import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

type Chunk = { id: number; pagina: number; texto: string };

async function getChunks(fuente: string) {
  const res = await fetch(
    `${API}/api/documents/${encodeURIComponent(fuente)}/chunks/`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json() as Promise<{ fuente: string; total: number; chunks: Chunk[] }>;
}

export default async function DocumentPage(props: PageProps<"/documents/[fuente]">) {
  const { fuente } = await props.params;
  const decoded = decodeURIComponent(fuente);
  const data = await getChunks(decoded);

  if (!data) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Volver</Link>
        <p className="text-red-500">Documento no encontrado.</p>
      </div>
    );
  }

  const paginas = [...new Set(data.chunks.map((c) => c.pagina))].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Volver</Link>
        <span className="text-gray-300">|</span>
        <Link
          href={`/search?fuente=${encodeURIComponent(decoded)}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Buscar en este documento →
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold break-all">{decoded}</h1>
        <p className="text-gray-700 text-sm mt-1">
          {data.total} chunks · {paginas.length} página{paginas.length !== 1 ? "s" : ""}
        </p>
      </div>

      {paginas.map((pagina) => {
        const chunksEnPagina = data.chunks.filter((c) => c.pagina === pagina);
        return (
          <div key={pagina}>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Página {pagina + 1}
            </h2>
            <div className="space-y-2">
              {chunksEnPagina.map((chunk, i) => (
                <div
                  key={chunk.id}
                  className="bg-white border border-gray-200 rounded-lg px-4 py-3"
                >
                  <p className="text-xs text-gray-600 mb-1">Chunk {i + 1}</p>
                  <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                    {chunk.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
