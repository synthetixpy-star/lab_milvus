"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

type Resultado = {
  score: number;
  texto: string;
  fuente: string;
  pagina: number;
};

function SearchForm() {
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [fuente, setFuente] = useState(params.get("fuente") ?? "");
  const [limit, setLimit] = useState(5);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [buscado, setBuscado] = useState(false);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/search/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, fuente: fuente || undefined, limit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error en la búsqueda");
      setResultados(data.resultados);
      setBuscado(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Búsqueda semántica</h1>
        <p className="text-gray-600 text-sm mt-1">Busca por significado, no solo por palabras exactas</p>
      </div>

      <form onSubmit={buscar} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-800">Consulta</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="¿De qué trata el documento?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 text-gray-800">Filtrar por documento (opcional)</label>
            <input
              type="text"
              value={fuente}
              onChange={(e) => setFuente(e.target.value)}
              placeholder="ORD_10_2020.pdf"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium mb-1 text-gray-800">Resultados</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[3, 5, 10].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {buscado && resultados.length === 0 && !loading && (
        <p className="text-gray-400 text-sm">Sin resultados para esta consulta.</p>
      )}

      {resultados.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">{resultados.length} resultados encontrados</p>
          {resultados.map((r, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{r.fuente} · pág. {r.pagina + 1}</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    r.score > 0.5 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {(r.score * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-sm text-gray-900 leading-relaxed">{r.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchForm />
    </Suspense>
  );
}
