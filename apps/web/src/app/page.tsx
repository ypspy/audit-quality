import { auth } from "@/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-4">감사품질 통합지원서비스</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          서비스를 이용하려면 로그인해 주세요.
        </p>
        <Link
          href="/api/auth/signin"
          className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Keycloak 로그인
        </Link>
      </div>
    );
  }

  const services = [
    { href: "/portal", label: "품질 포털", description: "품질 포털 대시보드 (Phase 2-2 이전 예정)" },
    { href: "/eval", label: "품질 평가", description: "리스크·통제 목록, 필터, 편집 (Phase 2-3 이전 예정)" },
    { href: "/timesheet", label: "타임시트", description: "목록, 생성, 수정, changelog" },
    { href: "/dart", label: "DART 공시", description: "공시 검색·조회" },
    { href: "/client", label: "현장 조회", description: "고객 조회, Split View, 탭" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">
        환영합니다, {session.user.name ?? session.user.email ?? "사용자"}님
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        아래 서비스로 이동할 수 있습니다.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map(({ href, label, description }) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm transition hover:border-gray-300 dark:hover:border-gray-700 hover:shadow"
            >
              <span className="font-semibold text-foreground">{label}</span>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
