# Lab Milvus

Documentación completa de la instalación y configuración de Milvus en el servidor `65.109.99.208`.

---

## Entorno

- **Servidor:** `65.109.99.208`
- **OS:** Ubuntu Noble (24.04)
- **Usuario sistema:** `lucas`
- **Modo instalación:** Milvus Standalone con Docker
- **Fecha inicio:** 2026-05-11
- **Docker:** 29.4.3
- **Docker Compose:** v5.1.3
- **pymilvus:** instalado en `~/lab_milvus/venv`

---

## Accesos SSH

| Usuario | Método | Notas |
|---------|--------|-------|
| lucas | Clave SSH | Usuario principal |
| root | Clave SSH | Acceso root habilitado |

Configuración SSH (`/etc/ssh/sshd_config`):
- `PermitRootLogin prohibit-password` — root solo con clave SSH
- `PubkeyAuthentication yes`
- `PasswordAuthentication no`

---

## Arquitectura Milvus

Milvus Standalone levanta 3 contenedores:

| Contenedor | Imagen | Rol |
|------------|--------|-----|
| milvus-etcd | quay.io/coreos/etcd:v3.5.5 | Almacena metadatos |
| milvus-minio | minio/minio:RELEASE.2023-03-20T20-16-18Z | Almacena vectores (object storage) |
| milvus-standalone | milvusdb/milvus:v2.4.9 | Motor principal |

---

## Puertos

| Puerto | Servicio | Uso |
|--------|----------|-----|
| 22 | SSH | Acceso al servidor |
| 19530 | Milvus | Cliente gRPC (conexión principal) |
| 9091 | Milvus | HTTP / métricas |
| 9000 | MinIO | API object storage |
| 9001 | MinIO | Consola web MinIO |
| 8000 | Attu UI | Interfaz gráfica de Milvus |

---

## Usuarios Milvus

| Usuario | Contraseña | Notas |
|---------|------------|-------|
| root | Milvus | Usuario administrador por defecto |
| lucas | Lucas123! | Usuario creado |
| eudes | Mailo$ | Usuario creado |

---

## Accesos Web

| Servicio | URL |
|----------|-----|
| Attu UI | http://65.109.99.208:8000 |
| MinIO Consola | http://65.109.99.208:9001 |

Credenciales MinIO por defecto:
- Usuario: `minioadmin`
- Contraseña: `minioadmin`

---

## Directorio de trabajo

```
~/lab_milvus/
├── docker-compose.yml    # Configuración de los contenedores
├── README.md             # Esta documentación
├── venv/                 # Entorno virtual Python con pymilvus
└── volumes/              # Datos persistentes de los contenedores
    ├── etcd/
    ├── minio/
    └── milvus/
```

---

## Comandos útiles

### Gestión de contenedores

```bash
cd ~/lab_milvus

# Ver estado de los contenedores
docker compose ps

# Levantar Milvus
docker compose up -d

# Apagar Milvus
docker compose down

# Ver logs de Milvus
docker logs milvus-standalone --tail 50

# Reiniciar un contenedor específico
docker restart milvus-standalone
```

### Activar entorno Python

```bash
cd ~/lab_milvus
source venv/bin/activate
```

### Conectarse a Milvus con Python

```python
from pymilvus import MilvusClient

client = MilvusClient(
    uri="http://localhost:19530",
    user="root",
    password="Milvus"
)
```

### Gestión de usuarios desde Python

```bash
# Listar usuarios
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); print(utility.list_usernames())"

# Crear usuario
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); utility.create_user('USUARIO', 'CONTRASEÑA', using='default'); print('OK')"

# Eliminar usuario
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); utility.delete_user('USUARIO', using='default'); print('OK')"
```

### Firewall

```bash
sudo ufw status verbose       # Ver reglas activas
sudo ufw allow PUERTO/tcp     # Abrir puerto
sudo ufw deny PUERTO/tcp      # Cerrar puerto
```

---

## Paso a Paso de Instalación

### Paso 1 — Verificar requisitos previos

```bash
docker --version
docker compose version
free -h
df -h
```

**Estado:** completado ✓
- RAM: 62GB disponibles
- Disco: 411GB libres

---

### Paso 2 — Instalar Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker lucas
newgrp docker
```

**Estado:** completado ✓

---

### Paso 3 — Crear directorio de trabajo

```bash
mkdir ~/lab_milvus && cd ~/lab_milvus
```

**Estado:** completado ✓

---

### Paso 4 — Descargar docker-compose de Milvus Standalone

```bash
wget https://github.com/milvus-io/milvus/releases/download/v2.4.9/milvus-standalone-docker-compose.yml -O docker-compose.yml
```

**Estado:** completado ✓

---

### Paso 5 — Iniciar Milvus

```bash
docker compose up -d
```

**Estado:** completado ✓
- milvus-etcd: healthy
- milvus-minio: healthy
- milvus-standalone: healthy

---

### Paso 6 — Verificar contenedores

```bash
docker compose ps
```

**Estado:** completado ✓

---

### Paso 7 — Abrir puertos en firewall

```bash
sudo ufw allow 19530/tcp
sudo ufw allow 9091/tcp
```

**Estado:** completado ✓

---

### Paso 8 — Instalar pymilvus y probar conexión

```bash
sudo apt install python3.12-venv -y
python3 -m venv venv
source venv/bin/activate
pip install pymilvus
python3 -c "from pymilvus import connections; connections.connect(host='localhost', port='19530'); print('Conectado OK')"
```

**Estado:** completado ✓

---

### Paso 9 — Attu UI

```bash
sudo ufw allow 8000/tcp
docker run -d --name attu \
  -p 8000:3000 \
  -e MILVUS_URL=65.109.99.208:19530 \
  zilliz/attu:latest
```

Acceso: `http://65.109.99.208:8000`

**Estado:** completado ✓

---

### Paso 10 — Activar autenticación y crear usuarios

Agregar en `docker-compose.yml` bajo `standalone > environment`:
```yaml
COMMON_SECURITY_AUTHORIZATIONENABLED: "true"
```

Reiniciar:
```bash
docker compose down && docker compose up -d
```

Crear usuarios:
```bash
source venv/bin/activate
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); utility.create_user('lucas', 'Lucas123!', using='default'); print('OK')"
python3 -c "from pymilvus import connections, utility; connections.connect(host='localhost', port='19530', user='root', password='Milvus'); utility.create_user('eudes', 'Mailo\$', using='default'); print('OK')"
```

**Estado:** completado ✓

---

## Notas y Problemas

- La contraseña de Milvus debe tener mínimo 6 caracteres.
- El atributo `version` en el docker-compose.yml está obsoleto (warning inofensivo).
- `connections.connect` y `utility.*` serán removidos en pymilvus 3.1 — usar `MilvusClient` en su lugar.

---

## Referencias

- [Documentación oficial Milvus](https://milvus.io/docs)
- [Milvus GitHub](https://github.com/milvus-io/milvus)
- [pymilvus SDK](https://github.com/milvus-io/pymilvus)
- [Attu UI](https://github.com/zilliztech/attu)
