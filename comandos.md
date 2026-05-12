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
