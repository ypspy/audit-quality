"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type ClientBasic = {
  id: number;
  company_name: string;
  status: string;
  primary_manager?: string;
  primary_manager_role?: string;
};

type PartnerTree = {
  partner_tree: { partner: string; clients: ClientBasic[] }[];
  inactive_clients: ClientBasic[];
  total_clients: number;
};

type ClientDetail = {
  id: number;
  company_name: string;
  year_established?: number;
  client_acceptance_year?: number;
  fein?: string;
  business_activity?: string;
  naics_code?: string;
  sic_code?: string;
  date_of_incorporation?: string;
  sos_control_no?: string;
  tax_type?: string;
  tax_return_type?: string;
  client_category?: string;
  payroll_provider?: string;
  accounting_basis?: string;
  phone?: string;
  fax?: string;
  status: string;
  note?: string;
  created_at?: string;
  primary_manager?: { name: string; role_type?: string };
  addresses?: { id: number; address_type: string; address_line1?: string; address_line2?: string; city?: string; state?: string; zip_code?: string; country?: string }[];
  managers?: { id: number; name: string; role_type?: string; is_primary: boolean }[];
  persons?: { id: number; name: string; title?: string; phone_business?: string; phone_cell?: string; email?: string; dob?: string }[];
  shareholders?: { id: number; name?: string; as_of_date?: string; authorized_stock?: number; number_of_stock?: number; address?: string; country?: string }[];
  related_parties?: { id: number; relation_type: string; name?: string; linked_client_id?: number; linked_client_name?: string }[];
  reverse_related_parties?: { id: number; relation_type: string; client_id: number; client_name: string }[];
  bank_accounts?: { id: number; bank_name?: string; purpose?: string; status: string; memo?: string }[];
  custom_entries?: { id: number; entry_name: string; fields: { id: number; field_name: string; field_value?: string }[] }[];
  notes?: { id: number; content: string; created_at?: string }[];
  engagement_deadlines?: { id: number; deadline_type: string; due_date?: string; is_completed: boolean; completed_at?: string; note?: string }[];
};

type TabType = { id: number; label: string };

function orDash(v: unknown): string {
  return v != null && v !== "" ? String(v) : "—";
}

function ClientDetailPane({ client, onOpenRelated }: { client: ClientDetail; onOpenRelated?: (id: number, name: string) => void }) {
  const [contactHistory, setContactHistory] = useState<{ changed_at: string; changed_by?: string; prev_manager?: string; new_manager?: string; prev_role?: string; new_role?: string; change_note?: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!client?.id) return;
    fetch(`/api/web/client/clients/${client.id}/contact-history`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then(setContactHistory)
      .catch(() => setContactHistory([]));
  }, [client?.id]);

  const pm = client?.primary_manager;
  const today = new Date();

  return (
    <div className="flex h-full flex-col overflow-auto p-4 text-sm">
      <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
        <h2 className="text-lg font-semibold">{client.company_name}</h2>
        <span className={`rounded px-2 py-0.5 text-xs ${client.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}>
          {client.status === "active" ? "활성" : "비활성"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div><span className="text-gray-500 dark:text-gray-400">CKP 주 담당자</span><div>{pm ? `${pm.name}${pm.role_type ? ` (${pm.role_type})` : ""}` : "—"}</div></div>
          <div><span className="text-gray-500 dark:text-gray-400">설립 연도</span><div>{orDash(client.year_established)}</div></div>
          <div><span className="text-gray-500 dark:text-gray-400">고객 수임 연도</span><div>{orDash(client.client_acceptance_year)}</div></div>
          <div><span className="text-gray-500 dark:text-gray-400">FEIN</span><div>{orDash(client.fein)}</div></div>
          <div><span className="text-gray-500 dark:text-gray-400">업종</span><div>{orDash(client.business_activity)}</div></div>
          <div><span className="text-gray-500 dark:text-gray-400">NAICS</span><div>{orDash(client.naics_code)}</div></div>
          <div><span className="text-gray-500 dark:text-gray-400">Tax Return Type</span><div>{orDash(client.tax_return_type)}</div></div>
          <div><span className="text-gray-500 dark:text-gray-400">전화</span><div>{orDash(client.phone)}</div></div>
          <div><span className="text-gray-500 dark:text-gray-400">등록일</span><div>{orDash(client.created_at)}</div></div>
          {client.note && <div className="col-span-2"><span className="text-gray-500 dark:text-gray-400">메모</span><div className="whitespace-pre-wrap">{client.note}</div></div>}
        </div>
        <div className="space-y-2">
          {client.engagement_deadlines && client.engagement_deadlines.length > 0 && (
            <div>
              <h3 className="mb-2 font-medium">Engagement Deadlines</h3>
              <table className="w-full border-collapse text-xs">
                <thead><tr><th className="border p-1 text-left">유형</th><th className="border p-1 text-left">Due Date</th><th className="border p-1 text-left">완료</th></tr></thead>
                <tbody>
                  {client.engagement_deadlines.map((d) => {
                    const due = d.due_date ? new Date(d.due_date) : null;
                    const urgent = due && !d.is_completed && (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 7;
                    return (
                      <tr key={d.id} className={urgent ? "bg-amber-50 dark:bg-amber-900/20" : ""}>
                        <td className="border p-1">{d.deadline_type}</td>
                        <td className="border p-1">{orDash(d.due_date)}</td>
                        <td className="border p-1">{d.is_completed ? "완료" : "미완료"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {client.addresses && client.addresses.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-medium">주소</h3>
          <table className="w-full border-collapse text-xs">
            <thead><tr><th className="border p-1 text-left">유형</th><th className="border p-1 text-left">주소</th></tr></thead>
            <tbody>
              {client.addresses.map((a) => (
                <tr key={a.id}>
                  <td className="border p-1">{a.address_type === "OFFICE" ? "사무실" : "우편"}</td>
                  <td className="border p-1">{[a.address_line1, a.address_line2, a.city, a.state, a.zip_code, a.country].filter(Boolean).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {client.managers && client.managers.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-medium">CKP 담당자</h3>
          <div className="space-y-1">
            {client.managers.map((m) => (
              <div key={m.id} className={m.is_primary ? "font-medium" : ""}>
                {m.name}{m.is_primary && " (Primary)"}{m.role_type ? ` — ${m.role_type}` : ""}
              </div>
            ))}
          </div>
          {contactHistory.length > 0 && (
            <div className="mt-2">
              <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                {showHistory ? "담당자 변경 이력 숨기기" : "담당자 변경 이력 보기"}
              </button>
              {showHistory && (
                <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  {contactHistory.map((h, i) => (
                    <li key={i}>{h.changed_at} · {h.changed_by || "—"} — {h.prev_manager || "—"} → {h.new_manager || "—"}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {client.persons && client.persons.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-medium">클라이언트 연락처</h3>
          <table className="w-full border-collapse text-xs">
            <thead><tr><th className="border p-1 text-left">이름</th><th className="border p-1 text-left">직책</th><th className="border p-1 text-left">전화</th><th className="border p-1 text-left">이메일</th></tr></thead>
            <tbody>
              {client.persons.map((p) => (
                <tr key={p.id}>
                  <td className="border p-1">{p.name}</td>
                  <td className="border p-1">{orDash(p.title)}</td>
                  <td className="border p-1">{orDash(p.phone_business || p.phone_cell)}</td>
                  <td className="border p-1">{orDash(p.email)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {((client.related_parties && client.related_parties.length > 0) || (client.reverse_related_parties && client.reverse_related_parties.length > 0)) && (
        <div className="mt-4">
          <h3 className="mb-2 font-medium">관계사</h3>
          <table className="w-full border-collapse text-xs">
            <thead><tr><th className="border p-1 text-left">관계</th><th className="border p-1 text-left">회사</th><th className="border p-1 text-left">열기</th></tr></thead>
            <tbody>
              {client.related_parties?.map((rp) => (
                <tr key={rp.id}>
                  <td className="border p-1">{rp.relation_type === "PARENT" ? "모회사" : rp.relation_type === "AFFILIATE" ? "계열사" : rp.relation_type === "BRANCH" ? "지점" : rp.relation_type}</td>
                  <td className="border p-1">{rp.linked_client_name || rp.name || "—"}</td>
                  <td className="border p-1">
                    {rp.linked_client_id && onOpenRelated && (
                      <button type="button" onClick={() => onOpenRelated(rp.linked_client_id!, rp.linked_client_name || "")} className="text-blue-600 hover:underline dark:text-blue-400">
                        탭으로 열기
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {client.reverse_related_parties?.map((rp) => (
                <tr key={rp.id}>
                  <td className="border p-1">{rp.relation_type}</td>
                  <td className="border p-1">{rp.client_name}</td>
                  <td className="border p-1">
                    {onOpenRelated && (
                      <button type="button" onClick={() => onOpenRelated(rp.client_id, rp.client_name)} className="text-blue-600 hover:underline dark:text-blue-400">
                        탭으로 열기
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {client.bank_accounts && client.bank_accounts.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-medium">은행 계좌</h3>
          <table className="w-full border-collapse text-xs">
            <thead><tr><th className="border p-1 text-left">은행명</th><th className="border p-1 text-left">용도</th><th className="border p-1 text-left">상태</th></tr></thead>
            <tbody>
              {client.bank_accounts.map((ba) => (
                <tr key={ba.id}>
                  <td className="border p-1">{orDash(ba.bank_name)}</td>
                  <td className="border p-1">{orDash(ba.purpose)}</td>
                  <td className="border p-1">{ba.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {client.notes && client.notes.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-medium">메모</h3>
          <div className="space-y-2">
            {client.notes.map((n) => (
              <div key={n.id} className="rounded border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
                <div className="text-gray-500 dark:text-gray-400">{n.created_at}</div>
                <div className="whitespace-pre-wrap">{n.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tree, setTree] = useState<PartnerTree | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [searchResults, setSearchResults] = useState<ClientBasic[] | null>(null);
  const [filter, setFilter] = useState<string>("__all__");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const id = searchParams.get("id");
    return id ? parseInt(id, 10) : null;
  });
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [tabs, setTabs] = useState<TabType[]>([]);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [splitMode, setSplitMode] = useState(false);

  const fetchTree = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/web/client/partner-tree", { credentials: "include" });
      if (!res.ok) throw new Error("파트너 트리를 불러올 수 없습니다.");
      const json = await res.json();
      setTree(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await fetch(`/api/web/client/clients/search?q=${encodeURIComponent(searchQuery.trim())}`, { credentials: "include" });
      if (!res.ok) throw new Error("검색에 실패했습니다.");
      const json = await res.json();
      setSearchResults(json.results || []);
    } catch {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchClient = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/web/client/clients/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("고객 정보를 불러올 수 없습니다.");
      const json = await res.json();
      setClientDetail(json);
      setSelectedId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    }
  }, []);

  useEffect(() => {
    void fetchTree();
  }, [fetchTree]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      const num = parseInt(id, 10);
      if (!isNaN(num)) {
        void fetchClient(num);
        setTabs((prev) => {
          if (prev.find((t) => t.id === num)) return prev;
          return [...prev, { id: num, label: `Client #${num}` }];
        });
        setActiveTab(num);
      }
    }
  }, [searchParams, fetchClient]);

  // 탭 라벨을 고객명으로 업데이트
  useEffect(() => {
    if (!clientDetail) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === clientDetail.id && t.label.startsWith("Client #")
          ? { ...t, label: clientDetail.company_name }
          : t
      )
    );
  }, [clientDetail]);

  const openTab = (id: number, label: string) => {
    setTabs((prev) => {
      const exists = prev.find((t) => t.id === id);
      if (exists) {
        setActiveTab(id);
        void fetchClient(id);
        router.replace(`/client?id=${id}`, { scroll: false });
        return prev;
      }
      return [...prev, { id, label }];
    });
    setActiveTab(id);
    void fetchClient(id);
    router.replace(`/client?id=${id}`, { scroll: false });
  };

  const closeTab = (id: number) => {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeTab === id) {
      const next = tabs.find((t) => t.id !== id);
      setActiveTab(next?.id ?? null);
      setClientDetail(null);
      setSelectedId(next?.id ?? null);
      if (next) void fetchClient(next.id);
    }
  };

  const handleClientClick = (c: ClientBasic) => {
    openTab(c.id, c.company_name);
  };

  const allClients = tree
    ? [...tree.partner_tree.flatMap((g) => g.clients), ...tree.inactive_clients]
    : [];

  const filteredClients =
    filter === "__all__"
      ? allClients
      : filter === "__inactive__"
        ? tree?.inactive_clients ?? []
        : tree?.partner_tree.find((g) => g.partner === filter)?.clients ?? [];

  const displayClients = searchResults !== null ? searchResults : filteredClients;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex w-[360px] shrink-0 flex-col gap-3 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void fetchSearch();
          }}
          className="flex gap-2 p-3"
        >
          <input
            type="text"
            placeholder="고객 검색…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
          />
          <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300">
            검색
          </button>
        </form>
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSearchResults(null);
            }}
            className="mx-3 text-xs text-gray-500 hover:underline dark:text-gray-400"
          >
            검색 닫기
          </button>
        )}

        {tree && (
          <div className="flex flex-wrap gap-1 px-3">
            <button
              type="button"
              onClick={() => setFilter("__all__")}
              className={`rounded px-2 py-0.5 text-xs ${filter === "__all__" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-200 dark:bg-gray-700"}`}
            >
              전체
            </button>
            {tree.partner_tree.map((g) => (
              <button
                key={g.partner}
                type="button"
                onClick={() => setFilter(g.partner)}
                className={`rounded px-2 py-0.5 text-xs ${filter === g.partner ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                {g.partner}
              </button>
            ))}
            {tree.inactive_clients.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter("__inactive__")}
                className={`rounded px-2 py-0.5 text-xs ${filter === "__inactive__" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                비활성
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="p-4 text-sm text-gray-500 dark:text-gray-400">불러오는 중...</p>
          ) : error ? (
            <div className="p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button type="button" onClick={() => void fetchTree()} className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400">
                다시 시도
              </button>
            </div>
          ) : searchResults !== null ? (
            <div className="space-y-1 p-2">
              <p className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                검색 결과 {searchResults.length}건
              </p>
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleClientClick(c)}
                  className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${selectedId === c.id ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                >
                  {c.company_name}
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{c.primary_manager ?? "(미배정)"}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              <p className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                총 {tree?.total_clients ?? 0}개 고객
              </p>
              {displayClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleClientClick(c)}
                  className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${selectedId === c.id ? "bg-gray-100 dark:bg-gray-800" : ""} ${c.status === "inactive" ? "text-gray-500 dark:text-gray-400" : ""}`}
                >
                  {c.company_name}
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{c.primary_manager ?? "(미배정)"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {tabs.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={() => tabs.length >= 2 && setSplitMode((s) => !s)}
              disabled={tabs.length < 2}
              className={`rounded px-2 py-0.5 text-xs ${splitMode ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-200 dark:bg-gray-700"}`}
            >
              {splitMode ? "⬛ Single" : "⬜ Split"}
            </button>
            {tabs.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${activeTab === t.id ? "bg-gray-200 dark:bg-gray-700" : ""}`}
              >
                <button type="button" onClick={() => { setActiveTab(t.id); void fetchClient(t.id); }}>
                  {t.label}
                </button>
                <button type="button" onClick={() => closeTab(t.id)} className="hover:text-red-600">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={`min-h-0 flex-1 overflow-auto ${tabs.length >= 2 && splitMode ? "grid grid-cols-2 gap-2 p-2" : ""}`}>
          {tabs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
              <span className="text-4xl">👥</span>
              <p className="text-sm">왼쪽 목록에서 고객을 선택하거나 검색하세요.</p>
            </div>
          ) : splitMode && tabs.length >= 2 ? (
            tabs.slice(0, 2).map((t) => (
              <div key={t.id} className="overflow-auto rounded border border-gray-200 dark:border-gray-700">
                <ClientDetailLoader clientId={t.id} onOpenRelated={openTab} />
              </div>
            ))
          ) : clientDetail && selectedId === clientDetail.id ? (
            <ClientDetailPane client={clientDetail} onOpenRelated={openTab} />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
              불러오는 중...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientDetailLoader({ clientId, onOpenRelated }: { clientId: number; onOpenRelated: (id: number, name: string) => void }) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  useEffect(() => {
    fetch(`/api/web/client/clients/${clientId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then(setClient);
  }, [clientId]);
  if (!client) return <div className="p-4">
    <p className="text-sm text-gray-500 dark:text-gray-400">불러오는 중...</p>
  </div>;
  return <ClientDetailPane client={client} onOpenRelated={onOpenRelated} />;
}
