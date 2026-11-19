/**
 * Parser de tramas biométricas - Protocolo DiconSolutions modo 4 botones
 *
 * Estructura de trama (24 bytes, índices 0-23):
 *   BYTE #0  = 0x25 (sync/header)
 *   BYTE #1  = ?
 *   BYTE #2  = ?
 *   BYTE #3  = ?
 *   BYTE #4-12 = 0x00 (reservados)
 *   BYTE #13 = CodTarjeta (1 byte, 1-255)
 *   BYTE #14 = día (1-31)
 *   BYTE #15 = mes (1-12)
 *   BYTE #16 = año - 2000 (ej: 26 = 2026)
 *   BYTE #17 = hora (0-23)
 *   BYTE #18 = minuto (0-59)
 *   BYTE #19 = segundo (0-59)
 *   BYTE #20 = bits: bit0=ENTRADA, bit1=SALIDA (otros bits reservados)
 *   BYTE #21 = LUGAR DE TRAMA: 0=default, 1=trabajo, 2=refrigerio
 *   BYTE #22 = 0x7F (marcador de fin)
 *   BYTE #23 = checksum (XOR de bytes 0-22)
 *
 * Ejemplo:
 *   [25 0A 01 21 00 00 00 00 00 00 00 00 00 01 09 0B 1A 0B 18 2E 82 01 7F D7]
 *    b0 b1 b2 b3 b4 ..                                  b13 b14 b15 b16 b17 b18 b19 b20 b21 b22 b23
 *   - CodTarjeta = 0x01 = 1
 *   - Fecha: 09/11/2026 11:24:46
 *   - byte 20 = 0x82 → bit1=1 → SALIDA
 *   - byte 21 = 0x01 → LUGAR=trabajo
 *   - tipo = TRABAJO-SALIDA
 */

export const TRAMA_SYNC_BYTE = 0x25;
export const TRAMA_END_BYTE = 0x7f;
export const TRAMA_EXPECTED_LENGTH = 24;

export type TipoMarcacion =
  | "TRABAJO-ENTRADA"
  | "TRABAJO-SALIDA"
  | "REFRIGERIO-ENTRADA"
  | "REFRIGERIO-SALIDA"
  | "DEFAULT-ENTRADA"
  | "DEFAULT-SALIDA"
  | "DESCONOCIDO";

export interface LugarTrama {
  valor: number;
  descripcion: string;
}

export interface TramaParseada {
  valida: boolean;
  errores: string[];
  // Datos crudos
  tramaHex: string;
  longitud: number;
  // Campos parseados
  codTarjeta: string;
  fechaHora: Date | null;
  anio: number | null;
  mes: number | null;
  dia: number | null;
  hora: number | null;
  minuto: number | null;
  segundo: number | null;
  byteMarcacion: number; // byte #20 crudo
  bitEntrada: boolean; // bit 0
  bitSalida: boolean; // bit 1
  lugar: LugarTrama;
  endMarker: number; // byte #22 (esperado 0x7F)
  checksumRecibido: number; // byte #23
  checksumCalculado: number;
  checksumValido: boolean;
  // Resultado
  tipoMarcacion: TipoMarcacion;
  incidencia: string; // "01", "10", "11", "00"
  esEntrada: boolean;
  esSalida: boolean;
  // Cadena legible tipo "2026110911240000000000010110"
  cadenaProcesada: string;
}

/** Convierte un Buffer o array de bytes a string hex separado por espacios. */
export function toHexStr(bytes: Buffer | Uint8Array | number[]): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

/** Calcula el checksum XOR de los bytes 0..n-2 (todos menos el último). */
export function calcularChecksum(bytes: Buffer | Uint8Array | number[]): number {
  const arr = Array.from(bytes);
  if (arr.length < 2) return 0;
  // XOR de todos los bytes excepto el último
  return arr.slice(0, arr.length - 1).reduce((acc, b) => acc ^ b, 0);
}

/** Describe el lugar a partir del byte #21. */
export function describirLugar(valor: number): LugarTrama {
  switch (valor) {
    case 0:
      return { valor, descripcion: "Default" };
    case 1:
      return { valor, descripcion: "Trabajo" };
    case 2:
      return { valor, descripcion: "Refrigerio" };
    default:
      return { valor, descripcion: `Desconocido (${valor})` };
  }
}

/** Determina el tipo de marcación combinando bits + lugar. */
export function determinarTipoMarcacion(
  esEntrada: boolean,
  esSalida: boolean,
  lugar: number
): TipoMarcacion {
  if (esEntrada && !esSalida) {
    if (lugar === 1) return "TRABAJO-ENTRADA";
    if (lugar === 2) return "REFRIGERIO-ENTRADA";
    if (lugar === 0) return "DEFAULT-ENTRADA";
    return "DESCONOCIDO";
  }
  if (esSalida && !esEntrada) {
    if (lugar === 1) return "TRABAJO-SALIDA";
    if (lugar === 2) return "REFRIGERIO-SALIDA";
    if (lugar === 0) return "DEFAULT-SALIDA";
    return "DESCONOCIDO";
  }
  // Ambos bits o ninguno → no debería ocurrir
  return "DESCONOCIDO";
}

/** Cadena procesada estilo "2026110911240000000000010110". */
export function construirCadenaProcesada(parsed: {
  anio: number | null;
  mes: number | null;
  dia: number | null;
  hora: number | null;
  minuto: number | null;
  codTarjeta: string;
  lugar: number;
  esEntrada: boolean;
  esSalida: boolean;
}): string {
  const yyyy = (parsed.anio ?? 0).toString().padStart(4, "0");
  const mm = (parsed.mes ?? 0).toString().padStart(2, "0");
  const dd = (parsed.dia ?? 0).toString().padStart(2, "0");
  const hh = (parsed.hora ?? 0).toString().padStart(2, "0");
  const min = (parsed.minuto ?? 0).toString().padStart(2, "0");
  // 10 dígitos del código de trabajador con padding
  const cod = parsed.codTarjeta.padStart(10, "0");
  // Lugar: 1 dígito
  const lugar = parsed.lugar.toString();
  // Incidencia bits: "10" si salida, "01" si entrada, "11" si ambos
  const inc = (parsed.esSalida ? "1" : "0") + (parsed.esEntrada ? "1" : "0");
  return `${yyyy}${mm}${dd}${hh}${min}${cod}${lugar}${inc}`;
}

/**
 * Parsea una trama binaria completa (24 bytes).
 * Acepta Buffer o Uint8Array.
 */
export function parseTrama(data: Buffer | Uint8Array | number[]): TramaParseada {
  const bytes = Array.from(data);
  const errores: string[] = [];
  const tramaHex = toHexStr(bytes);

  // Validaciones básicas
  if (bytes.length !== TRAMA_EXPECTED_LENGTH) {
    errores.push(
      `Longitud incorrecta: ${bytes.length} bytes (esperado ${TRAMA_EXPECTED_LENGTH})`
    );
  }

  if (bytes.length > 0 && bytes[0] !== TRAMA_SYNC_BYTE) {
    errores.push(
      `Byte de sync incorrecto: 0x${bytes[0].toString(16)} (esperado 0x25)`
    );
  }

  const endMarker = bytes.length > 22 ? bytes[22] : 0;
  if (bytes.length > 22 && endMarker !== TRAMA_END_BYTE) {
    errores.push(
      `Marcador de fin incorrecto: 0x${endMarker.toString(16)} (esperado 0x7F)`
    );
  }

  // CodTarjeta (byte 13)
  const codTarjetaByte = bytes.length > 13 ? bytes[13] : 0;
  const codTarjeta = codTarjetaByte.toString();

  // Fecha (bytes 14-19): día, mes, año-2000, hora, minuto, segundo
  const dia = bytes.length > 14 ? bytes[14] : null;
  const mes = bytes.length > 15 ? bytes[15] : null;
  const anioOffset = bytes.length > 16 ? bytes[16] : null;
  const hora = bytes.length > 17 ? bytes[17] : null;
  const minuto = bytes.length > 18 ? bytes[18] : null;
  const segundo = bytes.length > 19 ? bytes[19] : null;

  let fechaHora: Date | null = null;
  if (
    dia !== null &&
    mes !== null &&
    anioOffset !== null &&
    hora !== null &&
    minuto !== null &&
    segundo !== null
  ) {
    const anio = 2000 + anioOffset;
    // Validar rangos
    if (dia < 1 || dia > 31) errores.push(`Día fuera de rango: ${dia}`);
    if (mes < 1 || mes > 12) errores.push(`Mes fuera de rango: ${mes}`);
    if (hora > 23) errores.push(`Hora fuera de rango: ${hora}`);
    if (minuto > 59) errores.push(`Minuto fuera de rango: ${minuto}`);
    if (segundo > 59) errores.push(`Segundo fuera de rango: ${segundo}`);
    // Construir fecha en UTC para evitar problemas de zona horaria
    fechaHora = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto, segundo));
  }

  // Byte #20: bits de marcación
  const byteMarcacion = bytes.length > 20 ? bytes[20] : 0;
  const bitEntrada = (byteMarcacion & 0x01) === 0x01; // bit 0
  const bitSalida = (byteMarcacion & 0x02) === 0x02; // bit 1

  // Byte #21: lugar
  const lugarByte = bytes.length > 21 ? bytes[21] : 0;
  const lugar = describirLugar(lugarByte);

  // Byte #23: checksum
  const checksumRecibido = bytes.length > 23 ? bytes[23] : 0;
  const checksumCalculado = calcularChecksum(bytes);
  const checksumValido = checksumRecibido === checksumCalculado;
  if (!checksumValido) {
    errores.push(
      `Checksum inválido: recibido 0x${checksumRecibido.toString(16).padStart(2, "0")}, calculado 0x${checksumCalculado.toString(16).padStart(2, "0")}`
    );
  }

  // Tipo de marcación
  const tipoMarcacion = determinarTipoMarcacion(
    bitEntrada,
    bitSalida,
    lugarByte
  );

  // Incidencia string "01"/"10"/"11"
  const incidencia = (bitSalida ? "1" : "0") + (bitEntrada ? "1" : "0");

  // Cadena procesada legible
  const cadenaProcesada = construirCadenaProcesada({
    anio: anioOffset !== null ? 2000 + anioOffset : null,
    mes,
    dia,
    hora,
    minuto,
    codTarjeta,
    lugar: lugarByte,
    esEntrada: bitEntrada,
    esSalida: bitSalida,
  });

  return {
    valida: errores.length === 0,
    errores,
    tramaHex,
    longitud: bytes.length,
    codTarjeta,
    fechaHora,
    anio: anioOffset !== null ? 2000 + anioOffset : null,
    mes,
    dia,
    hora,
    minuto,
    segundo,
    byteMarcacion,
    bitEntrada,
    bitSalida,
    lugar,
    endMarker,
    checksumRecibido,
    checksumCalculado,
    checksumValido,
    tipoMarcacion,
    incidencia,
    esEntrada: bitEntrada,
    esSalida: bitSalida,
    cadenaProcesada,
  };
}

/**
 * Construye la trama ACK binaria de respuesta al equipo.
 * Formato: [0x25, 0x06, CodTarjeta, byteMarcacion, lugar, 0x7F, checksum]
 *  - 0x25 = sync (mismo que trama recibida)
 *  - 0x06 = ACK (confirmación)
 *  - CodTarjeta, byteMarcacion, lugar = echo de la trama recibida
 *  - 0x7F = end marker
 *  - checksum = XOR de los 6 bytes anteriores
 */
export function construirACK(parsed: TramaParseada): Buffer {
  const codTarjetaByte = parseInt(parsed.codTarjeta, 10) & 0xff;
  const bytes = [
    TRAMA_SYNC_BYTE, // 0x25
    0x06, // ACK
    codTarjetaByte,
    parsed.byteMarcacion,
    parsed.lugar.valor,
    TRAMA_END_BYTE, // 0x7F
  ];
  const checksum = bytes.reduce((acc, b) => acc ^ b, 0);
  bytes.push(checksum);
  return Buffer.from(bytes);
}

/**
 * Intenta extraer una trama completa (24 bytes) a partir de un buffer
 * acumulado de datos TCP. Las tramas pueden venir pegadas o incompletas.
 * Retorna las tramas completas encontradas y el resto del buffer.
 */
export function extraerTramas(
  buffer: Buffer
): { tramas: Buffer[]; resto: Buffer } {
  const tramas: Buffer[] = [];
  let inicio = 0;

  while (inicio < buffer.length) {
    // Buscar byte de sync 0x25
    const syncIdx = buffer.indexOf(TRAMA_SYNC_BYTE, inicio);
    if (syncIdx === -1) {
      // No hay sync, descartar todo pero conservar últimos bytes por si viene troceado
      return { tramas, resto: buffer.subarray(Math.max(0, buffer.length - 4)) };
    }

    // ¿Hay suficientes bytes para una trama completa?
    if (syncIdx + TRAMA_EXPECTED_LENGTH > buffer.length) {
      // Trama incompleta, esperar más datos
      return { tramas, resto: buffer.subarray(syncIdx) };
    }

    // Validar marcador de fin en byte 22
    if (buffer[syncIdx + 22] !== TRAMA_END_BYTE) {
      // No es una trama válida, avanzar 1 byte y seguir buscando
      inicio = syncIdx + 1;
      continue;
    }

    // Extraer la trama completa
    const trama = buffer.subarray(syncIdx, syncIdx + TRAMA_EXPECTED_LENGTH);
    tramas.push(Buffer.from(trama));
    inicio = syncIdx + TRAMA_EXPECTED_LENGTH;
  }

  return { tramas, resto: Buffer.alloc(0) };
}

/** Ejemplo de trama para tests y demo. */
export const TRAMA_EJEMPLO = Buffer.from([
  0x25, 0x0a, 0x01, 0x21, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x09, 0x0b, 0x1a, 0x0b, 0x18, 0x2e, 0x82, 0x01, 0x7f, 0xd7,
]);

/**
 * Genera una trama de marcación válida para testing.
 * Útil para el simulador de equipo biométrico.
 */
export function generarTramaMarcacion(params: {
  codTarjeta: number;
  dia?: number;
  mes?: number;
  anio?: number; // 4 dígitos
  hora?: number;
  minuto?: number;
  segundo?: number;
  esEntrada?: boolean;
  esSalida?: boolean;
  lugar?: number; // 0, 1, 2
}): Buffer {
  const now = new Date();
  const dia = params.dia ?? now.getUTCDate();
  const mes = params.mes ?? now.getUTCMonth() + 1;
  const anio = params.anio ?? now.getUTCFullYear();
  const hora = params.hora ?? now.getUTCHours();
  const minuto = params.minuto ?? now.getUTCMinutes();
  const segundo = params.segundo ?? now.getUTCSeconds();
  const lugar = params.lugar ?? 1;
  const esEntrada = params.esEntrada ?? true;
  const esSalida = params.esSalida ?? false;

  let byteMarcacion = 0;
  if (esEntrada) byteMarcacion |= 0x01;
  if (esSalida) byteMarcacion |= 0x02;

  const bytes = [
    0x25, // sync
    0x0a, // ?
    0x01, // ?
    0x21, // ?
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reservados
    params.codTarjeta & 0xff, // byte 13
    dia & 0xff,
    mes & 0xff,
    (anio - 2000) & 0xff,
    hora & 0xff,
    minuto & 0xff,
    segundo & 0xff,
    byteMarcacion,
    lugar & 0xff,
    0x7f, // end marker
    0x00, // checksum placeholder
  ];
  const checksum = bytes.slice(0, bytes.length - 1).reduce((a, b) => a ^ b, 0);
  bytes[bytes.length - 1] = checksum;
  return Buffer.from(bytes);
}
