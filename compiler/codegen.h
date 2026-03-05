#ifndef CODEGEN_H
#define CODEGEN_H

#include "ast.h"

char *generate_c(ASTNode *ast);
char *generate_cpp(ASTNode *ast);
char *generate_java(ASTNode *ast);
char *generate_python(ASTNode *ast);
char *generate_code(ASTNode *ast, const char *target);

#endif
