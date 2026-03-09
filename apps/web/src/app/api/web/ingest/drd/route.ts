import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { drdSave } from "@/lib/ingestor-client";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  try {
    const result = await drdSave(body);
    if (result.ok) {
      revalidatePath("/updates");
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
