import { Header } from "@/components/Header";
import { ImportClient } from "@/components/ImportClient";

export default function ImportPage() {
  return (
    <>
      <Header active="import" />
      <main className="mx-auto max-w-[1400px] px-8 pb-24 pt-10">
        <ImportClient />
      </main>
    </>
  );
}
