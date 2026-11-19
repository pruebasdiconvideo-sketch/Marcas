# Servidor Biométrico DiconSolutions — SQL Server Express

Servidor standalone que recibe marcaciones de equipos biométricos vía TCP/IP y las almacena en **Microsoft SQL Server Express**.

## Requisitos

1. **Microsoft SQL Server Express** (2016 o superior) instalado y corriendo
2. **TCP/IP habilitado** en la instancia de SQL Server (ver más abajo)
3. **Bun runtime** (https://bun.sh) o Node.js 18+
4. La base de datos `Asistencia_DiconSolutions` debe existir (puedes usar otro nombre)

## Configuración paso a paso

### 1. Habilitar TCP/IP en SQL Server Express

Por defecto, SQL Server Express viene con TCP/IP deshabilitado. Para habilitarlo:

1. Abre **SQL Server Configuration Manager**
2. Ve a **SQL Server Network Configuration** → **Protocols for SQLEXPRESS**
3. Habilita **TCP/IP**
4. Click derecho en TCP/IP → Properties → IP Addresses tab → IPAll → TCP Port: `1433`
5. Reinicia el servicio SQL Server (SQLEXPRESS)

### 2. Crear la base de datos y tablas

Abre **SQL Server Management Studio (SSMS)** y conéctate a tu instancia. Ejecuta:

```sql
CREATE DATABASE [Asistencia_DiconSolutions];
GO
USE [Asistencia_DiconSolutions];
GO
```

Luego ejecuta el script de creación de tablas:

```bash
sqlcmd -S localhost\SQLEXPRESS -U sa -P tu_password -d Asistencia_DiconSolutions -i schema.sqlserver.sql
```

O abre `schema.sqlserver.sql` en SSMS y ejecútalo (F5).

### 3. Configurar variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

```bash
cp .env.example .env
```

Edita `.env`:

```env
# Tu instancia SQL Server (formato: servidor\instancia o IP)
SQL_SERVER=localhost\SQLEXPRESS
SQL_PORT=1433
SQL_DATABASE=Asistencia_DiconSolutions

# Autenticación SQL (usuario sa u otro)
SQL_USER=sa
SQL_PASSWORD=tu_password_real

# Para Windows Authentication (sin usuario/password):
# SQL_USER=
# SQL_PASSWORD=
```

### 4. Instalar dependencias y arrancar

```bash
cd mini-services/server
bun install

# Iniciar el servidor
bun index.ts
```

Verás en la consola:

```
[DB] Conectando a SQL Server: localhost\SQLEXPRESS:1433/Asistencia_DiconSolutions...
[DB] ✓ Conectado a SQL Server Express
[DB] ✓ Tablas verificadas en SQL Server
============================================================
[HTTP] Servidor biométrico escuchando en http://0.0.0.0:3001
[HTTP] Base de datos: SQL Server Express
============================================================
[TCP Listener] Escuchando en 0.0.0.0:5000
```

## Verificación de conexión

Visita en el navegador:

```
http://localhost:3001/health
```

Debe devolver:

```json
{
  "ok": true,
  "service": "biometrico-server",
  "ports": { "http": 3001, "tcp": 5000 },
  "database": {
    "connected": true,
    "error": null,
    "server": "localhost\\SQLEXPRESS",
    "database": "Asistencia_DiconSolutions"
  }
}
```

Si `connected` es `false`, revisa:
- Credenciales en `.env`
- TCP/IP habilitado en SQL Server
- Firewall permitiendo el puerto 1433
- SQL Server Browser service corriendo (si usas instancia con nombre)

## Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | UI HTML del servidor (marcaciones en vivo) |
| GET | `/health` | Estado del servidor y conexión BD |
| GET | `/api/marcaciones` | Lista marcaciones con filtros y paginación |
| GET | `/api/stats` | Estadísticas del día |
| GET | `/api/equipos` | Lista equipos biométricos |
| GET | `/api/equipos/conectados` | Equipos TCP conectados ahora |
| GET | `/api/export` | Exportar marcaciones a CSV |
| GET | `/api/events` | Stream SSE para push en tiempo real |
| GET | `/api/trabajadores` | Lista trabajadores |
| POST | `/api/simular` | Genera y envía trama de prueba |

## Configuración del equipo biométrico

En tu equipo biométrico DiconSolutions (chip WIZnet), configura:

- **IP del servidor**: la IP de la máquina donde corre este servidor
- **Puerto TCP**: 5000 (o el que configuraste en `TCP_PORT`)

El equipo actuará como cliente TCP y se conectará automáticamente al listener.

## Troubleshooting

### Error: "ECONNREFUSED" al conectar a SQL Server

1. Verifica que SQL Server Express esté corriendo: `sc query MSSQL$SQLEXPRESS` (Windows) o `systemctl status mssql-server` (Linux)
2. Verifica que el puerto 1433 esté abierto: `telnet localhost 1433`
3. Verifica que TCP/IP esté habilitado en SQL Server Configuration Manager
4. Verifica credenciales en `.env`

### Error: "Login failed for user 'sa'"

1. Verifica que SQL Server tenga el modo de autenticación mixto habilitado (SQL Server + Windows Authentication)
2. En SSMS: click derecho en el servidor → Properties → Security → "SQL Server and Windows Authentication mode"
3. Habilita el login `sa`: SSMS → Security → Logins → sa → Properties → Status → Login: Enabled
4. Reinicia SQL Server

### Error: "Cannot connect to localhost\SQLEXPRESS"

1. Verifica el nombre de la instancia (puede ser `SQLEXPRESS`, `MSSQLSERVER`, etc.)
2. Si usas instancia con nombre, asegúrate que SQL Server Browser esté corriendo
3. Prueba con IP directa: `SQL_SERVER=127.0.0.1` y `SQL_PORT=1433`

## Archivos principales

- `index.ts` — Servidor HTTP Bun + APIs REST + SSE
- `tcp-listener.ts` — TCP listener puerto 5000 (recibe tramas del equipo biométrico)
- `db.ts` — Conexión y helpers para SQL Server (pool, query, execute)
- `trama-parser.ts` — Parser de tramas binarias de 24 bytes
- `event-bus.ts` — Pub/sub interno para push SSE
- `ui.ts` — UI HTML del servidor
- `schema.sqlserver.sql` — Script de creación de tablas
- `.env.example` — Template de configuración

## Integración con SQL Server existente (DiconSolutions)

Si ya tienes la base de datos `Asistencia_DiconSolutions` con las tablas existentes (`Marcaciones`, `Trabajadores`, `Equipos`, etc.), puedes:

1. Modificar las queries en `tcp-listener.ts` para insertar en tu tabla `Marcaciones` existente
2. Mapear el campo `CodTarjeta` a tu columna `CodTarjeta` existente en `Trabajadores`
3. Configurar `SQL_DATABASE=Asistencia_DiconSolutions` en `.env`

Las tablas que crea este servidor por defecto son independientes y no afectan tus tablas existentes.
