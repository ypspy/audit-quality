// apps/web/src/lib/mkdocs-nav.ts
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";

export type NavLeaf = { type: "leaf"; label: string; path: string };
export type NavSection = { type: "section"; label: string; children: NavItem[] };
export type NavItem = NavLeaf | NavSection;

export type ParsedNav = {
  items: NavItem[];
  flatList: NavLeaf[];
};

const NAV_BASE =
  process.env.NAV_BASE ?? path.join(process.cwd(), "src", "nav");

const BASE_URLS: Record<string, string> = {
  updates: "/updates",
  policy: "/policy",
};

function mkdocsPathToUrl(filePath: string, baseUrl: string): string {
  let p = filePath.startsWith("./") ? filePath.slice(2) : filePath;
  p = p.replace(/\.md$/, "");
  if (p === "index") return baseUrl;
  return `${baseUrl}/${p}`;
}

function parseNavItem(
  raw: Record<string, unknown>,
  baseUrl: string
): NavItem {
  const [label, value] = Object.entries(raw)[0];
  if (typeof value === "string") {
    return {
      type: "leaf",
      label,
      path: mkdocsPathToUrl(value, baseUrl),
    };
  }
  if (!Array.isArray(value)) {
    return { type: "section", label, children: [] };
  }
  const children = (value as Array<Record<string, unknown>>).map((child) =>
    parseNavItem(child, baseUrl)
  );
  return { type: "section", label, children };
}

function flattenLeaves(items: NavItem[]): NavLeaf[] {
  const result: NavLeaf[] = [];
  for (const item of items) {
    if (item.type === "leaf") result.push(item);
    else result.push(...flattenLeaves(item.children));
  }
  return result;
}

export function parseNav(section: "updates" | "policy"): ParsedNav {
  const filePath = path.join(
    NAV_BASE,
    section === "updates" ? "updates.yml" : "policy.yml"
  );
  if (!fs.existsSync(filePath)) {
    return { items: [], flatList: [] };
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = parseYaml(raw) as { nav?: Array<Record<string, unknown>> };
  const navRaw = parsed?.nav ?? [];
  const baseUrl = BASE_URLS[section];
  const items = navRaw.map((item) => parseNavItem(item, baseUrl));
  const flatList = flattenLeaves(items).filter((leaf) => leaf.path !== baseUrl);
  return { items, flatList };
}
