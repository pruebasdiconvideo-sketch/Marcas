/**
 * Configuración del cliente API.
 * El cliente (Next.js) se conecta al servidor standalone en puerto 3001.
 */

export const API_SERVER_URL =
  process.env.NEXT_PUBLIC_API_SERVER_URL || "http://localhost:3001";

/**
 * Fetch helper que siempre apunta al servidor biométrico.
 * Permite al cliente (puerto 3000) consumir la API del servidor (puerto 3001).
 */
export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_SERVER_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * URL completa para endpoints que se consumen vía EventSource o window.open.
 */
export function apiUrl(path: string): string {
  return path.startsWith("http") ? path : `${API_SERVER_URL}${path}`;
}
