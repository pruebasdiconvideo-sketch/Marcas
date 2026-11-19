"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wifi, WifiOff, Server, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EquipoItem {
  id: number;
  codEquipo: number;
  descripcion: string;
  ip: string;
  puerto: number;
  ubicacion: string | null;
  conectado: boolean;
  ultimaConn: string | null;
  ultMarcacion: string | null;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function EquiposView() {
  const [data, setData] = useState<{
    items: EquipoItem[];
    total: number;
    conectados: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/equipos");
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" /> Equipos biométricos
          </h3>
          <p className="text-sm text-muted-foreground">
            Equipos detectados automáticamente cuando envían marcaciones.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total equipos</p>
            <p className="text-3xl font-bold">{data?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Conectados ahora</p>
            <p className="text-3xl font-bold text-emerald-600">
              {data?.conectados ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Puerto TCP listener</p>
            <p className="text-3xl font-bold font-mono">5000</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listado de equipos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Server className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                Aún no se ha conectado ningún equipo biométrico.
              </p>
              <p className="text-xs mt-1">
                Cuando un equipo envíe su primera trama al puerto 5000, aparecerá aquí.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cod</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Puerto</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Última conexión</TableHead>
                    <TableHead>Última marcación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        {e.conectado ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            <Wifi className="h-3 w-3 mr-1" /> Conectado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <WifiOff className="h-3 w-3 mr-1" /> Desconectado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.codEquipo}</TableCell>
                      <TableCell className="font-medium text-sm">{e.descripcion}</TableCell>
                      <TableCell className="font-mono text-xs">{e.ip}</TableCell>
                      <TableCell className="font-mono text-xs">{e.puerto}</TableCell>
                      <TableCell className="text-xs">{e.ubicacion ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {formatDateTime(e.ultimaConn)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDateTime(e.ultMarcacion)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
