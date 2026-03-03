import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const CLIENT_BASE =
  process.env.CLIENT_INTERNAL_URL ?? "http://local-inquiry-site:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params;

  try {
    const res = await fetch(`${CLIENT_BASE}/api/clients/${id}/deadlines`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "마감일 API 오류", detail: text },
        { status: res.status }
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("client deadlines proxy error:", err);
    return NextResponse.json(
      { error: "고객 서버에 연결할 수 없습니다." },
      { status: 502 }
    );
  }
}
