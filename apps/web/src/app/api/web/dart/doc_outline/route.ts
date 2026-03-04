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
    return NextResponse.json(
      { error: "url 쿼리 파라미터가 필요합니다" },
      { status: 400 }
    );
  }

  const url = `${DART_BASE}/api/v1/doc_outline?url=${encodeURIComponent(urlParam)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: json.error ?? "문서 아웃라인 조회 실패", details: json.details },
        { status: res.status }
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("dart doc_outline proxy error:", err);
    return NextResponse.json(
      { error: "DART 공시 서버에 연결할 수 없습니다." },
      { status: 502 }
    );
  }
}
