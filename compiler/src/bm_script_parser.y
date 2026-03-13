%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <signal.h>
#include <errno.h>
#include <fcntl.h>

#define MAX_STR 4096
#define RUN_BUF_SIZE 65536
#define TIMEOUT_SEC 15

typedef struct {
    char lang[32];
    char filename[256];
    char stdin_text[MAX_STR];
    int has_lang;
    int has_file;
    int has_run;
    int has_stdin;
} BMJob;

typedef struct {
    int ok;
    int exit_code;
    char stdout_buf[RUN_BUF_SIZE];
    char stderr_buf[RUN_BUF_SIZE];
    char phase[32];
} RunResult;

extern int yylex(void);
extern int yylineno;
extern int yycolumn;
extern FILE *yyin;

typedef struct yy_buffer_state *YY_BUFFER_STATE;
extern YY_BUFFER_STATE yy_scan_string(const char *);
extern void yy_delete_buffer(YY_BUFFER_STATE);

void yyerror(const char *s);

static BMJob parsed_job;
static int parse_had_error = 0;
static char parse_error_msg[512];

static void bm_job_init(BMJob *job) {
    memset(job, 0, sizeof(BMJob));
}

static void json_escape(char *dest, const char *src, int max_len) {
    int j = 0;
    for (int i = 0; src[i] && j < max_len - 6; i++) {
        switch (src[i]) {
            case '"':  dest[j++] = '\\'; dest[j++] = '"'; break;
            case '\\': dest[j++] = '\\'; dest[j++] = '\\'; break;
            case '\n': dest[j++] = '\\'; dest[j++] = 'n'; break;
            case '\r': dest[j++] = '\\'; dest[j++] = 'r'; break;
            case '\t': dest[j++] = '\\'; dest[j++] = 't'; break;
            default:
                if ((unsigned char)src[i] < 0x20) {
                    j += snprintf(dest + j, max_len - j, "\\u%04x", (unsigned char)src[i]);
                } else {
                    dest[j++] = src[i];
                }
        }
    }
    dest[j] = '\0';
}

static void output_json(int ok, int exit_code, const char *out, const char *err, const char *phase) {
    char esc_out[RUN_BUF_SIZE * 2];
    char esc_err[RUN_BUF_SIZE * 2];
    json_escape(esc_out, out ? out : "", sizeof(esc_out));
    json_escape(esc_err, err ? err : "", sizeof(esc_err));
    printf("{\"ok\":%s,\"exit_code\":%d,\"stdout\":\"%s\",\"stderr\":\"%s\",\"phase\":\"%s\"}\n",
           ok ? "true" : "false", exit_code, esc_out, esc_err, phase);
}

static int exec_cmd(char *const argv[], const char *stdin_text,
                    char *out_buf, int out_max,
                    char *err_buf, int err_max) {
    int stdout_pipe[2], stderr_pipe[2], stdin_pipe[2];
    if (pipe(stdout_pipe) < 0 || pipe(stderr_pipe) < 0 || pipe(stdin_pipe) < 0)
        return -1;

    pid_t pid = fork();
    if (pid < 0) return -1;

    if (pid == 0) {
        close(stdout_pipe[0]);
        close(stderr_pipe[0]);
        close(stdin_pipe[1]);

        dup2(stdin_pipe[0], STDIN_FILENO);
        dup2(stdout_pipe[1], STDOUT_FILENO);
        dup2(stderr_pipe[1], STDERR_FILENO);

        close(stdin_pipe[0]);
        close(stdout_pipe[1]);
        close(stderr_pipe[1]);

        alarm(TIMEOUT_SEC);
        execvp(argv[0], argv);
        _exit(127);
    }

    close(stdout_pipe[1]);
    close(stderr_pipe[1]);
    close(stdin_pipe[0]);

    if (stdin_text && strlen(stdin_text) > 0) {
        write(stdin_pipe[1], stdin_text, strlen(stdin_text));
    }
    close(stdin_pipe[1]);

    int out_len = 0, err_len = 0;
    fd_set fds;
    int maxfd = (stdout_pipe[0] > stderr_pipe[0] ? stdout_pipe[0] : stderr_pipe[0]) + 1;
    int stdout_open = 1, stderr_open = 1;

    while (stdout_open || stderr_open) {
        FD_ZERO(&fds);
        if (stdout_open) FD_SET(stdout_pipe[0], &fds);
        if (stderr_open) FD_SET(stderr_pipe[0], &fds);

        struct timeval tv = { TIMEOUT_SEC + 1, 0 };
        int ret = select(maxfd, &fds, NULL, NULL, &tv);
        if (ret <= 0) break;

        if (stdout_open && FD_ISSET(stdout_pipe[0], &fds)) {
            int n = read(stdout_pipe[0], out_buf + out_len, out_max - out_len - 1);
            if (n <= 0) stdout_open = 0;
            else out_len += n;
        }
        if (stderr_open && FD_ISSET(stderr_pipe[0], &fds)) {
            int n = read(stderr_pipe[0], err_buf + err_len, err_max - err_len - 1);
            if (n <= 0) stderr_open = 0;
            else err_len += n;
        }
    }

    out_buf[out_len] = '\0';
    err_buf[err_len] = '\0';

    close(stdout_pipe[0]);
    close(stderr_pipe[0]);

    int status = 0;
    waitpid(pid, &status, 0);

    if (WIFEXITED(status)) return WEXITSTATUS(status);
    if (WIFSIGNALED(status)) {
        if (WTERMSIG(status) == SIGALRM || WTERMSIG(status) == SIGKILL) {
            strncat(err_buf, "\nProcess killed: timeout exceeded\n", err_max - err_len - 1);
            return 124;
        }
        return 128 + WTERMSIG(status);
    }
    return 1;
}

static void get_dir(const char *path, char *dir, int max) {
    strncpy(dir, path, max - 1);
    dir[max - 1] = '\0';
    char *last_slash = strrchr(dir, '/');
    if (last_slash) *last_slash = '\0';
    else strcpy(dir, ".");
}

/* Write a helper script to a temp file, returns 0 on success */
static int write_script(const char *path, const char *content) {
    FILE *f = fopen(path, "w");
    if (!f) return -1;
    fputs(content, f);
    fclose(f);
    return 0;
}

static void run_job(const BMJob *job, const char *source_file, RunResult *result) {
    memset(result, 0, sizeof(RunResult));
    result->ok = 0;
    result->exit_code = 1;

    char dir[512];
    get_dir(source_file, dir, sizeof(dir));

    /* ── C ─────────────────────────────────────────────── */
    if (strcmp(job->lang, "c") == 0) {
        char outfile[512];
        snprintf(outfile, sizeof(outfile), "%s/a.out", dir);

        strcpy(result->phase, "compile");
        char *compile_args[] = { "gcc", (char*)source_file, "-o", outfile, "-lm", NULL };
        int rc = exec_cmd(compile_args, NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        if (rc != 0) { result->exit_code = rc; return; }

        strcpy(result->phase, "run");
        result->stdout_buf[0] = '\0';
        result->stderr_buf[0] = '\0';
        char *run_args[] = { outfile, NULL };
        rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                     result->stdout_buf, RUN_BUF_SIZE,
                     result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;
        unlink(outfile);

    /* ── C++ ────────────────────────────────────────────── */
    } else if (strcmp(job->lang, "cpp") == 0) {
        char outfile[512];
        snprintf(outfile, sizeof(outfile), "%s/a.out", dir);

        strcpy(result->phase, "compile");
        char *compile_args[] = { "g++", (char*)source_file, "-o", outfile, NULL };
        int rc = exec_cmd(compile_args, NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        if (rc != 0) { result->exit_code = rc; return; }

        strcpy(result->phase, "run");
        result->stdout_buf[0] = '\0';
        result->stderr_buf[0] = '\0';
        char *run_args[] = { outfile, NULL };
        rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                     result->stdout_buf, RUN_BUF_SIZE,
                     result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;
        unlink(outfile);

    /* ── Java ───────────────────────────────────────────── */
    } else if (strcmp(job->lang, "java") == 0) {
        strcpy(result->phase, "compile");
        char *compile_args[] = { "javac", (char*)source_file, NULL };
        int rc = exec_cmd(compile_args, NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        if (rc != 0) { result->exit_code = rc; return; }

        strcpy(result->phase, "run");
        result->stdout_buf[0] = '\0';
        result->stderr_buf[0] = '\0';

        char classname[256];
        const char *base = strrchr(job->filename, '/');
        base = base ? base + 1 : job->filename;
        strncpy(classname, base, sizeof(classname) - 1);
        classname[sizeof(classname) - 1] = '\0';
        char *dot = strrchr(classname, '.');
        if (dot) *dot = '\0';

        char *run_args[] = { "java", "-cp", dir, classname, NULL };
        rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                     result->stdout_buf, RUN_BUF_SIZE,
                     result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

        char classfile[512];
        snprintf(classfile, sizeof(classfile), "%s/%s.class", dir, classname);
        unlink(classfile);

    /* ── Python ─────────────────────────────────────────── */
    } else if (strcmp(job->lang, "py") == 0) {
        strcpy(result->phase, "run");
        char *run_args[] = { "python3", (char*)source_file, NULL };
        int rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

    /* ── JavaScript ─────────────────────────────────────── */
    } else if (strcmp(job->lang, "js") == 0) {
        strcpy(result->phase, "run");
        char *run_args[] = { "node", (char*)source_file, NULL };
        int rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

    /* ── TypeScript ─────────────────────────────────────── */
    } else if (strcmp(job->lang, "ts") == 0) {
        strcpy(result->phase, "run");
        char *run_args[] = { "npx", "tsx", (char*)source_file, NULL };
        int rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

    /* ── PHP ────────────────────────────────────────────── */
    } else if (strcmp(job->lang, "php") == 0) {
        strcpy(result->phase, "run");
        char *run_args[] = { "php", (char*)source_file, NULL };
        int rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

    /* ── Ruby ───────────────────────────────────────────── */
    } else if (strcmp(job->lang, "rb") == 0) {
        strcpy(result->phase, "run");
        char *run_args[] = { "ruby", (char*)source_file, NULL };
        int rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

    /* ── Go ─────────────────────────────────────────────── */
    } else if (strcmp(job->lang, "go") == 0) {
        strcpy(result->phase, "run");
        char *run_args[] = { "go", "run", (char*)source_file, NULL };
        int rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

    /* ── Rust ───────────────────────────────────────────── */
    } else if (strcmp(job->lang, "rs") == 0) {
        char outfile[512];
        snprintf(outfile, sizeof(outfile), "%s/rust_out", dir);

        strcpy(result->phase, "compile");
        char *compile_args[] = { "rustc", (char*)source_file, "-o", outfile, NULL };
        int rc = exec_cmd(compile_args, NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        if (rc != 0) { result->exit_code = rc; return; }

        strcpy(result->phase, "run");
        result->stdout_buf[0] = '\0';
        result->stderr_buf[0] = '\0';
        char *run_args[] = { outfile, NULL };
        rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                     result->stdout_buf, RUN_BUF_SIZE,
                     result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;
        unlink(outfile);

    /* ── Dart ───────────────────────────────────────────── */
    } else if (strcmp(job->lang, "dart") == 0) {
        strcpy(result->phase, "run");
        char *run_args[] = { "dart", "run", (char*)source_file, NULL };
        int rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

    /* ── HTML ───────────────────────────────────────────── */
    } else if (strcmp(job->lang, "html") == 0) {
        strcpy(result->phase, "run");
        char script_path[512];
        snprintf(script_path, sizeof(script_path), "%s/_html_runner.js", dir);
        const char *html_script =
            "const fs=require('fs');\n"
            "const file=process.argv[2];\n"
            "const html=fs.readFileSync(file,'utf8');\n"
            "const lines=html.split('\\n').length;\n"
            "const tags=(html.match(/<[a-zA-Z][^>]*>/g)||[]).length;\n"
            "const text=html\n"
            "  .replace(/<style[\\s\\S]*?<\\/style>/gi,'')\n"
            "  .replace(/<script[\\s\\S]*?<\\/script>/gi,'')\n"
            "  .replace(/<[^>]+>/g,'')\n"
            "  .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')\n"
            "  .replace(/&nbsp;/g,' ').replace(/\\s+/g,' ').trim();\n"
            "console.log('=== BM Compiler: HTML Runner ===');\n"
            "console.log('File   : '+file);\n"
            "console.log('Lines  : '+lines);\n"
            "console.log('Tags   : '+tags);\n"
            "console.log('---');\n"
            "if(text) console.log('Text content:\\n'+text);\n"
            "else console.log('(no visible text content)');\n"
            "console.log('\\n[Open in a web browser to see the rendered page]');\n";
        if (write_script(script_path, html_script) != 0) {
            strcpy(result->stderr_buf, "Failed to create HTML runner");
            return;
        }
        char *run_args[] = { "node", script_path, (char*)source_file, NULL };
        int rc = exec_cmd(run_args, NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;
        unlink(script_path);

    /* ── CSS ────────────────────────────────────────────── */
    } else if (strcmp(job->lang, "css") == 0) {
        strcpy(result->phase, "run");
        char script_path[512];
        snprintf(script_path, sizeof(script_path), "%s/_css_runner.js", dir);
        const char *css_script =
            "const fs=require('fs');\n"
            "const file=process.argv[2];\n"
            "const css=fs.readFileSync(file,'utf8');\n"
            "const rules=(css.match(/[^{}]+\\{[^}]*\\}/g)||[]).length;\n"
            "const props=(css.match(/[a-z-]+\\s*:/g)||[]).length;\n"
            "const selectors=(css.match(/[^{}]+(?=\\{)/g)||[]).map(s=>s.trim()).filter(Boolean);\n"
            "console.log('=== BM Compiler: CSS Runner ===');\n"
            "console.log('File      : '+file);\n"
            "console.log('Rules     : '+rules);\n"
            "console.log('Properties: '+props);\n"
            "console.log('Selectors : '+selectors.slice(0,10).join(', ')+(selectors.length>10?'...':''));\n"
            "console.log('---');\n"
            "console.log('CSS Source:');\n"
            "console.log(css);\n"
            "console.log('[Link this CSS file in an HTML file to apply styles]');\n";
        if (write_script(script_path, css_script) != 0) {
            strcpy(result->stderr_buf, "Failed to create CSS runner");
            return;
        }
        char *run_args[] = { "node", script_path, (char*)source_file, NULL };
        int rc = exec_cmd(run_args, NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;
        unlink(script_path);

    /* ── SQL (SQLite — MySQL/OracleSQL compatible subset) ── */
    } else if (strcmp(job->lang, "sql") == 0 || strcmp(job->lang, "mysql") == 0 || strcmp(job->lang, "ora") == 0) {
        strcpy(result->phase, "run");
        /* Read SQL file and pipe to sqlite3 :memory: */
        char *run_args[] = { "sqlite3", ":memory:", NULL };
        FILE *f = fopen(source_file, "r");
        char sql_buf[MAX_STR] = {0};
        if (f) {
            fread(sql_buf, 1, sizeof(sql_buf) - 1, f);
            fclose(f);
        }
        int rc = exec_cmd(run_args, sql_buf,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

    /* ── Bash / Shell ───────────────────────────────────── */
    } else if (strcmp(job->lang, "sh") == 0 || strcmp(job->lang, "bash") == 0) {
        strcpy(result->phase, "run");
        char *run_args[] = { "bash", (char*)source_file, NULL };
        int rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

    } else {
        strcpy(result->phase, "setup");
        snprintf(result->stderr_buf, RUN_BUF_SIZE,
                 "Unsupported language: '%s'\nSupported: c, cpp, java, py, js, ts, php, rb, go, rs, dart, html, css, sql, mysql, ora, sh",
                 job->lang);
    }
}

%}

%locations

%union {
    char *sval;
}

%token <sval> T_STRING T_IDENT
%token T_LANG T_FILE T_RUN T_STDIN T_SEMI

%start script

%%

script
    : stmts { }
    ;

stmts
    : stmts stmt
    | stmt
    ;

stmt
    : T_LANG T_IDENT T_SEMI {
        strncpy(parsed_job.lang, $2, sizeof(parsed_job.lang) - 1);
        parsed_job.has_lang = 1;
        free($2);
    }
    | T_LANG T_STRING T_SEMI {
        strncpy(parsed_job.lang, $2, sizeof(parsed_job.lang) - 1);
        parsed_job.has_lang = 1;
        free($2);
    }
    | T_FILE T_STRING T_SEMI {
        strncpy(parsed_job.filename, $2, sizeof(parsed_job.filename) - 1);
        parsed_job.has_file = 1;
        free($2);
    }
    | T_STDIN T_STRING T_SEMI {
        strncpy(parsed_job.stdin_text, $2, sizeof(parsed_job.stdin_text) - 1);
        parsed_job.has_stdin = 1;
        free($2);
    }
    | T_RUN T_SEMI {
        parsed_job.has_run = 1;
    }
    ;

%%

void yyerror(const char *s) {
    parse_had_error = 1;
    snprintf(parse_error_msg, sizeof(parse_error_msg),
             "BM Script parse error at line %d col %d: %s",
             yylloc.first_line, yylloc.first_column, s);
}

int main(int argc, char **argv) {
    char *lang = NULL;
    char *file = NULL;
    char *stdin_text = NULL;
    int do_run = 0;
    int do_json = 0;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--lang") == 0 && i + 1 < argc) {
            lang = argv[++i];
        } else if (strcmp(argv[i], "--file") == 0 && i + 1 < argc) {
            file = argv[++i];
        } else if (strcmp(argv[i], "--stdin-text") == 0 && i + 1 < argc) {
            stdin_text = argv[++i];
        } else if (strcmp(argv[i], "--run") == 0) {
            do_run = 1;
        } else if (strcmp(argv[i], "--json") == 0) {
            do_json = 1;
        } else if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
            fprintf(stderr, "Usage: bmcc --lang <lang> --file <path> [--run] [--stdin-text <text>] [--json]\n");
            fprintf(stderr, "Languages: c, cpp, java, py, js, ts, php, rb, go, rs, dart, html, css, sql, mysql, ora, sh\n");
            return 0;
        }
    }

    if (!lang || !file) {
        if (do_json) {
            output_json(0, 1, "", "Missing --lang or --file argument", "setup");
        } else {
            fprintf(stderr, "Usage: bmcc --lang <lang> --file <path> [--run] [--stdin-text <text>] [--json]\n");
        }
        return 1;
    }

    char bm_script[MAX_STR];
    int pos = 0;
    pos += snprintf(bm_script + pos, sizeof(bm_script) - pos, "LANG %s;\n", lang);
    pos += snprintf(bm_script + pos, sizeof(bm_script) - pos, "FILE \"%s\";\n", file);
    if (stdin_text) {
        pos += snprintf(bm_script + pos, sizeof(bm_script) - pos, "STDIN \"%s\";\n", stdin_text);
    }
    if (do_run) {
        pos += snprintf(bm_script + pos, sizeof(bm_script) - pos, "RUN;\n");
    }

    bm_job_init(&parsed_job);
    parse_had_error = 0;
    parse_error_msg[0] = '\0';
    yylineno = 1;
    yycolumn = 1;

    YY_BUFFER_STATE buf = yy_scan_string(bm_script);
    int parse_status = yyparse();
    yy_delete_buffer(buf);

    if (parse_status != 0 || parse_had_error) {
        if (do_json) {
            output_json(0, 1, "", parse_error_msg[0] ? parse_error_msg : "BM Script parse error", "bm_script_parse");
        } else {
            fprintf(stderr, "Parse error: %s\n", parse_error_msg);
        }
        return 1;
    }

    if (!parsed_job.has_lang) {
        if (do_json) output_json(0, 1, "", "No LANG specified in BM Script", "bm_script_parse");
        else fprintf(stderr, "No LANG specified\n");
        return 1;
    }
    if (!parsed_job.has_file) {
        if (do_json) output_json(0, 1, "", "No FILE specified in BM Script", "bm_script_parse");
        else fprintf(stderr, "No FILE specified\n");
        return 1;
    }

    if (access(parsed_job.filename, F_OK) != 0) {
        char err_msg[512];
        snprintf(err_msg, sizeof(err_msg), "Source file not found: %s", parsed_job.filename);
        if (do_json) output_json(0, 1, "", err_msg, "setup");
        else fprintf(stderr, "%s\n", err_msg);
        return 1;
    }

    if (parsed_job.has_run) {
        RunResult result;
        run_job(&parsed_job, parsed_job.filename, &result);

        if (do_json) {
            output_json(result.ok, result.exit_code, result.stdout_buf, result.stderr_buf, result.phase);
        } else {
            if (result.stdout_buf[0]) printf("%s", result.stdout_buf);
            if (result.stderr_buf[0]) fprintf(stderr, "%s", result.stderr_buf);
            return result.exit_code;
        }
    } else {
        if (do_json) {
            output_json(1, 0, "BM Script parsed successfully. No RUN directive.", "", "bm_script_parse");
        } else {
            printf("BM Script parsed OK. Job: lang=%s file=%s\n", parsed_job.lang, parsed_job.filename);
        }
    }

    return 0;
}
