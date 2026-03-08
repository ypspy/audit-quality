"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/mkdocs-nav";

function NavTree({ items, depth, pathname, onClose }: {
  items: NavItem[];
  depth: number;
  pathname: string;
  onClose: () => void;
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
                onClick={onClose}
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
        const open = item.children.some(
          (c) => c.type === "leaf" && c.path === pathname
        );
        return (
          <li key={item.label}>
            <details open={open} className="group">
              <summary className="flex cursor-pointer select-none items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 list-none">
                <svg className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item.label}
              </summary>
              <NavTree items={item.children} depth={depth + 1} pathname={pathname} onClose={onClose} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export function DocSidebarMobile({ nav }: { nav: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Hamburger button (mobile only) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3.5 left-4 z-40 rounded-md p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="목차 열기"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={[
          "md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-white dark:bg-gray-950 shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-label="문서 내비게이션"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">목차</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="닫기"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="overflow-y-auto h-[calc(100%-3rem)] py-4">
          <NavTree items={nav} depth={0} pathname={pathname} onClose={() => setOpen(false)} />
        </nav>
      </div>
    </>
  );
}
