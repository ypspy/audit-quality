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
  const urlParam = searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ error: "URL이 필요합니다" }, { status: 400 });
  }

  const url = `${DART_BASE}/api/html_proxy?url=${encodeURIComponent(urlParam)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const html = await res.text();
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("dart html_proxy error:", err);
    return new NextResponse(
      "<html><body><h3>문서 로드 실패</h3><p>서버 연결 오류</p></body></html>",
      {
        status: 502,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}
