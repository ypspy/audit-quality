#!/usr/bin/env node
/**
 * Sync policy and quality-updates docs into apps/web for MDX serving.
 * Run from apps/web (npm run sync-docs) or repo root.
 * Source: ../../policy/my-project/docs, ../../quality-updates/docs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const cwd = process.cwd();
const isAppCwd = cwd === appRoot || cwd.startsWith(appRoot + path.sep);
const repoRoot = isAppCwd ? path.resolve(appRoot, "..", "..") : path.resolve(appRoot, "..", "..");
const contentDir = path.join(appRoot, "src", "content");

const sources = [
  { from: path.join(repoRoot, "policy", "my-project", "docs"), to: path.join(contentDir, "policy") },
  { from: path.join(repoRoot, "quality-updates", "docs"), to: path.join(contentDir, "updates") },
];

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn("sync-docs: skip (missing):", src);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const srcPath = path.join(src, name);
    const destPath = path.join(dest, name);
    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.mkdirSync(contentDir, { recursive: true });
for (const { from, to } of sources) {
  if (fs.existsSync(from)) {
    copyRecursive(from, to);
    console.log("sync-docs: copied", from, "->", to);
  } else {
    console.warn("sync-docs: skip (not found):", from);
  }
}
