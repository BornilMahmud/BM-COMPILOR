import type {
  ProgramNode, StmtNode, ExprNode, DataType, BlockNode,
} from './ast.js';
import { getExprType } from './ast.js';

export interface SemaError {
  line: number;
  col: number;
  message: string;
}

interface SymbolInfo {
  name: string;
  type: DataType;
  line: number;
  col: number;
}

class Scope {
  private symbols: Map<string, SymbolInfo> = new Map();
  public parent: Scope | null;

  constructor(parent: Scope | null = null) {
    this.parent = parent;
  }

  declare(name: string, type: DataType, line: number, col: number): SymbolInfo | null {
    if (this.symbols.has(name)) {
      return null;
    }
    const info: SymbolInfo = { name, type, line, col };
    this.symbols.set(name, info);
    return info;
  }

  lookup(name: string): SymbolInfo | null {
    const found = this.symbols.get(name);
    if (found) return found;
    if (this.parent) return this.parent.lookup(name);
    return null;
  }

  lookupLocal(name: string): SymbolInfo | null {
    return this.symbols.get(name) ?? null;
  }
}

export class SemanticAnalyzer {
  private scope: Scope;
  public errors: SemaError[] = [];
  public varTypes: Map<string, DataType> = new Map();

  constructor() {
    this.scope = new Scope();
  }

  analyze(program: ProgramNode): void {
    for (const stmt of program.body) {
      this.analyzeStmt(stmt);
    }
  }

  private enterScope(): void {
    this.scope = new Scope(this.scope);
  }

  private exitScope(): void {
    if (this.scope.parent) {
      this.scope = this.scope.parent;
    }
  }

  private analyzeStmt(stmt: StmtNode): void {
    switch (stmt.kind) {
      case 'VarDecl': {
        if (this.scope.lookupLocal(stmt.name)) {
          this.errors.push({
            line: stmt.loc.line,
            col: stmt.loc.col,
            message: `Variable '${stmt.name}' already declared in this scope`,
          });
          return;
        }
        this.scope.declare(stmt.name, stmt.varType, stmt.loc.line, stmt.loc.col);
        this.varTypes.set(stmt.name, stmt.varType);
        if (stmt.init) {
          const initType = this.analyzeExpr(stmt.init);
          if (initType && !this.isAssignable(stmt.varType, initType)) {
            this.errors.push({
              line: stmt.loc.line,
              col: stmt.loc.col,
              message: `Cannot assign ${initType} to variable '${stmt.name}' of type ${stmt.varType}`,
            });
          }
        }
        break;
      }
      case 'Assign': {
        const sym = this.scope.lookup(stmt.name);
        if (!sym) {
          this.errors.push({
            line: stmt.loc.line,
            col: stmt.loc.col,
            message: `Undefined variable '${stmt.name}'`,
          });
          return;
        }
        const valType = this.analyzeExpr(stmt.value);
        if (valType && !this.isAssignable(sym.type, valType)) {
          this.errors.push({
            line: stmt.loc.line,
            col: stmt.loc.col,
            message: `Cannot assign ${valType} to variable '${stmt.name}' of type ${sym.type}`,
          });
        }
        break;
      }
      case 'Print': {
        this.analyzeExpr(stmt.expr);
        break;
      }
      case 'If': {
        const condType = this.analyzeExpr(stmt.condition);
        if (condType && condType !== 'bool') {
          this.errors.push({
            line: stmt.loc.line,
            col: stmt.loc.col,
            message: `Condition in 'if' must be bool, got ${condType}`,
          });
        }
        this.analyzeBlock(stmt.thenBlock);
        if (stmt.elseBlock) {
          this.analyzeBlock(stmt.elseBlock);
        }
        break;
      }
      case 'While': {
        const condType = this.analyzeExpr(stmt.condition);
        if (condType && condType !== 'bool') {
          this.errors.push({
            line: stmt.loc.line,
            col: stmt.loc.col,
            message: `Condition in 'while' must be bool, got ${condType}`,
          });
        }
        this.analyzeBlock(stmt.body);
        break;
      }
      case 'Block': {
        this.analyzeBlock(stmt);
        break;
      }
    }
  }

  private analyzeBlock(block: BlockNode): void {
    this.enterScope();
    for (const stmt of block.body) {
      this.analyzeStmt(stmt);
    }
    this.exitScope();
  }

  private analyzeExpr(expr: ExprNode): DataType | undefined {
    switch (expr.kind) {
      case 'IntLit':
        expr.resolvedType = 'int';
        return 'int';
      case 'FloatLit':
        expr.resolvedType = 'float';
        return 'float';
      case 'StringLit':
        expr.resolvedType = 'string';
        return 'string';
      case 'BoolLit':
        expr.resolvedType = 'bool';
        return 'bool';
      case 'VarRef': {
        const sym = this.scope.lookup(expr.name);
        if (!sym) {
          this.errors.push({
            line: expr.loc.line,
            col: expr.loc.col,
            message: `Undefined variable '${expr.name}'`,
          });
          return undefined;
        }
        expr.resolvedType = sym.type;
        return sym.type;
      }
      case 'BinaryExpr': {
        const leftType = this.analyzeExpr(expr.left);
        const rightType = this.analyzeExpr(expr.right);
        if (!leftType || !rightType) {
          return undefined;
        }
        const op = expr.op;
        if (op === '+' && leftType === 'string' && rightType === 'string') {
          expr.resolvedType = 'string';
          return 'string';
        }
        if (['+', '-', '*', '/'].includes(op)) {
          if (!this.isNumeric(leftType) || !this.isNumeric(rightType)) {
            if (leftType === 'string' || rightType === 'string') {
              this.errors.push({
                line: expr.loc.line,
                col: expr.loc.col,
                message: `Operator '${op}' not supported between ${leftType} and ${rightType}`,
              });
              return undefined;
            }
            this.errors.push({
              line: expr.loc.line,
              col: expr.loc.col,
              message: `Operator '${op}' requires numeric operands, got ${leftType} and ${rightType}`,
            });
            return undefined;
          }
          const resultType: DataType = (leftType === 'float' || rightType === 'float') ? 'float' : 'int';
          expr.resolvedType = resultType;
          return resultType;
        }
        if (['==', '!=', '<', '<=', '>', '>='].includes(op)) {
          if (this.isNumeric(leftType) && this.isNumeric(rightType)) {
            expr.resolvedType = 'bool';
            return 'bool';
          }
          if (leftType === 'bool' && rightType === 'bool' && (op === '==' || op === '!=')) {
            expr.resolvedType = 'bool';
            return 'bool';
          }
          if (leftType === 'string' || rightType === 'string') {
            this.errors.push({
              line: expr.loc.line,
              col: expr.loc.col,
              message: `Cannot use '${op}' on string values`,
            });
            return undefined;
          }
          if (leftType === rightType) {
            expr.resolvedType = 'bool';
            return 'bool';
          }
          this.errors.push({
            line: expr.loc.line,
            col: expr.loc.col,
            message: `Cannot compare ${leftType} and ${rightType} with '${op}'`,
          });
          return undefined;
        }
        return undefined;
      }
    }
  }

  private isNumeric(t: DataType): boolean {
    return t === 'int' || t === 'float';
  }

  private isAssignable(target: DataType, source: DataType): boolean {
    if (target === source) return true;
    if (target === 'float' && source === 'int') return true;
    return false;
  }
}
