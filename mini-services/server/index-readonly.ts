// Servidor HTTP standalone - MODO SOLO LECTURA
// ============================================================
// Lee directamente de la BD del C# (BDASISTENCIA15_GruasdelPacifico)
// NO escucha puerto 5000 (no recibe tramas del equipo)
// NO escribe en la BD (read-only)
// Hace polling cada 10s para detectar marcaciones nuevas
// y disparar eventos SSE en tiempo real
//
// El C# Capturador hace el trabajo de recibir del equipo y guardar en BD.
// Nosotros solo visualizamos lo que el C# ya descargó.
//
// Puerto HTTP: 3001
// Puerto TCP:  NO SE USA (el C# lo tiene)
//
// Ejecutar con: bun index-readonly.ts

import { getPool, getConnectionStatus } from "./db";
import { eventBus } from "./event-bus";
import { serverHTML } from "./ui";
import {
  getMarcacionesCsharp,
  getStatsCsharp,
  getEquiposCsharp,
  getTrabajadoresCsharp,
  getLogCsharp,
  getMarcacionesDesde,
  exportMarcacionesCsharpCSV,
} from "./csharp-queries";

const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3001", 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "10000", 10);

// ============================================================
// POLLING: detectar marcaciones nuevas cada 10s
// ============================================================
let ultimaFechaProcesada = new Date(Date.now() - 60000); // empezar hace 1 min
let pollingTimer: NodeJS.Timeout | null = null;

async function pollNuevasMarcaciones() {
  try {
    const nuevas = await getMarcacionesDesde(ultimaFechaProcesada);
    if (nuevas.length === 0) return;

    // Actualizar timestamp
    const masReciente = nuevas.reduce((max: Date, m: any) => {
      const f = new Date(m.recibidoEn || m.fechaHora);
      return f > max ? f : max;
    }, ultimaFechaProcesada);
    ultimaFechaProcesada = masReciente;

    console.log(`[POLL] ${nuevas.length} marcación(es) nueva(s) detectada(s) desde el C#`);

    // Publicar cada marcación nueva via event bus (para SSE)
    for (const m of nuevas) {
      eventBus.publish("marcacion:nueva", m);
    }
  } catch (err) {
    console.error("[POLL] Error:", (err as Error).message);
  }
}

function startPolling() {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(pollNuevasMarcaciones, POLL_INTERVAL_MS);
  console.log(`[POLL] Polling cada ${POLL_INTERVAL_MS / 1000}s para detectar marcaciones nuevas`);
  // Ejecutar una vez inmediatamente
  setTimeout(pollNuevasMarcaciones, 2000);
}

// ============================================================
// HTTP HANDLER
// ============================================================
function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf("?");
  if (idx === -1) return {};
  const params = new URLSearchParams(url.slice(idx + 1));
  const result: Record<string, string> = {};
  params.forEach((v, k) => (result[k] = v));
  return result;
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // UI HTML
  if (path === "/" && method === "GET") {
    return new Response(serverHTML(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Healthcheck
  if (path === "/health" && method === "GET") {
    const dbStatus = getConnectionStatus();
    return jsonResponse({
      ok: true,
      service: "biometrico-server-readonly",
      mode: "READ_ONLY (leyendo de BD del C#)",
      ports: { http: HTTP_PORT },
      database: dbStatus,
      polling: { intervalMs: POLL_INTERVAL_MS, running: pollingTimer !== null },
      timestamp: new Date().toISOString(),
    });
  }

  // SSE: stream de eventos en tiempo real
  if (path === "/api/events" && method === "GET") {
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController | null = null;
    let closed = false;

    const stream = new ReadableStream({
      start(c) {
        controller = c;
        try {
          c.enqueue(
            encoder.encode(
              `event: conexion\ndata: ${JSON.stringify({
                message: "SSE conectado al servidor biométrico (modo solo lectura)",
                mode: "READ_ONLY",
                source: "BD del C# (BDASISTENCIA15_GruasdelPacifico)",
                timestamp: new Date().toISOString(),
              })}\n\n`
            )
          );
        } catch {}
      },
      cancel() {
        closed = true;
        controller = null;
      },
    });

    const send = (event: string, data: any) => {
      if (!controller || closed) return;
      try {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      } catch {
        closed = true;
      }
    };

    const unsub1 = eventBus.subscribe("marcacion:nueva", (data) => send("marcacion:nueva", data));
    const unsub2 = eventBus.subscribe("equipo:conectado", (data) => send("equipo:conectado", data));
    const unsub3 = eventBus.subscribe("equipo:desconectado", (data) => send("equipo:desconectado", data));

    const interval = setInterval(() => {
      if (!controller || closed) {
        clearInterval(interval);
        unsub1(); unsub2(); unsub3();
        return;
      }
      try {
        controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
      } catch {
        closed = true;
        clearInterval(interval);
        unsub1(); unsub2(); unsub3();
      }
    }, 15000);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // ===== GET /api/marcaciones =====
  if (path === "/api/marcaciones" && method === "GET") {
    const q = parseQuery(req.url);
    const result = await getMarcacionesCsharp(q);
    return jsonResponse(result);
  }

  // ===== GET /api/stats =====
  if (path === "/api/stats" && method === "GET") {
    const result = await getStatsCsharp();
    return jsonResponse(result);
  }

  // ===== GET /api/equipos =====
  if (path === "/api/equipos" && method === "GET") {
    const result = await getEquiposCsharp();
    return jsonResponse(result);
  }

  // ===== GET /api/equipos/conectados =====
  if (path === "/api/equipos/conectados" && method === "GET") {
    const result = await getEquiposCsharp();
    return jsonResponse(result.conectados);
  }

  // ===== GET /api/trabajadores =====
  if (path === "/api/trabajadores" && method === "GET") {
    const result = await getTrabajadoresCsharp();
    return jsonResponse(result);
  }

  // ===== GET /api/log =====
  if (path === "/api/log" && method === "GET") {
    const q = parseQuery(req.url);
    const result = await getLogCsharp(q);
    return jsonResponse(result);
  }

  // ===== GET /api/export =====
  if (path === "/api/export" && method === "GET") {
    const q = parseQuery(req.url);
    const csv = await exportMarcacionesCsharpCSV(q);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="marcaciones_${new Date().toISOString().slice(0, 10)}.csv"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // ===== POST /api/simular (DESHABILITADO en modo read-only) =====
  if (path === "/api/simular" && method === "POST") {
    return jsonResponse({
      error: "Modo solo lectura: no se pueden simular marcaciones",
      mode: "READ_ONLY",
      hint: "Las marcaciones se reciben a través del C# original y se leen de su BD",
    }, 403);
  }

  // 404
  return jsonResponse({ error: "Not found", path }, 404);
}

// ============================================================
// INICIALIZAR SERVIDOR
// ============================================================
async function main() {
  // Conectar a la BD del C#
  await getPool().catch((err) => {
    console.error("[HTTP] No se pudo conectar a SQL Server:", err.message);
    console.error("[HTTP] Verifica tu archivo .env (SQL_DATABASE=BDASISTENCIA15_GruasdelPacifico)");
    process.exit(1);
  });

  console.log("[DB] ✓ Conectado a la BD del C# (BDASISTENCIA15_GruasdelPacifico)");

  // Iniciar polling para detectar nuevas marcaciones
  startPolling();

  // Iniciar servidor HTTP
  const httpServer = Bun.serve({
    port: HTTP_PORT,
    hostname: "0.0.0.0",
    idleTimeout: 255,
    fetch(req) {
      return handleRequest(req);
    },
  });

  console.log("=".repeat(70));
  console.log(`[HTTP] Servidor biométrico escuchando en http://0.0.0.0:${HTTP_PORT}`);
  console.log("[HTTP] MODO: SOLO LECTURA");
  console.log("[HTTP] Fuente: BD del C# (BDASISTENCIA15_GruasdelPacifico)");
  console.log("[HTTP] UI disponible en /");
  console.log("[HTTP] API REST disponible en /api/*");
  console.log("[HTTP] SSE: /api/events (marcaciones en tiempo real via polling)");
  console.log("[HTTP] NO escucha puerto 5000 (lo tiene el C# Capturador)");
  console.log("=".repeat(70));

  process.on("SIGTERM", () => { httpServer.stop(); process.exit(0); });
  process.on("SIGINT", () => { httpServer.stop(); process.exit(0); });
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
