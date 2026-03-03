import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

type NavItem =
  | { href: string; label: string; external?: false; roles?: string[] }
  | { href: string; label: string; external: true; roles?: never };

const portalNavItems: NavItem[] = [
  { href: "/portal", label: "홈" },
  { href: "https://seonjin-qualitycontrol.github.io/policy/", label: "정책과 절차", external: true },
  { href: "/portal/forms", label: "Forms and Templates" },
  { href: "/portal/vsc", label: "Valuation Specialist Center" },
  { href: "/portal/qc", label: "품질관리실", roles: ["admin", "qc-manager"] },
];

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const roles = (session.user as { roles?: string[] }).roles ?? [];
  const filteredNav = portalNavItems.filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r))
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-4">
        {filteredNav.map((item) =>
          item.external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-foreground"
            >
              {item.label}
            </a>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-foreground"
            >
              {item.label}
            </Link>
          )
        )}
      </div>
      {children}
    </div>
  );
}
