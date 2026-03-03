"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "홈" },
  { href: "/portal", label: "품질 포털" },
  { href: "/eval", label: "품질 평가" },
  { href: "/timesheet", label: "타임시트" },
  { href: "/dart", label: "DART 공시" },
  { href: "/client", label: "현장 조회" },
  { href: "/policy", label: "정책" },
  { href: "/updates", label: "규제 업데이트" },
] as const;

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAuthPage = pathname?.startsWith("/api/auth");

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link
            href="/"
            className="shrink-0 text-lg font-semibold text-foreground hover:opacity-80"
          >
            감사품질 통합
          </Link>
          <ul className="flex shrink-0 flex-wrap items-center gap-1 overflow-x-auto py-1">
            {navItems.map(({ href, label }) => {
              const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-gray-100 dark:bg-gray-800 text-foreground"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex items-center gap-2">
          {status !== "loading" && !isAuthPage && (
            session?.user ? (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" }).then(() => router.refresh())}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-foreground"
              >
                로그아웃
              </button>
            ) : (
              <Link
                href="/api/auth/signin"
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-foreground"
              >
                로그인
              </Link>
            )
          )}
        </div>
      </nav>
    </header>
  );
}
