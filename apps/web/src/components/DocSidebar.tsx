"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/mkdocs-nav";

function isActiveSection(item: NavItem, pathname: string): boolean {
  if (item.type === "leaf") return item.path === pathname;
  return item.children.some((child) => isActiveSection(child, pathname));
}

function NavTree({
  items,
  depth,
  pathname,
}: {
  items: NavItem[];
  depth: number;
  pathname: string;
}) {
  return (
    <ul className={depth > 0 ? "pl-3 border-l border-gray-200 dark:border-gray-700 ml-2" : ""}>
      {items.map((item) => {
        if (item.type === "leaf") {
          const active = item.path === pathname;
          return (
            <li key={item.label}>
              <Link
                href={item.path}
                className={[
                  "block px-3 py-1.5 text-sm rounded-md transition-colors",
                  active
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          );
        }
        // section
        const open = isActiveSection(item, pathname);
        return (
          <li key={item.label}>
            <details open={open} className="group">
              <summary className="flex cursor-pointer select-none items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 list-none">
                <svg
                  className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item.label}
              </summary>
              <NavTree items={item.children} depth={depth + 1} pathname={pathname} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export function DocSidebar({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <aside className="hidden md:block w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-6">
      <nav aria-label="문서 내비게이션">
        <NavTree items={nav} depth={0} pathname={pathname} />
      </nav>
    </aside>
  );
}
