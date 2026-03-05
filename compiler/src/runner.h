#ifndef RUNNER_H
#define RUNNER_H

#include "ast.h"

#define RUN_BUF_SIZE 65536

typedef struct {
    int ok;
    int exit_code;
    char stdout_buf[RUN_BUF_SIZE];
    char stderr_buf[RUN_BUF_SIZE];
    char phase[32];
} RunResult;

void run_job(const BMJob *job, const char *source_file, RunResult *result);

#endif
