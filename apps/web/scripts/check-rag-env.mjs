#!/usr/bin/env node
/**
 * RAG 채팅용 환경 변수 점검 (web 컨테이너 또는 동일 .env 기준)
 *
 * 점검 항목:
 * - DATABASE_URL (또는 PGVECTOR_DATABASE_URL): pgvector 접속 가능 여부
 * - ANTHROPIC_API_KEY: 유효한 키가 .env에 설정되어 있는지 (값 노출 없이 존재·placeholder 여부만)
 * - VOYAGE_API_KEY: 있으면 RAG 검색 동작, 없으면 참조 문서 없이 Claude만 호출
 *
 * 실행: docker compose exec web node scripts/check-rag-env.mjs
 *       또는 로컬: cd apps/web && node scripts/check-rag-env.mjs (DATABASE_URL은 Docker 내부 주소 대신 localhost:5433 등으로 설정)
 */

import pg from "pg";

const placeholderPatterns = [
  /^your_anthropic_api_key_here$/i,
  /^your_voyage_api_key_here$/i,
  /^sk-ant-/i, // 유효한 Anthropic 키는 보통 이 prefix
];

function mask(value) {
  if (!value || typeof value !== "string") return "(없음)";
  if (value.length <= 8) return "***";
  return value.slice(0, 4) + "…" + value.slice(-4);
}

function isPlaceholder(key, value) {
  if (!value) return true;
  const v = value.trim();
  if (v.length < 10) return true;
  if (key === "ANTHROPIC_API_KEY" && /^sk-ant-[a-zA-Z0-9-]+$/i.test(v)) return false;
  if (key === "VOYAGE_API_KEY" && v.length >= 20 && !/your_|here$/i.test(v)) return false;
  return placeholderPatterns.some((p) => p.test(v)) || /change-me|optional|example/i.test(v);
}

async function checkDatabase() {
  const url = process.env.DATABASE_URL || process.env.PGVECTOR_DATABASE_URL;
  if (!url || !url.trim()) {
    return { ok: false, message: "DATABASE_URL 및 PGVECTOR_DATABASE_URL 모두 없음" };
  }
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    const res = await client.query("SELECT 1 AS n");
    if (res.rows?.[0]?.n !== 1) {
      return { ok: false, message: "SELECT 1 실패" };
    }
    const ext = await client.query(
      "SELECT extname FROM pg_extension WHERE extname = 'vector'"
    );
    const hasVector = ext.rows?.length > 0;
    return {
      ok: true,
      message: hasVector ? "접속 성공 (vector 확장 있음)" : "접속 성공 (vector 확장 없음 — RAG 벡터 쿼리 실패 가능)",
    };
  } catch (err) {
    return { ok: false, message: err.message || String(err) };
  } finally {
    await client.end();
  }
}

function checkAnthropic() {
  const raw = process.env.ANTHROPIC_API_KEY;
  const set = !!raw?.trim();
  const placeholder = set && isPlaceholder("ANTHROPIC_API_KEY", raw);
  return {
    set,
    placeholder,
    summary: !set
      ? "설정 안 됨 (채팅 API 실패)"
      : placeholder
        ? "설정됐으나 placeholder 가능성 (실제 키로 교체 여부 확인)"
        : "설정됨 (유효한 키 형태)",
    masked: mask(raw),
  };
}

function checkVoyage() {
  const raw = process.env.VOYAGE_API_KEY;
  const set = !!raw?.trim();
  const placeholder = set && isPlaceholder("VOYAGE_API_KEY", raw);
  return {
    set,
    placeholder,
    summary: !set
      ? "없음 → RAG 검색 비활성, 참조 문서 없이 Claude만 호출"
      : placeholder
        ? "설정됐으나 placeholder 가능성 → RAG 비활성 가능"
        : "있음 → RAG 검색(임베딩 + pgvector) 동작",
    masked: mask(raw),
  };
}

async function main() {
  console.log("=== RAG/채팅 환경 변수 점검 ===\n");

  console.log("1. DATABASE_URL (pgvector 접속)");
  const db = await checkDatabase();
  console.log(`   결과: ${db.ok ? "OK" : "FAIL"}`);
  console.log(`   메시지: ${db.message}\n`);

  console.log("2. ANTHROPIC_API_KEY");
  const anth = checkAnthropic();
  console.log(`   설정: ${anth.set ? "예" : "아니오"}`);
  console.log(`   값(마스킹): ${anth.masked}`);
  console.log(`   요약: ${anth.summary}\n`);

  console.log("3. VOYAGE_API_KEY");
  const voyage = checkVoyage();
  console.log(`   설정: ${voyage.set ? "예" : "아니오"}`);
  console.log(`   값(마스킹): ${voyage.masked}`);
  console.log(`   요약: ${voyage.summary}\n`);

  const allOk = db.ok && anth.set && !anth.placeholder;
  if (allOk && voyage.set && !voyage.placeholder) {
    console.log("=== 전체: RAG 채팅 정상 동작 가능 ===\n");
  } else if (allOk && !voyage.set) {
    console.log("=== Claude만 동작 (참조 문서 없음). VOYAGE_API_KEY 설정 시 RAG 활성화 ===\n");
  } else {
    console.log("=== 일부 항목 미설정/오류 — 위 요약 참고 후 .env 수정 및 컨테이너 재기동 ===\n");
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
