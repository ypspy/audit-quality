#!/usr/bin/env node
/**
 * Chunks all updates markdown files and upserts embeddings into pgvector.
 * Requires:
 *   DATABASE_URL=postgres://...
 *   ANTHROPIC_API_KEY=...  (for voyage-3 embeddings via Anthropic)
 * Usage: node scripts/index-regulations.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(__dirname, "../src/content/updates");
const indexFile = path.resolve(__dirname, "../src/content/updates-index.json");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const anthropic = new Anthropic();

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
  const response = await anthropic.embeddings.create({
    model: "voyage-3",
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

async function main() {
  await client.connect();

  const index = JSON.parse(fs.readFileSync(indexFile, "utf-8"));

  for (const entry of index) {
    const filePath = path.join(contentDir, `${entry.slug}.md`);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf-8");
    const content = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
    const chunks = chunkByHeadings(content);

    if (chunks.length === 0) continue;

    // Delete existing chunks for this slug
    await client.query("DELETE FROM regulations.chunks WHERE slug = $1", [entry.slug]);

    // Embed in batches of 10
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const texts = batch.map((c) => `${entry.title}\n${c.heading}\n${c.content}`);
      const embeddings = await embedTexts(texts);

      for (let j = 0; j < batch.length; j++) {
        const metadata = {
          title: entry.title,
          date: entry.date,
          sources: entry.sources,
          category: entry.category,
          path: entry.path,
          url: `https://your-domain.com${entry.path}#${entry.slug}`,
        };
        await client.query(
          `INSERT INTO regulations.chunks (slug, heading, content, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5)`,
          [entry.slug, batch[j].heading, batch[j].content, JSON.stringify(metadata), JSON.stringify(embeddings[j])]
        );
      }
      console.log(`indexed ${entry.slug}: chunks ${i}–${i + batch.length - 1}`);
    }
  }

  await client.end();
  console.log("indexing complete");
}

main().catch((e) => { console.error(e); process.exit(1); });
