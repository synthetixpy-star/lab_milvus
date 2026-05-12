# Plan de Test — Milvus con PDFs y Búsqueda Semántica

Verificar que Milvus funciona correctamente cargando PDFs reales, generando embeddings con modelos de lenguaje y haciendo búsquedas semánticas.

---

## Dependencias

| Librería | Uso |
|----------|-----|
| pymupdf | Leer PDFs y extraer texto |
| langchain | Dividir texto en chunks |
| sentence-transformers | Generar embeddings reales |
| numpy | Manejo de vectores |

---

## Paso a Paso

### Paso 1 — Instalar dependencias

Instalar todas las librerías necesarias en el entorno virtual:

```bash
source ~/lab_milvus/venv/bin/activate
pip install pymupdf langchain sentence-transformers numpy
```

El modelo `all-MiniLM-L6-v2` se descarga automáticamente la primera vez que se usa. Pesa ~90MB y corre completamente local, sin necesidad de API externa.

**Estado:** pendiente

---

### Paso 2 — Cargar y leer el PDF

Usar `pymupdf` para abrir el PDF y extraer el texto de cada página. El resultado es una lista de strings, uno por página.

```python
import fitz  # pymupdf

doc = fitz.open("documento.pdf")
paginas = [page.get_text() for page in doc]
print(f"{len(paginas)} páginas extraídas")
```

**Estado:** pendiente

---

### Paso 3 — Split del texto en chunks

Dividir el texto en fragmentos de ~500 caracteres con 50 de overlap (superposición) usando `RecursiveCharacterTextSplitter` de LangChain. El overlap evita que una idea quede cortada entre dos chunks.

```
Página completa → [chunk1, chunk2, chunk3, ...]
```

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
chunks = splitter.create_documents(paginas)
print(f"{len(chunks)} chunks generados")
```

**Estado:** pendiente

---

### Paso 4 — Generar embeddings reales

Usar el modelo `all-MiniLM-L6-v2` de `sentence-transformers` (gratuito, corre local, 384 dimensiones). Cada chunk de texto se convierte en un vector de 384 números que representa su significado semántico.

```
"El contrato vence en marzo" → [0.23, -0.11, 0.87, ...]  (384 valores)
```

```python
from sentence_transformers import SentenceTransformer

modelo = SentenceTransformer("all-MiniLM-L6-v2")
textos = [c.page_content for c in chunks]
embeddings = modelo.encode(textos, show_progress_bar=True)
print(f"Embeddings generados: {embeddings.shape}")
```

**Estado:** pendiente

---

### Paso 5 — Crear colección en Milvus

Crear una colección `pdf_collection` con los siguientes campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INT64 (PK) | Clave primaria autoincremental |
| vector | FLOAT_VECTOR(384) | Embedding del chunk |
| texto | VARCHAR(2000) | Texto original del chunk |
| fuente | VARCHAR(500) | Nombre del PDF de origen |
| pagina | INT64 | Número de página |

```python
from pymilvus import MilvusClient, DataType

client = MilvusClient(uri="http://localhost:19530", user="root", password="Milvus")

schema = client.create_schema(auto_id=True, enable_dynamic_field=False)
schema.add_field("id", DataType.INT64, is_primary=True)
schema.add_field("vector", DataType.FLOAT_VECTOR, dim=384)
schema.add_field("texto", DataType.VARCHAR, max_length=2000)
schema.add_field("fuente", DataType.VARCHAR, max_length=500)
schema.add_field("pagina", DataType.INT64)

client.create_collection("pdf_collection", schema=schema)
print("Colección creada OK")
```

**Estado:** pendiente

---

### Paso 6 — Insertar chunks en Milvus

Insertar todos los chunks con sus embeddings en la colección. Milvus los indexa para búsqueda rápida.

```python
import time

datos = [
    {
        "vector": embeddings[i].tolist(),
        "texto": textos[i],
        "fuente": "documento.pdf",
        "pagina": chunks[i].metadata.get("page", 0)
    }
    for i in range(len(textos))
]

inicio = time.time()
client.insert("pdf_collection", datos)
print(f"{len(datos)} chunks insertados en {time.time() - inicio:.2f}s")
```

**Estado:** pendiente

---

### Paso 7 — Crear índice HNSW

Crear un índice `HNSW` (más preciso que IVF_FLAT para textos) con métrica `COSINE` (ideal para similitud semántica entre textos).

```python
index_params = client.prepare_index_params()
index_params.add_index(
    field_name="vector",
    index_type="HNSW",
    metric_type="COSINE",
    params={"M": 16, "efConstruction": 200}
)

client.create_index("pdf_collection", index_params)
client.load_collection("pdf_collection")
print("Índice creado y colección cargada OK")
```

**Estado:** pendiente

---

### Paso 8 — Test de búsqueda semántica

Convertir una pregunta en texto a embedding con el mismo modelo y buscar los 5 chunks más similares en Milvus. Muestra el texto encontrado y el score de similitud.

```python
query = "¿De qué trata el documento?"
query_embedding = modelo.encode([query])

inicio = time.time()
resultados = client.search(
    collection_name="pdf_collection",
    data=query_embedding.tolist(),
    limit=5,
    output_fields=["texto", "fuente", "pagina"]
)
print(f"Búsqueda completada en {time.time() - inicio:.4f}s\n")

for i, r in enumerate(resultados[0]):
    print(f"Resultado {i+1} (score: {r['distance']:.4f})")
    print(f"  Página: {r['entity']['pagina']}")
    print(f"  Texto: {r['entity']['texto'][:200]}...")
    print()
```

Ejemplo de salida esperada:
```
Resultado 1 (score: 0.95): "El contrato vence el 31 de marzo de 2025..."
Resultado 2 (score: 0.87): "La fecha límite acordada entre las partes..."
```

**Estado:** pendiente

---

### Paso 9 — Test de búsqueda con filtro por fuente

Buscar solo dentro de un PDF específico usando filtro de metadata. Útil cuando hay múltiples PDFs cargados.

```python
resultados_filtrados = client.search(
    collection_name="pdf_collection",
    data=query_embedding.tolist(),
    limit=5,
    filter='fuente == "documento.pdf"',
    output_fields=["texto", "fuente", "pagina"]
)

print(f"{len(resultados_filtrados[0])} resultados filtrados por fuente")
```

**Estado:** pendiente

---

### Paso 10 — Reporte final

Mostrar un resumen completo del test:

```python
stats = client.get_collection_stats("pdf_collection")

print("=== REPORTE FINAL ===")
print(f"Total chunks en Milvus: {stats['row_count']}")
print(f"Dimensión de embeddings: 384")
print(f"Modelo usado: all-MiniLM-L6-v2")
print(f"Índice: HNSW / Métrica: COSINE")
print(f"Búsqueda semántica: OK")
print(f"Búsqueda con filtro: OK")
```

**Estado:** pendiente

---

## Resultado esperado

```
10 páginas extraídas
87 chunks generados
Embeddings generados: (87, 384)
Colección creada OK
87 chunks insertados en 0.43s
Índice creado y colección cargada OK

Búsqueda completada en 0.0021s
Resultado 1 (score: 0.95): "..."
Resultado 2 (score: 0.87): "..."
...

=== REPORTE FINAL ===
Total chunks en Milvus: 87
Dimensión de embeddings: 384
Modelo usado: all-MiniLM-L6-v2
Índice: HNSW / Métrica: COSINE
Búsqueda semántica: OK
Búsqueda con filtro: OK
```

---

## Notas

- El modelo `all-MiniLM-L6-v2` corre completamente local, sin API externa ni costo.
- `COSINE` es la métrica ideal para comparar textos (ignora la magnitud, solo compara dirección).
- `HNSW` es más preciso que `IVF_FLAT` para búsquedas semánticas en texto.
- El overlap de 50 caracteres entre chunks evita perder contexto en los cortes.
