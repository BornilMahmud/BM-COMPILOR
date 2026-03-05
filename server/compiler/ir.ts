import type {
  ProgramNode, StmtNode, ExprNode, BlockNode, DataType,
} from './ast.js';
import { getExprType } from './ast.js';

export type TacOp =
  | 'LABEL'
  | 'GOTO'
  | 'IF_FALSE_GOTO'
  | 'ASSIGN'
  | 'ASSIGN_LIT'
  | 'BINOP'
  | 'PRINT'
  | 'DECL';

export interface TacInstruction {
  op: TacOp;
  dest?: string;
  arg1?: string;
  arg2?: string;
  binop?: string;
  label?: string;
  dataType?: DataType;
  litValue?: string;
}

export class IRGenerator {
  private instructions: TacInstruction[] = [];
  private tempCount = 0;
  private labelCount = 0;

  generate(program: ProgramNode): TacInstruction[] {
    this.instructions = [];
    this.tempCount = 0;
    this.labelCount = 0;
    for (const stmt of program.body) {
      this.genStmt(stmt);
    }
    return this.instructions;
  }

  private newTemp(): string {
    return `t${this.tempCount++}`;
  }

  private newLabel(): string {
    return `L${this.labelCount++}`;
  }

  private emit(instr: TacInstruction): void {
    this.instructions.push(instr);
  }

  private genStmt(stmt: StmtNode): void {
    switch (stmt.kind) {
      case 'VarDecl': {
        this.emit({ op: 'DECL', dest: stmt.name, dataType: stmt.varType });
        if (stmt.init) {
          const src = this.genExpr(stmt.init);
          this.emit({ op: 'ASSIGN', dest: stmt.name, arg1: src });
        }
        break;
      }
      case 'Assign': {
        const src = this.genExpr(stmt.value);
        this.emit({ op: 'ASSIGN', dest: stmt.name, arg1: src });
        break;
      }
      case 'Print': {
        const val = this.genExpr(stmt.expr);
        const exprType = getExprType(stmt.expr) ?? 'int';
        this.emit({ op: 'PRINT', arg1: val, dataType: exprType });
        break;
      }
      case 'If': {
        const cond = this.genExpr(stmt.condition);
        const elseLabel = this.newLabel();
        const endLabel = this.newLabel();
        if (stmt.elseBlock) {
          this.emit({ op: 'IF_FALSE_GOTO', arg1: cond, label: elseLabel });
          this.genBlock(stmt.thenBlock);
          this.emit({ op: 'GOTO', label: endLabel });
          this.emit({ op: 'LABEL', label: elseLabel });
          this.genBlock(stmt.elseBlock);
          this.emit({ op: 'LABEL', label: endLabel });
        } else {
          this.emit({ op: 'IF_FALSE_GOTO', arg1: cond, label: endLabel });
          this.genBlock(stmt.thenBlock);
          this.emit({ op: 'LABEL', label: endLabel });
        }
        break;
      }
      case 'While': {
        const startLabel = this.newLabel();
        const endLabel = this.newLabel();
        this.emit({ op: 'LABEL', label: startLabel });
        const cond = this.genExpr(stmt.condition);
        this.emit({ op: 'IF_FALSE_GOTO', arg1: cond, label: endLabel });
        this.genBlock(stmt.body);
        this.emit({ op: 'GOTO', label: startLabel });
        this.emit({ op: 'LABEL', label: endLabel });
        break;
      }
      case 'Block': {
        this.genBlock(stmt);
        break;
      }
    }
  }

  private genBlock(block: BlockNode): void {
    for (const stmt of block.body) {
      this.genStmt(stmt);
    }
  }

  private genExpr(expr: ExprNode): string {
    switch (expr.kind) {
      case 'IntLit': {
        const tmp = this.newTemp();
        this.emit({ op: 'ASSIGN_LIT', dest: tmp, litValue: String(expr.value), dataType: 'int' });
        return tmp;
      }
      case 'FloatLit': {
        const tmp = this.newTemp();
        this.emit({ op: 'ASSIGN_LIT', dest: tmp, litValue: String(expr.value), dataType: 'float' });
        return tmp;
      }
      case 'StringLit': {
        const tmp = this.newTemp();
        this.emit({ op: 'ASSIGN_LIT', dest: tmp, litValue: JSON.stringify(expr.value), dataType: 'string' });
        return tmp;
      }
      case 'BoolLit': {
        const tmp = this.newTemp();
        this.emit({ op: 'ASSIGN_LIT', dest: tmp, litValue: expr.value ? 'true' : 'false', dataType: 'bool' });
        return tmp;
      }
      case 'VarRef': {
        return expr.name;
      }
      case 'BinaryExpr': {
        const left = this.genExpr(expr.left);
        const right = this.genExpr(expr.right);
        const tmp = this.newTemp();
        this.emit({
          op: 'BINOP',
          dest: tmp,
          arg1: left,
          arg2: right,
          binop: expr.op,
          dataType: expr.resolvedType,
        });
        return tmp;
      }
    }
  }
}

export function formatIR(instructions: TacInstruction[]): string {
  const lines: string[] = [];
  for (const instr of instructions) {
    switch (instr.op) {
      case 'LABEL':
        lines.push(`${instr.label}:`);
        break;
      case 'GOTO':
        lines.push(`  goto ${instr.label}`);
        break;
      case 'IF_FALSE_GOTO':
        lines.push(`  if_false ${instr.arg1} goto ${instr.label}`);
        break;
      case 'DECL':
        lines.push(`  decl ${instr.dataType} ${instr.dest}`);
        break;
      case 'ASSIGN':
        lines.push(`  ${instr.dest} = ${instr.arg1}`);
        break;
      case 'ASSIGN_LIT':
        lines.push(`  ${instr.dest} = ${instr.litValue}`);
        break;
      case 'BINOP':
        lines.push(`  ${instr.dest} = ${instr.arg1} ${instr.binop} ${instr.arg2}`);
        break;
      case 'PRINT':
        lines.push(`  print(${instr.arg1}) [${instr.dataType}]`);
        break;
    }
  }
  return lines.join('\n');
}
