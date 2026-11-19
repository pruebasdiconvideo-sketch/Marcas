/**
 * GET /api/proxy-events
 * Proxy SSE que reenvía el stream del servidor biométrico (puerto 3001 /api/events)
 * hacia el cliente Next.js (puerto 3000), manteniendo la autenticación.
 *
 * Esto permite al dashboard usar EventSource("/api/proxy-events") en lugar de
 * tener que conectarse directamente al servidor (evitando CORS).
 */
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { API_SERVER_URL } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const upstream = await fetch(`${API_SERVER_URL}/api/events`, {
      headers: { Accept: "text/event-stream" },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(
        JSON.stringify({ error: "Servidor biométrico no disponible" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    // Reenviar el stream SSE del servidor al cliente
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Servidor no disponible: " + (err as Error).message }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
