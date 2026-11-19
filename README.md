# 📋 Sistema Biométrico DiconSolutions — Descarga e Instalación

Sistema completo para recibir marcaciones de equipos biométricos vía TCP/IP y visualizarlas en un dashboard web en tiempo real. **Dos aplicaciones separadas**: servidor standalone (recibe y descarga marcaciones en SQL Server Express) + cliente dashboard (visualiza en línea).

---

## 📦 Contenido del paquete

```
biometrico-diconsolutions/
├── mini-services/
│   └── server/                  # 🖥️ SERVIDOR STANDALONE (Bun + SQL Server)
│       ├── index.ts             #    Servidor HTTP + APIs REST + SSE
│       ├── tcp-listener.ts      #    TCP listener puerto 5000
│       ├── db.ts                #    Conexión SQL Server Express
│       ├── trama-parser.ts      #    Parser de tramas binarias 24 bytes
│       ├── event-bus.ts         #    Pub/sub interno
│       ├── ui.ts                #    UI HTML del servidor
│       ├── schema.sqlserver.sql #    Script creación tablas SQL Server
│       ├── .env.example         #    Template configuración
│       ├── package.json
│       └── README.md            #    Guía detallada del servidor
│
├── src/                         # 📺 CLIENTE DASHBOARD (Next.js 16)
│   ├── app/
│   │   ├── page.tsx             #    Dashboard con 4 tabs
│   │   ├── layout.tsx
│   │   └── api/                 #    Proxies autenticados al servidor
│   │       ├── auth/[...nextauth]/
│   │       ├── marcaciones/
│   │       ├── stats/
│   │       ├── equipos/
│   │       ├── export/
│   │       ├── simular/
│   │       └── proxy-events/
│   ├── components/              #    Componentes shadcn/ui + propios
│   │   ├── login-screen.tsx
│   │   ├── realtime-view.tsx
│   │   ├── historico-view.tsx
│   │   ├── equipos-view.tsx
│   │   └── simulador-view.tsx
│   ├── lib/
│   │   ├── auth.ts              #    NextAuth config
│   │   ├── api-client.ts        #    Cliente API servidor
│   │   └── trama-parser.ts      #    Parser compartido
│   └── components/ui/           #    shadcn/ui components
│
├── scripts/
│   ├── simular-equipo.ts        #    Simulador de equipo biométrico
│   └── test-parser.ts           #    Tests del parser de tramas
│
├── prisma/                      #    Schema Prisma (legacy, no usado por servidor)
├── public/
├── package.json                 #    Dependencias cliente Next.js
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── components.json              #    Config shadcn/ui
└── README.md                    #    Este archivo
```

---

## 🚀 Instalación rápida (3 pasos)

### Paso 1: Configurar SQL Server Express

1. Instala **Microsoft SQL Server Express** (2016 o superior)
2. Habilita **TCP/IP** en SQL Server Configuration Manager → puerto 1433
3. Crea la base de datos:
   ```sql
   CREATE DATABASE [Asistencia_DiconSolutions];
   ```
4. Ejecuta el schema de tablas:
   ```bash
   sqlcmd -S localhost\SQLEXPRESS -U sa -P tu_password -d Asistencia_DiconSolutions -i mini-services/server/schema.sqlserver.sql
   ```

### Paso 2: Arrancar el SERVIDOR (puerto 3001 + TCP 5000)

```bash
cd biometrico-diconsolutions/mini-services/server

# Copiar .env.example a .env y ajustar credenciales
cp .env.example .env
# Edita .env con tu SQL_SERVER, SQL_USER, SQL_PASSWORD

# Instalar dependencias
bun install

# Arrancar
bun index.ts
```

Verás:
```
[DB] ✓ Conectado a SQL Server Express
[HTTP] Servidor biométrico escuchando en http://0.0.0.0:3001
[TCP Listener] Escuchando en 0.0.0.0:5000
```

Abre **http://localhost:3001** para ver la UI del servidor.

### Paso 3: Arrancar el CLIENTE Dashboard (puerto 3000)

```bash
cd biometrico-diconsolutions

# Configurar URL del servidor (en .env)
echo "NEXT_PUBLIC_API_SERVER_URL=http://localhost:3001" > .env

# Instalar dependencias
bun install

# Arrancar
bun run dev
```

Abre **http://localhost:3000** y haz login con `admin` / `admin123`.

---

## 🧪 Verificar que todo funciona

1. **Servidor**: visita `http://localhost:3001/health` — debe mostrar `database.connected: true`
2. **Servidor UI**: visita `http://localhost:3001/` — botón "⚡ Ráfaga 5" para enviar 5 tramas de prueba
3. **Cliente**: visita `http://localhost:3000/` — login admin/admin123 → verás las marcaciones en tiempo real

**Simulador CLI** (opcional):
```bash
cd biometrico-diconsolutions
bun run scripts/simular-equipo.ts
```

---

## 🔌 Conexión del equipo biométrico real

En tu equipo biométrico DiconSolutions (chip WIZnet), configura:
- **IP del servidor**: la IP de la máquina donde corre el servidor (ej: `192.168.1.100`)
- **Puerto TCP**: `5000`

El equipo actuará como cliente TCP y se conectará automáticamente al listener.

### Formato de trama (24 bytes)

```
Byte 0:    0x25 (sync)
Bytes 4-13: código de tarjeta de 10 dígitos, un dígito decimal por byte
Bytes 14-19: día, mes, año - 2000, hora, minuto, segundo
Byte 20:
  bits 0-1: botones (bit0=ENTRADA, bit1=SALIDA)
  nibble alto 0x10: asistencia por huella
  nibble alto 0x20: asistencia por tarjeta/teclado
  nibble alto 0x80: control de acceso
Byte 21:   LUGAR (0=default, 1=trabajo, 2=refrigerio)
Byte 22:   0x7F (end marker)
Byte 23:   checksum XOR
```

### Tipos de marcación detectados

- `TRABAJO-ENTRADA` — byte 20 bit0=1 + byte 21=1
- `TRABAJO-SALIDA` — byte 20 bit1=1 + byte 21=1
- `REFRIGERIO-ENTRADA` — byte 20 bit0=1 + byte 21=2
- `REFRIGERIO-SALIDA` — byte 20 bit1=1 + byte 21=2
- `ACCESO-ENTRADA` / `ACCESO-SALIDA` — nibble alto del byte 20 es `0x80`

### ACK binario devuelto al equipo

7 bytes: `[0x25, 0x06, CodTarjeta, byteMarcacion, lugar, 0x7F, checksum]`

---

## 🛠️ Requisitos técnicos

- **Bun runtime** ≥ 1.0 (https://bun.sh) — para el servidor standalone
- **Node.js** ≥ 18 (alternativa a Bun)
- **Microsoft SQL Server Express** ≥ 2016
- **SQL Server Management Studio** (opcional, para administrar la BD)

---

## 📚 Documentación adicional

- **Servidor SQL Server**: ver `mini-services/server/README.md` (guía detallada con troubleshooting)
- **Schema BD**: ver `mini-services/server/schema.sqlserver.sql`
- **Parser de tramas**: ver `mini-services/server/trama-parser.ts` (con documentación del protocolo)
- **Tests del parser**: `bun run scripts/test-parser.ts`

---

## 🏗️ Arquitectura

```
┌─────────────────────┐
│ Equipo Biométrico    │
│ (chip WIZnet)        │
└──────────┬──────────┘
           │ TCP tramas 24 bytes
           ↓
┌─────────────────────────────────────────┐
│ SERVIDOR (mini-services/server/)        │
│ - TCP Listener puerto 5000              │
│ - HTTP API REST puerto 3001             │
│ - SQLite/SQL Server Express             │
│ - UI HTML propia (marcaciones en vivo)  │
└──────────┬──────────────────────────────┘
           │ SSE push + REST API (CORS)
           ↓
┌─────────────────────────────────────────┐
│ CLIENTE (Next.js dashboard)             │
│ - Puerto 3000                           │
│ - Login NextAuth (admin/admin123)       │
│ - Tabs: Tiempo Real / Histórico /       │
│   Equipos / Simulador                   │
│ - Proxies autenticados al servidor      │
└──────────┬──────────────────────────────┘
           │
           ↓
      Usuario final
```

---

## 📝 Licencia

Software a medida para DiconSolutions. Código propietario.
