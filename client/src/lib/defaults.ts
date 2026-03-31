import type { TargetLanguage } from "@shared/schema";

export const defaultCode: Record<TargetLanguage, string> = {
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
  py: `print("Hello, World!")\n`,
  js: `console.log("Hello, World!");\n\nconst nums = [1, 2, 3, 4, 5];\nconst sum = nums.reduce((a, b) => a + b, 0);\nconsole.log("Sum:", sum);\n`,
  ts: `const greet = (name: string): string => {\n  return \`Hello, \${name}!\`;\n};\n\nconsole.log(greet("World"));\n\nconst nums: number[] = [1, 2, 3, 4, 5];\nconst sum: number = nums.reduce((a, b) => a + b, 0);\nconsole.log("Sum:", sum);\n`,
  php: `<?php\n\necho "Hello, World!\\n";\n\n$nums = [1, 2, 3, 4, 5];\n$sum = array_sum($nums);\necho "Sum: $sum\\n";\n`,
  rb: `puts "Hello, World!"\n\nnums = [1, 2, 3, 4, 5]\nsum = nums.sum\nputs "Sum: #{sum}"\n`,
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n\n    nums := []int{1, 2, 3, 4, 5}\n    sum := 0\n    for _, n := range nums {\n        sum += n\n    }\n    fmt.Println("Sum:", sum)\n}\n`,
  rs: `fn main() {\n    println!("Hello, World!");\n\n    let nums = vec![1, 2, 3, 4, 5];\n    let sum: i32 = nums.iter().sum();\n    println!("Sum: {}", sum);\n}\n`,
  dart: `void main() {\n  print("Hello, World!");\n\n  List<int> nums = [1, 2, 3, 4, 5];\n  int sum = nums.reduce((a, b) => a + b);\n  print("Sum: \$sum");\n}\n`,
  sql: `-- BM Compiler — SQL Runner (SQLite engine)\nCREATE TABLE users (\n  id   INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  age  INTEGER\n);\n\nINSERT INTO users (name, age) VALUES ('Alice', 30);\nINSERT INTO users (name, age) VALUES ('Bob', 25);\nINSERT INTO users (name, age) VALUES ('Carol', 35);\n\nSELECT * FROM users;\nSELECT name FROM users WHERE age > 28 ORDER BY age;\n`,
  mysql: `-- BM Compiler — MySQL-compatible SQL (SQLite engine)\nCREATE TABLE products (\n  id    INTEGER PRIMARY KEY AUTOINCREMENT,\n  name  TEXT NOT NULL,\n  price REAL\n);\n\nINSERT INTO products (name, price) VALUES ('Apple', 1.20);\nINSERT INTO products (name, price) VALUES ('Banana', 0.50);\nINSERT INTO products (name, price) VALUES ('Cherry', 3.00);\n\nSELECT * FROM products;\nSELECT name, price FROM products WHERE price > 1.00 ORDER BY price DESC;\n`,
  ora: `-- BM Compiler — OracleSQL-compatible (SQLite engine)\nCREATE TABLE employees (\n  emp_id   INTEGER PRIMARY KEY,\n  emp_name TEXT NOT NULL,\n  salary   REAL,\n  dept     TEXT\n);\n\nINSERT INTO employees VALUES (1, 'Alice',  75000, 'Engineering');\nINSERT INTO employees VALUES (2, 'Bob',    60000, 'Marketing');\nINSERT INTO employees VALUES (3, 'Carol',  85000, 'Engineering');\n\nSELECT emp_name, salary FROM employees WHERE dept = 'Engineering' ORDER BY salary DESC;\nSELECT dept, AVG(salary) AS avg_salary FROM employees GROUP BY dept;\n`,
  sh: `#!/bin/bash\n\necho "Hello, World!"\n\nfor i in 1 2 3 4 5; do\n  echo "Number: $i"\ndone\n\nSUM=$((3 + 7))\necho "3 + 7 = $SUM"\n`,
};

const extMap: Record<string, TargetLanguage> = {
  c: "c",
  cpp: "cpp", cxx: "cpp", cc: "cpp",
  java: "java",
  py: "py",
  js: "js", mjs: "js",
  ts: "ts",
  php: "php",
  rb: "rb",
  go: "go",
  rs: "rs",
  dart: "dart",
  sql: "sql",
  mysql: "mysql",
  ora: "ora",
  sh: "sh", bash: "sh",
};

export function langFromFilename(name: string): TargetLanguage {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return extMap[ext] ?? "js";
}
