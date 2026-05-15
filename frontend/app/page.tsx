import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

async function getStats() {
  try {
    const res = await fetch(`${API}/api/stats/`, { cache: "no-store" });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

async function getDocuments() {
  try {
    const res = await fetch(`${API}/api/documents/`, { cache: "no-store" });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export default async function Dashboard() {
  const [stats, docs] = await Promise.all([getStats(), getDocuments()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-gray-600 text-sm mt-1">Estado del sistema de búsqueda semántica</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Documentos", value: stats?.total_documentos ?? "—" },
          { label: "Chunks", value: stats?.total_chunks ?? "—" },
          { label: "Modelo", value: stats?.modelo ?? "—" },
          { label: "Índice", value: stats?.indice ?? "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-600 uppercase tracking-wide">{s.label}</p>
            <p className="mt-1 text-lg font-semibold truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Documentos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Documentos indexados</h2>
          <Link href="/upload" className="text-sm text-blue-600 hover:underline">
            + Subir PDF
          </Link>
        </div>

        {docs.length === 0 ? (
          <p className="text-gray-600 text-sm">No hay documentos. Sube un PDF para empezar.</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {docs.map((doc: { fuente: string; chunks: number; paginas: number }) => (
              <div key={doc.fuente} className="flex items-center justify-between px-4 py-3">
                <Link
                  href={`/documents/${encodeURIComponent(doc.fuente)}`}
                  className="flex-1 min-w-0 hover:text-blue-600 transition-colors"
                >
                  <p className="text-sm font-medium truncate">{doc.fuente}</p>
                  <p className="text-xs text-gray-600">{doc.paginas} páginas · {doc.chunks} chunks</p>
                </Link>
                <div className="flex gap-3 ml-4 shrink-0">
                  <Link
                    href={`/documents/${encodeURIComponent(doc.fuente)}`}
                    className="text-xs text-gray-700 hover:text-blue-600 hover:underline"
                  >
                    Ver chunks
                  </Link>
                  <Link
                    href={`/search?fuente=${encodeURIComponent(doc.fuente)}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Buscar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex gap-3">
        <Link
          href="/search"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Buscar en documentos
        </Link>
        <Link
          href="/upload"
          className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition-colors"
        >
          Subir nuevo PDF
        </Link>
      </div>
    </div>
  );
}
