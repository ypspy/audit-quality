// apps/web/src/lib/mkdocs-parser.ts

export type MarkdownSegment = { type: "markdown"; text: string };
export type AdmonitionSegment = {
  type: "admonition";
  admonType: string;
  title: string;
  collapsible: boolean;
  body: string;
};
export type TabsSegment = {
  type: "tabs";
  tabs: Array<{ name: string; body: string }>;
};
export type Segment = MarkdownSegment | AdmonitionSegment | TabsSegment;

const ADMONITION_RE = /^(!{3}|\?{3})\s+(\w+)\s*(?:"([^"]*)")?$/;
const TAB_RE = /^===\s+"([^"]+)"\s*$/;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function collectIndentedBody(
  lines: string[],
  startIndex: number,
  bodyIndent: number
): [string, number] {
  const body: string[] = [];
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      body.push("");
      i++;
    } else if (indentOf(line) >= bodyIndent) {
      body.push(line.substring(bodyIndent));
      i++;
    } else {
      break;
    }
  }
  while (body.length > 0 && body[body.length - 1] === "") body.pop();
  return [body.join("\n"), i];
}

export function parseSegments(content: string): Segment[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const segments: Segment[] = [];
  const mdBuffer: string[] = [];

  const flushMarkdown = () => {
    const text = mdBuffer.join("\n").trim();
    if (text) segments.push({ type: "markdown", text });
    mdBuffer.length = 0;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const indent = indentOf(line);
    const trimmed = line.trimStart();

    const admonMatch = trimmed.match(ADMONITION_RE);
    if (admonMatch) {
      flushMarkdown();
      const collapsible = admonMatch[1] === "???";
      const admonType = admonMatch[2].toLowerCase();
      const title = admonMatch[3] ?? "";
      const [body, next] = collectIndentedBody(lines, i + 1, indent + 4);
      i = next;
      segments.push({ type: "admonition", admonType, title, collapsible, body });
      continue;
    }

    const tabMatch = trimmed.match(TAB_RE);
    if (tabMatch) {
      flushMarkdown();
      const tabs: Array<{ name: string; body: string }> = [];
      const tabIndent = indent;
      while (i < lines.length) {
        const tl = lines[i];
        const tm = tl.trimStart().match(TAB_RE);
        if (!tm || indentOf(tl) !== tabIndent) break;
        const [body, next] = collectIndentedBody(lines, i + 1, tabIndent + 4);
        tabs.push({ name: tm[1], body });
        i = next;
      }
      if (tabs.length > 0) segments.push({ type: "tabs", tabs });
      continue;
    }

    mdBuffer.push(line);
    i++;
  }

  flushMarkdown();
  return segments;
}
