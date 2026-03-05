import type { Express } from "express";
import { createServer, type Server } from "http";
import { compile, EXAMPLES } from "./compiler/index.js";
import { compileRequestSchema } from "@shared/schema.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/compile", (req, res) => {
    try {
      const parsed = compileRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: [{ line: 0, column: 0, message: parsed.error.message, phase: 'parser' as const }],
          generatedCode: '',
          ir: '',
          target: 'c',
        });
      }
      const result = compile(parsed.data);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        errors: [{ line: 0, column: 0, message: err.message || 'Internal compiler error', phase: 'parser' as const }],
        generatedCode: '',
        ir: '',
        target: 'c',
      });
    }
  });

  app.get("/api/examples", (_req, res) => {
    res.json(EXAMPLES);
  });

  return httpServer;
}
