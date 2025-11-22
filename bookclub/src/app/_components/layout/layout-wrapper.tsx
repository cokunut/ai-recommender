"use client";

import { usePathname } from "next/navigation";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = pathname !== "/";

  return (
    <>
      {showSidebar && (
        <div
          className="fixed left-0 top-0 h-screen w-64 pointer-events-none"
          aria-hidden="true"
        />
      )}
      <div className={showSidebar ? "ml-64" : ""}>{children}</div>
    </>
  );
}

