#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "ast.h"
#include "sema.h"
#include "codegen.h"
#include "ir.h"

extern ASTNode *parse_result;
extern int yyparse(void);
extern FILE *yyin;
extern int yylineno;
extern int yycolumn;

extern int parse_error_count;
typedef struct {
    int line;
    int col;
    char message[256];
    char phase[16];
} ParseError;
extern ParseError parse_errors[];

static void json_escape_print(FILE *out, const char *s) {
    for (int i = 0; s[i]; i++) {
        switch (s[i]) {
            case '"': fprintf(out, "\\\""); break;
            case '\\': fprintf(out, "\\\\"); break;
            case '\n': fprintf(out, "\\n"); break;
            case '\r': fprintf(out, "\\r"); break;
            case '\t': fprintf(out, "\\t"); break;
            default:
                if ((unsigned char)s[i] < 0x20) {
                    fprintf(out, "\\u%04x", (unsigned char)s[i]);
                } else {
                    fputc(s[i], out);
                }
        }
    }
}

static void print_errors_json(FILE *out, const char *phase_default) {
    fprintf(out, "[");
    for (int i = 0; i < parse_error_count; i++) {
        if (i > 0) fprintf(out, ",");
        fprintf(out, "{\"line\":%d,\"column\":%d,\"message\":\"", parse_errors[i].line, parse_errors[i].col);
        json_escape_print(out, parse_errors[i].message);
        fprintf(out, "\",\"phase\":\"%s\"}", parse_errors[i].phase);
    }
    fprintf(out, "]");
}

int main(int argc, char **argv) {
    const char *target = "c";
    int emit_ir = 0;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--target") == 0 && i + 1 < argc) {
            target = argv[++i];
        } else if (strcmp(argv[i], "--ir") == 0) {
            emit_ir = 1;
        }
    }

    yyin = stdin;
    yylineno = 1;
    yycolumn = 1;

    int parse_status = yyparse();

    if (parse_status != 0 || parse_error_count > 0) {
        fprintf(stdout, "{\"success\":false,\"generatedCode\":\"\",\"ir\":\"\",\"errors\":");
        print_errors_json(stdout, "parser");
        fprintf(stdout, ",\"target\":\"%s\"}\n", target);
        if (parse_result) free_ast(parse_result);
        return 0;
    }

    if (!parse_result) {
        fprintf(stdout, "{\"success\":false,\"generatedCode\":\"\",\"ir\":\"\",\"errors\":[{\"line\":1,\"column\":1,\"message\":\"No input\",\"phase\":\"parser\"}],\"target\":\"%s\"}\n", target);
        return 0;
    }

    SemaContext sema;
    sema_init(&sema);
    sema_analyze(&sema, parse_result);

    if (sema.error_count > 0) {
        fprintf(stdout, "{\"success\":false,\"generatedCode\":\"\",\"ir\":\"\",\"errors\":[");
        for (int i = 0; i < sema.error_count; i++) {
            if (i > 0) fprintf(stdout, ",");
            fprintf(stdout, "{\"line\":%d,\"column\":%d,\"message\":\"", sema.errors[i].line, sema.errors[i].col);
            json_escape_print(stdout, sema.errors[i].message);
            fprintf(stdout, "\",\"phase\":\"semantic\"}");
        }
        fprintf(stdout, "],\"target\":\"%s\"}\n", target);
        free_ast(parse_result);
        return 0;
    }

    char *code = generate_code(parse_result, target);
    char *ir_text = emit_ir ? generate_ir(parse_result) : NULL;

    fprintf(stdout, "{\"success\":true,\"generatedCode\":\"");
    json_escape_print(stdout, code);
    fprintf(stdout, "\",\"ir\":\"");
    if (ir_text) json_escape_print(stdout, ir_text);
    fprintf(stdout, "\",\"errors\":[],\"target\":\"%s\"}\n", target);

    free(code);
    if (ir_text) free(ir_text);
    free_ast(parse_result);

    return 0;
}
