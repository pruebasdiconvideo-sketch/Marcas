/**
 * GET /api/proxy?path=/api/stats
 * Proxy autenticado al servidor biométrico (puerto 3001).
 * El cliente Next.js usa esto para evitar problemas de CORS y mantener auth.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { API_SERVER_URL } from "@/lib/api-client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const targetPath = new URL(req.url).searchParams.get("path");
  if (!targetPath) {
    return NextResponse.json({ error: "Falta parámetro path" }, { status: 400 });
  }
  try {
    const url = `${API_SERVER_URL}${targetPath}`;
    const res = await fetch(url);
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Servidor no disponible: " + (err as Error).message },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const targetPath = new URL(req.url).searchParams.get("path");
  if (!targetPath) {
    return NextResponse.json({ error: "Falta parámetro path" }, { status: 400 });
  }
  try {
    const url = `${API_SERVER_URL}${targetPath}`;
    const body = await req.text();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": req.headers.get("Content-Type") || "application/json" },
      body,
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Servidor no disponible: " + (err as Error).message },
      { status: 503 }
    );
  }
}
