/**
 * Simulador de equipo biométrico - envía tramas al TCP listener (puerto 5000)
 * para probar el flujo completo: TCP → Parser → SQLite → WebSocket push.
 */
import net from "net";
import {
  generarTramaMarcacion,
  toHexStr,
  parseTrama,
} from "../src/lib/trama-parser";

const TCP_HOST = "127.0.0.1";
const TCP_PORT = 5000;

const tramas = [
  generarTramaMarcacion({
    codTarjeta: 5,
    dia: 10,
    mes: 11,
    anio: 2026,
    hora: 8,
    minuto: 30,
    segundo: 12,
    esEntrada: true,
    esSalida: false,
    lugar: 1,
  }),
  generarTramaMarcacion({
    codTarjeta: 5,
    dia: 10,
    mes: 11,
    anio: 2026,
    hora: 12,
    minuto: 30,
    segundo: 5,
    esEntrada: false,
    esSalida: true,
    lugar: 2,
  }),
  generarTramaMarcacion({
    codTarjeta: 5,
    dia: 10,
    mes: 11,
    anio: 2026,
    hora: 13,
    minuto: 0,
    segundo: 0,
    esEntrada: true,
    esSalida: false,
    lugar: 2,
  }),
  generarTramaMarcacion({
    codTarjeta: 12,
    dia: 10,
    mes: 11,
    anio: 2026,
    hora: 9,
    minuto: 15,
    segundo: 30,
    esEntrada: true,
    esSalida: false,
    lugar: 1,
  }),
  generarTramaMarcacion({
    codTarjeta: 12,
    dia: 10,
    mes: 11,
    anio: 2026,
    hora: 18,
    minuto: 0,
    segundo: 0,
    esEntrada: false,
    esSalida: true,
    lugar: 1,
  }),
];

console.log("=".repeat(60));
console.log("Simulador de Equipo Biométrico");
console.log("=".repeat(60));
console.log(`Conectando a ${TCP_HOST}:${TCP_PORT}...`);

const client = net.createConnection({ host: TCP_HOST, port: TCP_PORT }, () => {
  console.log("Conectado al TCP listener\n");
  let idx = 0;
  const sendNext = () => {
    if (idx >= tramas.length) {
      console.log("\nTodas las tramas enviadas. Cerrando conexión...");
      client.end();
      return;
    }
    const trama = tramas[idx];
    const parsed = parseTrama(trama);
    console.log(`[${idx + 1}/${tramas.length}] Enviando:`);
    console.log(`  Trama:     ${toHexStr(trama)}`);
    console.log(`  CodTarj:   ${parsed.codTarjeta}`);
    console.log(`  Tipo:      ${parsed.tipoMarcacion}`);
    console.log(`  Fecha:     ${parsed.fechaHora?.toISOString()}`);
    client.write(trama);
    idx += 1;
    setTimeout(sendNext, 800);
  };
  sendNext();
});

client.on("data", (data: Buffer) => {
  console.log(`  ACK recv:  ${toHexStr(data)} (${data.length} bytes)`);
});

client.on("error", (err: Error) => {
  console.error("Error de conexión:", err.message);
  process.exit(1);
});

client.on("close", () => {
  console.log("\nConexión cerrada.");
  process.exit(0);
});
