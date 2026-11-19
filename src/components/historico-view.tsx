"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Download, Loader2, ChevronLeft, ChevronRight, Fingerprint } from "lucide-react";

interface MarcacionItem {
  id: number;
  codTarjeta: string;
  tramaHex: string;
  tramaParseada: string;
  fechaHora: string;
  recibidoEn: string;
  tipoMarcacion: string;
  lugarDesc: string;
  lugar: number;
  esEntrada: boolean;
  esSalida: boolean;
  incidencia: string;
  checksumValido: boolean;
  trabajador?: { nombre: string; documento: string | null; area: string | null };
  equipo?: { descripcion: string; ip: string } | null;
}

interface ListResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: MarcacionItem[];
}

const TIPOS = [
  { value: "ALL", label: "Todos los tipos" },
  { value: "TRABAJO-ENTRADA", label: "Trabajo · Entrada" },
  { value: "TRABAJO-SALIDA", label: "Trabajo · Salida" },
  { value: "REFRIGERIO-ENTRADA", label: "Refrigerio · Entrada" },
  { value: "REFRIGERIO-SALIDA", label: "Refrigerio · Salida" },
];

function formatDateTime(iso: string): string {
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

const tipoBadgeClass: Record<string, string> = {
  "TRABAJO-ENTRADA": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  "TRABAJO-SALIDA": "bg-rose-100 text-rose-700 hover:bg-rose-100",
  "REFRIGERIO-ENTRADA": "bg-amber-100 text-amber-700 hover:bg-amber-100",
  "REFRIGERIO-SALIDA": "bg-orange-100 text-orange-700 hover:bg-orange-100",
};

export function HistoricoView() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filtros, setFiltros] = useState({
    fechaInicio: "",
    fechaFin: "",
    codTarjeta: "",
    tipoMarcacion: "ALL",
    lugar: "ALL",
  });
  const [selected, setSelected] = useState<MarcacionItem | null>(null);

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (filtros.fechaInicio) p.set("fechaInicio", filtros.fechaInicio);
    if (filtros.fechaFin) p.set("fechaFin", filtros.fechaFin);
    if (filtros.codTarjeta) p.set("codTarjeta", filtros.codTarjeta);
    if (filtros.tipoMarcacion !== "ALL")
      p.set("tipoMarcacion", filtros.tipoMarcacion);
    if (filtros.lugar !== "ALL") p.set("lugar", filtros.lugar);
    return p.toString();
  }, [page, pageSize, filtros]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/marcaciones?${buildQuery()}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const onBuscar = () => {
    setPage(1);
    load();
  };

  const onLimpiar = () => {
    setFiltros({
      fechaInicio: "",
      fechaFin: "",
      codTarjeta: "",
      tipoMarcacion: "ALL",
      lugar: "ALL",
    });
    setPage(1);
  };

  const onExport = () => {
    const p = new URLSearchParams();
    if (filtros.fechaInicio) p.set("fechaInicio", filtros.fechaInicio);
    if (filtros.fechaFin) p.set("fechaFin", filtros.fechaFin);
    if (filtros.codTarjeta) p.set("codTarjeta", filtros.codTarjeta);
    if (filtros.tipoMarcacion !== "ALL")
      p.set("tipoMarcacion", filtros.tipoMarcacion);
    if (filtros.lugar !== "ALL") p.set("lugar", filtros.lugar);
    window.open(`/api/export?${p.toString()}`, "_blank");
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <Label htmlFor="fi" className="text-xs">Fecha inicio</Label>
              <Input
                id="fi"
                type="datetime-local"
                value={filtros.fechaInicio}
                onChange={(e) =>
                  setFiltros({ ...filtros, fechaInicio: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ff" className="text-xs">Fecha fin</Label>
              <Input
                id="ff"
                type="datetime-local"
                value={filtros.fechaFin}
                onChange={(e) =>
                  setFiltros({ ...filtros, fechaFin: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ct" className="text-xs">Cod. Tarjeta</Label>
              <Input
                id="ct"
                value={filtros.codTarjeta}
                onChange={(e) =>
                  setFiltros({ ...filtros, codTarjeta: e.target.value })
                }
                placeholder="Ej: 5"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={filtros.tipoMarcacion}
                onValueChange={(v) =>
                  setFiltros({ ...filtros, tipoMarcacion: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lugar</Label>
              <Select
                value={filtros.lugar}
                onValueChange={(v) => setFiltros({ ...filtros, lugar: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="1">Trabajo</SelectItem>
                  <SelectItem value="2">Refrigerio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={onBuscar} className="flex-1">
                <Search className="h-4 w-4 mr-1" /> Buscar
              </Button>
              <Button variant="outline" onClick={onLimpiar}>
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Marcaciones
            {data && (
              <span className="text-muted-foreground font-normal ml-2 text-sm">
                {data.total} registro(s) · pág {data.page}/{data.totalPages || 1}
              </span>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Fingerprint className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay marcaciones que coincidan con los filtros.</p>
            </div>
          ) : (
            <>
              <ScrollArea className="max-h-[480px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[40px]">ID</TableHead>
                      <TableHead>Trabajador</TableHead>
                      <TableHead>Cod</TableHead>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Lugar</TableHead>
                      <TableHead>Equipo</TableHead>
                      <TableHead className="text-center">CHK</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((m) => (
                      <TableRow
                        key={m.id}
                        onClick={() => setSelected(m)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="font-mono text-xs">{m.id}</TableCell>
                        <TableCell className="font-medium text-sm">
                          {m.trabajador?.nombre ?? `Cod ${m.codTarjeta}`}
                          {m.trabajador?.area && (
                            <span className="text-xs text-muted-foreground ml-1">
                              · {m.trabajador.area}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{m.codTarjeta}</TableCell>
                        <TableCell className="text-xs">
                          {formatDateTime(m.fechaHora)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${
                              tipoBadgeClass[m.tipoMarcacion] ??
                              "bg-slate-100 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {m.tipoMarcacion}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{m.lugarDesc}</TableCell>
                        <TableCell className="text-xs">
                          {m.equipo?.ip ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {m.checksumValido ? (
                            <span className="text-emerald-600 text-xs">✓</span>
                          ) : (
                            <span className="text-red-600 text-xs">✗</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Paginación */}
              <div className="flex items-center justify-between p-3 border-t">
                <span className="text-xs text-muted-foreground">
                  Mostrando {data.items.length} de {data.total}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs">
                    Pág {page} / {data.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog detalle */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de marcación #{selected?.id}</DialogTitle>
            <DialogDescription>
              Información cruda y parseada de la trama recibida.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Trabajador" value={selected.trabajador?.nombre ?? `Cod ${selected.codTarjeta}`} />
                <Field label="Código Tarjeta" value={selected.codTarjeta} mono />
                <Field label="Documento" value={selected.trabajador?.documento ?? "—"} />
                <Field label="Área" value={selected.trabajador?.area ?? "—"} />
                <Field label="Fecha/Hora marcación" value={formatDateTime(selected.fechaHora)} />
                <Field label="Recibido en servidor" value={formatDateTime(selected.recibidoEn)} />
                <Field label="Tipo de marcación" value={selected.tipoMarcacion} />
                <Field label="Lugar" value={selected.lugarDesc} />
                <Field label="Es entrada" value={selected.esEntrada ? "Sí" : "No"} />
                <Field label="Es salida" value={selected.esSalida ? "Sí" : "No"} />
                <Field label="Incidencia (bits)" value={selected.incidencia} mono />
                <Field
                  label="Checksum"
                  value={selected.checksumValido ? "Válido" : "Inválido"}
                />
                <Field
                  label="Equipo"
                  value={
                    selected.equipo
                      ? `${selected.equipo.descripcion} (${selected.equipo.ip})`
                      : "—"
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Trama cruda (hex)</Label>
                <div className="bg-slate-950 text-emerald-400 font-mono text-xs p-3 rounded-md break-all">
                  {selected.tramaHex}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Cadena procesada</Label>
                <div className="bg-slate-100 dark:bg-slate-900 font-mono text-xs p-3 rounded-md break-all">
                  {selected.tramaParseada || "—"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
