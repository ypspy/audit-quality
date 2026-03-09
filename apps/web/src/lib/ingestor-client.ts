const BASE = process.env.DOCUMENT_INGESTOR_URL ?? "http://document-ingestor:8010";

export async function ingestUrl(url: string): Promise<{ text: string; error?: string }> {
  const res = await fetch(`${BASE}/ingest/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function ingestFile(
  file: File
): Promise<{ file_id: string; type: string } | { error: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/ingest/file`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: (err as { detail?: string }).detail ?? "파일 처리 실패" };
  }
  return res.json();
}

export async function summarize(payload: {
  text?: string;
  file_id?: string;
  source: string;
  category: string;
}): Promise<{ title: string; summary: string }> {
  const res = await fetch(`${BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function drdSave(payload: {
  title: string;
  url: string;
  date: string;
  source: string;
  year: string;
  quarter_filename: string;
  summary: string;
}): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/drd/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}
