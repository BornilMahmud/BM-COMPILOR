%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "ast.h"
#include "parser.tab.h"

int yycolumn = 1;

extern void add_lexer_error(int line, int col, const char *text);

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

[ \t]+          { /* skip whitespace */ }
\n              { yycolumn = 1; }
"//".*          { /* line comment */ }
"/*"([^*]|\*+[^*/])*\*+"/"  { 
    for (int i = 0; yytext[i]; i++) {
        if (yytext[i] == '\n') yycolumn = 1;
    }
}

"int"           { return T_INT; }
"float"         { return T_FLOAT; }
"bool"          { return T_BOOL; }
"string"        { return T_STRING; }
"if"            { return T_IF; }
"else"          { return T_ELSE; }
"while"         { return T_WHILE; }
"print"         { return T_PRINT; }
"true"          { yylval.ival = 1; return T_TRUE; }
"false"         { yylval.ival = 0; return T_FALSE; }

[0-9]+\.[0-9]+  { yylval.fval = atof(yytext); return T_FLOAT_LIT; }
[0-9]+          { yylval.ival = atoi(yytext); return T_INT_LIT; }
\"([^\"\\]|\\.)*\"  { yylval.sval = unescape_string(yytext); return T_STRING_LIT; }

[a-zA-Z_][a-zA-Z0-9_]*  { yylval.sval = strdup(yytext); return T_IDENT; }

"=="            { return T_EQ; }
"!="            { return T_NEQ; }
"<="            { return T_LE; }
">="            { return T_GE; }
"&&"            { return T_AND; }
"||"            { return T_OR; }
"<"             { return '<'; }
">"             { return '>'; }
"+"             { return '+'; }
"-"             { return '-'; }
"*"             { return '*'; }
"/"             { return '/'; }
"="             { return '='; }
"("             { return '('; }
")"             { return ')'; }
"{"             { return '{'; }
"}"             { return '}'; }
";"             { return ';'; }

.               { add_lexer_error(yylineno, yycolumn - yyleng, yytext); }

%%
