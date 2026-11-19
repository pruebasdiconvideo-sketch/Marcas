"use client";

import { useSession } from "next-auth/react";
import { LoginScreen, LogoutButton } from "@/components/login-screen";
import { RealtimeView } from "@/components/realtime-view";
import { HistoricoView } from "@/components/historico-view";
import { EquiposView } from "@/components/equipos-view";
import { SimuladorView } from "@/components/simulador-view";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Fingerprint, Activity, History, Server, FlaskConical } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Fingerprint className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">
                Cliente Dashboard · Biométrico DiconSolutions
              </h1>
              <p className="text-xs text-muted-foreground leading-tight">
                Visualizador en línea · Conectado al servidor en <code className="font-mono">localhost:3001</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium">{session.user?.name ?? session.user?.email}</p>
              <p className="text-[11px] text-muted-foreground">
                {(session.user as any)?.role ?? "user"}
              </p>
            </div>
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline hidden sm:inline"
            >
              Ver servidor →
            </a>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-6 flex-1">
        <Tabs defaultValue="realtime" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-4">
            <TabsTrigger value="realtime">
              <Activity className="h-4 w-4 mr-1.5" />
              Tiempo Real
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-4 w-4 mr-1.5" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="equipos">
              <Server className="h-4 w-4 mr-1.5" />
              Equipos
            </TabsTrigger>
            <TabsTrigger value="simulador">
              <FlaskConical className="h-4 w-4 mr-1.5" />
              Simulador
            </TabsTrigger>
          </TabsList>

          <TabsContent value="realtime">
            <RealtimeView />
          </TabsContent>
          <TabsContent value="historico">
            <HistoricoView />
          </TabsContent>
          <TabsContent value="equipos">
            <EquiposView />
          </TabsContent>
          <TabsContent value="simulador">
            <SimuladorView />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background mt-auto">
        <div className="container mx-auto px-4 py-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>
            Cliente dashboard · consume API del servidor en <code className="font-mono">:3001</code>
          </span>
          <span className="font-mono">
            Servidor TCP :5000 · HTTP :3001 · Cliente :3000
          </span>
        </div>
      </footer>
    </div>
  );
}
