# Conceptos del Servidor — Lab Milvus

Documentación explicativa de todas las tecnologías, herramientas y conceptos presentes en el servidor `65.109.99.208`.

---

## Arquitectura general

```
Usuario (navegador)
       │
       ▼
  Next.js :3000          ← Frontend (interfaz web)
       │
       ▼
  Django :8001           ← Backend (API REST)
       │
   ┌───┴────────────┐
   ▼                ▼
Milvus :19530    OpenAI API
(vectores)       (LLM externo)
```

---

## 1. Base de datos vectorial

### Milvus `v2.4.9`
Motor de búsqueda vectorial de código abierto. En lugar de buscar por coincidencia exacta de palabras, compara vectores numéricos que representan el **significado semántico** del texto.

**¿Por qué Milvus y no PostgreSQL o MongoDB?**
Las bases de datos tradicionales buscan por igualdad o rangos (`WHERE nombre = 'algo'`). Milvus busca por *similitud* entre vectores de alta dimensión, lo que permite encontrar textos con el mismo significado aunque usen palabras diferentes.

**Modo de instalación:** Standalone con Docker Compose.

**Tres contenedores que levanta:**

| Contenedor | Imagen | Rol |
|------------|--------|-----|
| `milvus-standalone` | `milvusdb/milvus:v2.4.9` | Motor principal de búsqueda vectorial |
| `milvus-minio` | `minio/minio` | Almacena los vectores como archivos (object storage) |
| `milvus-etcd` | `quay.io/coreos/etcd` | Guarda los metadatos y configuración del cluster |

### MinIO
Sistema de almacenamiento de objetos compatible con AWS S3. Milvus lo usa internamente para persistir los datos vectoriales en disco. No se interactúa directamente con él en la app, pero sin él Milvus no arranca.

Consola web: `http://65.109.99.208:9001` (usuario: `minioadmin`)

### etcd
Base de datos clave-valor distribuida, usada por Milvus para guardar su estado interno: qué colecciones existen, qué índices están cargados, configuración de seguridad. Tampoco se usa directamente.

---

## 2. Conceptos de búsqueda semántica

### Embeddings (vectores)
Un embedding es la representación numérica de un texto como un vector de 384 números (en este proyecto). Textos con significado similar tienen vectores *cercanos* en el espacio matemático.

```
"gestión de residuos"    → [0.23, -0.11, 0.87, ...]  (384 valores)
"manejo de desechos"     → [0.21, -0.09, 0.85, ...]  (muy cercano → mismo significado)
"receta de cocina"       → [-0.45, 0.67, -0.12, ...] (muy lejano → distinto significado)
```

### Modelo `all-MiniLM-L6-v2`
Modelo de la librería `sentence-transformers` (versión 5.5.0) que convierte texto en embeddings de 384 dimensiones. Corre **completamente local** en el servidor, sin API externa ni costo. Pesa ~90MB.

**¿Por qué este modelo?** Es un buen equilibrio entre velocidad, tamaño y calidad para textos en español e inglés.

### Chunks (fragmentos)
Los PDFs se dividen en fragmentos de ~500 caracteres con 50 de superposición (overlap). Cada chunk se convierte en un embedding y se guarda en Milvus.

```
PDF completo (8.900 chars)
       │
       ▼
 RecursiveCharacterTextSplitter
       │
       ▼
[chunk1 500c][chunk2 500c]...[chunk21 500c]   ← 21 fragmentos
```

El overlap de 50 caracteres evita que una idea quede cortada entre dos chunks.

### Índice HNSW
*Hierarchical Navigable Small World* — algoritmo que organiza los vectores en un grafo jerárquico para encontrar los más similares en milisegundos, sin comparar uno a uno.

Parámetros usados:
- `M: 16` — conexiones por nodo (más = más preciso pero más RAM)
- `efConstruction: 200` — calidad del índice durante la construcción

### Similitud coseno (COSINE)
Métrica que mide el ángulo entre dos vectores, ignorando su magnitud. Es la ideal para texto porque dos frases que dicen lo mismo con distintas palabras deberían tener el mismo ángulo aunque sus vectores sean de diferente longitud.

Un score de `1.0` = idénticos, `0.0` = sin relación, `-1.0` = opuestos.

### Colección `pdf_collection`
Tabla equivalente en Milvus con estos campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT64 | Clave primaria autoincremental |
| `vector` | FLOAT_VECTOR(384) | Embedding del chunk |
| `texto` | VARCHAR(2000) | Texto original del chunk |
| `fuente` | VARCHAR(500) | Nombre del PDF de origen |
| `pagina` | INT64 | Número de página |

---

## 3. RAG (Retrieval Augmented Generation)

Patrón que combina búsqueda semántica con un modelo de lenguaje para responder preguntas sobre documentos propios.

```
Pregunta del usuario
        │
        ▼
  Milvus search         ← busca los 5 chunks más relevantes
        │
        ▼
  Armar contexto        ← junta los chunks encontrados
        │
        ▼
  OpenAI API            ← [sistema + contexto + pregunta] → respuesta
        │
        ▼
  Respuesta al usuario  ← basada en los documentos reales
```

**¿Por qué RAG y no fine-tuning?** El fine-tuning requiere reentrenar el modelo cada vez que se agregan documentos nuevos. Con RAG, simplemente se indexa el nuevo PDF y ya está disponible para consultas.

---

## 4. Backend

### Django `6.0.5`
Framework web de Python. En este proyecto se usa solo como API REST — sin templates HTML ni base de datos SQL (no hay modelos Django activos).

### Django REST Framework (DRF) `3.17.1`
Extensión de Django que facilita construir APIs REST. Provee:
- `@api_view` — decorador para definir endpoints
- `Response` — respuestas JSON automáticas
- Parsers para multipart (subida de archivos)

### Gunicorn `26.0.0`
Servidor WSGI de producción para Python. Corre Django en modo daemon con 2 workers paralelos. A diferencia del servidor de desarrollo de Django (`manage.py runserver`), Gunicorn está diseñado para recibir tráfico real.

```bash
gunicorn --bind 0.0.0.0:8001 backend.wsgi:application --workers 2
```

### PyMuPDF (fitz) `1.27.2.3`
Librería para leer y extraer texto de PDFs. El nombre del módulo en Python es `fitz` (nombre histórico).

```python
import fitz
doc = fitz.open("documento.pdf")
texto = doc[0].get_text()   # extrae texto de la página 1
```

### LangChain Text Splitters `1.1.2`
Componente de LangChain usado exclusivamente para dividir texto en chunks con `RecursiveCharacterTextSplitter`. Intenta cortar en puntos lógicos (párrafos, oraciones) antes de cortar a mitad de una palabra.

### PyMilvus `3.0.0`
Cliente Python oficial de Milvus. Permite conectarse al servidor Milvus, crear colecciones, insertar vectores y hacer búsquedas semánticas.

### OpenAI SDK `2.36.0`
Cliente Python para consumir la API de OpenAI. Se usa para enviar el contexto RAG + la pregunta del usuario al modelo de lenguaje.

### CORS (Cross-Origin Resource Sharing)
Mecanismo de seguridad del navegador que bloquea requests desde un origen distinto al del servidor. Como el frontend (`:3000`) hace requests al backend (`:8001`), Django necesita el header `Access-Control-Allow-Origin`. Lo maneja `django-cors-headers` con `CORS_ALLOW_ALL_ORIGINS = True`.

---

## 5. Modelos de lenguaje (LLM)

### OpenAI `gpt-4.1-nano`
Modelo de lenguaje de OpenAI — el más económico disponible actualmente.

| Modelo | Input | Output | Calidad |
|--------|-------|--------|---------|
| gpt-4o | $2.50/1M tokens | $10.00/1M | Alta |
| gpt-4o-mini | $0.15/1M tokens | $0.60/1M | Buena |
| **gpt-4.1-nano** | **$0.10/1M tokens** | **$0.40/1M** | Básica |

Un **token** es aproximadamente 4 caracteres o ¾ de una palabra. Una consulta típica en este sistema consume ~1.000–2.000 tokens (contexto de 5 chunks + pregunta + respuesta).

---

## 6. Frontend

### Next.js `16.2.6`
Framework de React para construir aplicaciones web. Maneja el routing por sistema de archivos — cada carpeta dentro de `app/` es una ruta.

```
app/
├── page.tsx          → /           (Dashboard)
├── search/page.tsx   → /search     (Búsqueda)
├── upload/page.tsx   → /upload     (Subir PDF)
├── chat/page.tsx     → /chat       (Chat IA)
└── documents/
    └── [fuente]/
        └── page.tsx  → /documents/:fuente  (Detalle)
```

### Server Components vs Client Components
- **Server Components** (por defecto): se renderizan en el servidor. Pueden hacer `fetch` directo y no necesitan JavaScript en el navegador. Usados en el Dashboard y el detalle de documento.
- **Client Components** (`'use client'`): se ejecutan en el navegador. Necesarios para interactividad con `useState`, eventos, formularios. Usados en Search, Upload y Chat.

### React `19.2.4`
Librería de interfaz de usuario basada en componentes. Next.js lo incluye automáticamente.

### Tailwind CSS `4.x`
Framework de CSS basado en clases utilitarias. En lugar de escribir CSS custom, se aplican clases directamente en el HTML:

```html
<div class="bg-white rounded-lg border border-gray-200 p-4 text-sm">
```

### Node.js `v20.20.2` y npm `10.8.2`
Entorno de ejecución de JavaScript en el servidor. Next.js requiere Node.js para compilar y servir la aplicación.

### nvm (Node Version Manager)
Herramienta para instalar y gestionar múltiples versiones de Node.js. Instalado en `~/.nvm`.

---

## 7. Gestión de procesos

### pm2 `0.39.7` (daemon)
Process manager para Node.js. Mantiene Next.js corriendo permanentemente — si el proceso muere, lo reinicia automáticamente.

```bash
pm2 list              # ver procesos
pm2 logs nextjs       # ver logs
pm2 restart nextjs    # reiniciar
pm2 save              # guardar estado para reinicios del servidor
```

### Python venv
Entorno virtual de Python aislado en `~/lab_milvus/venv/`. Evita conflictos entre versiones de paquetes del sistema y del proyecto.

```bash
source ~/lab_milvus/venv/bin/activate   # activar
deactivate                               # salir
```

---

## 8. Infraestructura

### Docker `29.4.3`
Plataforma de contenedores. Empaqueta una aplicación y todas sus dependencias en un contenedor portable que corre igual en cualquier máquina.

### Docker Compose `v5.1.3`
Herramienta para orquestar múltiples contenedores con un solo archivo `docker-compose.yml`. Los tres contenedores de Milvus (standalone, minio, etcd) se levantan con `docker compose up -d`.

### UFW (Uncomplicated Firewall)
Firewall del servidor Ubuntu. Controla qué puertos son accesibles desde internet.

```bash
sudo ufw allow 3000/tcp    # abre el puerto de Next.js
sudo ufw allow 8001/tcp    # abre el puerto de Django
sudo ufw status            # ver reglas activas
```

---

## 9. Puertos del sistema

| Puerto | Servicio | Acceso |
|--------|----------|--------|
| 22 | SSH | Externo |
| 3000 | Next.js (frontend) | Externo |
| 8001 | Django/Gunicorn (API) | Externo |
| 8000 | Attu UI (panel Milvus) | Externo |
| 19530 | Milvus gRPC | Interno |
| 9000 | MinIO API | Interno |
| 9001 | MinIO consola | Externo |
| 9091 | Milvus HTTP/métricas | Interno |

---

## 10. Endpoints de la API

| Método | Endpoint | Función |
|--------|----------|---------|
| GET | `/api/stats/` | Estado general del sistema |
| GET | `/api/documents/` | Lista documentos indexados |
| POST | `/api/documents/upload/` | Sube e indexa un PDF |
| GET | `/api/documents/{fuente}/chunks/` | Chunks de un documento |
| DELETE | `/api/documents/{fuente}/` | Elimina un documento |
| POST | `/api/search/` | Búsqueda semántica |
| POST | `/api/chat/` | Chat RAG con OpenAI |
