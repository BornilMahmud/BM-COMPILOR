#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "sema.h"

void sema_init(SemaContext *ctx) {
    ctx->symtab.count = 0;
    ctx->symtab.scope_level = 0;
    ctx->error_count = 0;
}

static void sema_error(SemaContext *ctx, int line, int col, const char *msg) {
    if (ctx->error_count < MAX_SEMA_ERRORS) {
        ctx->errors[ctx->error_count].line = line;
        ctx->errors[ctx->error_count].col = col;
        strncpy(ctx->errors[ctx->error_count].message, msg, 255);
        ctx->errors[ctx->error_count].message[255] = '\0';
        ctx->error_count++;
    }
}

static void enter_scope(SemaContext *ctx) {
    ctx->symtab.scope_level++;
}

static void leave_scope(SemaContext *ctx) {
    int level = ctx->symtab.scope_level;
    while (ctx->symtab.count > 0 && ctx->symtab.symbols[ctx->symtab.count - 1].scope_level == level) {
        free(ctx->symtab.symbols[ctx->symtab.count - 1].name);
        ctx->symtab.count--;
    }
    ctx->symtab.scope_level--;
}

static Symbol *lookup(SemaContext *ctx, const char *name) {
    for (int i = ctx->symtab.count - 1; i >= 0; i--) {
        if (strcmp(ctx->symtab.symbols[i].name, name) == 0) {
            return &ctx->symtab.symbols[i];
        }
    }
    return NULL;
}

static void declare(SemaContext *ctx, const char *name, DataType type, int line, int col) {
    for (int i = ctx->symtab.count - 1; i >= 0; i--) {
        if (ctx->symtab.symbols[i].scope_level < ctx->symtab.scope_level) break;
        if (strcmp(ctx->symtab.symbols[i].name, name) == 0) {
            char buf[256];
            snprintf(buf, sizeof(buf), "Variable '%s' already declared in this scope", name);
            sema_error(ctx, line, col, buf);
            return;
        }
    }
    if (ctx->symtab.count >= MAX_SYMBOLS) {
        sema_error(ctx, line, col, "Too many variables");
        return;
    }
    ctx->symtab.symbols[ctx->symtab.count].name = strdup(name);
    ctx->symtab.symbols[ctx->symtab.count].type = type;
    ctx->symtab.symbols[ctx->symtab.count].scope_level = ctx->symtab.scope_level;
    ctx->symtab.count++;
}

DataType sema_expr_type(SemaContext *ctx, ASTNode *node) {
    if (!node) return TYPE_ERROR;

    switch (node->type) {
        case NODE_INT_LIT: node->data_type = TYPE_INT; return TYPE_INT;
        case NODE_FLOAT_LIT: node->data_type = TYPE_FLOAT; return TYPE_FLOAT;
        case NODE_STRING_LIT: node->data_type = TYPE_STRING; return TYPE_STRING;
        case NODE_BOOL_LIT: node->data_type = TYPE_BOOL; return TYPE_BOOL;
        case NODE_VAR_REF: {
            Symbol *sym = lookup(ctx, node->data.var_name);
            if (!sym) {
                char buf[256];
                snprintf(buf, sizeof(buf), "Undeclared variable '%s'", node->data.var_name);
                sema_error(ctx, node->line, node->col, buf);
                node->data_type = TYPE_ERROR;
                return TYPE_ERROR;
            }
            node->data_type = sym->type;
            return sym->type;
        }
        case NODE_BINARY_EXPR: {
            DataType lt = sema_expr_type(ctx, node->data.binary.left);
            DataType rt = sema_expr_type(ctx, node->data.binary.right);
            BinOp op = node->data.binary.op;

            if (lt == TYPE_ERROR || rt == TYPE_ERROR) {
                node->data_type = TYPE_ERROR;
                return TYPE_ERROR;
            }

            if (op == OP_ADD && lt == TYPE_STRING && rt == TYPE_STRING) {
                node->data_type = TYPE_STRING;
                return TYPE_STRING;
            }

            if (op >= OP_ADD && op <= OP_DIV) {
                if (lt == TYPE_STRING || rt == TYPE_STRING) {
                    sema_error(ctx, node->line, node->col, "Cannot use arithmetic operators on strings");
                    node->data_type = TYPE_ERROR;
                    return TYPE_ERROR;
                }
                if (lt == TYPE_FLOAT || rt == TYPE_FLOAT) {
                    node->data_type = TYPE_FLOAT;
                    return TYPE_FLOAT;
                }
                node->data_type = TYPE_INT;
                return TYPE_INT;
            }

            if (op >= OP_EQ && op <= OP_GE) {
                if (lt == TYPE_STRING || rt == TYPE_STRING) {
                    if (op != OP_EQ && op != OP_NEQ) {
                        sema_error(ctx, node->line, node->col, "Cannot compare strings with relational operators");
                        node->data_type = TYPE_ERROR;
                        return TYPE_ERROR;
                    }
                }
                node->data_type = TYPE_BOOL;
                return TYPE_BOOL;
            }

            if (op == OP_AND || op == OP_OR) {
                node->data_type = TYPE_BOOL;
                return TYPE_BOOL;
            }

            node->data_type = TYPE_ERROR;
            return TYPE_ERROR;
        }
        default:
            node->data_type = TYPE_ERROR;
            return TYPE_ERROR;
    }
}

static void sema_stmt(SemaContext *ctx, ASTNode *node);

static void sema_stmts(SemaContext *ctx, NodeList *list) {
    while (list) {
        sema_stmt(ctx, list->node);
        list = list->next;
    }
}

static void sema_stmt(SemaContext *ctx, ASTNode *node) {
    if (!node) return;

    switch (node->type) {
        case NODE_VAR_DECL: {
            DataType init_type = sema_expr_type(ctx, node->data.var_decl.init);
            DataType var_type = node->data.var_decl.var_type;
            if (init_type != TYPE_ERROR && init_type != var_type) {
                if (var_type == TYPE_FLOAT && init_type == TYPE_INT) {
                } else {
                    char buf[256];
                    snprintf(buf, sizeof(buf), "Type mismatch: cannot assign %s to %s variable '%s'",
                             datatype_to_string(init_type), datatype_to_string(var_type),
                             node->data.var_decl.name);
                    sema_error(ctx, node->line, node->col, buf);
                }
            }
            declare(ctx, node->data.var_decl.name, var_type, node->line, node->col);
            break;
        }
        case NODE_ASSIGN: {
            Symbol *sym = lookup(ctx, node->data.assign.name);
            if (!sym) {
                char buf[256];
                snprintf(buf, sizeof(buf), "Undeclared variable '%s'", node->data.assign.name);
                sema_error(ctx, node->line, node->col, buf);
            } else {
                DataType val_type = sema_expr_type(ctx, node->data.assign.value);
                if (val_type != TYPE_ERROR && val_type != sym->type) {
                    if (!(sym->type == TYPE_FLOAT && val_type == TYPE_INT)) {
                        char buf[256];
                        snprintf(buf, sizeof(buf), "Type mismatch: cannot assign %s to %s variable '%s'",
                                 datatype_to_string(val_type), datatype_to_string(sym->type),
                                 node->data.assign.name);
                        sema_error(ctx, node->line, node->col, buf);
                    }
                }
            }
            break;
        }
        case NODE_PRINT:
            sema_expr_type(ctx, node->data.print_stmt.expr);
            break;
        case NODE_IF:
            sema_expr_type(ctx, node->data.if_stmt.cond);
            sema_stmt(ctx, node->data.if_stmt.then_block);
            if (node->data.if_stmt.else_block)
                sema_stmt(ctx, node->data.if_stmt.else_block);
            break;
        case NODE_WHILE:
            sema_expr_type(ctx, node->data.while_stmt.cond);
            sema_stmt(ctx, node->data.while_stmt.body);
            break;
        case NODE_BLOCK:
            enter_scope(ctx);
            sema_stmts(ctx, node->data.block.stmts);
            leave_scope(ctx);
            break;
        default:
            break;
    }
}

void sema_analyze(SemaContext *ctx, ASTNode *node) {
    if (!node || node->type != NODE_PROGRAM) return;
    sema_stmts(ctx, node->data.program.stmts);
}
