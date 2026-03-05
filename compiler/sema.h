#ifndef SEMA_H
#define SEMA_H

#include "ast.h"

#define MAX_SYMBOLS 256
#define MAX_SCOPES 32

typedef struct {
    char *name;
    DataType type;
    int scope_level;
} Symbol;

typedef struct {
    Symbol symbols[MAX_SYMBOLS];
    int count;
    int scope_level;
} SymbolTable;

typedef struct {
    int line;
    int col;
    char message[256];
} SemaError;

#define MAX_SEMA_ERRORS 100

typedef struct {
    SymbolTable symtab;
    SemaError errors[MAX_SEMA_ERRORS];
    int error_count;
} SemaContext;

void sema_init(SemaContext *ctx);
void sema_analyze(SemaContext *ctx, ASTNode *node);
DataType sema_expr_type(SemaContext *ctx, ASTNode *node);

#endif
