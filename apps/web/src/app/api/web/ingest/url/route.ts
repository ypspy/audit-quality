import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { ingestUrl } from "@/lib/ingestor-client";

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { url } = (await req.json()) as { url: string };
  if (!url) return NextResponse.json({ error: "url 필드가 필요합니다" }, { status: 400 });
  try {
    const result = await ingestUrl(url);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
