#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include "ir.h"

#define BUF_SIZE 32768

typedef struct {
    char *buf;
    int pos;
    int cap;
    int temp_count;
} IRBuffer;

static void ir_init(IRBuffer *b) {
    b->cap = BUF_SIZE;
    b->buf = (char *)malloc(b->cap);
    b->pos = 0;
    b->buf[0] = '\0';
    b->temp_count = 0;
}

static void ir_append(IRBuffer *b, const char *s) {
    int len = strlen(s);
    while (b->pos + len + 1 > b->cap) {
        b->cap *= 2;
        b->buf = (char *)realloc(b->buf, b->cap);
    }
    memcpy(b->buf + b->pos, s, len);
    b->pos += len;
    b->buf[b->pos] = '\0';
}

static void ir_printf(IRBuffer *b, const char *fmt, ...) {
    char tmp[1024];
    va_list args;
    va_start(args, fmt);
    vsnprintf(tmp, sizeof(tmp), fmt, args);
    va_end(args);
    ir_append(b, tmp);
}

static int ir_new_temp(IRBuffer *b) {
    return b->temp_count++;
}

static int ir_expr(IRBuffer *b, ASTNode *e) {
    int t = ir_new_temp(b);
    switch (e->type) {
        case NODE_INT_LIT:
            ir_printf(b, "  t%d = %d\n", t, e->data.int_val);
            break;
        case NODE_FLOAT_LIT:
            ir_printf(b, "  t%d = %.6g\n", t, e->data.float_val);
            break;
        case NODE_STRING_LIT:
            ir_printf(b, "  t%d = \"%s\"\n", t, e->data.string_val);
            break;
        case NODE_BOOL_LIT:
            ir_printf(b, "  t%d = %s\n", t, e->data.bool_val ? "true" : "false");
            break;
        case NODE_VAR_REF:
            ir_printf(b, "  t%d = %s\n", t, e->data.var_name);
            break;
        case NODE_BINARY_EXPR: {
            int l = ir_expr(b, e->data.binary.left);
            int r = ir_expr(b, e->data.binary.right);
            ir_printf(b, "  t%d = t%d %s t%d\n", t, l, binop_to_string(e->data.binary.op), r);
            break;
        }
        default:
            ir_printf(b, "  t%d = <error>\n", t);
            break;
    }
    return t;
}

static void ir_stmt(IRBuffer *b, ASTNode *s);

static void ir_stmts(IRBuffer *b, NodeList *list) {
    while (list) { ir_stmt(b, list->node); list = list->next; }
}

static int label_count = 0;

static void ir_stmt(IRBuffer *b, ASTNode *s) {
    if (!s) return;
    switch (s->type) {
        case NODE_VAR_DECL: {
            ir_printf(b, "  decl %s %s\n", datatype_to_string(s->data.var_decl.var_type), s->data.var_decl.name);
            int t = ir_expr(b, s->data.var_decl.init);
            ir_printf(b, "  %s = t%d\n", s->data.var_decl.name, t);
            break;
        }
        case NODE_ASSIGN: {
            int t = ir_expr(b, s->data.assign.value);
            ir_printf(b, "  %s = t%d\n", s->data.assign.name, t);
            break;
        }
        case NODE_PRINT: {
            int t = ir_expr(b, s->data.print_stmt.expr);
            ir_printf(b, "  print(t%d) [%s]\n", t, datatype_to_string(s->data.print_stmt.expr->data_type));
            break;
        }
        case NODE_IF: {
            int lbl_else = label_count++;
            int lbl_end = label_count++;
            int t = ir_expr(b, s->data.if_stmt.cond);
            ir_printf(b, "  if_false t%d goto L%d\n", t, lbl_else);
            if (s->data.if_stmt.then_block) {
                if (s->data.if_stmt.then_block->type == NODE_BLOCK)
                    ir_stmts(b, s->data.if_stmt.then_block->data.block.stmts);
                else ir_stmt(b, s->data.if_stmt.then_block);
            }
            ir_printf(b, "  goto L%d\n", lbl_end);
            ir_printf(b, "L%d:\n", lbl_else);
            if (s->data.if_stmt.else_block) {
                if (s->data.if_stmt.else_block->type == NODE_BLOCK)
                    ir_stmts(b, s->data.if_stmt.else_block->data.block.stmts);
                else ir_stmt(b, s->data.if_stmt.else_block);
            }
            ir_printf(b, "L%d:\n", lbl_end);
            break;
        }
        case NODE_WHILE: {
            int lbl_start = label_count++;
            int lbl_end = label_count++;
            ir_printf(b, "L%d:\n", lbl_start);
            int t = ir_expr(b, s->data.while_stmt.cond);
            ir_printf(b, "  if_false t%d goto L%d\n", t, lbl_end);
            if (s->data.while_stmt.body) {
                if (s->data.while_stmt.body->type == NODE_BLOCK)
                    ir_stmts(b, s->data.while_stmt.body->data.block.stmts);
                else ir_stmt(b, s->data.while_stmt.body);
            }
            ir_printf(b, "  goto L%d\n", lbl_start);
            ir_printf(b, "L%d:\n", lbl_end);
            break;
        }
        case NODE_BLOCK:
            ir_stmts(b, s->data.block.stmts);
            break;
        default: break;
    }
}

char *generate_ir(ASTNode *ast) {
    IRBuffer b;
    ir_init(&b);
    label_count = 0;
    if (ast && ast->type == NODE_PROGRAM)
        ir_stmts(&b, ast->data.program.stmts);
    return b.buf;
}
