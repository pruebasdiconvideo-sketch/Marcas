import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { API_SERVER_URL } from "@/lib/api-client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const q = new URL(req.url).search;
    const res = await fetch(`${API_SERVER_URL}/api/marcaciones${q}`);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: "Servidor no disponible" }, { status: 503 });
  }
}
