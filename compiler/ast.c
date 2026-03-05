#include <stdlib.h>
#include <string.h>
#include "ast.h"

static ASTNode *alloc_node(NodeType type, int line, int col) {
    ASTNode *n = (ASTNode *)calloc(1, sizeof(ASTNode));
    n->type = type;
    n->line = line;
    n->col = col;
    n->data_type = TYPE_VOID;
    return n;
}

ASTNode *make_program(NodeList *stmts) {
    ASTNode *n = alloc_node(NODE_PROGRAM, 1, 1);
    n->data.program.stmts = stmts;
    return n;
}

ASTNode *make_var_decl(DataType type, char *name, ASTNode *init, int line, int col) {
    ASTNode *n = alloc_node(NODE_VAR_DECL, line, col);
    n->data.var_decl.var_type = type;
    n->data.var_decl.name = strdup(name);
    n->data.var_decl.init = init;
    return n;
}

ASTNode *make_assign(char *name, ASTNode *value, int line, int col) {
    ASTNode *n = alloc_node(NODE_ASSIGN, line, col);
    n->data.assign.name = strdup(name);
    n->data.assign.value = value;
    return n;
}

ASTNode *make_print(ASTNode *expr, int line, int col) {
    ASTNode *n = alloc_node(NODE_PRINT, line, col);
    n->data.print_stmt.expr = expr;
    return n;
}

ASTNode *make_if(ASTNode *cond, ASTNode *then_b, ASTNode *else_b, int line, int col) {
    ASTNode *n = alloc_node(NODE_IF, line, col);
    n->data.if_stmt.cond = cond;
    n->data.if_stmt.then_block = then_b;
    n->data.if_stmt.else_block = else_b;
    return n;
}

ASTNode *make_while(ASTNode *cond, ASTNode *body, int line, int col) {
    ASTNode *n = alloc_node(NODE_WHILE, line, col);
    n->data.while_stmt.cond = cond;
    n->data.while_stmt.body = body;
    return n;
}

ASTNode *make_block(NodeList *stmts, int line, int col) {
    ASTNode *n = alloc_node(NODE_BLOCK, line, col);
    n->data.block.stmts = stmts;
    return n;
}

ASTNode *make_int_lit(int val, int line, int col) {
    ASTNode *n = alloc_node(NODE_INT_LIT, line, col);
    n->data.int_val = val;
    n->data_type = TYPE_INT;
    return n;
}

ASTNode *make_float_lit(double val, int line, int col) {
    ASTNode *n = alloc_node(NODE_FLOAT_LIT, line, col);
    n->data.float_val = val;
    n->data_type = TYPE_FLOAT;
    return n;
}

ASTNode *make_string_lit(char *val, int line, int col) {
    ASTNode *n = alloc_node(NODE_STRING_LIT, line, col);
    n->data.string_val = strdup(val);
    n->data_type = TYPE_STRING;
    return n;
}

ASTNode *make_bool_lit(int val, int line, int col) {
    ASTNode *n = alloc_node(NODE_BOOL_LIT, line, col);
    n->data.bool_val = val;
    n->data_type = TYPE_BOOL;
    return n;
}

ASTNode *make_var_ref(char *name, int line, int col) {
    ASTNode *n = alloc_node(NODE_VAR_REF, line, col);
    n->data.var_name = strdup(name);
    return n;
}

ASTNode *make_binary(BinOp op, ASTNode *left, ASTNode *right, int line, int col) {
    ASTNode *n = alloc_node(NODE_BINARY_EXPR, line, col);
    n->data.binary.op = op;
    n->data.binary.left = left;
    n->data.binary.right = right;
    return n;
}

NodeList *make_node_list(ASTNode *node) {
    NodeList *l = (NodeList *)calloc(1, sizeof(NodeList));
    l->node = node;
    l->next = NULL;
    return l;
}

NodeList *append_node_list(NodeList *list, ASTNode *node) {
    NodeList *entry = make_node_list(node);
    if (!list) return entry;
    NodeList *cur = list;
    while (cur->next) cur = cur->next;
    cur->next = entry;
    return list;
}

void free_ast(ASTNode *node) {
    if (!node) return;
    switch (node->type) {
        case NODE_PROGRAM: {
            NodeList *l = node->data.program.stmts;
            while (l) { NodeList *n = l->next; free_ast(l->node); free(l); l = n; }
            break;
        }
        case NODE_VAR_DECL:
            free(node->data.var_decl.name);
            free_ast(node->data.var_decl.init);
            break;
        case NODE_ASSIGN:
            free(node->data.assign.name);
            free_ast(node->data.assign.value);
            break;
        case NODE_PRINT:
            free_ast(node->data.print_stmt.expr);
            break;
        case NODE_IF:
            free_ast(node->data.if_stmt.cond);
            free_ast(node->data.if_stmt.then_block);
            free_ast(node->data.if_stmt.else_block);
            break;
        case NODE_WHILE:
            free_ast(node->data.while_stmt.cond);
            free_ast(node->data.while_stmt.body);
            break;
        case NODE_BLOCK: {
            NodeList *l = node->data.block.stmts;
            while (l) { NodeList *n = l->next; free_ast(l->node); free(l); l = n; }
            break;
        }
        case NODE_STRING_LIT: free(node->data.string_val); break;
        case NODE_VAR_REF: free(node->data.var_name); break;
        case NODE_BINARY_EXPR:
            free_ast(node->data.binary.left);
            free_ast(node->data.binary.right);
            break;
        default: break;
    }
    free(node);
}

const char *datatype_to_string(DataType t) {
    switch (t) {
        case TYPE_INT: return "int";
        case TYPE_FLOAT: return "float";
        case TYPE_BOOL: return "bool";
        case TYPE_STRING: return "string";
        case TYPE_VOID: return "void";
        case TYPE_ERROR: return "error";
    }
    return "unknown";
}

const char *binop_to_string(BinOp op) {
    switch (op) {
        case OP_ADD: return "+";
        case OP_SUB: return "-";
        case OP_MUL: return "*";
        case OP_DIV: return "/";
        case OP_EQ: return "==";
        case OP_NEQ: return "!=";
        case OP_LT: return "<";
        case OP_LE: return "<=";
        case OP_GT: return ">";
        case OP_GE: return ">=";
        case OP_AND: return "&&";
        case OP_OR: return "||";
    }
    return "?";
}
