import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const DART_BASE =
  process.env.DART_INTERNAL_URL ?? "http://localhost:4000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ corp_code: string }> }
) {
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

  const { corp_code } = await params;
  const url = `${DART_BASE}/api/company-names/${encodeURIComponent(corp_code)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "회사명 변경내역 조회 오류", detail: text },
        { status: res.status }
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("dart company-names proxy error:", err);
    return NextResponse.json(
      { error: "DART 공시 서버에 연결할 수 없습니다." },
      { status: 502 }
    );
  }
}
