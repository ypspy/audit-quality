import type { NavItem } from "@/lib/mkdocs-nav";
import { DocSidebar } from "./DocSidebar";
import { DocBackToTop } from "./DocBackToTop";

export function DocLayout({
  nav,
  children,
}: {
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <DocSidebar nav={nav} />
      <div className="flex-1 min-w-0">
        {children}
      </div>
      <DocBackToTop />
    </div>
  );
}
