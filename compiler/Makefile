CC = gcc
CFLAGS = -Wall -Wno-unused-function -g -Isrc -Ibuild
LDFLAGS =

TARGET = bmcc

BISON_SRC = src/bm_script_parser.y
FLEX_SRC = src/bm_script_lexer.l
C_SRCS = src/ast.c src/runner.c src/util.c src/driver.c

BISON_C = build/parser.c
BISON_H = build/parser.h
FLEX_C = build/lexer.c

all: $(TARGET)

build:
	mkdir -p build

$(BISON_C) $(BISON_H): $(BISON_SRC) | build
	bison -d -o $(BISON_C) --defines=$(BISON_H) $(BISON_SRC)

$(FLEX_C): $(FLEX_SRC) $(BISON_H) | build
	flex -o $(FLEX_C) $(FLEX_SRC)

$(TARGET): $(FLEX_C) $(BISON_C) $(C_SRCS)
	$(CC) $(CFLAGS) -o $(TARGET) $(FLEX_C) $(BISON_C) $(C_SRCS) $(LDFLAGS)

clean:
	rm -f $(TARGET)
	rm -rf build

.PHONY: all clean
