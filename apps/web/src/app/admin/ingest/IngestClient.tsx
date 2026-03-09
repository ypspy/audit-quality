"use client";
import { useState } from "react";

const SOURCES = ["금융감독원", "금융위원회", "공인회계사회", "회계기준원"];
const CATEGORIES = ["보도자료", "공시", "규정·예규", "기타"];

function currentQuarterInfo(): { year: string; filename: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const [qs, qe] =
    m <= 3 ? [`${y}-01-01`, `${y}-03-31`] :
    m <= 6 ? [`${y}-04-01`, `${y}-06-30`] :
    m <= 9 ? [`${y}-07-01`, `${y}-09-30`] :
             [`${y}-10-01`, `${y}-12-31`];
  return { year: String(y), filename: `${qs}_to_${qe}.md` };
}

type Status = "idle" | "fetching" | "summarizing" | "saving" | "done";

export function IngestClient() {
  const [source, setSource] = useState(SOURCES[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [url, setUrl] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  function reset() {
    setUrl(""); setExtractedText(""); setFileId(null);
    setTitle(""); setSummary(""); setStatus("idle"); setError("");
  }

  async function handleFetch() {
    setStatus("fetching"); setError("");
    try {
      const res = await fetch("/api/web/ingest/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "본문 추출 실패");
      setExtractedText(data.text ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("fetching"); setError("");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/web/ingest/file", { method: "POST", body: form });
      const data = await res.json() as { file_id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "파일 처리 실패");
      setFileId(data.file_id ?? null);
      setExtractedText("[PDF/HWP 파일 업로드 완료 — Claude가 직접 읽음]");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleSummarize() {
    setStatus("summarizing"); setError("");
    try {
      const payload = fileId
        ? { file_id: fileId, source, category }
        : { text: extractedText, source, category };
      const res = await fetch("/api/web/ingest/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { title?: string; summary?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "요약 생성 실패");
      setTitle(data.title ?? "");
      setSummary(data.summary ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleSave() {
    setStatus("saving"); setError("");
    const { year, filename } = currentQuarterInfo();
    try {
      const res = await fetch("/api/web/ingest/drd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, url, summary, source,
          date: new Date().toISOString().slice(0, 10),
          year,
          quarter_filename: filename,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="text-green-600 font-medium py-8 text-center">
        저장 완료.{" "}
        <button className="underline" onClick={reset}>
          새 항목 입력
        </button>
      </div>
    );
  }

  const busy = status !== "idle";

  return (
    <div className="space-y-6">
      {/* 기관·분류 */}
      <div className="flex gap-4">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* URL */}
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://fss.or.kr/..."
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button
          onClick={handleFetch}
          disabled={!url || busy}
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm disabled:opacity-50"
        >
          {status === "fetching" ? "가져오는 중..." : "내용 가져오기"}
        </button>
      </div>

      {/* 파일 업로드 */}
      <div>
        <label className="text-sm text-gray-500">또는 PDF/HWP 파일</label>
        <input
          type="file"
          accept=".pdf,.hwp,.hwpx"
          onChange={handleFileUpload}
          disabled={busy}
          className="ml-3 text-sm"
        />
      </div>

      {/* 추출 본문 */}
      {extractedText && (
        <div>
          <label className="block text-sm font-medium mb-1">추출된 본문 (편집 가능)</label>
          <textarea
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
            rows={8}
            className="w-full border rounded px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={handleSummarize}
            disabled={busy}
            className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded text-sm disabled:opacity-50"
          >
            {status === "summarizing" ? "요약 중..." : "요약 생성"}
          </button>
        </div>
      )}

      {/* 요약 결과 */}
      {title && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">요약 (편집 가능)</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={busy}
            className="px-6 py-2 bg-green-600 text-white rounded font-medium disabled:opacity-50"
          >
            {status === "saving" ? "저장 중..." : "DRD에 저장"}
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
