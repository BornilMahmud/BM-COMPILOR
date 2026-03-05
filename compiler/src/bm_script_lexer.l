%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "ast.h"
#include "parser.h"

int yycolumn = 1;

#define YY_USER_ACTION \
    yylloc.first_line = yylineno; \
    yylloc.first_column = yycolumn; \
    yylloc.last_line = yylineno; \
    yylloc.last_column = yycolumn + yyleng - 1; \
    yycolumn += yyleng;

static char *unescape_string(const char *s) {
    int len = strlen(s);
    char *result = (char *)malloc(len + 1);
    int j = 0;
    for (int i = 1; i < len - 1; i++) {
        if (s[i] == '\\' && i + 1 < len - 1) {
            i++;
            switch (s[i]) {
                case 'n': result[j++] = '\n'; break;
                case 't': result[j++] = '\t'; break;
                case '\\': result[j++] = '\\'; break;
                case '"': result[j++] = '"'; break;
                default: result[j++] = '\\'; result[j++] = s[i]; break;
            }
        } else {
            result[j++] = s[i];
        }
    }
    result[j] = '\0';
    return result;
}
%}

%option noyywrap
%option yylineno

%%

[ \t]+          { }
\n              { yycolumn = 1; }
"//".*          { }

"LANG"          { return T_LANG; }
"FILE"          { return T_FILE; }
"RUN"           { return T_RUN; }
"STDIN"         { return T_STDIN; }
";"             { return T_SEMI; }

\"([^\"\\]|\\.)*\"  { yylval.sval = unescape_string(yytext); return T_STRING; }

[a-zA-Z_][a-zA-Z0-9_+]*  { yylval.sval = strdup(yytext); return T_IDENT; }

.               { fprintf(stderr, "Lexer error at line %d col %d: unexpected '%s'\n", yylineno, yycolumn - yyleng, yytext); }

%%
