import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { ingestFile } from "@/lib/ingestor-client";

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const file = form.get("file") as File;
  if (!file) return NextResponse.json({ error: "파일 없음" }, { status: 400 });
  const result = await ingestFile(file);
  return NextResponse.json(result);
}
