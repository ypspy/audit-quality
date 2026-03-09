const BASE = process.env.DOCUMENT_INGESTOR_URL ?? "http://document-ingestor:8010";

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `upstream error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function ingestUrl(url: string): Promise<{ text: string; error?: string }> {
  return fetchJson(`${BASE}/ingest/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export async function ingestFile(
  file: File
): Promise<{ file_id: string; type: string }> {
  const form = new FormData();
  form.append("file", file);
  return fetchJson(`${BASE}/ingest/file`, { method: "POST", body: form });
}

export async function summarize(payload: {
  text?: string;
  file_id?: string;
  source: string;
  category: string;
}): Promise<{ title: string; summary: string }> {
  return fetchJson(`${BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
  return fetchJson(`${BASE}/drd/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
