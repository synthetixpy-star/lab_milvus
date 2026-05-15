import fitz
from django.conf import settings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymilvus import MilvusClient, DataType
from sentence_transformers import SentenceTransformer

_model = None
_client = None

COLLECTION = settings.MILVUS_COLLECTION
EMBED_DIM = 384


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def get_client():
    global _client
    if _client is None:
        _client = MilvusClient(
            uri=settings.MILVUS_URI,
            user=settings.MILVUS_USER,
            password=settings.MILVUS_PASSWORD,
        )
        _ensure_collection(_client)
    return _client


def _ensure_collection(client):
    if client.has_collection(COLLECTION):
        return
    schema = client.create_schema(auto_id=True, enable_dynamic_field=False)
    schema.add_field("id", DataType.INT64, is_primary=True)
    schema.add_field("vector", DataType.FLOAT_VECTOR, dim=EMBED_DIM)
    schema.add_field("texto", DataType.VARCHAR, max_length=2000)
    schema.add_field("fuente", DataType.VARCHAR, max_length=500)
    schema.add_field("pagina", DataType.INT64)

    index_params = client.prepare_index_params()
    index_params.add_index(
        field_name="vector",
        index_type="HNSW",
        metric_type="COSINE",
        params={"M": 16, "efConstruction": 200},
    )
    client.create_collection(COLLECTION, schema=schema, index_params=index_params)
    client.load_collection(COLLECTION)


def index_pdf(pdf_path: str, filename: str) -> int:
    doc = fitz.open(pdf_path)
    paginas = [(i, page.get_text()) for i, page in enumerate(doc)]

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = []
    for page_num, texto in paginas:
        for chunk in splitter.create_documents([texto]):
            chunks.append((page_num, chunk.page_content))

    if not chunks:
        return 0

    model = get_model()
    textos = [c[1] for c in chunks]
    embeddings = model.encode(textos)

    datos = [
        {
            "vector": embeddings[i].tolist(),
            "texto": textos[i][:2000],
            "fuente": filename,
            "pagina": chunks[i][0],
        }
        for i in range(len(chunks))
    ]

    client = get_client()
    client.insert(COLLECTION, datos)
    client.flush(COLLECTION)
    return len(datos)


def search(query: str, limit: int = 5, fuente: str = None) -> list:
    model = get_model()
    embedding = model.encode([query])

    client = get_client()
    kwargs = dict(
        collection_name=COLLECTION,
        data=embedding.tolist(),
        limit=limit,
        output_fields=["texto", "fuente", "pagina"],
    )
    if fuente:
        kwargs["filter"] = f'fuente == "{fuente}"'

    resultados = client.search(**kwargs)
    return [
        {
            "score": round(r["distance"], 4),
            "texto": r["entity"]["texto"],
            "fuente": r["entity"]["fuente"],
            "pagina": r["entity"]["pagina"],
        }
        for r in resultados[0]
    ]


def get_chunks(fuente: str) -> list:
    client = get_client()
    rows = client.query(
        collection_name=COLLECTION,
        filter=f'fuente == "{fuente}"',
        output_fields=["id", "texto", "pagina"],
        limit=10000,
    )
    return sorted(
        [{"id": r["id"], "pagina": r["pagina"], "texto": r["texto"]} for r in rows],
        key=lambda r: (r["pagina"], r["id"]),
    )


def list_documents() -> list:
    client = get_client()
    try:
        rows = client.query(
            collection_name=COLLECTION,
            filter="id > 0",
            output_fields=["fuente", "pagina"],
            limit=10000,
        )
    except Exception:
        return []

    fuentes: dict[str, dict] = {}
    for row in rows:
        f = row["fuente"]
        if f not in fuentes:
            fuentes[f] = {"fuente": f, "chunks": 0, "paginas": set()}
        fuentes[f]["chunks"] += 1
        fuentes[f]["paginas"].add(row["pagina"])

    return [
        {"fuente": v["fuente"], "chunks": v["chunks"], "paginas": len(v["paginas"])}
        for v in fuentes.values()
    ]


def delete_document(fuente: str) -> int:
    client = get_client()
    rows = client.query(
        collection_name=COLLECTION,
        filter=f'fuente == "{fuente}"',
        output_fields=["id"],
        limit=10000,
    )
    if not rows:
        return 0
    ids = [r["id"] for r in rows]
    client.delete(collection_name=COLLECTION, ids=ids)
    client.flush(COLLECTION)
    return len(ids)


def get_stats() -> dict:
    client = get_client()
    client.flush(COLLECTION)
    stats = client.get_collection_stats(COLLECTION)
    docs = list_documents()
    return {
        "total_chunks": int(stats.get("row_count", 0)),
        "total_documentos": len(docs),
        "modelo": "all-MiniLM-L6-v2",
        "dimension": EMBED_DIM,
        "indice": "HNSW / COSINE",
        "coleccion": COLLECTION,
    }
