# Comandos — Lab Milvus

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
# Abre puertos necesarios para el sistema completo
sudo ufw allow 19530/tcp   # Milvus gRPC (interno)
sudo ufw allow 9091/tcp    # Milvus HTTP/métricas
sudo ufw allow 8000/tcp    # Attu UI (panel de Milvus)
sudo ufw allow 8001/tcp    # Django API (backend)
sudo ufw allow 3000/tcp    # Next.js (frontend)

# Muestra el estado detallado del firewall y reglas activas
sudo ufw status verbose
```

---

## Docker y Milvus

```bash
# Instala Docker usando el script oficial
curl -fsSL https://get.docker.com | sudo sh

# Agrega el usuario lucas al grupo docker (para usarlo sin sudo)
sudo usermod -aG docker lucas

# Aplica el nuevo grupo sin cerrar sesión
newgrp docker

# Verifica las versiones instaladas
docker --version
docker compose version

# Descarga el docker-compose oficial de Milvus Standalone v2.4.9
wget https://github.com/milvus-io/milvus/releases/download/v2.4.9/milvus-standalone-docker-compose.yml -O docker-compose.yml

# Levanta todos los contenedores de Milvus en segundo plano
cd ~/lab_milvus
docker compose up -d

# Apaga los contenedores (los datos se conservan en volumes/)
docker compose down

# Muestra el estado y salud de los contenedores
docker compose ps

# Muestra los últimos 50 logs del contenedor de Milvus
docker logs milvus-standalone --tail 50

# Reinicia un contenedor específico
docker restart milvus-standalone

# Levanta el contenedor de Attu UI — solo la primera vez
docker run -d --name attu \
  -p 8000:3000 \
  -e MILVUS_URL=65.109.99.208:19530 \
  zilliz/attu:latest

# Inicia Attu cuando el contenedor ya existe pero está apagado
docker start attu

# Secuencia completa para levantar todo desde cero
docker compose up -d
docker start attu
docker compose ps
```

---

## Python y entorno virtual

```bash
# Instala el paquete necesario para crear entornos virtuales
sudo apt install python3.12-venv -y

# Crea el entorno virtual en la carpeta venv
python3 -m venv ~/lab_milvus/venv

# Activa el entorno virtual (siempre antes de usar Python del proyecto)
source ~/lab_milvus/venv/bin/activate

# Desactiva el entorno virtual
deactivate

# Instala todas las dependencias del proyecto
pip install pymilvus pymupdf langchain-text-splitters sentence-transformers numpy \
            django djangorestframework django-cors-headers gunicorn openai

# Lista los paquetes instalados
pip list

# Prueba la conexión a Milvus
python3 -c "from pymilvus import MilvusClient; c = MilvusClient(uri='http://localhost:19530', user='root', password='Milvus'); print('Conectado OK')"
```

---

## Usuarios de Milvus

```bash
# Activa el entorno antes de ejecutar estos comandos
source ~/lab_milvus/venv/bin/activate

# Lista todos los usuarios
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); print(utility.list_usernames())"

# Crea un usuario
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); utility.create_user('USUARIO', 'CONTRASEÑA', using='default'); print('OK')"

# Elimina un usuario
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); utility.delete_user('USUARIO', using='default'); print('OK')"
```

---

## Backend Django (Gunicorn)

> La API key de OpenAI se lee desde `backend/.env` — hay que exportarla antes de arrancar.

```bash
cd ~/lab_milvus
source venv/bin/activate

# Cargar la API key de OpenAI desde el archivo .env
export $(cat ~/lab_milvus/backend/.env | xargs)

# Arrancar Django con Gunicorn (modo producción, daemon)
gunicorn --chdir ~/lab_milvus/backend --bind 0.0.0.0:8001 backend.wsgi:application \
  --workers 2 --daemon --pid /tmp/gunicorn.pid --log-file /tmp/gunicorn.log

# Ver logs en tiempo real
tail -f /tmp/gunicorn.log

# Parar Gunicorn
kill $(cat /tmp/gunicorn.pid)

# Reiniciar Gunicorn (necesario después de cambios en el código Python)
kill $(cat /tmp/gunicorn.pid) && sleep 1
export $(cat ~/lab_milvus/backend/.env | xargs)
gunicorn --chdir ~/lab_milvus/backend --bind 0.0.0.0:8001 backend.wsgi:application \
  --workers 2 --daemon --pid /tmp/gunicorn.pid --log-file /tmp/gunicorn.log

# Ver el PID del proceso master
cat /tmp/gunicorn.pid

# Verificar que está respondiendo
curl http://localhost:8001/api/stats/

# Modo desarrollo (con recarga automática, no usar en producción)
source ~/lab_milvus/venv/bin/activate
export $(cat ~/lab_milvus/backend/.env | xargs)
python ~/lab_milvus/backend/manage.py runserver 8001
```

---

## Frontend Next.js (pm2)

```bash
# Instala nvm (Node Version Manager)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Carga nvm en la sesión actual
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"

# Instala Node.js 20
nvm install 20

# Verifica las versiones
node --version   # v20.20.2
npm --version    # 10.8.2

# Instala pm2 globalmente
npm install -g pm2

# Arrancar Next.js con pm2
cd ~/lab_milvus/frontend
pm2 start npm --name nextjs -- run dev -- -H 0.0.0.0 -p 3000

# Ver estado de los procesos
pm2 list

# Ver logs en tiempo real
pm2 logs nextjs

# Parar Next.js
pm2 stop nextjs

# Reiniciar Next.js
pm2 restart nextjs

# Guardar la configuración (sobrevive reinicios del servidor)
pm2 save

# Restaurar procesos guardados después de un reinicio del servidor
pm2 resurrect
```

---

## Arranque completo del sistema

Secuencia correcta cuando el servidor estuvo apagado:

```bash
# 1. Levantar Milvus (primero siempre)
cd ~/lab_milvus
docker compose up -d
docker start attu

# 2. Verificar que Milvus está healthy (~10 segundos)
docker compose ps

# 3. Levantar Django
source ~/lab_milvus/venv/bin/activate
export $(cat ~/lab_milvus/backend/.env | xargs)
gunicorn --chdir ~/lab_milvus/backend --bind 0.0.0.0:8001 backend.wsgi:application \
  --workers 2 --daemon --pid /tmp/gunicorn.pid --log-file /tmp/gunicorn.log

# 4. Levantar Next.js
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
pm2 resurrect   # si ya fue guardado con pm2 save
# o si es la primera vez:
# cd ~/lab_milvus/frontend && pm2 start npm --name nextjs -- run dev -- -H 0.0.0.0 -p 3000

# 5. Verificar todo
docker compose ps
curl -s http://localhost:8001/api/stats/
pm2 list
```

---

## Parada completa del sistema

```bash
# Parar Next.js
pm2 stop nextjs

# Parar Django
kill $(cat /tmp/gunicorn.pid)

# Parar Milvus
cd ~/lab_milvus && docker compose down
```

---

## API REST — ejemplos con curl

```bash
# Estado general del sistema
curl http://localhost:8001/api/stats/

# Listar documentos indexados
curl http://localhost:8001/api/documents/

# Subir un PDF
curl -X POST http://localhost:8001/api/documents/upload/ \
  -F "file=@/ruta/al/archivo.pdf"

# Ver chunks de un documento
curl http://localhost:8001/api/documents/ORD_10_2020.pdf/chunks/

# Eliminar un documento
curl -X DELETE http://localhost:8001/api/documents/ORD_10_2020.pdf/

# Búsqueda semántica en todos los documentos
curl -X POST http://localhost:8001/api/search/ \
  -H "Content-Type: application/json" \
  -d '{"query": "gestión de residuos sólidos", "limit": 5}'

# Búsqueda filtrada por documento específico
curl -X POST http://localhost:8001/api/search/ \
  -H "Content-Type: application/json" \
  -d '{"query": "sanciones", "fuente": "ORD_10_2020.pdf", "limit": 3}'

# Chat con RAG (requiere API key de OpenAI configurada)
curl -X POST http://localhost:8001/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"mensaje": "¿Qué sanciones establece la ordenanza?", "historial": []}'

# Chat con historial de conversación
curl -X POST http://localhost:8001/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "mensaje": "¿Y cuál es el plazo para implementarlas?",
    "historial": [
      {"role": "user", "content": "¿Qué sanciones establece la ordenanza?"},
      {"role": "assistant", "content": "La ordenanza establece multas graves..."}
    ]
  }'
```

---

## Milvus — operaciones con Python

```python
from pymilvus import MilvusClient, DataType

client = MilvusClient(uri="http://localhost:19530", user="root", password="Milvus")

# Listar colecciones
client.list_collections()

# Estadísticas de la colección
client.flush("pdf_collection")
client.get_collection_stats("pdf_collection")

# Eliminar una colección completa
client.drop_collection("pdf_collection")

# Buscar en Milvus directamente
from sentence_transformers import SentenceTransformer
modelo = SentenceTransformer("all-MiniLM-L6-v2")
embedding = modelo.encode(["¿De qué trata el documento?"])

resultados = client.search(
    collection_name="pdf_collection",
    data=embedding.tolist(),
    limit=5,
    output_fields=["texto", "fuente", "pagina"]
)
for r in resultados[0]:
    print(f"Score: {r['distance']:.4f} | {r['entity']['fuente']} | {r['entity']['texto'][:100]}")
```

---

## Git y GitHub

```bash
# Inicializa el repositorio
git init
git branch -m main
git remote add origin git@github.com:synthetixpy-star/lab_milvus.git

# Configura el usuario
git config --global user.name "synthetixpy-star"
git config --global user.email "synthetixpy@gmail.com"

# Flujo normal de trabajo
git status
git add archivo1.md archivo2.py
git commit -m "descripción del cambio"
git push -u origin main

# Ver historial de commits
git log --oneline
```

---

## URLs del sistema

| Servicio | URL |
|----------|-----|
| Frontend (Next.js) | http://65.109.99.208:3000 |
| Dashboard | http://65.109.99.208:3000 |
| Búsqueda semántica | http://65.109.99.208:3000/search |
| Subir PDF | http://65.109.99.208:3000/upload |
| Chat IA | http://65.109.99.208:3000/chat |
| API Django | http://65.109.99.208:8001/api/ |
| Attu UI (Milvus) | http://65.109.99.208:8000 |
| MinIO consola | http://65.109.99.208:9001 |
