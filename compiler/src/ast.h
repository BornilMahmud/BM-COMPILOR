#ifndef AST_H
#define AST_H

#define MAX_STR 4096

typedef struct {
    char lang[16];
    char filename[256];
    char stdin_text[MAX_STR];
    int has_lang;
    int has_file;
    int has_run;
    int has_stdin;
} BMJob;

void bm_job_init(BMJob *job);

#endif
