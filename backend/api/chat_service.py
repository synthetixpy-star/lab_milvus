from django.conf import settings
from openai import OpenAI

from .milvus_service import search

_client = None

SYSTEM_PROMPT = """Sos un asistente experto en análisis de ordenanzas y documentos municipales.
Respondé siempre en español, de forma clara y precisa.
Usá únicamente la información del contexto proporcionado para responder.
Si la información no está en el contexto, decilo claramente en lugar de inventar.
Cuando cites información, mencioná el documento fuente."""


def get_openai_client():
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def chat(mensaje: str, historial: list, fuente: str = None) -> dict:
    chunks = search(mensaje, limit=5, fuente=fuente)

    if chunks:
        contexto = "\n\n".join(
            f"[{c['fuente']} · pág. {c['pagina'] + 1}]\n{c['texto']}"
            for c in chunks
        )
        contexto_msg = f"Contexto relevante de los documentos:\n\n{contexto}"
    else:
        contexto_msg = "No se encontraron fragmentos relevantes en los documentos indexados."

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    for turno in historial:
        messages.append({"role": turno["role"], "content": turno["content"]})

    messages.append({
        "role": "user",
        "content": f"{contexto_msg}\n\nPregunta: {mensaje}",
    })

    client = get_openai_client()
    respuesta = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        temperature=0.3,
    )

    return {
        "respuesta": respuesta.choices[0].message.content,
        "fuentes": [
            {"fuente": c["fuente"], "pagina": c["pagina"], "score": c["score"], "texto": c["texto"]}
            for c in chunks
        ],
        "tokens": {
            "prompt": respuesta.usage.prompt_tokens,
            "completion": respuesta.usage.completion_tokens,
        },
    }
