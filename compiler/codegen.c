#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include "codegen.h"

#define BUF_SIZE 65536

typedef struct {
    char *buf;
    int pos;
    int cap;
} Buffer;

static void buf_init(Buffer *b) {
    b->cap = BUF_SIZE;
    b->buf = (char *)malloc(b->cap);
    b->pos = 0;
    b->buf[0] = '\0';
}

static void buf_append(Buffer *b, const char *s) {
    int len = strlen(s);
    while (b->pos + len + 1 > b->cap) {
        b->cap *= 2;
        b->buf = (char *)realloc(b->buf, b->cap);
    }
    memcpy(b->buf + b->pos, s, len);
    b->pos += len;
    b->buf[b->pos] = '\0';
}

static void buf_printf(Buffer *b, const char *fmt, ...) {
    char tmp[4096];
    va_list args;
    va_start(args, fmt);
    vsnprintf(tmp, sizeof(tmp), fmt, args);
    va_end(args);
    buf_append(b, tmp);
}

static void pad(Buffer *b, int indent) {
    for (int i = 0; i < indent; i++) buf_append(b, "    ");
}

static void escape_string(Buffer *b, const char *s) {
    buf_append(b, "\"");
    for (int i = 0; s[i]; i++) {
        switch (s[i]) {
            case '\\': buf_append(b, "\\\\"); break;
            case '"': buf_append(b, "\\\""); break;
            case '\n': buf_append(b, "\\n"); break;
            case '\t': buf_append(b, "\\t"); break;
            default: { char c[2] = {s[i], 0}; buf_append(b, c); }
        }
    }
    buf_append(b, "\"");
}

static const char *c_type(DataType t) {
    switch (t) {
        case TYPE_INT: return "int";
        case TYPE_FLOAT: return "double";
        case TYPE_BOOL: return "int";
        case TYPE_STRING: return "const char*";
        default: return "void";
    }
}

static void gen_expr_c(Buffer *b, ASTNode *e) {
    switch (e->type) {
        case NODE_INT_LIT: buf_printf(b, "%d", e->data.int_val); break;
        case NODE_FLOAT_LIT: buf_printf(b, "%.6g", e->data.float_val); break;
        case NODE_STRING_LIT: escape_string(b, e->data.string_val); break;
        case NODE_BOOL_LIT: buf_append(b, e->data.bool_val ? "1" : "0"); break;
        case NODE_VAR_REF: buf_append(b, e->data.var_name); break;
        case NODE_BINARY_EXPR:
            buf_append(b, "(");
            gen_expr_c(b, e->data.binary.left);
            buf_printf(b, " %s ", binop_to_string(e->data.binary.op));
            gen_expr_c(b, e->data.binary.right);
            buf_append(b, ")");
            break;
        default: buf_append(b, "/* error */"); break;
    }
}

static void gen_stmt_c(Buffer *b, ASTNode *s, int indent);

static void gen_stmts_c(Buffer *b, NodeList *list, int indent) {
    while (list) {
        gen_stmt_c(b, list->node, indent);
        list = list->next;
    }
}

static void gen_stmt_c(Buffer *b, ASTNode *s, int indent) {
    if (!s) return;
    switch (s->type) {
        case NODE_VAR_DECL:
            pad(b, indent);
            buf_printf(b, "%s %s = ", c_type(s->data.var_decl.var_type), s->data.var_decl.name);
            gen_expr_c(b, s->data.var_decl.init);
            buf_append(b, ";\n");
            break;
        case NODE_ASSIGN:
            pad(b, indent);
            buf_printf(b, "%s = ", s->data.assign.name);
            gen_expr_c(b, s->data.assign.value);
            buf_append(b, ";\n");
            break;
        case NODE_PRINT:
            pad(b, indent);
            if (s->data.print_stmt.expr->data_type == TYPE_INT)
                { buf_append(b, "printf(\"%d\\n\", "); gen_expr_c(b, s->data.print_stmt.expr); buf_append(b, ");\n"); }
            else if (s->data.print_stmt.expr->data_type == TYPE_FLOAT)
                { buf_append(b, "printf(\"%g\\n\", "); gen_expr_c(b, s->data.print_stmt.expr); buf_append(b, ");\n"); }
            else if (s->data.print_stmt.expr->data_type == TYPE_STRING)
                { buf_append(b, "printf(\"%s\\n\", "); gen_expr_c(b, s->data.print_stmt.expr); buf_append(b, ");\n"); }
            else if (s->data.print_stmt.expr->data_type == TYPE_BOOL)
                { buf_append(b, "printf(\"%s\\n\", "); gen_expr_c(b, s->data.print_stmt.expr); buf_append(b, " ? \"true\" : \"false\");\n"); }
            else
                { buf_append(b, "printf(\"%d\\n\", "); gen_expr_c(b, s->data.print_stmt.expr); buf_append(b, ");\n"); }
            break;
        case NODE_IF:
            pad(b, indent);
            buf_append(b, "if (");
            gen_expr_c(b, s->data.if_stmt.cond);
            buf_append(b, ") {\n");
            if (s->data.if_stmt.then_block && s->data.if_stmt.then_block->type == NODE_BLOCK)
                gen_stmts_c(b, s->data.if_stmt.then_block->data.block.stmts, indent + 1);
            else
                gen_stmt_c(b, s->data.if_stmt.then_block, indent + 1);
            pad(b, indent); buf_append(b, "}");
            if (s->data.if_stmt.else_block) {
                buf_append(b, " else {\n");
                if (s->data.if_stmt.else_block->type == NODE_BLOCK)
                    gen_stmts_c(b, s->data.if_stmt.else_block->data.block.stmts, indent + 1);
                else
                    gen_stmt_c(b, s->data.if_stmt.else_block, indent + 1);
                pad(b, indent); buf_append(b, "}");
            }
            buf_append(b, "\n");
            break;
        case NODE_WHILE:
            pad(b, indent);
            buf_append(b, "while (");
            gen_expr_c(b, s->data.while_stmt.cond);
            buf_append(b, ") {\n");
            if (s->data.while_stmt.body && s->data.while_stmt.body->type == NODE_BLOCK)
                gen_stmts_c(b, s->data.while_stmt.body->data.block.stmts, indent + 1);
            else
                gen_stmt_c(b, s->data.while_stmt.body, indent + 1);
            pad(b, indent); buf_append(b, "}\n");
            break;
        case NODE_BLOCK:
            pad(b, indent); buf_append(b, "{\n");
            gen_stmts_c(b, s->data.block.stmts, indent + 1);
            pad(b, indent); buf_append(b, "}\n");
            break;
        default: break;
    }
}

char *generate_c(ASTNode *ast) {
    Buffer b; buf_init(&b);
    buf_append(&b, "#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n");
    if (ast->type == NODE_PROGRAM)
        gen_stmts_c(&b, ast->data.program.stmts, 1);
    buf_append(&b, "    return 0;\n}\n");
    return b.buf;
}

static void gen_expr_cpp(Buffer *b, ASTNode *e) {
    switch (e->type) {
        case NODE_INT_LIT: buf_printf(b, "%d", e->data.int_val); break;
        case NODE_FLOAT_LIT: buf_printf(b, "%.6g", e->data.float_val); break;
        case NODE_STRING_LIT:
            buf_append(b, "std::string(");
            escape_string(b, e->data.string_val);
            buf_append(b, ")");
            break;
        case NODE_BOOL_LIT: buf_append(b, e->data.bool_val ? "true" : "false"); break;
        case NODE_VAR_REF: buf_append(b, e->data.var_name); break;
        case NODE_BINARY_EXPR:
            buf_append(b, "(");
            gen_expr_cpp(b, e->data.binary.left);
            buf_printf(b, " %s ", binop_to_string(e->data.binary.op));
            gen_expr_cpp(b, e->data.binary.right);
            buf_append(b, ")");
            break;
        default: buf_append(b, "/* error */"); break;
    }
}

static void gen_stmt_cpp(Buffer *b, ASTNode *s, int indent);

static void gen_stmts_cpp(Buffer *b, NodeList *list, int indent) {
    while (list) { gen_stmt_cpp(b, list->node, indent); list = list->next; }
}

static const char *cpp_type(DataType t) {
    switch (t) {
        case TYPE_INT: return "int";
        case TYPE_FLOAT: return "double";
        case TYPE_BOOL: return "bool";
        case TYPE_STRING: return "std::string";
        default: return "void";
    }
}

static void gen_stmt_cpp(Buffer *b, ASTNode *s, int indent) {
    if (!s) return;
    switch (s->type) {
        case NODE_VAR_DECL:
            pad(b, indent);
            buf_printf(b, "%s %s = ", cpp_type(s->data.var_decl.var_type), s->data.var_decl.name);
            gen_expr_cpp(b, s->data.var_decl.init);
            buf_append(b, ";\n");
            break;
        case NODE_ASSIGN:
            pad(b, indent);
            buf_printf(b, "%s = ", s->data.assign.name);
            gen_expr_cpp(b, s->data.assign.value);
            buf_append(b, ";\n");
            break;
        case NODE_PRINT:
            pad(b, indent);
            buf_append(b, "std::cout << ");
            gen_expr_cpp(b, s->data.print_stmt.expr);
            if (s->data.print_stmt.expr->data_type == TYPE_BOOL)
                buf_append(b, " ? \"true\" : \"false\"");
            buf_append(b, " << std::endl;\n");
            break;
        case NODE_IF:
            pad(b, indent);
            buf_append(b, "if (");
            gen_expr_cpp(b, s->data.if_stmt.cond);
            buf_append(b, ") {\n");
            if (s->data.if_stmt.then_block && s->data.if_stmt.then_block->type == NODE_BLOCK)
                gen_stmts_cpp(b, s->data.if_stmt.then_block->data.block.stmts, indent + 1);
            else gen_stmt_cpp(b, s->data.if_stmt.then_block, indent + 1);
            pad(b, indent); buf_append(b, "}");
            if (s->data.if_stmt.else_block) {
                buf_append(b, " else {\n");
                if (s->data.if_stmt.else_block->type == NODE_BLOCK)
                    gen_stmts_cpp(b, s->data.if_stmt.else_block->data.block.stmts, indent + 1);
                else gen_stmt_cpp(b, s->data.if_stmt.else_block, indent + 1);
                pad(b, indent); buf_append(b, "}");
            }
            buf_append(b, "\n");
            break;
        case NODE_WHILE:
            pad(b, indent);
            buf_append(b, "while (");
            gen_expr_cpp(b, s->data.while_stmt.cond);
            buf_append(b, ") {\n");
            if (s->data.while_stmt.body && s->data.while_stmt.body->type == NODE_BLOCK)
                gen_stmts_cpp(b, s->data.while_stmt.body->data.block.stmts, indent + 1);
            else gen_stmt_cpp(b, s->data.while_stmt.body, indent + 1);
            pad(b, indent); buf_append(b, "}\n");
            break;
        case NODE_BLOCK:
            pad(b, indent); buf_append(b, "{\n");
            gen_stmts_cpp(b, s->data.block.stmts, indent + 1);
            pad(b, indent); buf_append(b, "}\n");
            break;
        default: break;
    }
}

char *generate_cpp(ASTNode *ast) {
    Buffer b; buf_init(&b);
    buf_append(&b, "#include <iostream>\n#include <string>\n\nint main() {\n");
    if (ast->type == NODE_PROGRAM)
        gen_stmts_cpp(&b, ast->data.program.stmts, 1);
    buf_append(&b, "    return 0;\n}\n");
    return b.buf;
}

static void gen_expr_java(Buffer *b, ASTNode *e) {
    switch (e->type) {
        case NODE_INT_LIT: buf_printf(b, "%d", e->data.int_val); break;
        case NODE_FLOAT_LIT: buf_printf(b, "%.6g", e->data.float_val); break;
        case NODE_STRING_LIT: escape_string(b, e->data.string_val); break;
        case NODE_BOOL_LIT: buf_append(b, e->data.bool_val ? "true" : "false"); break;
        case NODE_VAR_REF: buf_append(b, e->data.var_name); break;
        case NODE_BINARY_EXPR:
            buf_append(b, "(");
            gen_expr_java(b, e->data.binary.left);
            buf_printf(b, " %s ", binop_to_string(e->data.binary.op));
            gen_expr_java(b, e->data.binary.right);
            buf_append(b, ")");
            break;
        default: buf_append(b, "/* error */"); break;
    }
}

static void gen_stmt_java(Buffer *b, ASTNode *s, int indent);

static void gen_stmts_java(Buffer *b, NodeList *list, int indent) {
    while (list) { gen_stmt_java(b, list->node, indent); list = list->next; }
}

static const char *java_type(DataType t) {
    switch (t) {
        case TYPE_INT: return "int";
        case TYPE_FLOAT: return "double";
        case TYPE_BOOL: return "boolean";
        case TYPE_STRING: return "String";
        default: return "void";
    }
}

static void gen_stmt_java(Buffer *b, ASTNode *s, int indent) {
    if (!s) return;
    switch (s->type) {
        case NODE_VAR_DECL:
            pad(b, indent);
            buf_printf(b, "%s %s = ", java_type(s->data.var_decl.var_type), s->data.var_decl.name);
            gen_expr_java(b, s->data.var_decl.init);
            buf_append(b, ";\n");
            break;
        case NODE_ASSIGN:
            pad(b, indent);
            buf_printf(b, "%s = ", s->data.assign.name);
            gen_expr_java(b, s->data.assign.value);
            buf_append(b, ";\n");
            break;
        case NODE_PRINT:
            pad(b, indent);
            buf_append(b, "System.out.println(");
            gen_expr_java(b, s->data.print_stmt.expr);
            buf_append(b, ");\n");
            break;
        case NODE_IF:
            pad(b, indent);
            buf_append(b, "if (");
            gen_expr_java(b, s->data.if_stmt.cond);
            buf_append(b, ") {\n");
            if (s->data.if_stmt.then_block && s->data.if_stmt.then_block->type == NODE_BLOCK)
                gen_stmts_java(b, s->data.if_stmt.then_block->data.block.stmts, indent + 1);
            else gen_stmt_java(b, s->data.if_stmt.then_block, indent + 1);
            pad(b, indent); buf_append(b, "}");
            if (s->data.if_stmt.else_block) {
                buf_append(b, " else {\n");
                if (s->data.if_stmt.else_block->type == NODE_BLOCK)
                    gen_stmts_java(b, s->data.if_stmt.else_block->data.block.stmts, indent + 1);
                else gen_stmt_java(b, s->data.if_stmt.else_block, indent + 1);
                pad(b, indent); buf_append(b, "}");
            }
            buf_append(b, "\n");
            break;
        case NODE_WHILE:
            pad(b, indent);
            buf_append(b, "while (");
            gen_expr_java(b, s->data.while_stmt.cond);
            buf_append(b, ") {\n");
            if (s->data.while_stmt.body && s->data.while_stmt.body->type == NODE_BLOCK)
                gen_stmts_java(b, s->data.while_stmt.body->data.block.stmts, indent + 1);
            else gen_stmt_java(b, s->data.while_stmt.body, indent + 1);
            pad(b, indent); buf_append(b, "}\n");
            break;
        case NODE_BLOCK:
            pad(b, indent); buf_append(b, "{\n");
            gen_stmts_java(b, s->data.block.stmts, indent + 1);
            pad(b, indent); buf_append(b, "}\n");
            break;
        default: break;
    }
}

char *generate_java(ASTNode *ast) {
    Buffer b; buf_init(&b);
    buf_append(&b, "public class Main {\n    public static void main(String[] args) {\n");
    if (ast->type == NODE_PROGRAM)
        gen_stmts_java(&b, ast->data.program.stmts, 2);
    buf_append(&b, "    }\n}\n");
    return b.buf;
}

static void gen_expr_py(Buffer *b, ASTNode *e) {
    switch (e->type) {
        case NODE_INT_LIT: buf_printf(b, "%d", e->data.int_val); break;
        case NODE_FLOAT_LIT: buf_printf(b, "%.6g", e->data.float_val); break;
        case NODE_STRING_LIT: escape_string(b, e->data.string_val); break;
        case NODE_BOOL_LIT: buf_append(b, e->data.bool_val ? "True" : "False"); break;
        case NODE_VAR_REF: buf_append(b, e->data.var_name); break;
        case NODE_BINARY_EXPR: {
            buf_append(b, "(");
            gen_expr_py(b, e->data.binary.left);
            BinOp op = e->data.binary.op;
            if (op == OP_AND) buf_append(b, " and ");
            else if (op == OP_OR) buf_append(b, " or ");
            else buf_printf(b, " %s ", binop_to_string(op));
            gen_expr_py(b, e->data.binary.right);
            buf_append(b, ")");
            break;
        }
        default: buf_append(b, "# error"); break;
    }
}

static void gen_stmt_py(Buffer *b, ASTNode *s, int indent);

static void gen_stmts_py(Buffer *b, NodeList *list, int indent) {
    if (!list) {
        pad(b, indent); buf_append(b, "pass\n");
        return;
    }
    while (list) { gen_stmt_py(b, list->node, indent); list = list->next; }
}

static void gen_stmt_py(Buffer *b, ASTNode *s, int indent) {
    if (!s) return;
    switch (s->type) {
        case NODE_VAR_DECL:
            pad(b, indent);
            buf_printf(b, "%s = ", s->data.var_decl.name);
            gen_expr_py(b, s->data.var_decl.init);
            buf_append(b, "\n");
            break;
        case NODE_ASSIGN:
            pad(b, indent);
            buf_printf(b, "%s = ", s->data.assign.name);
            gen_expr_py(b, s->data.assign.value);
            buf_append(b, "\n");
            break;
        case NODE_PRINT:
            pad(b, indent);
            buf_append(b, "print(");
            gen_expr_py(b, s->data.print_stmt.expr);
            buf_append(b, ")\n");
            break;
        case NODE_IF:
            pad(b, indent);
            buf_append(b, "if ");
            gen_expr_py(b, s->data.if_stmt.cond);
            buf_append(b, ":\n");
            if (s->data.if_stmt.then_block && s->data.if_stmt.then_block->type == NODE_BLOCK)
                gen_stmts_py(b, s->data.if_stmt.then_block->data.block.stmts, indent + 1);
            else gen_stmt_py(b, s->data.if_stmt.then_block, indent + 1);
            if (s->data.if_stmt.else_block) {
                pad(b, indent); buf_append(b, "else:\n");
                if (s->data.if_stmt.else_block->type == NODE_BLOCK)
                    gen_stmts_py(b, s->data.if_stmt.else_block->data.block.stmts, indent + 1);
                else gen_stmt_py(b, s->data.if_stmt.else_block, indent + 1);
            }
            break;
        case NODE_WHILE:
            pad(b, indent);
            buf_append(b, "while ");
            gen_expr_py(b, s->data.while_stmt.cond);
            buf_append(b, ":\n");
            if (s->data.while_stmt.body && s->data.while_stmt.body->type == NODE_BLOCK)
                gen_stmts_py(b, s->data.while_stmt.body->data.block.stmts, indent + 1);
            else gen_stmt_py(b, s->data.while_stmt.body, indent + 1);
            break;
        case NODE_BLOCK:
            gen_stmts_py(b, s->data.block.stmts, indent);
            break;
        default: break;
    }
}

char *generate_python(ASTNode *ast) {
    Buffer b; buf_init(&b);
    if (ast->type == NODE_PROGRAM)
        gen_stmts_py(&b, ast->data.program.stmts, 0);
    return b.buf;
}

char *generate_code(ASTNode *ast, const char *target) {
    if (strcmp(target, "c") == 0) return generate_c(ast);
    if (strcmp(target, "cpp") == 0) return generate_cpp(ast);
    if (strcmp(target, "java") == 0) return generate_java(ast);
    if (strcmp(target, "py") == 0) return generate_python(ast);
    return strdup("/* Unsupported target */\n");
}
