import { Suspense } from "react";
import { SidebarNav, SidebarNavLinks } from "./sidebar-nav";

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-sidebar px-4 py-6 text-sidebar-foreground">
        <div className="mb-8 px-3 text-lg font-bold text-white">Metaphor</div>
        <Suspense fallback={<SidebarNavLinks pathname="" />}>
          <SidebarNav />
        </Suspense>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
