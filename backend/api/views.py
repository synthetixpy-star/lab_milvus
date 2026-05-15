import os
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from . import milvus_service as ms
from . import chat_service as cs


@api_view(["GET"])
def stats(request):
    try:
        return Response(ms.get_stats())
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
def list_documents(request):
    try:
        return Response(ms.list_documents())
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@parser_classes([MultiPartParser])
def upload_document(request):
    archivo = request.FILES.get("file")
    if not archivo:
        return Response({"error": "Se requiere un archivo PDF"}, status=status.HTTP_400_BAD_REQUEST)
    if not archivo.name.lower().endswith(".pdf"):
        return Response({"error": "Solo se aceptan archivos PDF"}, status=status.HTTP_400_BAD_REQUEST)

    os.makedirs(settings.PDF_UPLOAD_DIR, exist_ok=True)
    ruta = os.path.join(settings.PDF_UPLOAD_DIR, archivo.name)
    with open(ruta, "wb") as f:
        for chunk in archivo.chunks():
            f.write(chunk)

    try:
        total = ms.index_pdf(ruta, archivo.name)
        return Response({"fuente": archivo.name, "chunks_indexados": total}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
def document_chunks(request, fuente):
    try:
        chunks = ms.get_chunks(fuente)
        if not chunks:
            return Response({"error": "Documento no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"fuente": fuente, "total": len(chunks), "chunks": chunks})
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["DELETE"])
def delete_document(request, fuente):
    try:
        eliminados = ms.delete_document(fuente)
        if eliminados == 0:
            return Response({"error": "Documento no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"fuente": fuente, "chunks_eliminados": eliminados})
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
def chat(request):
    mensaje = request.data.get("mensaje", "").strip()
    if not mensaje:
        return Response({"error": "Se requiere el campo 'mensaje'"}, status=status.HTTP_400_BAD_REQUEST)

    historial = request.data.get("historial", [])
    fuente = request.data.get("fuente") or None

    try:
        resultado = cs.chat(mensaje, historial, fuente)
        return Response(resultado)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
def search(request):
    query = request.data.get("query", "").strip()
    if not query:
        return Response({"error": "Se requiere el campo 'query'"}, status=status.HTTP_400_BAD_REQUEST)

    fuente = request.data.get("fuente") or None
    limit = int(request.data.get("limit", 5))

    try:
        resultados = ms.search(query, limit=limit, fuente=fuente)
        return Response({"query": query, "resultados": resultados})
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
