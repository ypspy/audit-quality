import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchRegulations } from "./tools/search.js";
import { getRegulation } from "./tools/get-doc.js";
import { listRegulations } from "./tools/list.js";

const server = new McpServer({
  name: "audit-regulations",
  version: "0.1.0",
});

server.tool(
  "search_regulations",
  "회계·감사 규제 업데이트 문서를 검색합니다.",
  {
    query: z.string().describe("검색어"),
    source: z.string().optional().describe("기관명 (금융감독원|금융위원회|회계기준원|공인회계사회)"),
    category: z.string().optional().describe("카테고리"),
    date_from: z.string().optional().describe("시작일 (YYYY-MM-DD)"),
    date_to: z.string().optional().describe("종료일 (YYYY-MM-DD)"),
    limit: z.number().optional().describe("최대 결과 수 (기본 5)"),
  },
  async (params) => {
    const results = searchRegulations(params);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.tool(
  "get_regulation",
  "특정 규제 문서의 전문을 조회합니다.",
  { slug: z.string().describe("문서 slug (예: quality-updates/2025/2025-10-01_to_2025-12-31)") },
  async ({ slug }) => {
    const doc = getRegulation(slug);
    if (!doc) {
      return { content: [{ type: "text", text: "문서를 찾을 수 없습니다." }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
  }
);

server.tool(
  "list_regulations",
  "최신 규제 업데이트 목록을 반환합니다.",
  {
    limit: z.number().optional().describe("최대 수 (기본 10)"),
    source: z.string().optional(),
    category: z.string().optional(),
  },
  async (params) => {
    const results = listRegulations(params);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
