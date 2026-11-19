import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { API_SERVER_URL } from "@/lib/api-client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const res = await fetch(`${API_SERVER_URL}/api/stats`);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: "Servidor no disponible" }, { status: 503 });
  }
}
