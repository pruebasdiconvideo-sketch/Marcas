// Test del parser de tramas con la trama de ejemplo del usuario
import {
  parseTrama,
  construirACK,
  generarTramaMarcacion,
  extraerTramas,
  TRAMA_EJEMPLO,
  toHexStr,
} from "../src/lib/trama-parser";

console.log("=".repeat(60));
console.log("TEST 1: Trama de ejemplo del usuario");
console.log("=".repeat(60));
console.log("Trama:", toHexStr(TRAMA_EJEMPLO));
const parsed = parseTrama(TRAMA_EJEMPLO);
console.log("Válida:", parsed.valida);
console.log("Errores:", parsed.errores);
console.log("CodTarjeta:", parsed.codTarjeta);
console.log(
  "Fecha:",
  parsed.fechaHora ? parsed.fechaHora.toISOString() : "null"
);
console.log("Día/Mes/Año:", parsed.dia, "/", parsed.mes, "/", parsed.anio);
console.log("Hora:", parsed.hora, ":", parsed.minuto, ":", parsed.segundo);
console.log("Byte marcación (0x20):", "0x" + parsed.byteMarcacion.toString(16));
console.log("Bit entrada:", parsed.bitEntrada);
console.log("Bit salida:", parsed.bitSalida);
console.log("Lugar:", parsed.lugar.valor, "=", parsed.lugar.descripcion);
console.log("Tipo marcación:", parsed.tipoMarcacion);
console.log("Incidencia:", parsed.incidencia);
console.log("Checksum válido:", parsed.checksumValido);
console.log("Checksum recibido:", "0x" + parsed.checksumRecibido.toString(16));
console.log("Checksum calculado:", "0x" + parsed.checksumCalculado.toString(16));
console.log("Cadena procesada:", parsed.cadenaProcesada);
console.log("Esperada:        2026110911240000000000010110");

console.log("\n" + "=".repeat(60));
console.log("ACK binario de respuesta:");
console.log("=".repeat(60));
const ack = construirACK(parsed);
console.log("ACK:", toHexStr(ack));
console.log("ACK length:", ack.length, "bytes");

console.log("\n" + "=".repeat(60));
console.log("TEST 2: Generar trama TRABAJO-ENTRADA");
console.log("=".repeat(60));
const trama1 = generarTramaMarcacion({
  codTarjeta: 5,
  dia: 10,
  mes: 11,
  anio: 2026,
  hora: 8,
  minuto: 30,
  segundo: 0,
  esEntrada: true,
  esSalida: false,
  lugar: 1,
});
console.log("Generada:", toHexStr(trama1));
const p1 = parseTrama(trama1);
console.log("Tipo:", p1.tipoMarcacion, "válida:", p1.valida);

console.log("\n" + "=".repeat(60));
console.log("TEST 3: Generar trama REFRIGERIO-SALIDA");
console.log("=".repeat(60));
const trama2 = generarTramaMarcacion({
  codTarjeta: 12,
  dia: 10,
  mes: 11,
  anio: 2026,
  hora: 13,
  minuto: 0,
  segundo: 15,
  esEntrada: false,
  esSalida: true,
  lugar: 2,
});
console.log("Generada:", toHexStr(trama2));
const p2 = parseTrama(trama2);
console.log("Tipo:", p2.tipoMarcacion, "válida:", p2.valida);

console.log("\n" + "=".repeat(60));
console.log("TEST 4: Extraer tramas de un buffer con basura");
console.log("=".repeat(60));
const buffer = Buffer.concat([
  Buffer.from([0xff, 0x00, 0xfe]),
  trama1,
  Buffer.from([0xaa, 0xbb]),
  trama2,
]);
const { tramas, resto } = extraerTramas(buffer);
console.log("Tramas extraídas:", tramas.length);
console.log("Resto:", resto.length, "bytes");
tramas.forEach((t, i) => {
  const p = parseTrama(t);
  console.log(`  Trama ${i + 1}:`, p.tipoMarcacion, "|", p.codTarjeta);
});
