// TCP Listener del servidor biométrico - puerto 5000
import net, { Socket } from "net";
import { queryOne, sql } from "./db";
import { eventBus } from "./event-bus";
import { parseTrama, extraerTramas, toHexStr } from "./trama-parser";

const TCP_PORT = parseInt(process.env.TCP_PORT || "5000", 10);

interface EquipoState {
  ip: string; puerto: number; conectadoDesde: Date; ultimoBuffer: Buffer;
  tramasRecibidas: number; ultimaTrama: Date | null; tramasGuardadas: Set<string>;
}

const equiposConectados = new Map<Socket, EquipoState>();

async function procesarTrama(trama: Buffer, equipoState: EquipoState): Promise<void> {
  const parsed = parseTrama(trama);
  
  const dedupKey = `${parsed.codTarjeta}|${parsed.fechaHora?.toISOString()}|${parsed.lugarValor}|${equipoState.ip}`;
  const esNuevaTrama = !equipoState.tramasGuardadas.has(dedupKey);
  let marcacionId: number | null = null;

  if (esNuevaTrama && parsed.valida) {
    try {
      const trabResult = await queryOne<any>(
        "EXEC sp_BuscarCrearTrabajador @CodTarjeta = @cod, @Nombre = @nombre",
        { cod: { type: sql.NVarChar(20), value: parsed.codTarjeta }, nombre: { type: sql.NVarChar(300), value: `Trabajador ${parsed.codTarjeta}` } }
      );
      const codTrabajador = trabResult?.CodTrabajador ?? null;

      const eqResult = await queryOne<any>("EXEC sp_BuscarCrearEquipo @IP = @ip, @Descripcion = @desc", { ip: { type: sql.NVarChar(45), value: equipoState.ip }, desc: { type: sql.NVarChar(200), value: `Equipo ${equipoState.ip}` } });
      const codEquipo = eqResult?.CodEquipo ?? null;

      let esEntradaFinal = parsed.esEntrada;
      let esSalidaFinal = parsed.esSalida;
      let estadoFinal = parsed.estado;
      let tipoMarcacionFinal = parsed.tipoMarcacion;

      // Si el reloj no mandó ni Entrada (01) ni Salida (02) -> Es "Sin Botones"
      if (!parsed.bitEntrada && !parsed.bitSalida) {
          // Buscamos la última marcación de ese mismo lugar para alternar
          const ultimaMarcacion = await queryOne<any>(
            `SELECT TOP 1 EsEntrada FROM dbo.Marcaciones WHERE CodTarjeta = @cod AND Lugar = @lugar ORDER BY FechaHora DESC`,
            { cod: { type: sql.NVarChar(20), value: parsed.codTarjeta }, lugar: { type: sql.Int, value: parsed.lugarValor } }
          );

          if (ultimaMarcacion && ultimaMarcacion.EsEntrada === true) {
              esEntradaFinal = false; esSalidaFinal = true;
              estadoFinal = parsed.sistema === "ACCESO" ? "SA" : "IS";
              tipoMarcacionFinal = parsed.tipoMarcacion.replace("-ENTRADA", "-SALIDA");
          } else {
              esEntradaFinal = true; esSalidaFinal = false;
              estadoFinal = parsed.sistema === "ACCESO" ? "EA" : "IE";
              tipoMarcacionFinal = parsed.tipoMarcacion.replace("-SALIDA", "-ENTRADA");
          }
      }

      const incidenciaFinal = esSalidaFinal ? "01" : "00";
      const fechaHora = parsed.fechaHora ?? new Date();

      const ins = await queryOne<any>(
        `INSERT INTO dbo.Marcaciones (
            CodTarjeta, CodTrabajador, FechaHora, RecibidoEn, Incidencia, Estado, TipoMarcacion, 
            EsEntrada, EsSalida, ByteMarcacion, Lugar, LugarDesc, CodEquipo, IPEquipo, 
            TramaHex, TramaParseada, ChecksumValido, ModoMarcacion, FechaHoraN, FechaHoraE, Activo
         ) VALUES (
            @codTarjeta, @codTrabajador, @fechaHora, GETDATE(), @incidencia, @estado, @tipoMarcacion, 
            @esEntrada, @esSalida, @byteMarcacion, @lugar, @lugarDesc, @codEquipo, @ipEquipo, 
            @tramaHex, @tramaParseada, 1, @modo, GETDATE(), GETDATE(), 1
         );
         SELECT SCOPE_IDENTITY() AS Id;`,
        {
          codTarjeta: { type: sql.NVarChar(20), value: parsed.codTarjeta },
          codTrabajador: { type: sql.Int, value: codTrabajador },
          fechaHora: { type: sql.DateTime, value: fechaHora },
          incidencia: { type: sql.NVarChar(4), value: incidenciaFinal },
          estado: { type: sql.NVarChar(6), value: estadoFinal },
          tipoMarcacion: { type: sql.NVarChar(50), value: tipoMarcacionFinal },
          esEntrada: { type: sql.Bit, value: esEntradaFinal ? 1 : 0 },
          esSalida: { type: sql.Bit, value: esSalidaFinal ? 1 : 0 },
          byteMarcacion: { type: sql.Int, value: parsed.byteMarcacion },
          lugar: { type: sql.Int, value: parsed.lugarValor },
          lugarDesc: { type: sql.NVarChar(50), value: parsed.lugarDesc },
          codEquipo: { type: sql.Int, value: codEquipo },
          ipEquipo: { type: sql.NVarChar(45), value: equipoState.ip },
          tramaHex: { type: sql.NVarChar(200), value: parsed.tramaHex },
          tramaParseada: { type: sql.NVarChar(100), value: parsed.cadenaProcesada },
          modo: { type: sql.NVarChar(50), value: parsed.modoMarcacion }
        }
      );
      
      marcacionId = ins?.Id ?? null;
      equipoState.tramasGuardadas.add(dedupKey);
      console.log(`[DB] ✓ ID=${marcacionId} | ${estadoFinal} | ${tipoMarcacionFinal} | ${parsed.modoMarcacion} | Lugar: ${parsed.lugarValor}`);

    } catch (err) {
      console.error("[TCP] Error guardando en SQL Server:", (err as Error).message);
    }
  }
  
  equipoState.tramasRecibidas += 1;
  equipoState.ultimaTrama = new Date();
}

export function startTcpListener() {
  const server = net.createServer((socket: Socket) => {
    const remoteIp = socket.remoteAddress?.replace(/^::ffff:/, "") ?? "desconocida";
    const state: EquipoState = {
      ip: remoteIp, puerto: socket.remotePort ?? 0, conectadoDesde: new Date(), ultimoBuffer: Buffer.alloc(0), tramasRecibidas: 0, ultimaTrama: null, tramasGuardadas: new Set(),
    };
    equiposConectados.set(socket, state);

    socket.on("data", async (data: Buffer) => {
      state.ultimoBuffer = Buffer.concat([state.ultimoBuffer, data]);
      const { tramas, resto } = extraerTramas(state.ultimoBuffer);
      state.ultimoBuffer = resto;
      
      for (const trama of tramas) {
        const parsed = parseTrama(trama);
        if (parsed.valida) {
            await procesarTrama(trama, state);
            const ack = Buffer.from(trama); 
            const temp = ack[1]; ack[1] = ack[2]; ack[2] = temp;   
            socket.write(ack);
        } else {
            socket.write(Buffer.from([0x15]));
        }
      }
    });

    socket.on("close", () => equiposConectados.delete(socket));
    socket.on("error", () => equiposConectados.delete(socket));
  });

  server.listen(TCP_PORT, "0.0.0.0", () => {
    console.log(`[TCP Listener] Escuchando en puerto ${TCP_PORT}`);
  });

  return server;
}

export function getEquiposConectados() { return Array.from(equiposConectados.values()); }