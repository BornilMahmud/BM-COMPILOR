#ifndef AST_H
#define AST_H

typedef enum {
    TYPE_INT,
    TYPE_FLOAT,
    TYPE_BOOL,
    TYPE_STRING,
    TYPE_VOID,
    TYPE_ERROR
} DataType;

typedef enum {
    NODE_PROGRAM,
    NODE_VAR_DECL,
    NODE_ASSIGN,
    NODE_PRINT,
    NODE_IF,
    NODE_WHILE,
    NODE_BLOCK,
    NODE_INT_LIT,
    NODE_FLOAT_LIT,
    NODE_STRING_LIT,
    NODE_BOOL_LIT,
    NODE_VAR_REF,
    NODE_BINARY_EXPR
} NodeType;

typedef enum {
    OP_ADD, OP_SUB, OP_MUL, OP_DIV,
    OP_EQ, OP_NEQ, OP_LT, OP_LE, OP_GT, OP_GE,
    OP_AND, OP_OR
} BinOp;

typedef struct ASTNode ASTNode;

typedef struct NodeList {
    ASTNode *node;
    struct NodeList *next;
} NodeList;

struct ASTNode {
    NodeType type;
    int line;
    int col;
    DataType data_type;

    union {
        struct { DataType var_type; char *name; ASTNode *init; } var_decl;
        struct { char *name; ASTNode *value; } assign;
        struct { ASTNode *expr; } print_stmt;
        struct { ASTNode *cond; ASTNode *then_block; ASTNode *else_block; } if_stmt;
        struct { ASTNode *cond; ASTNode *body; } while_stmt;
        struct { NodeList *stmts; } block;
        struct { NodeList *stmts; } program;
        int int_val;
        double float_val;
        char *string_val;
        int bool_val;
        char *var_name;
        struct { BinOp op; ASTNode *left; ASTNode *right; } binary;
    } data;
};

ASTNode *make_program(NodeList *stmts);
ASTNode *make_var_decl(DataType type, char *name, ASTNode *init, int line, int col);
ASTNode *make_assign(char *name, ASTNode *value, int line, int col);
ASTNode *make_print(ASTNode *expr, int line, int col);
ASTNode *make_if(ASTNode *cond, ASTNode *then_b, ASTNode *else_b, int line, int col);
ASTNode *make_while(ASTNode *cond, ASTNode *body, int line, int col);
ASTNode *make_block(NodeList *stmts, int line, int col);
ASTNode *make_int_lit(int val, int line, int col);
ASTNode *make_float_lit(double val, int line, int col);
ASTNode *make_string_lit(char *val, int line, int col);
ASTNode *make_bool_lit(int val, int line, int col);
ASTNode *make_var_ref(char *name, int line, int col);
ASTNode *make_binary(BinOp op, ASTNode *left, ASTNode *right, int line, int col);

NodeList *make_node_list(ASTNode *node);
NodeList *append_node_list(NodeList *list, ASTNode *node);

void free_ast(ASTNode *node);
const char *datatype_to_string(DataType t);
const char *binop_to_string(BinOp op);

#endif
