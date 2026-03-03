"use client";

import { useEffect, useMemo, useState } from "react";

type RiskControl = {
  _id: string;
  index?: number;
  evalItem?: string;
  qualityRisk?: string;
  controlActivity?: string;
  preparer?: string;
  status?: string;
  reviewComments?: string;
};

type Props = {
  initialFilters?: {
    preparer?: string;
    status?: string;
    yearend?: string;
  };
};

type FilterState = {
  preparer: string;
  status: string;
  yearend: string;
};

export function EvalPageClient({ initialFilters }: Props) {
  const [items, setItems] = useState<RiskControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    preparer: initialFilters?.preparer ?? "all",
    status: initialFilters?.status ?? "all",
    yearend: initialFilters?.yearend ?? "all",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/web/eval/risk-controls", {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("품질 평가 데이터를 불러오지 못했습니다.");
        }
        const json = await res.json();
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const distinctPreparers = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((i) => i.preparer?.trim())
            .filter((v): v is string => !!v && v.length > 0)
        )
      ).sort(),
    [items]
  );

  const distinctStatuses = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((i) => i.status?.trim())
            .filter((v): v is string => !!v && v.length > 0)
        )
      ).sort(),
    [items]
  );

  const distinctYears = useMemo(
    () =>
      Array.from(
        new Set(
          items
            // yearend 필드는 문자열(예: "2023")일 것으로 가정
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((i: any) => i.yearend?.toString().trim())
            .filter((v): v is string => !!v && v.length > 0)
        )
      ).sort(),
    [items]
  );

  const filteredItems = useMemo(
    () =>
      items.filter((i) => {
        if (filters.preparer !== "all" && i.preparer !== filters.preparer) {
          return false;
        }
        if (filters.status !== "all" && i.status !== filters.status) {
          return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const yearend = (i as any).yearend?.toString();
        if (filters.yearend !== "all" && yearend !== filters.yearend) {
          return false;
        }
        return true;
      }),
    [items, filters]
  );

  const handleChangeFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpdate = async (id: string, patch: Partial<RiskControl>) => {
    setSavingId(id);
    setError(null);

    // Optimistic update
    setItems((prev) =>
      prev.map((item) => (item._id === id ? { ...item, ...patch } : item))
    );

    try {
      const res = await fetch(`/api/web/eval/risk-controls/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        throw new Error("저장에 실패했습니다.");
      }
      const json = await res.json();
      if (json?.item) {
        setItems((prev) =>
          prev.map((item) => (item._id === id ? json.item : item))
        );
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm text-gray-600 dark:text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-3">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoading(true);
            // 단순 새로고침으로 재시도
            window.location.reload();
          }}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-black dark:hover:bg-gray-300"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">품질 평가</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          리스크·통제 항목을 조회하고 담당자·상태·연도로 필터링한 뒤, 상태와 검토 의견을
          업데이트할 수 있습니다.
        </p>
      </header>

      <section className="flex flex-wrap gap-4 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-900/40">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            담당자
          </label>
          <select
            value={filters.preparer}
            onChange={(e) => handleChangeFilter("preparer", e.target.value)}
            className="min-w-[160px] rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="all">전체</option>
            {distinctPreparers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            상태
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleChangeFilter("status", e.target.value)}
            className="min-w-[140px] rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="all">전체</option>
            {distinctStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            연도
          </label>
          <select
            value={filters.yearend}
            onChange={(e) => handleChangeFilter("yearend", e.target.value)}
            className="min-w-[120px] rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="all">전체</option>
            {distinctYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto self-end text-xs text-gray-500 dark:text-gray-400">
          총 {filteredItems.length.toLocaleString()}건
        </div>
      </section>

      <section className="overflow-x-auto rounded-md border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-400">
              <th className="px-2 py-2 text-left">번호</th>
              <th className="px-2 py-2 text-left">평가 항목</th>
              <th className="px-2 py-2 text-left">품질위험</th>
              <th className="px-2 py-2 text-left">통제활동</th>
              <th className="px-2 py-2 text-left">담당자</th>
              <th className="px-2 py-2 text-left">상태</th>
              <th className="px-2 py-2 text-left">검토 의견</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr
                key={item._id}
                className="border-b border-gray-100 align-top last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/60"
              >
                <td className="px-2 py-2 text-xs text-gray-500">
                  {item.index ?? "-"}
                </td>
                <td className="px-2 py-2 max-w-xs">
                  <div className="line-clamp-3 text-xs font-medium text-foreground">
                    {item.evalItem ?? "-"}
                  </div>
                </td>
                <td className="px-2 py-2 max-w-xs">
                  <div className="line-clamp-3 text-xs text-gray-700 dark:text-gray-300">
                    {item.qualityRisk ?? "-"}
                  </div>
                </td>
                <td className="px-2 py-2 max-w-xs">
                  <div className="line-clamp-3 text-xs text-gray-700 dark:text-gray-300">
                    {item.controlActivity ?? "-"}
                  </div>
                </td>
                <td className="px-2 py-2 text-xs text-gray-700 dark:text-gray-300">
                  {item.preparer ?? "-"}
                </td>
                <td className="px-2 py-2 text-xs">
                  <select
                    value={item.status ?? ""}
                    onChange={(e) =>
                      void handleUpdate(item._id, { status: e.target.value })
                    }
                    className="min-w-[120px] rounded border border-gray-300 px-1 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                    disabled={savingId === item._id}
                  >
                    <option value="">(미지정)</option>
                    {distinctStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-xs">
                  <textarea
                    className="min-h-[56px] w-full rounded border border-gray-300 px-1 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                    value={item.reviewComments ?? ""}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row) =>
                          row._id === item._id
                            ? { ...row, reviewComments: e.target.value }
                            : row
                        )
                      )
                    }
                    onBlur={(e) =>
                      void handleUpdate(item._id, {
                        reviewComments: e.target.value,
                      })
                    }
                    disabled={savingId === item._id}
                  />
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400"
                >
                  조건에 해당하는 항목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {savingId && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          저장 중입니다...
        </p>
      )}
    </div>
  );
}

