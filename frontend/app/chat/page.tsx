"use client";

import { useState, useRef, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

type Role = "user" | "assistant";

type Fuente = {
  fuente: string;
  pagina: number;
  score: number;
  texto: string;
};

type Mensaje = {
  role: Role;
  content: string;
  fuentes?: Fuente[];
  tokens?: { prompt: number; completion: number };
  error?: boolean;
};

export default function ChatPage() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [fuenteFiltro, setFuenteFiltro] = useState("");
  const [fuenteAbierta, setFuenteAbierta] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || cargando) return;

    const nuevoMensaje: Mensaje = { role: "user", content: texto };
    const historialActual = mensajes.map(({ role, content }) => ({ role, content }));

    setMensajes((prev) => [...prev, nuevoMensaje]);
    setInput("");
    setCargando(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch(`${API}/api/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: texto,
          historial: historialActual,
          fuente: fuenteFiltro || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Error al consultar");

      setMensajes((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.respuesta,
          fuentes: data.fuentes,
          tokens: data.tokens,
        },
      ]);
    } catch (err: unknown) {
      setMensajes((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Error desconocido",
          error: true,
        },
      ]);
    } finally {
      setCargando(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  function limpiar() {
    setMensajes([]);
    setFuenteAbierta(null);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] -mx-6 -my-8">

      {/* Barra superior */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-gray-900">Chat con documentos</h1>
          {mensajes.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {Math.ceil(mensajes.length / 2)} turnos
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={fuenteFiltro}
            onChange={(e) => setFuenteFiltro(e.target.value)}
            placeholder="Filtrar por documento (opcional)"
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
          />
          {mensajes.length > 0 && (
            <button
              onClick={limpiar}
              className="text-sm text-gray-600 hover:text-red-600 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {mensajes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="text-5xl">💬</div>
            <p className="text-gray-700 font-medium">Preguntá sobre los documentos indexados</p>
            <p className="text-sm text-gray-500 max-w-sm">
              Las respuestas se generan combinando búsqueda semántica en Milvus con GPT
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                "¿Qué ordenanzas están indexadas?",
                "¿Qué establece la ordenanza sobre residuos sólidos?",
                "¿Cuáles son las sanciones previstas?",
              ].map((sugerencia) => (
                <button
                  key={sugerencia}
                  onClick={() => setInput(sugerencia)}
                  className="text-xs border border-gray-300 rounded-full px-3 py-1.5 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {sugerencia}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensajes.map((msg, i) => (
          <div key={i} className={`flex gap-3 max-w-3xl mx-auto ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
            }`}>
              {msg.role === "user" ? "Vos" : "AI"}
            </div>

            <div className={`flex-1 space-y-2 ${msg.role === "user" ? "items-end flex flex-col" : ""}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-tr-sm max-w-[80%]"
                  : msg.error
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-white border border-gray-200 text-gray-900 rounded-tl-sm"
              }`}>
                {msg.content}
              </div>

              {/* Fuentes */}
              {msg.fuentes && msg.fuentes.length > 0 && (
                <div className="w-full">
                  <button
                    onClick={() => setFuenteAbierta(fuenteAbierta === i ? null : i)}
                    className="text-xs text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                  >
                    <span>{fuenteAbierta === i ? "▾" : "▸"}</span>
                    {msg.fuentes.length} fragmentos usados como contexto
                    {msg.tokens && (
                      <span className="ml-2 text-gray-400">· {msg.tokens.prompt + msg.tokens.completion} tokens</span>
                    )}
                  </button>

                  {fuenteAbierta === i && (
                    <div className="mt-2 space-y-2">
                      {msg.fuentes.map((f, j) => (
                        <div key={j} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">{f.fuente} · pág. {f.pagina + 1}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              f.score > 0.5 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {(f.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{f.texto}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {cargando && (
          <div className="flex gap-3 max-w-3xl mx-auto">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-700 shrink-0">
              AI
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <span className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 bg-white border-t border-gray-200 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={onKeyDown}
            placeholder="Preguntá algo sobre los documentos... (Enter para enviar, Shift+Enter para nueva línea)"
            rows={1}
            disabled={cargando}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 placeholder:text-gray-400"
            style={{ minHeight: "48px", maxHeight: "160px" }}
          />
          <button
            onClick={enviar}
            disabled={cargando || !input.trim()}
            className="shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 rotate-90">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Las respuestas se basan en los documentos indexados en Milvus
        </p>
      </div>
    </div>
  );
}
