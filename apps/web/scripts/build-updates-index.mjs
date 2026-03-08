#!/usr/bin/env node
/**
 * Reads all Markdown files in src/content/updates/,
 * extracts frontmatter + first 150 chars of body as summary,
 * writes src/content/updates-index.json.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(__dirname, "../src/content/updates");
const outputFile = path.resolve(__dirname, "../src/content/updates-index.json");

const AGENCY_MAP = {
  FSS: "금융감독원",
  FSC: "금융위원회",
  KICPA: "공인회계사회",
  KASB: "회계기준원",
};

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  // Simple YAML key-value parser (no nested objects needed here)
  const data = {};
  let body = match[2];
  const yaml = match[1];
  for (const line of yaml.split("\n")) {
    const kv = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
    const listKey = line.match(/^(\w[\w_]*)\s*:\s*$/);
    if (listKey) data[listKey[1]] = [];
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem) {
      const lastKey = Object.keys(data).at(-1);
      if (Array.isArray(data[lastKey])) data[lastKey].push(listItem[1].trim());
    }
  }
  return { data, body };
}

function extractSummary(body) {
  // Strip markdown syntax, take first 150 chars
  return body
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/[*_`>![\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

function walk(dir, prefix = "") {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(full).isDirectory()) {
      entries.push(...walk(full, rel));
    } else if (name.endsWith(".md") && name !== "index.md") {
      entries.push({ full, slug: rel.replace(/\.md$/, "") });
    }
  }
  return entries;
}

if (!fs.existsSync(contentDir)) {
  console.warn("build-updates-index: content dir missing, skipping");
  process.exit(0);
}

const files = walk(contentDir);
const index = [];

for (const { full, slug } of files) {
  const raw = fs.readFileSync(full, "utf-8");
  const { data, body } = parseFrontmatter(raw);

  const date =
    (data.period_end) ||
    (data.generated_at) ||
    slug.match(/(\d{4}-\d{2}-\d{2})(?:_to_(\d{4}-\d{2}-\d{2}))?/)?.[2] ||
    slug.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ||
    "";

  const rawAgencies = Array.isArray(data.agencies) ? data.agencies : [];
  const sources = rawAgencies.map((a) => AGENCY_MAP[a] ?? a);

  const summary = data.summary || extractSummary(body);

  index.push({
    slug,
    path: `/updates/${slug}`,
    title: data.title || slug,
    date,
    periodLabel: data.period_label || "",
    sources,                           // string[] e.g. ["금융감독원", "금융위원회"]
    category: data.category || "기타",
    tags: Array.isArray(data.tags) ? data.tags : [],
    summary,
  });
}

// Sort by date descending
index.sort((a, b) => (b.date > a.date ? 1 : -1));

fs.writeFileSync(outputFile, JSON.stringify(index, null, 2), "utf-8");
console.log(`build-updates-index: wrote ${index.length} entries → ${outputFile}`);
