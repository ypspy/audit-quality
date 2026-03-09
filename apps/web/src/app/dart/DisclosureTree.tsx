"use client";

import { useEffect, useState } from "react";

type TocNode = {
  eleId: string;
  text: string;
  viewerUrl: string;
  depth: number;
  parent_eleId: string | null;
  children: TocNode[];
};

type DocumentEntry = {
  dcmNo: string | null;
  docKind: string;
  title: string;
  documentUrl: string;
  tocNodes: TocNode[];
};

type TreeData = {
  disclosure: {
    rcpNo: string;
    corpName: string;
    reportNm: string;
    bsnsYear: string;
    yearEnd: string;
    rcptDt: string;
    correctionType: string;
    url: string;
  } | null;
  documents: DocumentEntry[];
};

type Props = {
  treeData: TreeData | null;
  loading: boolean;
  error: string | null;
  selectedUrl: string | null;
  onSelectUrl: (url: string) => void;
};

export function DisclosureTree({ treeData, loading, error, selectedUrl, onSelectUrl }: Props) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  // 새 treeData 로드 시 첫 번째 문서 자동 펼침
  useEffect(() => {
    if (treeData?.documents?.length) {
      const firstKey = treeData.documents[0].dcmNo ?? "main";
      setExpandedDocs(new Set([firstKey]));
    }
  }, [treeData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          왼쪽에서 공시를 선택하면
          <br />
          문서 목차가 표시됩니다.
        </p>
      </div>
    );
  }

  const toggleDoc = (key: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 헤더: 공시 제목 */}
      {treeData.disclosure && (
        <div className="shrink-0 border-b border-gray-200 p-3 dark:border-gray-800">
          <p className="truncate text-xs font-semibold text-gray-700 dark:text-gray-300">
            {treeData.disclosure.corpName}
          </p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {treeData.disclosure.reportNm}
          </p>
        </div>
      )}

      {/* 문서·목차 트리 */}
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {treeData.documents.length === 0 && (
          <p className="p-4 text-xs text-gray-400 dark:text-gray-500">
            수집된 문서가 없습니다.
          </p>
        )}
        {treeData.documents.map((doc) => {
          const key = doc.dcmNo ?? "main";
          const isExpanded = expandedDocs.has(key);
          return (
            <div key={key}>
              {/* Level 2: 문서 행 */}
              <button
                type="button"
                onClick={() => {
                  toggleDoc(key);
                  onSelectUrl(doc.documentUrl);
                }}
                className="flex w-full items-center gap-1 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <span className="shrink-0 text-[10px] text-gray-400">
                  {isExpanded ? "▾" : "▸"}
                </span>
                <span className="flex-1 truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                  [{doc.docKind}] {doc.title}
                </span>
              </button>

              {/* Level 3: TOC 노드 트리 */}
              {isExpanded && doc.tocNodes.length > 0 && (
                <div className="border-l border-gray-100 dark:border-gray-800">
                  {doc.tocNodes.map((node) => (
                    <TocNodeItem
                      key={node.eleId}
                      node={node}
                      selectedUrl={selectedUrl}
                      onSelectUrl={onSelectUrl}
                    />
                  ))}
                </div>
              )}
              {isExpanded && doc.tocNodes.length === 0 && (
                <p className="px-6 py-1 text-xs text-gray-400 dark:text-gray-500">
                  목차 없음
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 재귀 TOC 노드 렌더링
function TocNodeItem({
  node,
  selectedUrl,
  onSelectUrl,
}: {
  node: TocNode;
  selectedUrl: string | null;
  onSelectUrl: (url: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isSelected = selectedUrl === node.viewerUrl;
  const hasChildren = node.children.length > 0;
  const paddingLeft = `${(node.depth + 1) * 12 + 12}px`;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelectUrl(node.viewerUrl);
          if (hasChildren) setOpen((o) => !o);
        }}
        style={{ paddingLeft }}
        className={[
          "flex w-full items-center gap-1 py-1 pr-3 text-left text-xs",
          "hover:bg-gray-50 dark:hover:bg-gray-800/60",
          isSelected
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "text-gray-700 dark:text-gray-300",
        ].join(" ")}
      >
        {hasChildren ? (
          <span className="shrink-0 text-[10px] text-gray-400">
            {open ? "▾" : "▸"}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="truncate">{node.text}</span>
      </button>

      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TocNodeItem
              key={child.eleId}
              node={child}
              selectedUrl={selectedUrl}
              onSelectUrl={onSelectUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
