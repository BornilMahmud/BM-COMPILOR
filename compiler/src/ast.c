#include <string.h>
#include "ast.h"

void bm_job_init(BMJob *job) {
    memset(job, 0, sizeof(BMJob));
    job->has_lang = 0;
    job->has_file = 0;
    job->has_run = 0;
    job->has_stdin = 0;
}
