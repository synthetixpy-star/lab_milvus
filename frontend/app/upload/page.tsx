"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

type Estado = "idle" | "uploading" | "ok" | "error";

export default function UploadPage() {
  const [estado, setEstado] = useState<Estado>("idle");
  const [mensaje, setMensaje] = useState("");
  const [chunks, setChunks] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);

  async function subir(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setEstado("error");
      setMensaje("Solo se aceptan archivos PDF");
      return;
    }

    setEstado("uploading");
    setMensaje("");
    setChunks(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API}/api/documents/upload/`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al subir");
      setEstado("ok");
      setChunks(data.chunks_indexados);
      setMensaje(data.fuente);
    } catch (err: unknown) {
      setEstado("error");
      setMensaje(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) subir(file);
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      subir(file);
      e.target.value = "";
    }
  }

  function reset() {
    setEstado("idle");
    setMensaje("");
    setChunks(null);
  }

  if (estado === "ok") {
    return (
      <div className="space-y-6 max-w-lg">
        <div>
          <h1 className="text-2xl font-semibold">Subir PDF</h1>
          <p className="text-gray-700 text-sm mt-1">El documento se procesa e indexa automáticamente en Milvus</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center space-y-3">
          <p className="text-4xl">✓</p>
          <p className="font-medium text-green-800">{mensaje}</p>
          <p className="text-sm text-green-600">{chunks} chunks indexados en Milvus</p>
          <button
            onClick={reset}
            className="mt-2 px-4 py-2 border border-green-300 text-green-700 text-sm rounded-lg hover:bg-green-100 transition-colors"
          >
            Subir otro PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold">Subir PDF</h1>
        <p className="text-gray-700 text-sm mt-1">El documento se procesa e indexa automáticamente en Milvus</p>
      </div>

      <label
        htmlFor="pdf-input"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`block border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          estado === "uploading"
            ? "opacity-60 cursor-not-allowed border-gray-300"
            : drag
            ? "border-blue-400 bg-blue-50 cursor-copy"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50 cursor-pointer"
        }`}
      >
        <input
          id="pdf-input"
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={onSelect}
          disabled={estado === "uploading"}
        />
        {estado === "uploading" ? (
          <div className="space-y-3">
            <p className="text-3xl">⏳</p>
            <p className="text-sm text-gray-700">Procesando y indexando PDF...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-4xl text-gray-300">📄</p>
            <p className="text-sm font-medium text-gray-800">
              Arrastra un PDF aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-gray-600">Solo archivos .pdf</p>
          </div>
        )}
      </label>

      {estado === "error" && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
          <span>{mensaje}</span>
          <button onClick={reset} className="ml-4 underline text-xs">Reintentar</button>
        </div>
      )}
    </div>
  );
}
