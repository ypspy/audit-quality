#!/usr/bin/env node
/**
 * Reads all Markdown files in src/content/updates/,
 * parses individual items (link + optional !!! note) per quarterly file,
 * writes src/content/updates-index.json.
 *
 * New structure: one entry per item (disclosure/press release link),
 * rather than one entry per quarterly file.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(__dirname, "../src/content/updates");
const outputFile = path.resolve(__dirname, "../src/content/updates-index.json");

// Maps H3 section headings in quarterly docs to canonical source names
const H3_AGENCY_MAP = {
  "금융감독원": "금융감독원",
  "금융위원회": "금융위원회",
  "한국공인회계사회": "공인회계사회",
  "공인회계사회": "공인회계사회",
  "한국회계기준원": "회계기준원",
  "회계기준원": "회계기준원",
};

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  const body = match[2];
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

/**
 * Build a plain-text summary from collected !!! note content lines.
 */
function buildSummary(noteLines) {
  return noteLines
    .filter((l) => l && !l.startsWith("|") && !/^\|[-| ]+\|$/.test(l))
    .map((l) =>
      l
        .replace(/^-\s+/, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/`/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/**
 * Parse individual items from a quarterly document body.
 * Each `- (YY-MM-DD) [Title](URL)` line becomes one entry.
 * An immediately following `!!! note` block becomes its summary.
 *
 * Year inference: use `20` + two-digit year prefix (safe for 2020s content).
 */
function parseItemsFromBody(body) {
  const lines = body.split("\n");
  const items = [];

  let currentSource = "";
  let currentItem = null;
  let collectingNote = false;
  let noteLines = [];

  const finalizeCurrentItem = () => {
    if (currentItem) {
      currentItem.summary = buildSummary(noteLines);
      items.push(currentItem);
      currentItem = null;
      noteLines = [];
      collectingNote = false;
    }
  };

  for (const line of lines) {
    // H3 heading → new source section
    const h3Match = line.match(/^### (.+)$/);
    if (h3Match) {
      finalizeCurrentItem();
      const name = h3Match[1].trim();
      currentSource = H3_AGENCY_MAP[name] ?? name;
      continue;
    }

    // List item with date + markdown link
    const itemMatch = line.match(/^- \((\d{2}-\d{2}-\d{2})\) \[([^\]]+)\]\(([^)]+)\)/);
    if (itemMatch) {
      finalizeCurrentItem();
      const [, yy_mm_dd, title, url] = itemMatch;
      const [yy, mm, dd] = yy_mm_dd.split("-");
      const date = `20${yy}-${mm}-${dd}`;
      currentItem = { date, title, url, source: currentSource };
      continue;
    }

    // !!! note block start (4-space indent inside list item)
    if (currentItem && /^ {4}!!! note/.test(line)) {
      collectingNote = true;
      noteLines = [];
      continue;
    }

    // Collect note content lines (8-space indent)
    if (collectingNote && currentItem) {
      if (/^ {8}/.test(line)) {
        noteLines.push(line.trim());
      } else if (line.trim() === "") {
        // blank lines inside note are ok
      } else {
        // Non-indented content → end of note block
        collectingNote = false;
      }
    }
  }

  finalizeCurrentItem();
  return items;
}

function walk(dir, prefix = "") {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(full).isDirectory()) {
      entries.push(...walk(full, rel));
    } else if (name.endsWith(".md") && name !== "index.md") {
      entries.push({ full, quarterlySlug: rel.replace(/\.md$/, "") });
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

for (const { full, quarterlySlug } of files) {
  const raw = fs.readFileSync(full, "utf-8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const { data, body } = parseFrontmatter(raw);

  // Derive periodLabel from slug if not in frontmatter
  // e.g. "quality-updates/2024/2024-07-01_to_2024-09-30" → "2024-Q3"
  const slugPeriodLabel = (() => {
    const m = quarterlySlug.match(/(\d{4})-(\d{2})-\d{2}_to_\d{4}-\d{2}-\d{2}$/);
    if (!m) return "";
    const year = m[1];
    const month = parseInt(m[2], 10);
    const q = month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
    return `${year}-${q}`;
  })();
  const periodLabel = data.period_label || slugPeriodLabel;
  const items = parseItemsFromBody(body);

  for (const item of items) {
    index.push({
      quarterlySlug,
      path: `/updates/${quarterlySlug}`,
      url: item.url,
      title: item.title,
      date: item.date,
      source: item.source,
      periodLabel,
      summary: item.summary,
    });
  }
}

// Sort by date descending
index.sort((a, b) => (b.date > a.date ? 1 : -1));

fs.writeFileSync(outputFile, JSON.stringify(index, null, 2), "utf-8");
console.log(`build-updates-index: wrote ${index.length} entries → ${outputFile}`);
