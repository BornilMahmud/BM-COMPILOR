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

ASTNode *parse_result = NULL;

#define MAX_ERRORS 100
typedef struct {
    int line;
    int col;
    char message[256];
    char phase[16];
} ParseError;

ParseError parse_errors[MAX_ERRORS];
int parse_error_count = 0;

static void add_parse_error(int line, int col, const char *msg) {
    if (parse_error_count < MAX_ERRORS) {
        parse_errors[parse_error_count].line = line;
        parse_errors[parse_error_count].col = col;
        strncpy(parse_errors[parse_error_count].message, msg, 255);
        parse_errors[parse_error_count].message[255] = '\0';
        strncpy(parse_errors[parse_error_count].phase, "parser", 15);
        parse_error_count++;
    }
}

void add_lexer_error(int line, int col, const char *text) {
    if (parse_error_count < MAX_ERRORS) {
        parse_errors[parse_error_count].line = line;
        parse_errors[parse_error_count].col = col;
        snprintf(parse_errors[parse_error_count].message, 256, "Unexpected character: %s", text);
        strncpy(parse_errors[parse_error_count].phase, "lexer", 15);
        parse_error_count++;
    }
}
%}

%locations

%union {
    int ival;
    double fval;
    char *sval;
    ASTNode *node;
    NodeList *list;
    DataType dtype;
    BinOp binop;
}

%token <ival> T_INT_LIT T_TRUE T_FALSE
%token <fval> T_FLOAT_LIT
%token <sval> T_STRING_LIT T_IDENT
%token T_INT T_FLOAT T_BOOL T_STRING
%token T_IF T_ELSE T_WHILE T_PRINT
%token T_EQ T_NEQ T_LE T_GE T_AND T_OR

%type <node> program stmt expr primary_expr unary_expr
%type <node> mul_expr add_expr rel_expr eq_expr and_expr or_expr
%type <node> block if_stmt while_stmt print_stmt var_decl assign_stmt
%type <list> stmt_list
%type <dtype> type_spec

%start program

%%

program
    : stmt_list { parse_result = make_program($1); }
    ;

stmt_list
    : stmt_list stmt { $$ = append_node_list($1, $2); }
    | stmt { $$ = make_node_list($1); }
    ;

stmt
    : var_decl { $$ = $1; }
    | assign_stmt { $$ = $1; }
    | print_stmt { $$ = $1; }
    | if_stmt { $$ = $1; }
    | while_stmt { $$ = $1; }
    | block { $$ = $1; }
    ;

type_spec
    : T_INT { $$ = TYPE_INT; }
    | T_FLOAT { $$ = TYPE_FLOAT; }
    | T_BOOL { $$ = TYPE_BOOL; }
    | T_STRING { $$ = TYPE_STRING; }
    ;

var_decl
    : type_spec T_IDENT '=' expr ';' {
        $$ = make_var_decl($1, $2, $4, @1.first_line, @1.first_column);
        free($2);
    }
    ;

assign_stmt
    : T_IDENT '=' expr ';' {
        $$ = make_assign($1, $3, @1.first_line, @1.first_column);
        free($1);
    }
    ;

print_stmt
    : T_PRINT '(' expr ')' ';' {
        $$ = make_print($3, @1.first_line, @1.first_column);
    }
    ;

if_stmt
    : T_IF '(' expr ')' block T_ELSE block {
        $$ = make_if($3, $5, $7, @1.first_line, @1.first_column);
    }
    | T_IF '(' expr ')' block {
        $$ = make_if($3, $5, NULL, @1.first_line, @1.first_column);
    }
    ;

while_stmt
    : T_WHILE '(' expr ')' block {
        $$ = make_while($3, $5, @1.first_line, @1.first_column);
    }
    ;

block
    : '{' stmt_list '}' { $$ = make_block($2, @1.first_line, @1.first_column); }
    | '{' '}' { $$ = make_block(NULL, @1.first_line, @1.first_column); }
    ;

expr
    : or_expr { $$ = $1; }
    ;

or_expr
    : or_expr T_OR and_expr {
        $$ = make_binary(OP_OR, $1, $3, @2.first_line, @2.first_column);
    }
    | and_expr { $$ = $1; }
    ;

and_expr
    : and_expr T_AND eq_expr {
        $$ = make_binary(OP_AND, $1, $3, @2.first_line, @2.first_column);
    }
    | eq_expr { $$ = $1; }
    ;

eq_expr
    : eq_expr T_EQ rel_expr {
        $$ = make_binary(OP_EQ, $1, $3, @2.first_line, @2.first_column);
    }
    | eq_expr T_NEQ rel_expr {
        $$ = make_binary(OP_NEQ, $1, $3, @2.first_line, @2.first_column);
    }
    | rel_expr { $$ = $1; }
    ;

rel_expr
    : rel_expr '<' add_expr {
        $$ = make_binary(OP_LT, $1, $3, @2.first_line, @2.first_column);
    }
    | rel_expr '>' add_expr {
        $$ = make_binary(OP_GT, $1, $3, @2.first_line, @2.first_column);
    }
    | rel_expr T_LE add_expr {
        $$ = make_binary(OP_LE, $1, $3, @2.first_line, @2.first_column);
    }
    | rel_expr T_GE add_expr {
        $$ = make_binary(OP_GE, $1, $3, @2.first_line, @2.first_column);
    }
    | add_expr { $$ = $1; }
    ;

add_expr
    : add_expr '+' mul_expr {
        $$ = make_binary(OP_ADD, $1, $3, @2.first_line, @2.first_column);
    }
    | add_expr '-' mul_expr {
        $$ = make_binary(OP_SUB, $1, $3, @2.first_line, @2.first_column);
    }
    | mul_expr { $$ = $1; }
    ;

mul_expr
    : mul_expr '*' unary_expr {
        $$ = make_binary(OP_MUL, $1, $3, @2.first_line, @2.first_column);
    }
    | mul_expr '/' unary_expr {
        $$ = make_binary(OP_DIV, $1, $3, @2.first_line, @2.first_column);
    }
    | unary_expr { $$ = $1; }
    ;

unary_expr
    : '-' primary_expr {
        $$ = make_binary(OP_SUB, make_int_lit(0, @1.first_line, @1.first_column), $2, @1.first_line, @1.first_column);
    }
    | primary_expr { $$ = $1; }
    ;

primary_expr
    : T_INT_LIT { $$ = make_int_lit($1, @1.first_line, @1.first_column); }
    | T_FLOAT_LIT { $$ = make_float_lit($1, @1.first_line, @1.first_column); }
    | T_STRING_LIT { $$ = make_string_lit($1, @1.first_line, @1.first_column); free($1); }
    | T_TRUE { $$ = make_bool_lit(1, @1.first_line, @1.first_column); }
    | T_FALSE { $$ = make_bool_lit(0, @1.first_line, @1.first_column); }
    | T_IDENT { $$ = make_var_ref($1, @1.first_line, @1.first_column); free($1); }
    | '(' expr ')' { $$ = $2; }
    ;

%%

void yyerror(const char *s) {
    add_parse_error(yylloc.first_line, yylloc.first_column, s);
}
