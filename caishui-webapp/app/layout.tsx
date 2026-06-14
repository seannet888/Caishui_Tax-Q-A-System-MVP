import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/layout/TopNav";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "财税知识库问答",
  description: "面向中国财税领域、对政策时效与来源可信度有硬约束的问答系统",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="flex min-h-screen flex-col text-[color:var(--cs-ink)]">
          <TopNav />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <Sidebar />
            <main className="min-w-0 flex-1 overflow-auto px-4 py-5 md:px-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
