import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { summarize } from "@/lib/ingestor-client";

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const result = await summarize(body);
  return NextResponse.json(result);
}
