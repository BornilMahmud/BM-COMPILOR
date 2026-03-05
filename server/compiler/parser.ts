import { Token, TokenType, TOKEN_NAMES } from './lexer.js';
import type {
  ProgramNode, StmtNode, BlockNode, VarDeclNode, AssignNode,
  PrintNode, IfNode, WhileNode, ExprNode, DataType, BinOp, Loc,
} from './ast.js';

export interface ParseError {
  line: number;
  col: number;
  message: string;
}

export class Parser {
  private tokens: Token[];
  private pos = 0;
  public errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: TokenType.EOF, value: '', line: 0, col: 0 };
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return tok;
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): Token | null {
    for (const t of types) {
      if (this.check(t)) return this.advance();
    }
    return null;
  }

  private expect(type: TokenType): Token {
    const tok = this.peek();
    if (tok.type === type) return this.advance();
    this.errors.push({
      line: tok.line,
      col: tok.col,
      message: `Expected ${TOKEN_NAMES[type]} but got '${tok.value || TOKEN_NAMES[tok.type]}'`,
    });
    return tok;
  }

  private loc(): Loc {
    const t = this.peek();
    return { line: t.line, col: t.col };
  }

  parse(): ProgramNode {
    const body: StmtNode[] = [];
    while (!this.check(TokenType.EOF)) {
      const beforePos = this.pos;
      try {
        const stmt = this.parseStmt();
        if (stmt) body.push(stmt);
        else if (this.pos === beforePos) this.advance();
      } catch {
        if (this.pos === beforePos) this.advance();
      }
    }
    return { kind: 'Program', body, loc: { line: 1, col: 1 } };
  }

  private parseStmt(): StmtNode | null {
    const tok = this.peek();
    switch (tok.type) {
      case TokenType.KW_INT:
      case TokenType.KW_FLOAT:
      case TokenType.KW_BOOL:
      case TokenType.KW_STRING:
        return this.parseVarDecl();
      case TokenType.KW_IF:
        return this.parseIf();
      case TokenType.KW_WHILE:
        return this.parseWhile();
      case TokenType.KW_PRINT:
        return this.parsePrint();
      case TokenType.ID:
        return this.parseAssign();
      case TokenType.LBRACE:
        return this.parseBlock();
      default:
        this.errors.push({
          line: tok.line,
          col: tok.col,
          message: `Unexpected token '${tok.value || TOKEN_NAMES[tok.type]}'`,
        });
        return null;
    }
  }

  private parseVarDecl(): VarDeclNode {
    const l = this.loc();
    const typeTok = this.advance();
    const varType = typeTok.value as DataType;
    const nameTok = this.expect(TokenType.ID);
    let init: ExprNode | undefined;
    if (this.match(TokenType.ASSIGN)) {
      init = this.parseExpr();
    }
    this.expect(TokenType.SEMI);
    return { kind: 'VarDecl', varType, name: nameTok.value, init, loc: l };
  }

  private parseAssign(): AssignNode {
    const l = this.loc();
    const nameTok = this.advance();
    this.expect(TokenType.ASSIGN);
    const value = this.parseExpr();
    this.expect(TokenType.SEMI);
    return { kind: 'Assign', name: nameTok.value, value, loc: l };
  }

  private parsePrint(): PrintNode {
    const l = this.loc();
    this.advance();
    this.expect(TokenType.LPAREN);
    const expr = this.parseExpr();
    this.expect(TokenType.RPAREN);
    this.expect(TokenType.SEMI);
    return { kind: 'Print', expr, loc: l };
  }

  private parseIf(): IfNode {
    const l = this.loc();
    this.advance();
    this.expect(TokenType.LPAREN);
    const condition = this.parseExpr();
    this.expect(TokenType.RPAREN);
    const thenBlock = this.parseBlock();
    let elseBlock: BlockNode | undefined;
    if (this.match(TokenType.KW_ELSE)) {
      elseBlock = this.parseBlock();
    }
    return { kind: 'If', condition, thenBlock, elseBlock, loc: l };
  }

  private parseWhile(): WhileNode {
    const l = this.loc();
    this.advance();
    this.expect(TokenType.LPAREN);
    const condition = this.parseExpr();
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return { kind: 'While', condition, body, loc: l };
  }

  private parseBlock(): BlockNode {
    const l = this.loc();
    this.expect(TokenType.LBRACE);
    const body: StmtNode[] = [];
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      const beforePos = this.pos;
      try {
        const stmt = this.parseStmt();
        if (stmt) body.push(stmt);
        else if (this.pos === beforePos) this.advance();
      } catch {
        if (this.pos === beforePos) this.advance();
      }
    }
    this.expect(TokenType.RBRACE);
    return { kind: 'Block', body, loc: l };
  }

  private parseExpr(): ExprNode {
    return this.parseComparison();
  }

  private parseComparison(): ExprNode {
    let left = this.parseAddition();
    while (true) {
      const tok = this.peek();
      let op: BinOp | null = null;
      if (tok.type === TokenType.EQ) op = '==';
      else if (tok.type === TokenType.NEQ) op = '!=';
      else if (tok.type === TokenType.LT) op = '<';
      else if (tok.type === TokenType.LTE) op = '<=';
      else if (tok.type === TokenType.GT) op = '>';
      else if (tok.type === TokenType.GTE) op = '>=';
      if (!op) break;
      const l = this.loc();
      this.advance();
      const right = this.parseAddition();
      left = { kind: 'BinaryExpr', op, left, right, loc: l };
    }
    return left;
  }

  private parseAddition(): ExprNode {
    let left = this.parseMultiplication();
    while (true) {
      const tok = this.peek();
      let op: BinOp | null = null;
      if (tok.type === TokenType.PLUS) op = '+';
      else if (tok.type === TokenType.MINUS) op = '-';
      if (!op) break;
      const l = this.loc();
      this.advance();
      const right = this.parseMultiplication();
      left = { kind: 'BinaryExpr', op, left, right, loc: l };
    }
    return left;
  }

  private parseMultiplication(): ExprNode {
    let left = this.parsePrimary();
    while (true) {
      const tok = this.peek();
      let op: BinOp | null = null;
      if (tok.type === TokenType.MUL) op = '*';
      else if (tok.type === TokenType.DIV) op = '/';
      if (!op) break;
      const l = this.loc();
      this.advance();
      const right = this.parsePrimary();
      left = { kind: 'BinaryExpr', op, left, right, loc: l };
    }
    return left;
  }

  private parsePrimary(): ExprNode {
    const tok = this.peek();

    if (tok.type === TokenType.INT_LIT) {
      this.advance();
      return { kind: 'IntLit', value: parseInt(tok.value, 10), loc: { line: tok.line, col: tok.col } };
    }
    if (tok.type === TokenType.FLOAT_LIT) {
      this.advance();
      return { kind: 'FloatLit', value: parseFloat(tok.value), loc: { line: tok.line, col: tok.col } };
    }
    if (tok.type === TokenType.STRING_LIT) {
      this.advance();
      return { kind: 'StringLit', value: tok.value, loc: { line: tok.line, col: tok.col } };
    }
    if (tok.type === TokenType.KW_TRUE) {
      this.advance();
      return { kind: 'BoolLit', value: true, loc: { line: tok.line, col: tok.col } };
    }
    if (tok.type === TokenType.KW_FALSE) {
      this.advance();
      return { kind: 'BoolLit', value: false, loc: { line: tok.line, col: tok.col } };
    }
    if (tok.type === TokenType.ID) {
      this.advance();
      return { kind: 'VarRef', name: tok.value, loc: { line: tok.line, col: tok.col } };
    }
    if (tok.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpr();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    this.errors.push({
      line: tok.line,
      col: tok.col,
      message: `Expected expression but got '${tok.value || TOKEN_NAMES[tok.type]}'`,
    });
    this.advance();
    return { kind: 'IntLit', value: 0, loc: { line: tok.line, col: tok.col } };
  }
}
