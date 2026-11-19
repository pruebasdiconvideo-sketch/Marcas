"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Fingerprint,
  LogIn,
  LogOut,
  Coffee,
  Briefcase,
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface MarcacionLive {
  id: number | null;
  tramaHex: string;
  tramaParseada: string;
  codTarjeta: string;
  trabajador: string;
  fechaHora: string;
  tipoMarcacion: string;
  lugar: string;
  esEntrada: boolean;
  esSalida: boolean;
  checksumValido: boolean;
  ipEquipo: string;
  errores: string[];
  recibidoEn: string;
}

interface Stats {
  totalHoy: number;
  entradasHoy: number;
  salidasHoy: number;
  refrigerioHoy: number;
  trabajoHoy: number;
  tramasInvalidasHoy: number;
  totalTrabajadores: number;
  totalEquipos: number;
  equiposConectados: number;
  porTipo: Record<string, number>;
  ultimasMarcaciones: Array<{
    id: number;
    codTarjeta: string;
    trabajador: string;
    tipo: string;
    fechaHora: string;
    ip: string | null;
    lugar: string;
  }>;
}

const tipoInfo: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  "TRABAJO-ENTRADA": {
    label: "Trabajo · Entrada",
    icon: Briefcase,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  "TRABAJO-SALIDA": {
    label: "Trabajo · Salida",
    icon: Briefcase,
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/40",
  },
  "REFRIGERIO-ENTRADA": {
    label: "Refrigerio · Entrada",
    icon: Coffee,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  "REFRIGERIO-SALIDA": {
    label: "Refrigerio · Salida",
    icon: Coffee,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/40",
  },
  "DEFAULT-ENTRADA": {
    label: "Default · Entrada",
    icon: LogIn,
    color: "text-slate-600",
    bg: "bg-slate-50 dark:bg-slate-900/40",
  },
  "DEFAULT-SALIDA": {
    label: "Default · Salida",
    icon: LogOut,
    color: "text-slate-600",
    bg: "bg-slate-50 dark:bg-slate-900/40",
  },
  DESCONOCIDO: {
    label: "Desconocido",
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/40",
  },
};

function formatHora(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatHoraCorta(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RealtimeView() {
  const [connected, setConnected] = useState(false);
  const [marcaciones, setMarcaciones] = useState<MarcacionLive[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [equiposEventos, setEquiposEventos] = useState<
    Array<{ tipo: string; ip: string; timestamp: string }>
  >([]);

  // Cargar stats iniciales
  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error cargando stats:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const doRefresh = () => {
      if (!cancelled) refreshStats();
    };
    doRefresh();
    const interval = setInterval(doRefresh, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshStats]);

  // Conectar vía SSE directamente al servidor biométrico (puerto 3001)
  // El servidor tiene CORS habilitado para permitir conexiones cross-origin
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    // Hardcodeado para el demo - en producción usar variable de entorno
    const serverUrl = "http://localhost:3001";
    const es = new EventSource(`${serverUrl}/api/events`);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const onMarcacion = (e: MessageEvent) => {
      try {
        const m: MarcacionLive = JSON.parse(e.data);
        setMarcaciones((prev) => [m, ...prev].slice(0, 100));
        refreshStats();
      } catch {}
    };
    const onEquipoConectado = (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        setEquiposEventos((prev) =>
          [{ tipo: "conectado", ip: d.ip, timestamp: d.timestamp }, ...prev].slice(0, 20)
        );
      } catch {}
    };
    const onEquipoDesconectado = (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        setEquiposEventos((prev) =>
          [{ tipo: "desconectado", ip: d.ip, timestamp: d.timestamp }, ...prev].slice(0, 20)
        );
      } catch {}
    };

    es.addEventListener("marcacion:nueva", onMarcacion as EventListener);
    es.addEventListener("equipo:conectado", onEquipoConectado as EventListener);
    es.addEventListener("equipo:desconectado", onEquipoDesconectado as EventListener);

    return () => {
      es.removeEventListener("marcacion:nueva", onMarcacion as EventListener);
      es.removeEventListener("equipo:conectado", onEquipoConectado as EventListener);
      es.removeEventListener("equipo:desconectado", onEquipoDesconectado as EventListener);
      es.close();
      esRef.current = null;
    };
  }, [refreshStats]);

  return (
    <div className="space-y-6">
      {/* Estado de conexión */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <Activity className="h-3 w-3 mr-1" /> WebSocket conectado
            </Badge>
          ) : (
            <Badge variant="destructive">
              <Activity className="h-3 w-3 mr-1" /> WebSocket desconectado
            </Badge>
          )}
          {stats && (
            <Badge variant="outline">
              <Wifi className="h-3 w-3 mr-1" /> {stats.equiposConectados} equipo(s) activo(s)
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Servidor biométrico: <code className="font-mono">localhost:3001</code> · TCP listener:{" "}
          <code className="font-mono">:5000</code>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Total Hoy"
            value={stats.totalHoy}
            icon={Fingerprint}
            color="text-primary"
          />
          <StatCard
            label="Entradas"
            value={stats.entradasHoy}
            icon={LogIn}
            color="text-emerald-600"
          />
          <StatCard
            label="Salidas"
            value={stats.salidasHoy}
            icon={LogOut}
            color="text-rose-600"
          />
          <StatCard
            label="Refrigerio"
            value={stats.refrigerioHoy}
            icon={Coffee}
            color="text-amber-600"
          />
          <StatCard
            label="Trabajo"
            value={stats.trabajoHoy}
            icon={Briefcase}
            color="text-blue-600"
          />
          <StatCard
            label="Inválidas"
            value={stats.tramasInvalidasHoy}
            icon={AlertTriangle}
            color="text-red-600"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Visor tiempo real */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Marcaciones en tiempo real
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[480px] px-6">
              {marcaciones.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">
                  <Fingerprint className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">
                    Esperando marcaciones del equipo biométrico...
                  </p>
                  <p className="text-xs mt-1">
                    Las tramas que lleguen al puerto TCP 5000 aparecerán aquí automáticamente.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pb-4">
                  {marcaciones.map((m, idx) => {
                    const info = tipoInfo[m.tipoMarcacion] ?? tipoInfo["DESCONOCIDO"];
                    const Icon = info.icon;
                    return (
                      <div
                        key={`${m.id ?? "tmp"}-${idx}-${m.recibidoEn}`}
                        className={`rounded-lg border p-3 ${info.bg} ${
                          m.checksumValido ? "" : "border-red-300 dark:border-red-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className={`mt-0.5 ${info.color}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">
                                  {m.trabajador}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  Cod {m.codTarjeta}
                                </Badge>
                                <span className={`text-xs font-medium ${info.color}`}>
                                  {info.label}
                                </span>
                                {m.checksumValido ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 font-mono break-all">
                                {m.tramaHex}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {formatHora(m.fechaHora)} · IP {m.ipEquipo}
                                {m.errores.length > 0 && (
                                  <span className="text-red-600 ml-1">
                                    · {m.errores.join("; ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatHora(m.recibidoEn)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Sidebar: ultimas + eventos equipos */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumen general</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Trabajadores registrados" value={stats?.totalTrabajadores ?? 0} />
              <Separator />
              <Row label="Equipos totales" value={stats?.totalEquipos ?? 0} />
              <Separator />
              <Row
                label="Equipos conectados"
                value={stats?.equiposConectados ?? 0}
                icon={
                  stats && stats.equiposConectados > 0 ? (
                    <Wifi className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-muted-foreground" />
                  )
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Eventos de equipos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[200px] px-6 pb-4">
                {equiposEventos.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">
                    Sin eventos todavía.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {equiposEventos.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {e.tipo === "conectado" ? (
                          <Wifi className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <WifiOff className="h-3 w-3 text-red-500" />
                        )}
                        <span className="font-mono">{e.ip}</span>
                        <span className="text-muted-foreground">
                          {e.tipo === "conectado" ? "conectó" : "desconectó"}
                        </span>
                        <span className="ml-auto text-muted-foreground">
                          {formatHoraCorta(e.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-80`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium flex items-center gap-1">
        {icon}
        {value}
      </span>
    </div>
  );
}
