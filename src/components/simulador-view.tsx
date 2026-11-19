"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, FlaskConical, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const tiposSimulacion = [
  { value: "TRABAJO-ENTRADA", label: "Trabajo · Entrada" },
  { value: "TRABAJO-SALIDA", label: "Trabajo · Salida" },
  { value: "REFRIGERIO-ENTRADA", label: "Refrigerio · Entrada" },
  { value: "REFRIGERIO-SALIDA", label: "Refrigerio · Salida" },
];

export function SimuladorView() {
  const [codTarjeta, setCodTarjeta] = useState("1");
  const [tipo, setTipo] = useState("TRABAJO-ENTRADA");
  const [hora, setHora] = useState("");
  const [minuto, setMinuto] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{
    tramaEnviada: string;
    tramaParseada: string;
    tipoDetectado: string;
    ack: string;
    error?: string;
  } | null>(null);

  const enviar = async () => {
    setLoading(true);
    setResultado(null);
    try {
      const res = await fetch("/api/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codTarjeta: codTarjeta || "1",
          tipo,
          hora: hora ? Number(hora) : undefined,
          minuto: minuto ? Number(minuto) : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResultado(data);
        toast.success("Trama enviada y procesada correctamente");
      } else {
        toast.error(data.error || "Error al enviar trama");
      }
    } catch (err) {
      toast.error("Error de conexión: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const enviarRafaga = async () => {
    setLoading(true);
    setResultado(null);
    try {
      const codigos = [1, 2, 5, 12, 15];
      const tipos = [
        "TRABAJO-ENTRADA",
        "TRABAJO-ENTRADA",
        "TRABAJO-ENTRADA",
        "REFRIGERIO-SALIDA",
        "TRABAJO-ENTRADA",
      ];
      let count = 0;
      for (let i = 0; i < codigos.length; i++) {
        await new Promise((r) => setTimeout(r, 400));
        const res = await fetch("/api/simular", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codTarjeta: codigos[i],
            tipo: tipos[i],
          }),
        });
        if (res.ok) count++;
      }
      toast.success(`${count} tramas enviadas en ráfaga`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" /> Simulador de equipo biométrico
          </CardTitle>
          <CardDescription>
            Genera tramas binarias válidas y las envía al TCP listener (puerto 5000)
            para probar el flujo completo sin necesidad de un equipo físico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="cod">Código Tarjeta</Label>
              <Input
                id="cod"
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={codTarjeta}
                onChange={(e) => setCodTarjeta(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de marcación</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposSimulacion.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hora">Hora (opcional)</Label>
              <Input
                id="hora"
                type="number"
                min="0"
                max="23"
                placeholder="auto"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min">Minuto (opcional)</Label>
              <Input
                id="min"
                type="number"
                min="0"
                max="59"
                placeholder="auto"
                value={minuto}
                onChange={(e) => setMinuto(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={enviar} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Enviar 1 trama
            </Button>
            <Button variant="secondary" onClick={enviarRafaga} disabled={loading}>
              <Send className="h-4 w-4 mr-1" />
              Enviar ráfaga (5 tramas)
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Tipo detectado:</span>
              <Badge>{resultado.tipoDetectado}</Badge>
              {resultado.error && (
                <Badge variant="destructive">Error: {resultado.error}</Badge>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Trama enviada (hex)</Label>
              <div className="bg-slate-950 text-emerald-400 font-mono text-xs p-3 rounded-md break-all">
                {resultado.tramaEnviada}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cadena procesada</Label>
              <div className="bg-slate-100 dark:bg-slate-900 font-mono text-xs p-3 rounded-md break-all">
                {resultado.tramaParseada}
              </div>
            </div>
            {resultado.ack && (
              <div className="space-y-1">
                <Label className="text-xs">ACK recibido del listener (hex)</Label>
                <div className="bg-emerald-950 text-emerald-300 font-mono text-xs p-3 rounded-md break-all">
                  {resultado.ack}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              La marcación debería aparecer automáticamente en la pestaña "Tiempo Real"
              gracias al push por WebSocket.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
