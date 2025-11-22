import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { LayoutWrapper } from "./_components/layout/layout-wrapper";
import { Sidebar } from "./_components/layout/sidebar";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Bookclub",
  description: "A cute book club app",
  icons: [{ rel: "icon", url: "/favicon.svg" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-fuchsia-50 text-rose-900">
        <TRPCReactProvider>
          <Sidebar />
          <LayoutWrapper>{children}</LayoutWrapper>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
