export type DataType = 'int' | 'float' | 'bool' | 'string' | 'void';

export interface Loc {
  line: number;
  col: number;
}

export interface ProgramNode {
  kind: 'Program';
  body: StmtNode[];
  loc: Loc;
}

export type StmtNode =
  | VarDeclNode
  | AssignNode
  | PrintNode
  | IfNode
  | WhileNode
  | BlockNode;

export interface BlockNode {
  kind: 'Block';
  body: StmtNode[];
  loc: Loc;
}

export interface VarDeclNode {
  kind: 'VarDecl';
  varType: DataType;
  name: string;
  init?: ExprNode;
  loc: Loc;
}

export interface AssignNode {
  kind: 'Assign';
  name: string;
  value: ExprNode;
  loc: Loc;
}

export interface PrintNode {
  kind: 'Print';
  expr: ExprNode;
  loc: Loc;
}

export interface IfNode {
  kind: 'If';
  condition: ExprNode;
  thenBlock: BlockNode;
  elseBlock?: BlockNode;
  loc: Loc;
}

export interface WhileNode {
  kind: 'While';
  condition: ExprNode;
  body: BlockNode;
  loc: Loc;
}

export type ExprNode =
  | BinaryExprNode
  | IntLitNode
  | FloatLitNode
  | StringLitNode
  | BoolLitNode
  | VarRefNode;

export type BinOp = '+' | '-' | '*' | '/' | '==' | '!=' | '<' | '<=' | '>' | '>=';

export interface BinaryExprNode {
  kind: 'BinaryExpr';
  op: BinOp;
  left: ExprNode;
  right: ExprNode;
  resolvedType?: DataType;
  loc: Loc;
}

export interface IntLitNode {
  kind: 'IntLit';
  value: number;
  resolvedType?: DataType;
  loc: Loc;
}

export interface FloatLitNode {
  kind: 'FloatLit';
  value: number;
  resolvedType?: DataType;
  loc: Loc;
}

export interface StringLitNode {
  kind: 'StringLit';
  value: string;
  resolvedType?: DataType;
  loc: Loc;
}

export interface BoolLitNode {
  kind: 'BoolLit';
  value: boolean;
  resolvedType?: DataType;
  loc: Loc;
}

export interface VarRefNode {
  kind: 'VarRef';
  name: string;
  resolvedType?: DataType;
  loc: Loc;
}

export function getExprType(node: ExprNode): DataType | undefined {
  switch (node.kind) {
    case 'IntLit': return node.resolvedType ?? 'int';
    case 'FloatLit': return node.resolvedType ?? 'float';
    case 'StringLit': return node.resolvedType ?? 'string';
    case 'BoolLit': return node.resolvedType ?? 'bool';
    case 'VarRef': return node.resolvedType;
    case 'BinaryExpr': return node.resolvedType;
  }
}
