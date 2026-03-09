#!/usr/bin/env node
/**
 * Chunks all updates markdown files and upserts embeddings into pgvector.
 * Requires:
 *   DATABASE_URL=postgres://...
 *   VOYAGE_API_KEY=...  (https://dash.voyageai.com/)
 * Usage: node scripts/index-regulations.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(__dirname, "../src/content/updates");
const indexFile = path.resolve(__dirname, "../src/content/updates-index.json");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

function chunkByHeadings(content, maxTokens = 500) {
  const lines = content.split("\n");
  const chunks = [];
  let currentHeading = "";
  let currentLines = [];

  function flush() {
    const text = currentLines.join("\n").trim();
    if (text.length > 50) {
      chunks.push({ heading: currentHeading, content: text });
    }
    currentLines = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,3}\s+(.+)/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1];
    } else {
      currentLines.push(line);
      // Rough token estimate: 1 token ≈ 2 chars (Korean)
      if (currentLines.join("\n").length > maxTokens * 2) {
        flush();
      }
    }
  }
  flush();
  return chunks;
}

async function embedTexts(texts) {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY required");
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: texts, model: "voyage-3" }),
  });
  if (!res.ok) throw new Error(`Voyage API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.data ?? []).map((d) => d.embedding ?? []);
}

async function main() {
  await client.connect();

  const index = JSON.parse(fs.readFileSync(indexFile, "utf-8"));

  // Per-item index: group by quarterlySlug to process each file once
  const slug = (e) => e.quarterlySlug ?? e.slug;
  const seen = new Set();
  for (const entry of index) {
    const quarterlySlug = slug(entry);
    if (seen.has(quarterlySlug)) continue;
    seen.add(quarterlySlug);

    const filePath = path.join(contentDir, `${quarterlySlug}.md`);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf-8");
    const content = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
    const chunks = chunkByHeadings(content);

    if (chunks.length === 0) continue;

    const title = entry.title ?? quarterlySlug;
    const entryPath = entry.path ?? `/updates/${quarterlySlug}`;
    const entryDate = entry.date ?? "";
    const entrySource = entry.source ?? (entry.sources?.[0] ?? "");

    await client.query("DELETE FROM regulations.chunks WHERE slug = $1", [quarterlySlug]);

    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const texts = batch.map((c) => `${title}\n${c.heading}\n${c.content}`);
      const embeddings = await embedTexts(texts);

      for (let j = 0; j < batch.length; j++) {
        const metadata = {
          title,
          date: entryDate,
          source: entrySource,
          path: entryPath,
          url: entry.url ?? `https://your-domain.com${entryPath}`,
        };
        await client.query(
          `INSERT INTO regulations.chunks (slug, heading, content, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5)`,
          [quarterlySlug, batch[j].heading, batch[j].content, JSON.stringify(metadata), JSON.stringify(embeddings[j])]
        );
      }
      console.log(`indexed ${quarterlySlug}: chunks ${i}–${i + batch.length - 1}`);
    }
  }

  await client.end();
  console.log("indexing complete");
}

main().catch((e) => { console.error(e); process.exit(1); });
