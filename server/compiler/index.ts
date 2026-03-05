import { Lexer, TOKEN_NAMES } from './lexer.js';
import { Parser } from './parser.js';
import { SemanticAnalyzer } from './sema.js';
import { IRGenerator, formatIR } from './ir.js';
import { generateCode } from './codegen.js';
import type { CompileRequest, CompileResult, CompilerError } from '@shared/schema.js';

export function compile(request: CompileRequest): CompileResult {
  const errors: CompilerError[] = [];

  const lexer = new Lexer(request.source);
  const tokens = lexer.tokenize();

  if (lexer.errors.length > 0) {
    for (const e of lexer.errors) {
      errors.push({ line: e.line, column: e.col, message: e.message, phase: 'lexer' });
    }
    return {
      success: false,
      generatedCode: '',
      ir: '',
      errors,
      target: request.target,
      tokens: tokens.map(t => ({
        type: TOKEN_NAMES[t.type],
        value: t.value,
        line: t.line,
        col: t.col,
      })),
    };
  }

  const parser = new Parser(tokens);
  const ast = parser.parse();

  if (parser.errors.length > 0) {
    for (const e of parser.errors) {
      errors.push({ line: e.line, column: e.col, message: e.message, phase: 'parser' });
    }
    return {
      success: false,
      generatedCode: '',
      ir: '',
      errors,
      target: request.target,
    };
  }

  const sema = new SemanticAnalyzer();
  sema.analyze(ast);

  if (sema.errors.length > 0) {
    for (const e of sema.errors) {
      errors.push({ line: e.line, column: e.col, message: e.message, phase: 'semantic' });
    }
    return {
      success: false,
      generatedCode: '',
      ir: '',
      errors,
      target: request.target,
    };
  }

  const irGen = new IRGenerator();
  const irInstructions = irGen.generate(ast);
  const irText = formatIR(irInstructions);

  const generatedCode = generateCode(ast, request.target);

  return {
    success: true,
    generatedCode,
    ir: irText,
    errors: [],
    target: request.target,
  };
}

export const EXAMPLES = [
  {
    name: 'Hello World',
    filename: 'hello.ml',
    description: 'Simple arithmetic with print',
    source: `int a = 10;
int b = 20;
print(a + b);`,
  },
  {
    name: 'While Loop',
    filename: 'loop.ml',
    description: 'Countdown loop with print',
    source: `int x = 3;
while (x > 0) {
  print(x);
  x = x - 1;
}`,
  },
  {
    name: 'Conditionals',
    filename: 'cond.ml',
    description: 'If/else with float comparison',
    source: `float f = 2.5;
if (f >= 2.0) {
  print("ok");
} else {
  print("no");
}`,
  },
  {
    name: 'Type Mixing',
    filename: 'types.ml',
    description: 'Int to float promotion',
    source: `int x = 5;
float y = 3.14;
float result = x + y;
print(result);`,
  },
  {
    name: 'Boolean Logic',
    filename: 'boolean.ml',
    description: 'Boolean variables and conditions',
    source: `int a = 10;
int b = 20;
bool isGreater = a > b;
if (isGreater) {
  print("a is greater");
} else {
  print("b is greater");
}`,
  },
  {
    name: 'Nested Blocks',
    filename: 'nested.ml',
    description: 'Nested control flow',
    source: `int i = 5;
while (i > 0) {
  if (i == 3) {
    print("three!");
  } else {
    print(i);
  }
  i = i - 1;
}`,
  },
  {
    name: 'String Output',
    filename: 'strings.ml',
    description: 'String variables and printing',
    source: `string greeting = "Hello, MiniLang!";
print(greeting);
string name = "World";
print(name);
int answer = 42;
print(answer);`,
  },
];
