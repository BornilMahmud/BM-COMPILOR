export enum TokenType {
  KW_INT, KW_FLOAT, KW_BOOL, KW_STRING,
  KW_IF, KW_ELSE, KW_WHILE, KW_PRINT,
  KW_TRUE, KW_FALSE,
  INT_LIT, FLOAT_LIT, STRING_LIT,
  ID,
  ASSIGN, PLUS, MINUS, MUL, DIV,
  EQ, NEQ, LT, LTE, GT, GTE,
  LPAREN, RPAREN, LBRACE, RBRACE, SEMI,
  EOF,
}

export const TOKEN_NAMES: Record<TokenType, string> = {
  [TokenType.KW_INT]: 'int',
  [TokenType.KW_FLOAT]: 'float',
  [TokenType.KW_BOOL]: 'bool',
  [TokenType.KW_STRING]: 'string',
  [TokenType.KW_IF]: 'if',
  [TokenType.KW_ELSE]: 'else',
  [TokenType.KW_WHILE]: 'while',
  [TokenType.KW_PRINT]: 'print',
  [TokenType.KW_TRUE]: 'true',
  [TokenType.KW_FALSE]: 'false',
  [TokenType.INT_LIT]: 'integer literal',
  [TokenType.FLOAT_LIT]: 'float literal',
  [TokenType.STRING_LIT]: 'string literal',
  [TokenType.ID]: 'identifier',
  [TokenType.ASSIGN]: '=',
  [TokenType.PLUS]: '+',
  [TokenType.MINUS]: '-',
  [TokenType.MUL]: '*',
  [TokenType.DIV]: '/',
  [TokenType.EQ]: '==',
  [TokenType.NEQ]: '!=',
  [TokenType.LT]: '<',
  [TokenType.LTE]: '<=',
  [TokenType.GT]: '>',
  [TokenType.GTE]: '>=',
  [TokenType.LPAREN]: '(',
  [TokenType.RPAREN]: ')',
  [TokenType.LBRACE]: '{',
  [TokenType.RBRACE]: '}',
  [TokenType.SEMI]: ';',
  [TokenType.EOF]: 'end of file',
};

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS: Record<string, TokenType> = {
  'int': TokenType.KW_INT,
  'float': TokenType.KW_FLOAT,
  'bool': TokenType.KW_BOOL,
  'string': TokenType.KW_STRING,
  'if': TokenType.KW_IF,
  'else': TokenType.KW_ELSE,
  'while': TokenType.KW_WHILE,
  'print': TokenType.KW_PRINT,
  'true': TokenType.KW_TRUE,
  'false': TokenType.KW_FALSE,
};

export interface LexError {
  line: number;
  col: number;
  message: string;
}

export class Lexer {
  private src: string;
  private pos = 0;
  private line = 1;
  private col = 1;
  public errors: LexError[] = [];

  constructor(source: string) {
    this.src = source;
  }

  private peek(): string {
    return this.pos < this.src.length ? this.src[this.pos] : '\0';
  }

  private peekAt(offset: number): string {
    const idx = this.pos + offset;
    return idx < this.src.length ? this.src[idx] : '\0';
  }

  private advance(): string {
    const ch = this.src[this.pos++];
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  private skipWhitespace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) {
      this.advance();
    }
  }

  private skipLineComment(): void {
    while (this.pos < this.src.length && this.src[this.pos] !== '\n') {
      this.advance();
    }
  }

  private skipBlockComment(startLine: number, startCol: number): void {
    while (this.pos < this.src.length) {
      if (this.src[this.pos] === '*' && this.peekAt(1) === '/') {
        this.advance();
        this.advance();
        return;
      }
      this.advance();
    }
    this.errors.push({
      line: startLine,
      col: startCol,
      message: 'Unterminated block comment',
    });
  }

  private readString(startLine: number, startCol: number): Token {
    let str = '';
    while (this.pos < this.src.length && this.src[this.pos] !== '"') {
      if (this.src[this.pos] === '\n') {
        this.errors.push({
          line: this.line,
          col: this.col,
          message: 'Unterminated string literal (newline in string)',
        });
        break;
      }
      if (this.src[this.pos] === '\\') {
        this.advance();
        const esc = this.advance();
        switch (esc) {
          case 'n': str += '\n'; break;
          case 't': str += '\t'; break;
          case '\\': str += '\\'; break;
          case '"': str += '"'; break;
          default: str += esc;
        }
      } else {
        str += this.advance();
      }
    }
    if (this.pos < this.src.length && this.src[this.pos] === '"') {
      this.advance();
    } else {
      this.errors.push({
        line: startLine,
        col: startCol,
        message: 'Unterminated string literal',
      });
    }
    return { type: TokenType.STRING_LIT, value: str, line: startLine, col: startCol };
  }

  private readNumber(startLine: number, startCol: number): Token {
    let num = '';
    let isFloat = false;
    while (this.pos < this.src.length && /[0-9]/.test(this.src[this.pos])) {
      num += this.advance();
    }
    if (this.peek() === '.' && /[0-9]/.test(this.peekAt(1))) {
      isFloat = true;
      num += this.advance();
      while (this.pos < this.src.length && /[0-9]/.test(this.src[this.pos])) {
        num += this.advance();
      }
    }
    return {
      type: isFloat ? TokenType.FLOAT_LIT : TokenType.INT_LIT,
      value: num,
      line: startLine,
      col: startCol,
    };
  }

  private readIdentOrKeyword(startLine: number, startCol: number): Token {
    let id = '';
    while (this.pos < this.src.length && /[a-zA-Z0-9_]/.test(this.src[this.pos])) {
      id += this.advance();
    }
    const kwType = KEYWORDS[id];
    return {
      type: kwType !== undefined ? kwType : TokenType.ID,
      value: id,
      line: startLine,
      col: startCol,
    };
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.src.length) {
      this.skipWhitespace();
      if (this.pos >= this.src.length) break;

      const startLine = this.line;
      const startCol = this.col;
      const ch = this.peek();

      if (ch === '/' && this.peekAt(1) === '/') {
        this.advance(); this.advance();
        this.skipLineComment();
        continue;
      }
      if (ch === '/' && this.peekAt(1) === '*') {
        this.advance(); this.advance();
        this.skipBlockComment(startLine, startCol);
        continue;
      }

      if (ch === '"') {
        this.advance();
        tokens.push(this.readString(startLine, startCol));
        continue;
      }

      if (/[0-9]/.test(ch)) {
        tokens.push(this.readNumber(startLine, startCol));
        continue;
      }

      if (/[a-zA-Z_]/.test(ch)) {
        tokens.push(this.readIdentOrKeyword(startLine, startCol));
        continue;
      }

      this.advance();
      switch (ch) {
        case '+': tokens.push({ type: TokenType.PLUS, value: '+', line: startLine, col: startCol }); break;
        case '-': tokens.push({ type: TokenType.MINUS, value: '-', line: startLine, col: startCol }); break;
        case '*': tokens.push({ type: TokenType.MUL, value: '*', line: startLine, col: startCol }); break;
        case '/': tokens.push({ type: TokenType.DIV, value: '/', line: startLine, col: startCol }); break;
        case '(': tokens.push({ type: TokenType.LPAREN, value: '(', line: startLine, col: startCol }); break;
        case ')': tokens.push({ type: TokenType.RPAREN, value: ')', line: startLine, col: startCol }); break;
        case '{': tokens.push({ type: TokenType.LBRACE, value: '{', line: startLine, col: startCol }); break;
        case '}': tokens.push({ type: TokenType.RBRACE, value: '}', line: startLine, col: startCol }); break;
        case ';': tokens.push({ type: TokenType.SEMI, value: ';', line: startLine, col: startCol }); break;
        case '=':
          if (this.peek() === '=') {
            this.advance();
            tokens.push({ type: TokenType.EQ, value: '==', line: startLine, col: startCol });
          } else {
            tokens.push({ type: TokenType.ASSIGN, value: '=', line: startLine, col: startCol });
          }
          break;
        case '!':
          if (this.peek() === '=') {
            this.advance();
            tokens.push({ type: TokenType.NEQ, value: '!=', line: startLine, col: startCol });
          } else {
            this.errors.push({ line: startLine, col: startCol, message: `Unexpected character '!'` });
          }
          break;
        case '<':
          if (this.peek() === '=') {
            this.advance();
            tokens.push({ type: TokenType.LTE, value: '<=', line: startLine, col: startCol });
          } else {
            tokens.push({ type: TokenType.LT, value: '<', line: startLine, col: startCol });
          }
          break;
        case '>':
          if (this.peek() === '=') {
            this.advance();
            tokens.push({ type: TokenType.GTE, value: '>=', line: startLine, col: startCol });
          } else {
            tokens.push({ type: TokenType.GT, value: '>', line: startLine, col: startCol });
          }
          break;
        default:
          this.errors.push({ line: startLine, col: startCol, message: `Unexpected character '${ch}'` });
      }
    }

    tokens.push({ type: TokenType.EOF, value: '', line: this.line, col: this.col });
    return tokens;
  }
}
