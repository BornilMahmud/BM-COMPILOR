#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <signal.h>
#include <errno.h>
#include <fcntl.h>
#include "runner.h"

#define TIMEOUT_SEC 5

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

void run_job(const BMJob *job, const char *source_file, RunResult *result) {
    memset(result, 0, sizeof(RunResult));
    result->ok = 0;
    result->exit_code = 1;

    char dir[512];
    get_dir(source_file, dir, sizeof(dir));

    if (strcmp(job->lang, "c") == 0) {
        char outfile[512];
        snprintf(outfile, sizeof(outfile), "%s/a.out", dir);

        strcpy(result->phase, "compile");
        char *compile_args[] = { "gcc", (char*)source_file, "-o", outfile, "-lm", NULL };
        int rc = exec_cmd(compile_args, NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        if (rc != 0) {
            result->exit_code = rc;
            return;
        }

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

    } else if (strcmp(job->lang, "cpp") == 0) {
        char outfile[512];
        snprintf(outfile, sizeof(outfile), "%s/a.out", dir);

        strcpy(result->phase, "compile");
        char *compile_args[] = { "g++", (char*)source_file, "-o", outfile, NULL };
        int rc = exec_cmd(compile_args, NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        if (rc != 0) {
            result->exit_code = rc;
            return;
        }

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

    } else if (strcmp(job->lang, "java") == 0) {
        strcpy(result->phase, "compile");
        char *compile_args[] = { "javac", (char*)source_file, NULL };
        int rc = exec_cmd(compile_args, NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        if (rc != 0) {
            result->exit_code = rc;
            return;
        }

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
        unlink(source_file);

    } else if (strcmp(job->lang, "py") == 0) {
        strcpy(result->phase, "run");
        char *run_args[] = { "python3", (char*)source_file, NULL };
        int rc = exec_cmd(run_args, job->has_stdin ? job->stdin_text : NULL,
                         result->stdout_buf, RUN_BUF_SIZE,
                         result->stderr_buf, RUN_BUF_SIZE);
        result->exit_code = rc;
        result->ok = (rc == 0) ? 1 : 0;

    } else {
        strcpy(result->phase, "setup");
        snprintf(result->stderr_buf, RUN_BUF_SIZE, "Unsupported language: %s", job->lang);
    }
}
