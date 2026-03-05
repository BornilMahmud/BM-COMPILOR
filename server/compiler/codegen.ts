import type { ProgramNode, StmtNode, ExprNode, BlockNode, DataType, BinOp } from './ast.js';
import { getExprType } from './ast.js';
import type { TargetLanguage } from '@shared/schema.js';

function formatFloat(n: number): string {
  const s = String(n);
  if (!s.includes('.')) return s + '.0';
  return s;
}

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

function genExprC(expr: ExprNode): string {
  switch (expr.kind) {
    case 'IntLit': return String(expr.value);
    case 'FloatLit': return formatFloat(expr.value);
    case 'StringLit': return `"${escapeStr(expr.value)}"`;
    case 'BoolLit': return expr.value ? '1' : '0';
    case 'VarRef': return expr.name;
    case 'BinaryExpr': return `(${genExprC(expr.left)} ${expr.op} ${genExprC(expr.right)})`;
  }
}

function genExprCpp(expr: ExprNode): string {
  switch (expr.kind) {
    case 'IntLit': return String(expr.value);
    case 'FloatLit': return formatFloat(expr.value);
    case 'StringLit': return `std::string("${escapeStr(expr.value)}")`;
    case 'BoolLit': return expr.value ? 'true' : 'false';
    case 'VarRef': return expr.name;
    case 'BinaryExpr': return `(${genExprCpp(expr.left)} ${expr.op} ${genExprCpp(expr.right)})`;
  }
}

function genExprJava(expr: ExprNode): string {
  switch (expr.kind) {
    case 'IntLit': return String(expr.value);
    case 'FloatLit': return formatFloat(expr.value);
    case 'StringLit': return `"${escapeStr(expr.value)}"`;
    case 'BoolLit': return expr.value ? 'true' : 'false';
    case 'VarRef': return expr.name;
    case 'BinaryExpr': return `(${genExprJava(expr.left)} ${expr.op} ${genExprJava(expr.right)})`;
  }
}

function genExprPy(expr: ExprNode): string {
  switch (expr.kind) {
    case 'IntLit': return String(expr.value);
    case 'FloatLit': return formatFloat(expr.value);
    case 'StringLit': return `"${escapeStr(expr.value)}"`;
    case 'BoolLit': return expr.value ? 'True' : 'False';
    case 'VarRef': return expr.name;
    case 'BinaryExpr': {
      const op = expr.op === '==' ? '==' : expr.op === '!=' ? '!=' : expr.op;
      return `(${genExprPy(expr.left)} ${op} ${genExprPy(expr.right)})`;
    }
  }
}

function cTypeStr(dt: DataType): string {
  switch (dt) {
    case 'int': return 'int';
    case 'float': return 'double';
    case 'bool': return 'int';
    case 'string': return 'const char*';
    default: return 'int';
  }
}

function cDefault(dt: DataType): string {
  switch (dt) {
    case 'int': return '0';
    case 'float': return '0.0';
    case 'bool': return '0';
    case 'string': return '""';
    default: return '0';
  }
}

function cppTypeStr(dt: DataType): string {
  switch (dt) {
    case 'int': return 'int';
    case 'float': return 'double';
    case 'bool': return 'bool';
    case 'string': return 'std::string';
    default: return 'int';
  }
}

function javaTypeStr(dt: DataType): string {
  switch (dt) {
    case 'int': return 'int';
    case 'float': return 'double';
    case 'bool': return 'boolean';
    case 'string': return 'String';
    default: return 'int';
  }
}

function javaDefault(dt: DataType): string {
  switch (dt) {
    case 'int': return '0';
    case 'float': return '0.0';
    case 'bool': return 'false';
    case 'string': return '""';
    default: return '0';
  }
}

export function generateC(ast: ProgramNode): string {
  const lines: string[] = [];
  lines.push('#include <stdio.h>');
  lines.push('#include <string.h>');
  lines.push('');
  lines.push('int main(void) {');

  function emitStmt(stmt: StmtNode, indent: number): void {
    const pad = '    '.repeat(indent);
    switch (stmt.kind) {
      case 'VarDecl': {
        if (stmt.init) {
          lines.push(`${pad}${cTypeStr(stmt.varType)} ${stmt.name} = ${genExprC(stmt.init)};`);
        } else {
          lines.push(`${pad}${cTypeStr(stmt.varType)} ${stmt.name} = ${cDefault(stmt.varType)};`);
        }
        break;
      }
      case 'Assign':
        lines.push(`${pad}${stmt.name} = ${genExprC(stmt.value)};`);
        break;
      case 'Print': {
        const dt = getExprType(stmt.expr) ?? 'int';
        const val = genExprC(stmt.expr);
        if (dt === 'int') lines.push(`${pad}printf("%d\\n", ${val});`);
        else if (dt === 'float') lines.push(`${pad}printf("%g\\n", ${val});`);
        else if (dt === 'bool') lines.push(`${pad}printf("%s\\n", (${val}) ? "true" : "false");`);
        else if (dt === 'string') lines.push(`${pad}printf("%s\\n", ${val});`);
        break;
      }
      case 'If': {
        lines.push(`${pad}if (${genExprC(stmt.condition)}) {`);
        for (const s of stmt.thenBlock.body) emitStmt(s, indent + 1);
        if (stmt.elseBlock) {
          lines.push(`${pad}} else {`);
          for (const s of stmt.elseBlock.body) emitStmt(s, indent + 1);
        }
        lines.push(`${pad}}`);
        break;
      }
      case 'While': {
        lines.push(`${pad}while (${genExprC(stmt.condition)}) {`);
        for (const s of stmt.body.body) emitStmt(s, indent + 1);
        lines.push(`${pad}}`);
        break;
      }
      case 'Block': {
        lines.push(`${pad}{`);
        for (const s of stmt.body) emitStmt(s, indent + 1);
        lines.push(`${pad}}`);
        break;
      }
    }
  }

  for (const stmt of ast.body) {
    emitStmt(stmt, 1);
  }

  lines.push('    return 0;');
  lines.push('}');
  return lines.join('\n');
}

export function generateCpp(ast: ProgramNode): string {
  const lines: string[] = [];
  lines.push('#include <iostream>');
  lines.push('#include <string>');
  lines.push('');
  lines.push('int main() {');

  function emitStmt(stmt: StmtNode, indent: number): void {
    const pad = '    '.repeat(indent);
    switch (stmt.kind) {
      case 'VarDecl': {
        const typeStr = cppTypeStr(stmt.varType);
        if (stmt.init) {
          lines.push(`${pad}${typeStr} ${stmt.name} = ${genExprCpp(stmt.init)};`);
        } else {
          const def = stmt.varType === 'string' ? '""' : stmt.varType === 'bool' ? 'false' : '0';
          lines.push(`${pad}${typeStr} ${stmt.name} = ${def};`);
        }
        break;
      }
      case 'Assign':
        lines.push(`${pad}${stmt.name} = ${genExprCpp(stmt.value)};`);
        break;
      case 'Print': {
        const dt = getExprType(stmt.expr) ?? 'int';
        const val = genExprCpp(stmt.expr);
        if (dt === 'bool') {
          lines.push(`${pad}std::cout << ((${val}) ? "true" : "false") << std::endl;`);
        } else {
          lines.push(`${pad}std::cout << ${val} << std::endl;`);
        }
        break;
      }
      case 'If': {
        lines.push(`${pad}if (${genExprCpp(stmt.condition)}) {`);
        for (const s of stmt.thenBlock.body) emitStmt(s, indent + 1);
        if (stmt.elseBlock) {
          lines.push(`${pad}} else {`);
          for (const s of stmt.elseBlock.body) emitStmt(s, indent + 1);
        }
        lines.push(`${pad}}`);
        break;
      }
      case 'While': {
        lines.push(`${pad}while (${genExprCpp(stmt.condition)}) {`);
        for (const s of stmt.body.body) emitStmt(s, indent + 1);
        lines.push(`${pad}}`);
        break;
      }
      case 'Block': {
        lines.push(`${pad}{`);
        for (const s of stmt.body) emitStmt(s, indent + 1);
        lines.push(`${pad}}`);
        break;
      }
    }
  }

  for (const stmt of ast.body) {
    emitStmt(stmt, 1);
  }

  lines.push('    return 0;');
  lines.push('}');
  return lines.join('\n');
}

export function generateJava(ast: ProgramNode): string {
  const lines: string[] = [];
  lines.push('public class Out {');
  lines.push('    public static void main(String[] args) {');

  function emitStmt(stmt: StmtNode, indent: number): void {
    const pad = '    '.repeat(indent);
    switch (stmt.kind) {
      case 'VarDecl': {
        const typeStr = javaTypeStr(stmt.varType);
        if (stmt.init) {
          lines.push(`${pad}${typeStr} ${stmt.name} = ${genExprJava(stmt.init)};`);
        } else {
          lines.push(`${pad}${typeStr} ${stmt.name} = ${javaDefault(stmt.varType)};`);
        }
        break;
      }
      case 'Assign':
        lines.push(`${pad}${stmt.name} = ${genExprJava(stmt.value)};`);
        break;
      case 'Print':
        lines.push(`${pad}System.out.println(${genExprJava(stmt.expr)});`);
        break;
      case 'If': {
        lines.push(`${pad}if (${genExprJava(stmt.condition)}) {`);
        for (const s of stmt.thenBlock.body) emitStmt(s, indent + 1);
        if (stmt.elseBlock) {
          lines.push(`${pad}} else {`);
          for (const s of stmt.elseBlock.body) emitStmt(s, indent + 1);
        }
        lines.push(`${pad}}`);
        break;
      }
      case 'While': {
        lines.push(`${pad}while (${genExprJava(stmt.condition)}) {`);
        for (const s of stmt.body.body) emitStmt(s, indent + 1);
        lines.push(`${pad}}`);
        break;
      }
      case 'Block': {
        lines.push(`${pad}{`);
        for (const s of stmt.body) emitStmt(s, indent + 1);
        lines.push(`${pad}}`);
        break;
      }
    }
  }

  for (const stmt of ast.body) {
    emitStmt(stmt, 2);
  }

  lines.push('    }');
  lines.push('}');
  return lines.join('\n');
}

export function generatePy(ast: ProgramNode): string {
  const lines: string[] = [];

  function emitStmt(stmt: StmtNode, indent: number): void {
    const pad = '    '.repeat(indent);
    switch (stmt.kind) {
      case 'VarDecl': {
        if (stmt.init) {
          lines.push(`${pad}${stmt.name} = ${genExprPy(stmt.init)}`);
        } else {
          const def = stmt.varType === 'string' ? '""' : stmt.varType === 'bool' ? 'False' : stmt.varType === 'float' ? '0.0' : '0';
          lines.push(`${pad}${stmt.name} = ${def}`);
        }
        break;
      }
      case 'Assign':
        lines.push(`${pad}${stmt.name} = ${genExprPy(stmt.value)}`);
        break;
      case 'Print':
        lines.push(`${pad}print(${genExprPy(stmt.expr)})`);
        break;
      case 'If': {
        lines.push(`${pad}if ${genExprPy(stmt.condition)}:`);
        for (const s of stmt.thenBlock.body) emitStmt(s, indent + 1);
        if (stmt.elseBlock) {
          lines.push(`${pad}else:`);
          for (const s of stmt.elseBlock.body) emitStmt(s, indent + 1);
        }
        break;
      }
      case 'While': {
        lines.push(`${pad}while ${genExprPy(stmt.condition)}:`);
        for (const s of stmt.body.body) emitStmt(s, indent + 1);
        break;
      }
      case 'Block': {
        for (const s of stmt.body) emitStmt(s, indent);
        break;
      }
    }
  }

  for (const stmt of ast.body) {
    emitStmt(stmt, 0);
  }

  if (lines.length === 0) lines.push('pass');
  return lines.join('\n');
}

export function generateCode(ast: ProgramNode, target: TargetLanguage): string {
  switch (target) {
    case 'c': return generateC(ast);
    case 'cpp': return generateCpp(ast);
    case 'java': return generateJava(ast);
    case 'py': return generatePy(ast);
  }
}
