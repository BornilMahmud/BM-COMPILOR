%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "ast.h"

extern int yylex(void);
extern int yylineno;
extern int yycolumn;
extern FILE *yyin;

void yyerror(const char *s);

BMJob parsed_job;
int parse_had_error = 0;
char parse_error_msg[512];

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
