import "@/app/globals.css";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Agent Management Platform",
  description:
    "Create, customize, and deploy AI agents with specific personalities and knowledge domains without coding.",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div
          className={cn(
            "flex w-full flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-gray-100 md:flex-row dark:border-neutral-700 dark:bg-neutral-800",
            "h-screen"
          )}
        >
          <DashboardSidebar />
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
