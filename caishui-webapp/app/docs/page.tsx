// app/docs/page.tsx — 文档列表（Server Component，服务端分页）。
import { listDocuments } from "@/lib/db/queries/documents";
import { DocTable } from "./components/DocTable";
import { DocsPageHeader } from "./components/DocsPageHeader";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const { items } = await listDocuments({ take: 20 });
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <DocsPageHeader />
      <DocTable documents={items} />
    </div>
  );
}
