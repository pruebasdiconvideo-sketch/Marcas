// Probe standalone v2: prueba ~30 variantes de comandos cuando el equipo conecta
import net from "net";
import os from "os";

const MI_IP = "0.0.0.0";
const MI_PUERTO = parseInt(process.argv[3] || "5000", 10);

function getLocalIps(): string[] {
  const ifaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (!iface.internal && iface.family === "IPv4") ips.push(iface.address);
    }
  }
  return ips;
}

function hexStr(b: Buffer | number[]): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

// Construir frame de 24 bytes con sync 0x25, end 0x7F, checksum XOR
function frame24(cmd: number, payload: number[] = []): Buffer {
  const b = new Array(24).fill(0);
  b[0] = 0x25;
  b[1] = cmd;
  for (let i = 0; i < Math.min(payload.length, 20); i++) b[2 + i] = payload[i];
  b[22] = 0x7f;
  let cs = 0; for (let i = 0; i < 22; i++) cs ^= b[i];
  b[23] = cs;
  return Buffer.from(b);
}

// Frame corto (variable length) con sync, cmd, end, checksum
function frameShort(cmd: number, len = 7): Buffer {
  const b = new Array(len).fill(0);
  b[0] = 0x25;
  if (len > 1) b[1] = cmd;
  b[len - 2] = 0x7f;
  let cs = 0; for (let i = 0; i < len - 1; i++) cs ^= b[i];
  b[len - 1] = cs;
  return Buffer.from(b);
}

// Frame de 24 bytes con payload de IP (4 bytes) en bytes 2-5
function frameWithIP(cmd: number, ip: string): Buffer {
  const parts = ip.split(".").map((n) => parseInt(n, 10));
  return frame24(cmd, parts);
}

// Frame de 24 bytes con timestamp actual en bytes 14-19 (día/mes/año/hora/min/seg)
function frameWithTime(cmd: number, payload: number[] = []): Buffer {
  const now = new Date();
  const fullPayload = [...payload];
  // Padding hasta byte 12, luego timestamp en 13-18 (sin codTarjeta en 13)
  while (fullPayload.length < 12) fullPayload.push(0);
  fullPayload.push(0); // codTarjeta placeholder (byte 13)
  fullPayload.push(now.getUTCDate());
  fullPayload.push(now.getUTCMonth() + 1);
  fullPayload.push(now.getUTCFullYear() - 2000);
  fullPayload.push(now.getUTCHours());
  fullPayload.push(now.getUTCMinutes());
  fullPayload.push(now.getUTCSeconds());
  return frame24(cmd, fullPayload);
}

const localIps = getLocalIps();
console.log(`[PROBE] IPs locales detectadas: ${localIps.join(", ")}`);
const miIpLan = localIps.find((ip) => ip.startsWith("192.168.")) || localIps[0] || "192.168.196.169";
console.log(`[PROBE] Usando IP LAN para pruebas: ${miIpLan}`);

// Lista ampliada de comandos candidatos
const COMANDOS: Array<{ nombre: string; frame: Buffer }> = [
  // Frames simples de 24 bytes con un byte de comando
  { nombre: "cmd=0x00 (NOP)", frame: frame24(0x00) },
  { nombre: "cmd=0x01 (REQ_COUNT)", frame: frame24(0x01) },
  { nombre: "cmd=0x02 (REQ_ALL)", frame: frame24(0x02) },
  { nombre: "cmd=0x03 (REQ_STATUS)", frame: frame24(0x03) },
  { nombre: "cmd=0x04 (SYNC_TIME)", frame: frame24(0x04) },
  { nombre: "cmd=0x05 (REQ_NEW)", frame: frame24(0x05) },
  { nombre: "cmd=0x06 (ACK)", frame: frame24(0x06) },
  { nombre: "cmd=0x07 (NAK?)", frame: frame24(0x07) },
  { nombre: "cmd=0x08 (ENQ?)", frame: frame24(0x08) },
  { nombre: "cmd=0x09 (EOT?)", frame: frame24(0x09) },
  { nombre: "cmd=0x0a (MARCACION)", frame: frame24(0x0a) },
  { nombre: "cmd=0x0b", frame: frame24(0x0b) },
  { nombre: "cmd=0x0c", frame: frame24(0x0c) },
  { nombre: "cmd=0x0d", frame: frame24(0x0d) },
  { nombre: "cmd=0x0e", frame: frame24(0x0e) },
  { nombre: "cmd=0x0f", frame: frame24(0x0f) },
  { nombre: "cmd=0x10 (DOWNLOAD)", frame: frame24(0x10) },
  { nombre: "cmd=0x11", frame: frame24(0x11) },
  { nombre: "cmd=0x12", frame: frame24(0x12) },
  { nombre: "cmd=0x20 (RESET)", frame: frame24(0x20) },
  { nombre: "cmd=0x21", frame: frame24(0x21) },
  { nombre: "cmd=0x30", frame: frame24(0x30) },
  { nombre: "cmd=0x40", frame: frame24(0x40) },
  { nombre: "cmd=0x50", frame: frame24(0x50) },
  { nombre: "cmd=0x80", frame: frame24(0x80) },
  { nombre: "cmd=0xFF (BROADCAST)", frame: frame24(0xff) },

  // Frames con IP LAN en bytes 2-5
  { nombre: "cmd=0x01 + IP_LAN", frame: frameWithIP(0x01, miIpLan) },
  { nombre: "cmd=0x02 + IP_LAN", frame: frameWithIP(0x02, miIpLan) },
  { nombre: "cmd=0x04 + IP_LAN", frame: frameWithIP(0x04, miIpLan) },
  { nombre: "cmd=0x10 + IP_LAN", frame: frameWithIP(0x10, miIpLan) },

  // Frames con timestamp actual
  { nombre: "cmd=0x04 + TIME", frame: frameWithTime(0x04) },
  { nombre: "cmd=0x03 + TIME", frame: frameWithTime(0x03) },

  // Frames cortos
  { nombre: "short 4 bytes: 25 06 7F cs", frame: frameShort(0x06, 4) },
  { nombre: "short 7 bytes: 25 06 00 00 00 7F cs", frame: frameShort(0x06, 7) },

  // Bytes sueltos
  { nombre: "byte único: 0x25", frame: Buffer.from([0x25]) },
  { nombre: "byte único: 0x06 (ACK)", frame: Buffer.from([0x06]) },
  { nombre: "byte único: 0x0D (CR)", frame: Buffer.from([0x0d]) },
  { nombre: "byte único: 0x0A (LF)", frame: Buffer.from([0x0a]) },
];

console.log(`[PROBE] Total de variantes a probar: ${COMANDOS.length}`);
console.log("=".repeat(70));
console.log(`[PROBE] Escuchando en ${MI_IP}:${MI_PUERTO}`);
console.log("[PROBE] Enciende/resetea el equipo para que conecte.");
console.log("=".repeat(70));

const server = net.createServer((socket) => {
  const remoteIp = socket.remoteAddress?.replace(/^::ffff:/, "") ?? "?";
  const remotePort = socket.remotePort ?? 0;
  console.log(`\n[PROBE] *** Equipo conectado: ${remoteIp}:${remotePort} ***\n`);

  let tramasRecibidas = 0;
  let bytesRecibidos = 0;
  let buffer = Buffer.alloc(0);
  let probeIdx = 0;
  let esperandoRespuesta = false;

  socket.on("data", (data: Buffer) => {
    bytesRecibidos += data.length;
    console.log(`[PROBE] <- RECIBIDO ${data.length} bytes (total: ${bytesRecibidos}): ${hexStr(data)}`);
    if (data.length > 0) {
      esperandoRespuesta = false;
    }
    buffer = Buffer.concat([buffer, data]);
    let start = 0;
    while (start < buffer.length) {
      const sync = buffer.indexOf(0x25, start);
      if (sync === -1) break;
      if (sync + 24 > buffer.length) break;
      if (buffer[sync + 22] === 0x7f) {
        const trama = buffer.subarray(sync, sync + 24);
        console.log(`[PROBE]   *** TRAMA COMPLETA: ${hexStr(trama)} ***`);
        tramasRecibidas++;
        start = sync + 24;
      } else {
        start = sync + 1;
      }
    }
    buffer = buffer.subarray(start);
  });

  socket.on("close", () => {
    console.log(`\n[PROBE] Equipo desconectado.`);
    console.log(`[PROBE] Total: ${tramasRecibidas} tramas, ${bytesRecibidos} bytes.`);
    if (tramasRecibidas === 0 && bytesRecibidos === 0) {
      console.log("[PROBE] *** El equipo no respondió a NINGÚN comando. ***");
      console.log("[PROBE] *** Necesitamos captura Wireshark del C# original. ***");
    }
  });

  socket.on("error", (err) => {
    console.error(`[PROBE] Error:`, err.message);
  });

  function enviarSiguiente() {
    if (probeIdx >= COMANDOS.length) {
      console.log(`\n[PROBE] === Fin del barrido. Tramas: ${tramasRecibidas}, Bytes: ${bytesRecibidos} ===`);
      if (tramasRecibidas === 0 && bytesRecibidos === 0) {
        console.log("[PROBE] *** Ningún comando funcionó. Necesitamos Wireshark del C#. ***");
      }
      return;
    }
    if (socket.destroyed) return;

    const cmd = COMANDOS[probeIdx];
    try {
      socket.write(cmd.frame);
      console.log(`[PROBE] -> #${probeIdx + 1}/${COMANDOS.length} ${cmd.nombre} | ${hexStr(cmd.frame)}`);
    } catch (e) {
      console.error(`[PROBE] Error enviando:`, (e as Error).message);
    }
    probeIdx++;
    setTimeout(enviarSiguiente, 2500);
  }

  setTimeout(enviarSiguiente, 1000);
});

server.on("error", (err) => {
  console.error(`[PROBE] Error servidor:`, err.message);
  if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
    console.error(`[PROBE] Puerto ${MI_PUERTO} en uso. Mata bun: taskkill /F /IM bun.exe`);
  }
});

server.listen(MI_PUERTO, MI_IP, () => {
  console.log(`[PROBE] Listo.`);
});
