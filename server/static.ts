import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// In CJS (production build), __dirname is native. In ESM (dev), use import.meta.url.
// Since esbuild bundles to CJS where import.meta is empty, we guard against undefined.
const currentDir = typeof import.meta !== "undefined" && import.meta.url
  ? dirname(fileURLToPath(import.meta.url))
  : __dirname;

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
