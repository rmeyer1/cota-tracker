import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// CJS build: __dirname is available natively. ESM dev: use import.meta.url.
// esbuild outputs CJS so we always use __dirname.
const currentDir = __dirname;

export function serveStatic(app: Express) {
  const distPath = path.resolve(currentDir, "..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
