"use client";

import { useCallback, useEffect, useState } from "react";
import { DisclosureTree } from "./DisclosureTree";

type Disclosure = {
  _id: string;
  rcept_no?: string;
  rceptNo?: string;
  corp_name?: string;
  corp_code?: string;
  year_end?: string;
  report_nm?: string;
  correction_type?: string;
  rcept_dt?: string;
  submitter?: string;
  url?: string;
};

function getRcpNo(d: Disclosure): string {
  const raw = d.rcept_no ?? d.rceptNo ?? new URLSearchParams(d.url?.split("?")[1] ?? "").get("rcpNo") ?? "";
  return typeof raw === "string" ? raw : String(raw);
}

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

type ApiResponse = {
  data: Disclosure[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

const DEFAULT_LIMIT = 20;

function formatDate(d: string | undefined): string {
  if (!d) return "-";
  try {
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString("ko-KR");
  } catch {
    return d;
  }
}

export function DartPageClient() {
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [selectedRcpNo, setSelectedRcpNo] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    corp_name: "",
    corp_code: "",
    year_end: "",
    report_nm: "",
    rcept_dt: "",
    submitter: "",
    sort: "rcept_dt",
    order: "desc" as "asc" | "desc",
  });

  const fetchDisclosures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(DEFAULT_LIMIT),
        sort: filters.sort,
        order: filters.order,
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.corp_name) params.set("corp_name", filters.corp_name);
      if (filters.corp_code) params.set("corp_code", filters.corp_code);
      if (filters.year_end) params.set("year_end", filters.year_end);
      if (filters.report_nm) params.set("report_nm", filters.report_nm);
      if (filters.rcept_dt) params.set("rcept_dt", filters.rcept_dt);
      if (filters.submitter) params.set("submitter", filters.submitter);

      const res = await fetch(`/api/web/dart/disclosures?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "공시 목록을 불러오지 못했습니다.");
      }

      const json: ApiResponse = await res.json();
      setDisclosures(json.data ?? []);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    void fetchDisclosures();
  }, [fetchDisclosures]);

  const fetchTree = useCallback(async (rcpNo: string) => {
    try {
      setTreeLoading(true);
      setTreeError(null);
      setTreeData(null);
      const res = await fetch(
        `/api/web/dart/tree?rcpNo=${encodeURIComponent(rcpNo)}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "트리 데이터를 불러오지 못했습니다.");
      }
      const json: TreeData = await res.json();
      setTreeData(json);
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setTreeLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void fetchDisclosures();
  };

  const handleRowClick = (d: Disclosure) => {
    const rcpNo = getRcpNo(d);
    if (!rcpNo) return;
    setSelectedRcpNo(rcpNo);
    setSelectedUrl(null);
    void fetchTree(rcpNo);
  };

  // http URL을 https로 정규화 (DART는 https 지원)
  const normalizedSelectedUrl = selectedUrl?.replace(/^http:\/\//, "https://");
  const iframeSrc = normalizedSelectedUrl
    ? `/api/web/dart/html_proxy?url=${encodeURIComponent(normalizedSelectedUrl)}`
    : null;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3">
      {/* Panel 1: 공시 목록 (280px) */}
      <div className="flex w-[280px] shrink-0 flex-col gap-2 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <form onSubmit={handleSearch} className="flex flex-col gap-2 p-3">
          <input
            type="text"
            placeholder="검색 (회사명, 보고서명 등)"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              placeholder="회사명"
              value={filters.corp_name}
              onChange={(e) => setFilters((f) => ({ ...f, corp_name: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
            />
            <input
              type="text"
              placeholder="고유번호"
              value={filters.corp_code}
              onChange={(e) => setFilters((f) => ({ ...f, corp_code: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
            />
            <input
              type="text"
              placeholder="결산월 (예: 12)"
              value={filters.year_end}
              onChange={(e) => setFilters((f) => ({ ...f, year_end: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
            />
            <input
              type="text"
              placeholder="접수일 (YYYY-MM-DD)"
              value={filters.rcept_dt}
              onChange={(e) => setFilters((f) => ({ ...f, rcept_dt: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-black dark:hover:bg-gray-300"
          >
            검색
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="p-4 text-sm text-gray-500 dark:text-gray-400">불러오는 중...</p>
          ) : error ? (
            <div className="space-y-2 p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                type="button"
                onClick={() => void fetchDisclosures()}
                className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-black"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <>
              <p className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
                총 {total.toLocaleString()}건 · {page}페이지
              </p>
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/90">
                  <tr>
                    <th className="border-b p-1.5 text-left font-medium">회사명</th>
                    <th className="border-b p-1.5 text-left font-medium">결산월</th>
                    <th className="border-b p-1.5 text-left font-medium">접수일</th>
                  </tr>
                </thead>
                <tbody>
                  {disclosures.map((d) => (
                    <tr
                      key={d._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleRowClick(d)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleRowClick(d);
                        }
                      }}
                      className={[
                        "cursor-pointer border-b border-gray-100 dark:border-gray-800",
                        "hover:bg-gray-50 dark:hover:bg-gray-800/60",
                        selectedRcpNo === getRcpNo(d)
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : "",
                      ].join(" ")}
                    >
                      <td className="max-w-[100px] truncate p-1.5" title={d.corp_name}>
                        {d.corp_name ?? "-"}
                      </td>
                      <td className="p-1.5">{d.year_end ?? "-"}</td>
                      <td className="p-1.5">{formatDate(d.rcept_dt)}</td>
                    </tr>
                  ))}
                  {disclosures.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-gray-500">
                        조건에 해당하는 공시가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="flex justify-between gap-2 p-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * DEFAULT_LIMIT >= total || loading}
                  className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Panel 2: 문서·목차 트리 (300px) */}
      <div className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <DisclosureTree
          treeData={treeData}
          loading={treeLoading}
          error={treeError}
          selectedUrl={selectedUrl}
          onSelectUrl={setSelectedUrl}
        />
      </div>

      {/* Panel 3: DART 뷰어 */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {iframeSrc ? (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-end gap-2 border-b border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-gray-800 dark:bg-gray-800/50">
              <a
                href={normalizedSelectedUrl ?? ""}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                DART에서 직접 보기 ↗
              </a>
            </div>
            <iframe
              src={iframeSrc}
              title="DART 공시 문서"
              className="min-h-0 flex-1 border-0"
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
            <span className="text-4xl">📄</span>
            <p className="text-sm">목차에서 항목을 선택하면 내용이 표시됩니다.</p>
            <p className="text-xs">
              원문은{" "}
              <a
                href="https://dart.fss.or.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                DART
              </a>
              에서 확인할 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
