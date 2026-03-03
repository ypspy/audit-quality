import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const QUALITY_EVAL_BASE =
  process.env.QUALITY_EVAL_INTERNAL_URL ?? "http://qualityeval:3000";

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
  const query = searchParams.toString();
  const url = `${QUALITY_EVAL_BASE}/risk-controls${query ? `?${query}` : ""}`;

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
        { error: "품질 평가 API 오류", detail: text },
        { status: res.status }
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("qualityEval proxy error:", err);
    return NextResponse.json(
      { error: "품질 평가 서버에 연결할 수 없습니다." },
      { status: 502 }
    );
  }
}
