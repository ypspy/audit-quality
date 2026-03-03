import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { slugify } from "./slugify";

// standalone 런타임에서 process.cwd()가 예상과 다를 수 있으므로 env로 고정 가능
const CONTENT_BASE =
  process.env.CONTENT_BASE ?? path.join(process.cwd(), "src", "content");

export type DocSection = "policy" | "updates";

function contentDir(section: DocSection): string {
  return path.join(CONTENT_BASE, section);
}

/**
 * List all relative paths (slugs) for a section. Returns paths without .md.
 */
export function getDocSlugs(section: DocSection): string[] {
  const dir = contentDir(section);
  if (!fs.existsSync(dir)) return [];
  const slugs: string[] = [];
  function walk(dirPath: string, prefix: string) {
    for (const name of fs.readdirSync(dirPath)) {
      const full = path.join(dirPath, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (fs.statSync(full).isDirectory()) {
        walk(full, rel);
      } else if (name.endsWith(".md")) {
        slugs.push(rel.replace(/\.md$/, ""));
      }
    }
  }
  walk(dir, "");
  return slugs.sort();
}

/**
 * Get raw file path for a slug. Slug can be [] (index) or ['policy', '90-...'].
 */
function getFilePath(section: DocSection, slugSegments: string[]): string {
  const base = contentDir(section);
  if (slugSegments.length === 0) return path.join(base, "index.md");
  const rel = slugSegments.join(path.sep);
  const withExt = rel.endsWith(".md") ? rel : `${rel}.md`;
  return path.join(base, withExt);
}

const BASE_PATHS: Record<DocSection, string> = { policy: "/policy", updates: "/updates" };

/** Normalize relative .md links to Next.js paths (no .md, absolute with base). */
function normalizeLinks(content: string, section: DocSection): string {
  const base = BASE_PATHS[section];
  // 백슬래시 경로를 포워드 슬래시로 정규화 (Windows 스타일 링크 처리)
  content = content.replace(/\]\(([^)]*)\)/g, (_, href) =>
    `](${href.replace(/\\/g, "/")})`
  );
  return content
    .replace(/\]\((\.\/)([^)]+\.md)\)/g, (_, __, p) => `](${base}/${p.replace(/\.md$/, "")})`)
    .replace(/\]\((\.\.\/)+([^)]+)(\.md)?\)/g, (_, __, p) => `](${base}/${p.replace(/\.md$/, "")})`)
    .replace(/\]\(([^#)/][^)]*\.md)\)/g, (_, p) => `](${base}/${p.replace(/\.md$/, "")})`);
}

export function getDocBySlug(
  section: DocSection,
  slugSegments: string[]
): { content: string; data: Record<string, unknown> } | null {
  const dir = contentDir(section);
  if (!fs.existsSync(dir)) return null;
  const filePath = getFilePath(section, slugSegments);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { content, data } = matter(raw);
  return {
    content: normalizeLinks(content, section),
    data: data as Record<string, unknown>,
  };
}

export function getDocFilePath(section: DocSection, slugSegments: string[]): string {
  return getFilePath(section, slugSegments);
}

export function docExists(section: DocSection, slugSegments: string[]): boolean {
  return fs.existsSync(getFilePath(section, slugSegments));
}

export type Heading = { id: string; level: 2 | 3; text: string };

export function extractHeadings(content: string): Heading[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const headings: Heading[] = [];
  for (const line of normalized.split("\n")) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length as 2 | 3;
    const text = m[2].trim();
    const id = slugify(text);
    if (id) headings.push({ id, level, text });
  }
  return headings;
}
