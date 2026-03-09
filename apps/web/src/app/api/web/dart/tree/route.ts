import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const DART_BASE =
  process.env.DART_INTERNAL_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session.user as { access_token?: string }).access_token;
  if (!accessToken) {
    return NextResponse.json(
      { error: "토큰을 찾을 수 없습니다. 다시 로그인해 주세요." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rcpNo = searchParams.get("rcpNo");
  if (!rcpNo) {
    return NextResponse.json({ error: "rcpNo required" }, { status: 400 });
  }

  const url = `${DART_BASE}/api/v1/dart/tree?rcpNo=${encodeURIComponent(rcpNo)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "트리 조회 실패", detail: text },
        { status: res.status }
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("dart tree proxy error:", err);
    return NextResponse.json(
      { error: "DART 공시 서버에 연결할 수 없습니다." },
      { status: 502 }
    );
  }
}
