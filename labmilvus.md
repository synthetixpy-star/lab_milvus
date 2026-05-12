# Plan de Test — Milvus

Verificar que Milvus funciona correctamente creando una colección, insertando vectores y haciendo búsquedas por similitud.

---

## Paso a Paso

### Paso 1 — Crear el script de test

Crear el archivo `~/lab_milvus/test_milvus.py` con todos los tests.

**Estado:** pendiente

---

### Paso 2 — Conectarse a Milvus

Conectar usando `MilvusClient` (API nueva) con usuario `root`.

**Estado:** pendiente

---

### Paso 3 — Crear una colección

Crear una colección llamada `test_collection` con:
- Campo `id` (clave primaria)
- Campo `vector` (embeddings de 128 dimensiones)
- Campo `texto` (descripción del dato)

**Estado:** pendiente

---

### Paso 4 — Insertar datos de prueba

Insertar 1000 vectores generados aleatoriamente con `numpy`.

**Estado:** pendiente

---

### Paso 5 — Crear índice

Crear un índice `IVF_FLAT` sobre el campo vector para acelerar las búsquedas.

**Estado:** pendiente

---

### Paso 6 — Búsqueda por similitud

Buscar los 5 vectores más similares a uno dado y mostrar los resultados.

**Estado:** pendiente

---

### Paso 7 — Búsqueda con filtro

Buscar vectores con un filtro por campo de texto.

**Estado:** pendiente

---

### Paso 8 — Limpiar

Eliminar la colección de prueba al finalizar.

**Estado:** pendiente

---

## Resultado esperado

```
Conectado OK
Colección creada OK
1000 vectores insertados OK
Índice creado OK
Búsqueda OK — top 5 resultados: [ids...]
Colección eliminada OK
```
