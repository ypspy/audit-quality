import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import pg from "pg";

const anthropic = new Anthropic();
const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return [];
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: [text], model: "voyage-3" }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  return json.data?.[0]?.embedding ?? [];
}

async function retrieveChunks(embedding: number[], topK = 5) {
  if (!embedding?.length) return [];
  const embeddingStr = `[${embedding.join(",")}]`;
  const result = await pgPool.query(
    `SELECT slug, heading, content, metadata
     FROM regulations.chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [embeddingStr, topK]
  );
  return result.rows as {
    slug: string;
    heading: string;
    content: string;
    metadata: Record<string, unknown>;
  }[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = (body?.message as string) ?? "";
    const history = (body?.history as { role: "user" | "assistant"; content: string }[]) ?? [];
    if (!message?.trim()) {
      return Response.json({ error: "message required" }, { status: 400 });
    }

    // 1. Embed query
    const embedding = await embedQuery(message);

    // 2. Retrieve relevant chunks
    const chunks = await retrieveChunks(embedding);

    // 3. Build context
    const context = chunks
      .map((c, i) => {
        const meta = c.metadata;
        return `[${i + 1}] ${meta.title} — ${c.heading || "본문"}\n${c.content}`;
      })
      .join("\n\n---\n\n");

    const sources = chunks.map((c) => ({
      title: (c.metadata.title as string) || c.slug,
      url: (c.metadata.url as string) || (c.metadata.path as string) || `/updates/${c.slug}`,
      source: (c.metadata.source as string) || "",
      date: (c.metadata.date as string) || "",
    }));

    // 4. Stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            console.error("[chat] stream enqueue error:", e);
          }
        };

        try {
          const systemPrompt = `당신은 회계·감사 규제 전문 어시스턴트입니다.
아래 규제 문서를 참조하여 답변하고, 반드시 출처 번호([1], [2] 등)를 명시하세요.
조서 작성·리뷰 시 인용 가능한 형태로 명확하게 답변합니다.

[참조 문서]
${context}`;

          const claudeStream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
              ...history,
              { role: "user", content: message },
            ],
          });

          for await (const chunk of claudeStream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              send({ type: "delta", content: chunk.delta.text });
            }
          }

          send({ type: "sources", items: sources });
          send({ type: "done" });
        } catch (streamErr) {
          console.error("[chat] stream error:", streamErr);
          send({
            type: "error",
            message: "응답 생성 중 오류가 발생했습니다.",
            detail: String(streamErr),
          });
          send({ type: "done" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat] POST error:", err);
    return Response.json(
      { error: "채팅 처리 중 오류가 발생했습니다.", detail: String(err) },
      { status: 500 }
    );
  }
}
