import { notFound } from "next/navigation";
import Link from "next/link";
import { DocRenderer } from "@/components/DocRenderer";
import { DocToc } from "@/components/DocToc";
import { UpdatesSearch } from "@/components/UpdatesSearch";
import { getDocBySlug, getDocSlugs, extractHeadings } from "@/lib/docs";
import { parseNav } from "@/lib/mkdocs-nav";
import { loadUpdatesIndex, uniqueSources } from "@/lib/updates-index";

type UpdatesPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateStaticParams() {
  const slugs = getDocSlugs("updates");
  const params: { slug?: string[] }[] = [];
  params.push({});
  for (const s of slugs) {
    if (s === "index") continue;
    params.push({ slug: s.split("/") });
  }
  return params;
}

export default async function UpdatesPage({ params }: UpdatesPageProps) {
  const { slug } = await params;
  const segments = slug ?? [];

  // Root path → index card view
  if (segments.length === 0) {
    const entries = loadUpdatesIndex();
    const allSources = uniqueSources(entries);
    return (
      <div className="flex-1 min-w-0 flex justify-center">
        <div className="w-full max-w-3xl px-6 py-8">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            규제 업데이트
          </h1>
          <UpdatesSearch entries={entries} allSources={allSources} />
        </div>
      </div>
    );
  }

  const doc = getDocBySlug("updates", segments);
  if (!doc) notFound();

  const headings = extractHeadings(doc.content);
  const currentPath = `/updates/${segments.join("/")}`;
  const { flatList } = parseNav("updates");
  const currentIdx = flatList.findIndex((l) => l.path === currentPath);
  const prev = currentIdx > 0 ? flatList[currentIdx - 1] : null;
  const next =
    currentIdx !== -1 && currentIdx < flatList.length - 1
      ? flatList[currentIdx + 1]
      : null;

  return (
    <div className="flex min-h-full">
      <div className="flex-1 min-w-0 flex justify-center">
        <div className="w-full max-w-3xl px-6 py-8">
          <DocRenderer source={doc.content} />
          {(prev || next) && (
            <nav className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-between gap-4">
              {prev ? (
                <Link
                  href={prev.path}
                  className="flex flex-col text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  <span className="text-xs text-gray-400 mb-1">이전</span>
                  <span>← {prev.label}</span>
                </Link>
              ) : (
                <div />
              )}
              {next ? (
                <Link
                  href={next.path}
                  className="flex flex-col text-right text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  <span className="text-xs text-gray-400 mb-1">다음</span>
                  <span>{next.label} →</span>
                </Link>
              ) : (
                <div />
              )}
            </nav>
          )}
        </div>
      </div>
      <DocToc headings={headings} />
    </div>
  );
}
