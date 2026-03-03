"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseSegments, type Segment } from "@/lib/mkdocs-parser";
import { slugify } from "@/lib/slugify";

function childrenToText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  if (children && typeof children === "object" && "props" in (children as object)) {
    const el = children as { props: Record<string, unknown> };
    return childrenToText(el.props.children as React.ReactNode);
  }
  return "";
}

function MdLink({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  if (href?.startsWith("/")) return <Link href={href}>{children}</Link>;
  return (
    <a href={href ?? "#"} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function MdHeading({
  level,
  children,
}: {
  level: 2 | 3 | 4;
  children?: React.ReactNode;
}) {
  const id = slugify(childrenToText(children));
  const Tag = `h${level}` as "h2" | "h3" | "h4";
  return (
    <Tag id={id} className="group relative">
      {children}
      {id && (
        <a
          href={`#${id}`}
          className="ml-2 opacity-0 group-hover:opacity-50 text-gray-400 hover:text-gray-600 no-underline text-sm"
          aria-hidden="true"
        >
          #
        </a>
      )}
    </Tag>
  );
}

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
      aria-label="코드 복사"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

function MdPre({
  children,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const codeRef = useRef<HTMLPreElement>(null);
  return (
    <div className="relative group">
      <pre ref={codeRef} {...props}>
        {children}
      </pre>
      <CopyButton getText={() => codeRef.current?.textContent ?? ""} />
    </div>
  );
}

const MD_COMPONENTS = {
  a: MdLink,
  h2: ({ children }: { children?: React.ReactNode }) => (
    <MdHeading level={2}>{children}</MdHeading>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <MdHeading level={3}>{children}</MdHeading>
  ),
  pre: MdPre,
} as const;

type AdmonitionStyle = {
  border: string;
  bg: string;
  titleBg: string;
  titleColor: string;
  label: string;
};

const ADMONITION_STYLES: Record<string, AdmonitionStyle> = {
  note: {
    border: "border-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    titleBg: "bg-blue-100 dark:bg-blue-900/50",
    titleColor: "text-blue-800 dark:text-blue-200",
    label: "📝",
  },
  info: {
    border: "border-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    titleBg: "bg-blue-100 dark:bg-blue-900/50",
    titleColor: "text-blue-800 dark:text-blue-200",
    label: "ℹ️",
  },
  abstract: {
    border: "border-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    titleBg: "bg-blue-100 dark:bg-blue-900/50",
    titleColor: "text-blue-800 dark:text-blue-200",
    label: "📋",
  },
  success: {
    border: "border-green-400",
    bg: "bg-green-50 dark:bg-green-950/40",
    titleBg: "bg-green-100 dark:bg-green-900/50",
    titleColor: "text-green-800 dark:text-green-200",
    label: "✅",
  },
  tip: {
    border: "border-green-400",
    bg: "bg-green-50 dark:bg-green-950/40",
    titleBg: "bg-green-100 dark:bg-green-900/50",
    titleColor: "text-green-800 dark:text-green-200",
    label: "💡",
  },
  warning: {
    border: "border-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    titleBg: "bg-yellow-100 dark:bg-yellow-900/50",
    titleColor: "text-yellow-800 dark:text-yellow-200",
    label: "⚠️",
  },
  danger: {
    border: "border-red-500",
    bg: "bg-red-50 dark:bg-red-950/40",
    titleBg: "bg-red-100 dark:bg-red-900/50",
    titleColor: "text-red-800 dark:text-red-200",
    label: "🚨",
  },
  failure: {
    border: "border-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    titleBg: "bg-red-100 dark:bg-red-900/50",
    titleColor: "text-red-800 dark:text-red-200",
    label: "❌",
  },
  bug: {
    border: "border-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    titleBg: "bg-red-100 dark:bg-red-900/50",
    titleColor: "text-red-800 dark:text-red-200",
    label: "🐛",
  },
  example: {
    border: "border-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    titleBg: "bg-purple-100 dark:bg-purple-900/50",
    titleColor: "text-purple-800 dark:text-purple-200",
    label: "📌",
  },
  quote: {
    border: "border-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/40",
    titleBg: "bg-gray-100 dark:bg-gray-800/50",
    titleColor: "text-gray-700 dark:text-gray-300",
    label: "💬",
  },
};

const DEFAULT_STYLE: AdmonitionStyle = ADMONITION_STYLES.note;

function AdmonitionBlock({
  admonType,
  title,
  collapsible,
  body,
}: {
  admonType: string;
  title: string;
  collapsible: boolean;
  body: string;
}) {
  const style = ADMONITION_STYLES[admonType] ?? DEFAULT_STYLE;
  const displayTitle =
    title || admonType.charAt(0).toUpperCase() + admonType.slice(1);

  const bodyContent = (
    <div className="px-4 py-3">
      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
        <MkDocsContent content={body} />
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <details
        className={`border-l-4 rounded-r-md my-4 overflow-hidden ${style.border} ${style.bg}`}
      >
        <summary
          className={`flex items-center gap-2 px-4 py-2 font-semibold text-sm cursor-pointer select-none ${style.titleBg} ${style.titleColor}`}
        >
          <span>{style.label}</span>
          <span>{displayTitle}</span>
        </summary>
        {bodyContent}
      </details>
    );
  }

  return (
    <div
      className={`border-l-4 rounded-r-md my-4 overflow-hidden ${style.border} ${style.bg}`}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 font-semibold text-sm ${style.titleBg} ${style.titleColor}`}
      >
        <span>{style.label}</span>
        <span>{displayTitle}</span>
      </div>
      {bodyContent}
    </div>
  );
}

function TabsBlock({ tabs }: { tabs: Array<{ name: string; body: string }> }) {
  const [active, setActive] = useState(0);

  return (
    <div className="my-4 not-prose">
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map((tab, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={[
              "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              i === active
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
            ].join(" ")}
          >
            {tab.name}
          </button>
        ))}
      </div>
      <div className="border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-md p-4">
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
          <MkDocsContent content={tabs[active].body} />
        </div>
      </div>
    </div>
  );
}

function MkDocsContent({ content }: { content: string }) {
  const segments = parseSegments(content);

  return (
    <>
      {segments.map((seg: Segment, i: number) => {
        if (seg.type === "markdown") {
          return (
            <ReactMarkdown
              key={i}
              remarkPlugins={[remarkGfm]}
              components={MD_COMPONENTS}
            >
              {seg.text}
            </ReactMarkdown>
          );
        }
        if (seg.type === "admonition") {
          return (
            <AdmonitionBlock
              key={i}
              admonType={seg.admonType}
              title={seg.title}
              collapsible={seg.collapsible}
              body={seg.body}
            />
          );
        }
        if (seg.type === "tabs") {
          return <TabsBlock key={seg.tabs.map((t) => t.name).join("|")} tabs={seg.tabs} />;
        }
        return null;
      })}
    </>
  );
}

export function DocRenderer({ source }: { source: string }) {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <MkDocsContent content={source} />
    </article>
  );
}
