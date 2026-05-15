# Construcción de la app — 15 de Mayo de 2026

Todo lo construido en el servidor `65.109.99.208` durante esta sesión, desde la base de datos vectorial ya existente hasta la aplicación web completa con chat RAG.

---

## Punto de partida

El servidor ya tenía:
- Milvus corriendo con Docker Compose
- `venv` de Python con pymilvus, sentence-transformers, langchain, pymupdf
- Colección `pdf_collection` en Milvus con 64 chunks de 3 PDFs indexados:
  - `ORD_10_2020.pdf` — Ordenanza de gestión de residuos sólidos (21 chunks)
  - `ORD_11_2015.pdf` — Ordenanza de veredas inclusivas (21 chunks)
  - `ORD_12_2018.pdf` — Ordenanza de valores fiscales (22 chunks)
- **No había ningún script Python**, solo documentación en `.md`

---

## Lo que se construyó

### Fase 1 — Backend Django

**Instalación de dependencias:**
```
django==6.0.5
djangorestframework==3.17.1
django-cors-headers==4.9.0
gunicorn==26.0.0
openai==2.36.0
```

**Estructura creada:**
```
backend/
├── backend/
│   ├── settings.py         ← DRF, CORS, config Milvus y OpenAI
│   └── urls.py             ← rutas principales
├── api/
│   ├── milvus_service.py   ← lógica de vectores
│   ├── chat_service.py     ← lógica RAG + OpenAI
│   ├── views.py            ← 7 endpoints
│   └── urls.py             ← rutas de la API
└── requirements.txt
```

**`milvus_service.py`** — centraliza toda la interacción con Milvus:
- `index_pdf(path, filename)` — lee PDF, divide en chunks, genera embeddings, inserta en Milvus
- `search(query, limit, fuente)` — busca semánticamente por query
- `list_documents()` — agrupa chunks por fuente y devuelve stats por documento
- `get_chunks(fuente)` — devuelve todos los chunks de un documento ordenados por página
- `delete_document(fuente)` — elimina todos los chunks de un documento
- `get_stats()` — total chunks, documentos, modelo, índice

**`chat_service.py`** — implementa el patrón RAG:
1. Busca los 5 chunks más relevantes en Milvus con la pregunta del usuario
2. Arma un contexto con los fragmentos encontrados
3. Envía sistema + contexto + historial + pregunta a OpenAI
4. Devuelve la respuesta junto con las fuentes usadas y el conteo de tokens

**7 endpoints de la API:**

| Método | Endpoint | Función |
|--------|----------|---------|
| GET | `/api/stats/` | Estado general del sistema |
| GET | `/api/documents/` | Lista documentos con chunks y páginas |
| POST | `/api/documents/upload/` | Sube e indexa un PDF |
| GET | `/api/documents/{fuente}/chunks/` | Todos los chunks de un documento |
| DELETE | `/api/documents/{fuente}/` | Elimina un documento de Milvus |
| POST | `/api/search/` | Búsqueda semántica |
| POST | `/api/chat/` | Chat RAG con OpenAI |

**Servidor de producción:** Gunicorn con 2 workers en modo daemon, puerto `8001`.

---

### Fase 2 — Frontend Next.js

**Instalación:**
- Node.js `v20.20.2` vía nvm
- Next.js `16.2.6` con TypeScript y Tailwind CSS
- pm2 para gestión de procesos

**5 páginas construidas:**

#### `/` — Dashboard (Server Component)
- Tarjetas de estadísticas: total documentos, chunks, modelo, índice
- Lista de documentos indexados con links a "Ver chunks" y "Buscar"
- Botones de acceso rápido a Search y Upload
- Fetch directo al backend en el servidor (sin JavaScript en el cliente)

#### `/search` — Búsqueda semántica (Client Component)
- Input de consulta libre
- Filtro opcional por documento específico
- Selector de cantidad de resultados (3, 5, 10)
- Resultados con score de similitud en color (verde > 50%, amarillo < 50%)

#### `/upload` — Subir PDF (Client Component)
- Zona de drag & drop usando `<label>` nativo
- Indicador de estado: idle / uploading / ok / error
- Confirmación con nombre del archivo y cantidad de chunks indexados

#### `/documents/[fuente]` — Detalle de documento (Server Component)
- Muestra todos los chunks agrupados por página
- Link directo a búsqueda filtrada por ese documento

#### `/chat` — Chat RAG estilo ChatGPT (Client Component)
- Historial de conversación con burbujas diferenciadas (usuario / IA)
- Indicador de escritura animado (tres puntos)
- Fuentes expandibles debajo de cada respuesta (documento, página, score, fragmento)
- Contador de tokens usados por respuesta
- Filtro opcional por documento en la barra superior
- Sugerencias de preguntas en pantalla vacía
- Enter para enviar, Shift+Enter para nueva línea

---

### Fase 3 — Correcciones y mejoras

| Problema | Causa | Solución |
|----------|-------|----------|
| Upload no abría el selector de archivos | `onClick → inputRef.click()` bloqueado por el navegador | Reemplazado por `<label htmlFor>` nativo |
| 404 en `/upload.` | URL con punto al final en el navegador | URL correcta es `/upload` sin punto |
| Cross-origin bloqueado en dev | Next.js bloquea IPs externas por defecto | `allowedDevOrigins: ['65.109.99.208']` en `next.config.ts` |
| Contraste insuficiente | Textos `gray-400`/`gray-500` sobre fondo `gray-50` | Escalados a `gray-600`/`gray-700`/`gray-900` en toda la app |
| Next.js se caía solo | Sin gestor de procesos | Migrado a pm2 con `pm2 save` |
| Gunicorn no recargaba cambios | Proceso daemon con código cacheado | `kill + restart` después de cada cambio Python |
| GitHub bloqueó el push | API key de OpenAI hardcodeada en `settings.py` | Key movida a `backend/.env`, leída con `os.environ.get()` |

---

### Fase 4 — Configuración OpenAI

- Modelo inicial: `gpt-4o-mini`
- Modelo final: `gpt-4.1-nano` (el más económico disponible)

| Modelo | Input | Output |
|--------|-------|--------|
| gpt-4o | $2.50/1M | $10.00/1M |
| gpt-4o-mini | $0.15/1M | $0.60/1M |
| **gpt-4.1-nano** | **$0.10/1M** | **$0.40/1M** |

**Problema al hacer push:** GitHub bloqueó el commit porque la API key estaba hardcodeada en `settings.py`.

**Solución — variables de entorno:**

1. La key se movió a `backend/.env` (ignorado por git vía `.gitignore`)
2. `settings.py` ahora lee la key desde el entorno:
```python
import os
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_MODEL = 'gpt-4.1-nano'
```
3. Gunicorn se arranca exportando las variables primero:
```bash
export $(cat ~/lab_milvus/backend/.env | xargs)
gunicorn --chdir ~/lab_milvus/backend --bind 0.0.0.0:8001 backend.wsgi:application \
  --workers 2 --daemon --pid /tmp/gunicorn.pid --log-file /tmp/gunicorn.log
```

**Archivos agregados al `.gitignore`:**
```
.env
backend/.env
backend/media/
frontend/.env.local
frontend/node_modules/
```

---

### Fase 5 — Documentación

| Archivo | Contenido |
|---------|-----------|
| `conceptos.md` | Explicación de todas las tecnologías del servidor |
| `comandos.md` | Actualizado con Gunicorn, pm2, curl, arranque/parada completa |
| `construccion_app.md` | Este archivo |

---

## Estado final del sistema

```
lab_milvus/
├── docker-compose.yml
├── backend/
│   ├── backend/settings.py
│   ├── api/
│   │   ├── milvus_service.py
│   │   ├── chat_service.py
│   │   ├── views.py
│   │   └── urls.py
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── search/page.tsx
│   │   ├── upload/page.tsx
│   │   ├── chat/page.tsx
│   │   └── documents/[fuente]/page.tsx
│   ├── next.config.ts
│   └── .env.local
├── pdfs/output/
├── venv/
├── conceptos.md
├── comandos.md
├── configuracion_milvus.md
├── labmilvus.md
└── construccion_app.md
```

**Procesos corriendo:**

| Servicio | Gestor | Puerto |
|----------|--------|--------|
| Milvus + MinIO + etcd | Docker Compose | 19530 |
| Attu UI | Docker | 8000 |
| Django (Gunicorn, 2 workers) | daemon | 8001 |
| Next.js | pm2 | 3000 |

**URLs públicas:**

| Página | URL |
|--------|-----|
| Dashboard | http://65.109.99.208:3000 |
| Búsqueda | http://65.109.99.208:3000/search |
| Subir PDF | http://65.109.99.208:3000/upload |
| Chat IA | http://65.109.99.208:3000/chat |
| API | http://65.109.99.208:8001/api/ |
| Attu UI | http://65.109.99.208:8000 |
