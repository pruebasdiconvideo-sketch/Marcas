// Servidor HTTP + TCP para el servidor biométrico DiconSolutions
import { query, queryOne, getPool, getConnectionStatus, sql } from "./db";
import { eventBus } from "./event-bus";
import { startTcpListener, getEquiposConectados } from "./tcp-listener";
import { serverHTML } from "./ui";
import { parseTrama, generarTramaMarcacion, toHexStr } from "./trama-parser";
import net from "net";

const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3001", 10);
const TCP_PORT_VALUE = parseInt(process.env.TCP_PORT || "5000", 10);

// 1. INICIAR EL TCP LISTENER
try {
  startTcpListener();
  console.log(`[TCP] Listener iniciado en el puerto ${TCP_PORT_VALUE}`);
} catch (err) {
  console.error("❌ Error al iniciar TCP Listener:", (err as Error).message);
}

// 2. INICIAR CONEXIÓN A BASE DE DATOS
getPool().catch((err) => {
  console.error("[HTTP] No se pudo conectar a SQL Server al iniciar:", err.message);
});

// 3. FUNCIONES AUXILIARES
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

// 4. SERVIDOR HTTP
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } });
  }

  if (path === "/" && method === "GET") {
    return new Response(serverHTML(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (path === "/health" && method === "GET") {
    return jsonResponse({ ok: true, db: getConnectionStatus() });
  }

  if (path === "/api/marcaciones" && method === "GET") {
    const q = parseQuery(req.url);
    const page = parseInt(q.page ?? "1", 10);
    const pageSize = Math.min(parseInt(q.pageSize ?? "50", 10), 200);
    const offset = (page - 1) * pageSize;

    const totalRows = await query<any>(`SELECT COUNT(*) as c FROM dbo.Marcaciones`);
    const items = await query<any>(
      `SELECT m.Id, m.CodTarjeta, m.FechaHora, m.TipoMarcacion, m.Estado, m.ModoMarcacion, m.Lugar, m.LugarDesc,
              t.Nombre1, t.ApellidoPat, t.Documento
       FROM dbo.Marcaciones m
       LEFT JOIN dbo.Trabajadores t ON m.CodTrabajador = t.CodTrabajador
       ORDER BY m.Id DESC OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`);

    return jsonResponse({
      total: totalRows[0]?.c ?? 0,
      items: items.map((m: any) => ({
        id: m.Id, codTarjeta: m.CodTarjeta, fechaHora: m.FechaHora,
        tipoMarcacion: m.TipoMarcacion, estado: m.Estado, modo: m.ModoMarcacion,
        lugar: m.Lugar, trabajador: [m.Nombre1, m.ApellidoPat].filter(Boolean).join(" ")
      }))
    });
  }

  if (path === "/api/equipos/conectados" && method === "GET") {
    return jsonResponse(getEquiposConectados());
  }

  return jsonResponse({ error: "Not found" }, 404);
}

// 5. ARRANCAR SERVIDOR HTTP
const httpServer = Bun.serve({
  port: HTTP_PORT,
  hostname: "0.0.0.0",
  idleTimeout: 255,
  fetch(req) { return handleRequest(req); },
});

console.log("=".repeat(60));
console.log(`[HTTP] Servidor biométrico escuchando en http://0.0.0.0:${HTTP_PORT}`);
console.log("[HTTP] UI disponible en /");
console.log("[HTTP] API REST disponible en /api/*");
console.log("[HTTP] Base de datos: Biometrico_Dicon_Nuevo");
console.log("=".repeat(60));

process.on("SIGTERM", () => { httpServer.stop(); process.exit(0); });
process.on("SIGINT", () => { httpServer.stop(); process.exit(0); });