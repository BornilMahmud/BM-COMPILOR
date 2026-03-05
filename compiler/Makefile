CC = gcc
CFLAGS = -Wall -Wno-unused-function -g
LDFLAGS =

TARGET = bmc

BISON_SRC = parser.y
FLEX_SRC = lexer.l
C_SRCS = ast.c sema.c codegen.c ir.c main.c

BISON_C = parser.tab.c
BISON_H = parser.tab.h
FLEX_C = lex.yy.c

all: $(TARGET)

$(BISON_C) $(BISON_H): $(BISON_SRC)
	bison -d -o $(BISON_C) $(BISON_SRC)

$(FLEX_C): $(FLEX_SRC) $(BISON_H)
	flex -o $(FLEX_C) $(FLEX_SRC)

$(TARGET): $(FLEX_C) $(BISON_C) $(C_SRCS)
	$(CC) $(CFLAGS) -o $(TARGET) $(FLEX_C) $(BISON_C) $(C_SRCS) $(LDFLAGS)

clean:
	rm -f $(TARGET) $(BISON_C) $(BISON_H) $(FLEX_C)

.PHONY: all clean
