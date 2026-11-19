export const TRAMA_SYNC_BYTE = 0x25;
export const TRAMA_END_BYTE = 0x7f;
export const TRAMA_EXPECTED_LENGTH = 24;

export interface TramaParseada {
  valida: boolean; errores: string[]; tramaHex: string;
  codTarjeta: string; fechaHora: Date | null;
  dia: number | null; mes: number | null; anio: number | null;
  hora: number | null; minuto: number | null; segundo: number | null;
  byteMarcacion: number; bitEntrada: boolean; bitSalida: boolean;
  lugarValor: number; lugarDesc: string; tipoMarcacion: string; sistema: string;
  esEntrada: boolean; esSalida: boolean; cadenaProcesada: string;
  modoMarcacion: string; estado: string;
}

export function toHexStr(bytes: any): string {
  return Array.from(bytes).map((b: any) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

export function calcularChecksum(bytes: number[]): number {
  if (bytes.length < 2) return 0;
  return bytes.slice(0, bytes.length - 1).reduce((acc, b) => acc ^ b, 0);
}

// ============================================================
// DETECCIÓN AUTOMÁTICA BASADA EN EL BYTE 18
// ============================================================
export function detectarModoPorByte18(bytes: number[]): string {
  if (bytes.length < 19) return "Desconocido";
  
  const byte18 = bytes[18]; // El byte en la posición 18 (0-indexado)

  // Valores exactos según tus capturas
  if (byte18 === 0x39) return "Tarjeta";
  if (byte18 === 0x3A) return "Huella";
  if (byte18 === 0x3B) return "Teclado";

  // Fallback por si el reloj usa otros valores
  if (byte18 >= 0x39 && byte18 <= 0x3B) {
      return byte18 === 0x39 ? "Tarjeta" : (byte18 === 0x3A ? "Huella" : "Teclado");
  }

  return "Huella"; // Por defecto
}

export function construirCadenaProcesada(p: any): string {
  const yyyy = (p.anio ?? 0).toString().padStart(4, "0");
  const mm = (p.mes ?? 0).toString().padStart(2, "0");
  const dd = (p.dia ?? 0).toString().padStart(2, "0");
  const hh = (p.hora ?? 0).toString().padStart(2, "0");
  const min = (p.minuto ?? 0).toString().padStart(2, "0");
  const cod = p.codTarjeta.padStart(10, "0");
  const lugar = p.lugar === 0x10 ? "1" : (p.lugar >= 0x80 ? "2" : "0");
  const inc = (p.esSalida ? "1" : "0") + (p.esEntrada ? "1" : "0");
  return `${yyyy}${mm}${dd}${hh}${min}${cod}${lugar}${inc}`;
}

export function parseTrama(data: any): TramaParseada {
  const bytes = Array.from(data);
  const errores: string[] = [];
  const tramaHex = toHexStr(bytes);

  if (bytes.length !== TRAMA_EXPECTED_LENGTH) errores.push(`Longitud incorrecta: ${bytes.length}`);

  let codTarjeta = "";
  if (bytes.length >= 14) {
    codTarjeta = bytes.slice(4, 14).map((b: any) => b.toString()).join("");
  }

  const dia = bytes.length > 14 ? bytes[14] : null;
  const mes = bytes.length > 15 ? bytes[15] : null;
  const anioOffset = bytes.length > 16 ? bytes[16] : null;
  const hora = bytes.length > 17 ? bytes[17] : null;
  const minuto = bytes.length > 18 ? bytes[18] : null;
  const segundo = bytes.length > 19 ? bytes[19] : null;

  let fechaHora: Date | null = null;
  if (dia !== null && mes !== null && anioOffset !== null && hora !== null && minuto !== null && segundo !== null) {
    fechaHora = new Date(Date.UTC(2000 + anioOffset, mes - 1, dia, hora, minuto, segundo));
  }

  const byte20 = bytes.length > 20 ? bytes[20] : 0;
  const byte21 = bytes.length > 21 ? bytes[21] : 0;

  const esEntradaBoton = (byte20 & 0x01) === 0x01;
  const esSalidaBoton = (byte20 & 0x02) === 0x02;
  const lugarBase = byte20 & 0xF0;

  let sistema = "ASISTENCIA";
  let estado = "IE";
  let tipoMarcacion = "DESCONOCIDO";
  let esEntrada = false;
  let esSalida = false;

  if (byte21 === 0x80 || lugarBase === 0x80) {
      sistema = "ACCESO";
      if (esEntradaBoton) { estado = "EA"; tipoMarcacion = "ACCESO-ENTRADA"; esEntrada = true; }
      else if (esSalidaBoton) { estado = "SA"; tipoMarcacion = "ACCESO-SALIDA"; esSalida = true; }
  } else {
      sistema = "ASISTENCIA";
      const esRefrigerio = (lugarBase === 0x20 || byte21 === 0x21);
      const prefijo = esRefrigerio ? "REFRIGERIO" : "TRABAJO";
      if (esEntradaBoton) { estado = "IE"; tipoMarcacion = `${prefijo}-ENTRADA`; esEntrada = true; }
      else if (esSalidaBoton) { estado = "IS"; tipoMarcacion = `${prefijo}-SALIDA`; esSalida = true; }
  }

  const modoMarcacion = detectarModoPorByte18(bytes);

  const cadenaProcesada = construirCadenaProcesada({
    anio: anioOffset !== null ? 2000 + anioOffset : null,
    mes, dia, hora, minuto, codTarjeta, lugar: byte20, esEntrada, esSalida,
  });

  return {
    valida: errores.length === 0, errores, tramaHex, codTarjeta, fechaHora,
    anio: anioOffset !== null ? 2000 + anioOffset : null, mes, dia, hora, minuto, segundo,
    byteMarcacion: byte20, bitEntrada: esEntradaBoton, bitSalida: esSalidaBoton, 
    lugarValor: byte20, lugarDesc: tipoMarcacion,
    tipoMarcacion, sistema, esEntrada, esSalida, cadenaProcesada, modoMarcacion, estado
  };
}

export function extraerTramas(buffer: Buffer): { tramas: Buffer[]; resto: Buffer } {
  const tramas: Buffer[] = [];
  let inicio = 0;
  
  while (inicio < buffer.length) {
    const syncIdx = buffer.indexOf(TRAMA_SYNC_BYTE, inicio);
    if (syncIdx === -1) return { tramas, resto: buffer.subarray(Math.max(0, buffer.length - 4)) };
    if (syncIdx + TRAMA_EXPECTED_LENGTH > buffer.length) return { tramas, resto: buffer.subarray(syncIdx) };
    if (buffer[syncIdx + 22] !== TRAMA_END_BYTE) { inicio = syncIdx + 1; continue; }
    
    tramas.push(Buffer.from(buffer.subarray(syncIdx, syncIdx + TRAMA_EXPECTED_LENGTH)));
    inicio = syncIdx + TRAMA_EXPECTED_LENGTH;
  }
  return { tramas, resto: Buffer.alloc(0) };
}

export function generarTramaMarcacion(params: any): Buffer {
  const bytes = [0x25, 0x0a, 0x01, 0x21, 0,0,0,0,0,0,0,0,0,0, 14, 11, 26, 12, 0, 0, params.lugar || 0x11, 0x11, 0x7f, 0];
  const checksum = bytes.slice(0, 23).reduce((a, b) => a ^ b, 0);
  bytes[23] = checksum;
  return Buffer.from(bytes);
}