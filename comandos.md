# Comandos utilizados — Lab Milvus

---

## SSH y claves

```bash
# Genera un par de claves SSH (ejecutar en tu PC local)
ssh-keygen -t ed25519 -C "lucas@servidor"

# Copia tu clave pública al servidor (ejecutar en tu PC local)
ssh-copy-id lucas@65.109.99.208

# Copia un archivo específico del servidor a tu PC (Windows PowerShell)
scp lucas@65.109.99.208:/home/lucas/.ssh/authorized_keys "C:\Users\Lucas Perez\authorized_keys"

# Copia la clave pública de tu PC al servidor (Windows PowerShell)
type "C:\Users\Lucas Perez\.ssh\id_ed25519.pub" | ssh lucas@65.109.99.208 "cat >> ~/.ssh/authorized_keys"

# Crea la carpeta .ssh para root y copia las claves autorizadas
sudo mkdir -p /root/.ssh
sudo cp ~/.ssh/authorized_keys /root/.ssh/authorized_keys
sudo chmod 700 /root/.ssh
sudo chmod 600 /root/.ssh/authorized_keys

# Reinicia el servicio SSH para aplicar cambios de configuración
sudo systemctl restart ssh

# Prueba la conexión SSH con GitHub
ssh -T git@github.com
```

---

## Sistema

```bash
# Muestra el uso de RAM disponible
free -h

# Muestra el espacio en disco disponible
df -h

# Lista archivos con detalles en el directorio actual
ls -la ~/lab_milvus/

# Crea el directorio de trabajo
mkdir ~/lab_milvus

# Renombra un archivo
mv README.md configuracion_milvus.md
```

---

## Firewall (UFW)

```bash
# Abre el puerto 19530 para Milvus gRPC
sudo ufw allow 19530/tcp

# Abre el puerto 9091 para Milvus HTTP
sudo ufw allow 9091/tcp

# Abre el puerto 8000 para Attu UI
sudo ufw allow 8000/tcp

# Muestra el estado detallado del firewall y reglas activas
sudo ufw status verbose
```

---

## Docker

```bash
# Instala Docker usando el script oficial
curl -fsSL https://get.docker.com | sudo sh

# Agrega el usuario lucas al grupo docker (para usarlo sin sudo)
sudo usermod -aG docker lucas

# Aplica el nuevo grupo sin cerrar sesión
newgrp docker

# Verifica la versión instalada de Docker
docker --version

# Verifica la versión instalada de Docker Compose
docker compose version

# Descarga el docker-compose oficial de Milvus Standalone v2.4.9
wget https://github.com/milvus-io/milvus/releases/download/v2.4.9/milvus-standalone-docker-compose.yml -O docker-compose.yml

# Levanta todos los contenedores de Milvus en segundo plano
docker compose up -d

# Apaga y elimina todos los contenedores de Milvus
docker compose down

# Muestra el estado y salud de los contenedores
docker compose ps

# Muestra los últimos 50 logs del contenedor de Milvus
docker logs milvus-standalone --tail 50

# Reinicia un contenedor específico
docker restart milvus-standalone

# Entra dentro del contenedor de Milvus en modo interactivo
docker exec -it milvus-standalone bash

# Levanta el contenedor de Attu UI (interfaz gráfica de Milvus)
docker run -d --name attu \
  -p 8000:3000 \
  -e MILVUS_URL=65.109.99.208:19530 \
  zilliz/attu:latest
```

---

## Python y pymilvus

```bash
# Instala el paquete necesario para crear entornos virtuales
sudo apt install python3.12-venv -y

# Crea un entorno virtual Python en la carpeta venv
python3 -m venv venv

# Activa el entorno virtual
source venv/bin/activate

# Instala el SDK de Milvus para Python
pip install pymilvus

# Prueba la conexión a Milvus (API antigua)
python3 -c "from pymilvus import connections; connections.connect(host='localhost', port='19530'); print('Conectado OK')"

# Crea un usuario en Milvus
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); utility.create_user('USUARIO', 'CONTRASEÑA', using='default'); print('OK')"

# Lista todos los usuarios de Milvus
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); print(utility.list_usernames())"

# Elimina un usuario de Milvus
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); utility.delete_user('USUARIO', using='default'); print('OK')"
```

---

## Lab Milvus — Búsqueda Semántica con PDFs

```bash
# Instala las dependencias necesarias para el laboratorio
pip install pymupdf langchain sentence-transformers numpy

# Instala el splitter de texto (requerido en langchain 1.3.0+, ya no viene incluido)
pip install langchain-text-splitters
```

```python
# Abre un PDF y extrae el texto de cada página
import fitz
doc = fitz.open("pdfs/output/ORD_10_2020.pdf")
paginas = [page.get_text() for page in doc]
print(f"{doc.page_count} páginas extraídas")

# Divide el texto en chunks de 500 caracteres con 50 de overlap
from langchain_text_splitters import RecursiveCharacterTextSplitter
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
chunks = splitter.create_documents(paginas)
textos = [c.page_content for c in chunks]

# Convierte los chunks en vectores de 384 dimensiones (corre 100% local)
from sentence_transformers import SentenceTransformer
modelo = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = modelo.encode(textos, show_progress_bar=True)

# Crea la colección pdf_collection en Milvus con su esquema
from pymilvus import MilvusClient, DataType
client = MilvusClient(uri="http://localhost:19530", user="root", password="Milvus")
schema = client.create_schema(auto_id=True, enable_dynamic_field=False)
schema.add_field("id", DataType.INT64, is_primary=True)
schema.add_field("vector", DataType.FLOAT_VECTOR, dim=384)
schema.add_field("texto", DataType.VARCHAR, max_length=2000)
schema.add_field("fuente", DataType.VARCHAR, max_length=500)
schema.add_field("pagina", DataType.INT64)
client.create_collection("pdf_collection", schema=schema)

# Inserta los chunks con sus embeddings en Milvus
datos = [
    {
        "vector": embeddings[i].tolist(),
        "texto": textos[i],
        "fuente": "ORD_10_2020.pdf",
        "pagina": chunks[i].metadata.get("page", 0)
    }
    for i in range(len(textos))
]
client.insert("pdf_collection", datos)

# Crea un índice HNSW con métrica COSINE para búsqueda semántica eficiente
index_params = client.prepare_index_params()
index_params.add_index(
    field_name="vector",
    index_type="HNSW",
    metric_type="COSINE",
    params={"M": 16, "efConstruction": 200}
)
client.create_index("pdf_collection", index_params)

# Carga la colección en memoria RAM para habilitar las búsquedas
client.load_collection("pdf_collection")

# Busca los 5 chunks más similares a una pregunta en todos los PDFs
query_embedding = modelo.encode(["¿De qué trata el documento?"])
resultados = client.search(
    collection_name="pdf_collection",
    data=query_embedding.tolist(),
    limit=5,
    output_fields=["texto", "fuente", "pagina"]
)

# Busca solo dentro de un PDF específico usando filtro por fuente
resultados_filtrados = client.search(
    collection_name="pdf_collection",
    data=query_embedding.tolist(),
    limit=5,
    filter='fuente == "ORD_10_2020.pdf"',
    output_fields=["texto", "fuente", "pagina"]
)

# Fuerza el guardado en disco y obtiene el conteo real de registros
client.flush("pdf_collection")
stats = client.get_collection_stats("pdf_collection")
print(f"Total chunks: {stats['row_count']}")

# Asigna rol admin a un usuario de Milvus
client.grant_role(user_name="lucas", role_name="admin")
```

---

## Git y GitHub

```bash
# Inicializa un repositorio git en la carpeta actual
git init

# Cambia el nombre de la rama principal a main
git branch -m main

# Agrega el repositorio remoto de GitHub
git remote add origin https://github.com/synthetixpy-star/lab_milvus.git

# Cambia la URL del remoto (para usar token o SSH)
git remote set-url origin git@github.com:synthetixpy-star/lab_milvus.git

# Configura el nombre de usuario de git
git config --global user.name "synthetixpy-star"

# Configura el email de git
git config --global user.email "synthetixpy@gmail.com"

# Agrega archivos al staging para el commit
git add configuracion_milvus.md labmilvus.md docker-compose.yml comandos.md

# Crea un commit con un mensaje
git commit -m "mensaje del commit"

# Sube los cambios a GitHub
git push -u origin main

# Muestra el estado actual del repositorio
git status
```
