import { Header } from "@/components/Header";
import { SellersList } from "@/components/SellersList";
import { Glossary } from "@/components/Glossary";
import { Guides } from "@/components/Guides";
import { loadSellers, loadGlossary, loadGuides } from "@/lib/notes";

export const dynamic = "force-static";

export default async function NotesPage() {
  const [sellers, glossary, guides] = await Promise.all([
    loadSellers(),
    loadGlossary(),
    loadGuides(),
  ]);
  return (
    <>
      <Header active="notes" />
      <main className="mx-auto max-w-[1180px] px-8 pb-24 pt-14">
        <SellersList data={sellers} />
        <Glossary data={glossary} />
        <Guides guides={guides} />
      </main>
    </>
  );
}
