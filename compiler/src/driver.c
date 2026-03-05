#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "ast.h"
#include "runner.h"
#include "util.h"

extern BMJob parsed_job;
extern int parse_had_error;
extern char parse_error_msg[];
extern int yyparse(void);
extern FILE *yyin;
extern int yylineno;
extern int yycolumn;

typedef struct yy_buffer_state *YY_BUFFER_STATE;
extern YY_BUFFER_STATE yy_scan_string(const char *);
extern void yy_delete_buffer(YY_BUFFER_STATE);

static void print_usage(void) {
    fprintf(stderr, "Usage: bmcc --lang <c|cpp|java|py> --file <path> [--run] [--stdin-text <text>] [--json]\n");
}

static void output_json(int ok, int exit_code, const char *out, const char *err, const char *phase) {
    char esc_out[RUN_BUF_SIZE * 2];
    char esc_err[RUN_BUF_SIZE * 2];
    json_escape(esc_out, out ? out : "", sizeof(esc_out));
    json_escape(esc_err, err ? err : "", sizeof(esc_err));
    printf("{\"ok\":%s,\"exit_code\":%d,\"stdout\":\"%s\",\"stderr\":\"%s\",\"phase\":\"%s\"}\n",
           ok ? "true" : "false", exit_code, esc_out, esc_err, phase);
}

int driver_main(int argc, char **argv) {
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
            print_usage();
            return 0;
        }
    }

    if (!lang || !file) {
        if (do_json) {
            output_json(0, 1, "", "Missing --lang or --file argument", "setup");
        } else {
            print_usage();
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

int main(int argc, char **argv) {
    return driver_main(argc, argv);
}
