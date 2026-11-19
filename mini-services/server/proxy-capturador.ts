// ============================================================
// PROXY CAPTURADOR TCP - Espía la conversación entre el equipo y el C#
// ============================================================
//
// PROPÓSITO:
//   Descubrir EXACTAMENTE qué bytes envía el C# al equipo biométrico
//   después de recibir cada marcación. Hasta ahora probamos 29 formatos
//   de ACK y ninguno hizo que el equipo avance. La única forma de saber
//   qué hace el C# es ESPIARLO en acción.
//
// CÓMO FUNCIONA:
//   1. El proxy escucha en el puerto 5000 (donde el equipo se conecta).
//   2. Cuando el equipo conecta, el proxy abre una conexión al C#
//      (que debe estar escuchando en otro puerto, ej: 5001).
//   3. El proxy reenvía bytes en AMBAS direcciones (equipo ↔ C#).
//   4. El proxy LOGUEA cada byte con timestamp, dirección y contenido hex.
//   5. Después de capturar 1-2 minutos, detenemos el proxy y analizamos
//      el log para ver el protocolo real del C#.
//
// CONFIGURACIÓN REQUERIDA EN EL LADO DEL C#:
//   El C# normalmente escucha en el puerto 5000. Para que el proxy funcione,
//   hay que cambiar el C# para que escuche en otro puerto (ej: 5001).
//   Esto puede requerir modificar un archivo .config o .ini del C#.
//
//   Si NO se puede cambiar el puerto del C#, hay una alternativa:
//   - Detener el C#.
//   - Arrancar el proxy en 5000 (sin reenviar a nadie).
//   - El proxy no responde nada al equipo, solo captura lo que el equipo envía.
//   - Esto NO nos dice qué envía el C#, pero confirma qué envía el equipo.
//
// USO:
//   bun proxy-capturador.ts                  # proxy en 5000 → C# en 5001
//   bun proxy-capturador.ts 5000 5001        # puertos personalizados
//   bun proxy-capturador.ts 5000 127.0.0.1 5001  # host/puerto del C# personalizado
//
// ============================================================

import net from "net";
import fs from "fs";
import path from "path";

// ===== CONFIGURACIÓN =====
const PROXY_PORT = parseInt(process.argv[2] || "5000", 10);
const CSHARP_HOST = process.argv[3] || "127.0.0.1";
const CSHARP_PORT = parseInt(process.argv[4] || "5001", 10);

// ===== ARCHIVO DE LOG =====
const LOG_DIR = "/tmp/proxy-captura"; // en Windows esto se mapea a C:\Users\...\AppData\Local\Temp\proxy-captura
const LOG_FILE = path.join(process.env.TEMP || process.env.TMP || "/tmp", "proxy-captura.log");

// Asegurar que el directorio existe
try {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
} catch {}

// Stream de log (append)
const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });

function logLine(line: string): void {
  const ts = new Date().toISOString();
  const fullLine = `[${ts}] ${line}`;
  console.log(fullLine);
  logStream.write(fullLine + "\n");
}

function toHex(bytes: Buffer): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

function toAscii(bytes: Buffer): string {
  return Array.from(bytes).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : ".").join("");
}

// ===== ESTADO DE LA CAPTURA =====
let connectionCount = 0;
let totalBytesEquipoToCsharp = 0;
let totalBytesCsharpToEquipo = 0;

logLine("");
logLine("═══════════════════════════════════════════════════════════════════");
logLine("  PROXY CAPTURADOR TCP - Espía equipo ↔ C#");
logLine("═══════════════════════════════════════════════════════════════════");
logLine(`  Proxy escuchando en:  0.0.0.0:${PROXY_PORT}`);
logLine(`  Reenvía a C# en:      ${CSHARP_HOST}:${CSHARP_PORT}`);
logLine(`  Archivo de log:       ${LOG_FILE}`);
logLine("═══════════════════════════════════════════════════════════════════");
logLine("");
logLine("INSTRUCCIONES:");
logLine("  1. Asegúrate de que el C# esté escuchando en " + CSHARP_HOST + ":" + CSHARP_PORT);
logLine("  2. El equipo biométrico debe conectar al proxy (puerto " + PROXY_PORT + ")");
logLine("  3. Deja correr 1-2 minutos mientras se hacen marcaciones");
logLine("  4. Detén el proxy con Ctrl+C");
logLine("  5. Envía el contenido del log: " + LOG_FILE);
logLine("");

// ===== SERVIDOR PROXY =====
const server = net.createServer((clientSocket) => {
  const clientId = ++connectionCount;
  const clientIp = clientSocket.remoteAddress?.replace(/^::ffff:/, "") ?? "?";
  const clientPort = clientSocket.remotePort ?? 0;

  logLine(`━━━ CONEXIÓN #${clientId}: equipo ${clientIp}:${clientPort} conectó al proxy ━━━`);

  // Conectar al C#
  const csharpSocket = net.createConnection({ host: CSHARP_HOST, port: CSHARP_PORT }, () => {
    logLine(`    → Conectado al C# en ${CSHARP_HOST}:${CSHARP_PORT}`);
  });

  csharpSocket.on("error", (err) => {
    logLine(`    ✗ Error conectando al C#: ${err.message}`);
    if (err.message.includes("ECONNREFUSED")) {
      logLine(`    ℹ️  El C# NO está escuchando en ${CSHARP_HOST}:${CSHARP_PORT}.`);
      logLine(`    ℹ️  Modo CAPTURA PASIVA: el proxy NO responde al equipo, solo captura lo que envía.`);
      logLine(`    ℹ️  Si querés espiar al C#, arrancalo en el puerto ${CSHARP_PORT} y reconectá el equipo.`);
    }
    // En modo pasiva, NO cerramos el socket del equipo — seguimos capturando
  });
  });

  // ===== Equipo → C# =====
  let ultimaTramaEquipo: string | null = null;
  let tramasDistintas = 0;
  clientSocket.on("data", (data: Buffer) => {
    totalBytesEquipoToCsharp += data.length;
    const hex = toHex(data);
    const esDistinta = hex !== ultimaTramaEquipo;
    if (esDistinta) {
      tramasDistintas++;
      ultimaTramaEquipo = hex;
      logLine(`▶ EQUIPO→C#  #${clientId} | ${data.length} bytes | *** TRAMA NUEVA #${tramasDistintas} *** | hex: ${hex}`);
    } else {
      logLine(`▶ EQUIPO→C#  #${clientId} | ${data.length} bytes | (repetida)        | hex: ${hex}`);
    }
    logLine(`             | ascii: ${toAscii(data)}`);
    // Reenviar al C#
    if (!csharpSocket.destroyed) {
      csharpSocket.write(data);
    }
  });

  // ===== C# → Equipo =====
  csharpSocket.on("data", (data: Buffer) => {
    totalBytesCsharpToEquipo += data.length;
    logLine(`◀ C#→EQUIPO  #${clientId} | ${data.length} bytes | hex: ${toHex(data)}`);
    logLine(`             | ascii: ${toAscii(data)}`);
    // Reenviar al equipo
    if (!clientSocket.destroyed) {
      clientSocket.write(data);
    }
  });

  // ===== Cierres =====
  clientSocket.on("close", () => {
    logLine(`━━━ CONEXIÓN #${clientId}: equipo desconectó ━━━`);
    if (!csharpSocket.destroyed) csharpSocket.end();
  });

  csharpSocket.on("close", () => {
    logLine(`    ← C# cerró la conexión`);
    if (!clientSocket.destroyed) clientSocket.end();
  });

  clientSocket.on("error", (err) => {
    logLine(`    ✗ Error equipo: ${err.message}`);
  });
});

server.on("error", (err) => {
  logLine(`✗ ERROR en servidor proxy: ${err.message}`);
  if (err.message.includes("EADDRINUSE")) {
    logLine(`  El puerto ${PROXY_PORT} está en uso. Detén cualquier proceso que lo use:`);
    logLine(`  - En Windows: netstat -ano | findstr :${PROXY_PORT}`);
    logLine(`  - Luego: taskkill /F /PID <pid>`);
  }
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  logLine(`✓ Proxy escuchando en 0.0.0.0:${PROXY_PORT}`);
  logLine(`  (esperando que el equipo conecte...)`);
  logLine("");
});

// ===== Manejo de cierre graceful =====
process.on("SIGINT", () => {
  logLine("");
  logLine("═══════════════════════════════════════════════════════════════════");
  logLine("  CAPTURA FINALIZADA");
  logLine("═══════════════════════════════════════════════════════════════════");
  logLine(`  Total conexiones: ${connectionCount}`);
  logLine(`  Bytes equipo→C#: ${totalBytesEquipoToCsharp}`);
  logLine(`  Bytes C#→equipo: ${totalBytesCsharpToEquipo}`);
  logLine(`  Log completo en: ${LOG_FILE}`);
  logLine("═══════════════════════════════════════════════════════════════════");
  logStream.end();
  process.exit(0);
});
