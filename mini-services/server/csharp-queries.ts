// Queries adaptadas al esquema de la BD del C# (BDASISTENCIA15_GruasdelPacifico)
// Modo SOLO LECTURA: nunca escribe, solo lee de las tablas reales del C#.
//
// Tablas del C# que usamos:
//   dbo.Marcaciones    - 53,380 filas - marcaciones descargadas del equipo
//   dbo.Trabajadores   - 85 filas - empleados
//   dbo.Equipos        - 1 fila - equipo biométrico
//   dbo.LogSistema     - log de eventos del C#
//
// Mapeo de campos del C# → formato esperado por el dashboard:
//   Marcaciones.FechaHoraMarcacion → fechaHora
//   Marcaciones.FechaHoraN         → recibidoEn (cuándo se insertó en BD)
//   Marcaciones.CodTrabajador      → trabajadorId (FK)
//   Marcaciones.Incidencia         → incidencia ('00'=entrada, '01'=salida)
//   Marcaciones.Estado             → tipoMarcacion ('IE','IS','ST','EL','SL')
//   Marcaciones.CodEquipo          → equipoId
//   Trabajadores.CodTarjeta        → codTarjeta
//   Trabajadores.Nombre1 + Apellidos → trabajador.nombre
//   Trabajadores.Documento         → trabajador.documento
//   Trabajadores.PuestoLaboral     → trabajador.area
//   Equipos.IP                     → ipEquipo
//   Equipos.Descripcion            → equipo.descripcion

import { query, queryOne, sql } from "./db";

// ============================================================
// MAPEO DE ESTADOS
// ============================================================
// Estados del C# (campo Marcaciones.Estado):
//   "IE" = Ingreso Entrada     → esEntrada=true,  esSalida=false
//   "IS" = Ingreso Salida      → esEntrada=false, esSalida=true
//   "ST" = Salida Tardía       → esEntrada=false, esSalida=true
//   "EL" = Entrada Libre       → esEntrada=true,  esSalida=false
//   "SL" = Salida Libre        → esEntrada=false, esSalida=true
// Incidencia (campo Marcaciones.Incidencia):
//   "00" = entrada
//   "01" = salida

export function estadoAEsEntrada(estado: string | null, incidencia: string | null): boolean {
  if (estado) {
    return estado.startsWith("I") && estado.endsWith("E") || estado === "EL";
  }
  return incidencia === "00";
}

export function estadoAEsSalida(estado: string | null, incidencia: string | null): boolean {
  if (estado) {
    return estado.startsWith("I") && estado.endsWith("S") || estado === "ST" || estado === "SL";
  }
  return incidencia === "01";
}

export function estadoATipoMarcacion(estado: string | null, incidencia: string | null): string {
  if (estado === "IE") return "TRABAJO-ENTRADA";
  if (estado === "IS") return "TRABAJO-SALIDA";
  if (estado === "ST") return "TRABAJO-SALIDA-TARDIA";
  if (estado === "EL") return "ENTRADA-LIBRE";
  if (estado === "SL") return "SALIDA-LIBRE";
  if (incidencia === "00") return "ENTRADA";
  if (incidencia === "01") return "SALIDA";
  return "DESCONOCIDO";
}

// ============================================================
// FILTROS PARA QUERY DINÁMICA
// ============================================================
function buildFilterCsharp(q: Record<string, string>) {
  const conditions: string[] = [];
  const params: Record<string, { type: any; value: any }> = {};
  let paramIdx = 0;

  if (q.fechaInicio) {
    const p = `@p${paramIdx++}`;
    conditions.push(`m.FechaHoraMarcacion >= ${p}`);
    params[p] = { type: sql.DateTime, value: new Date(q.fechaInicio) };
  }
  if (q.fechaFin) {
    const p = `@p${paramIdx++}`;
    conditions.push(`m.FechaHoraMarcacion <= ${p}`);
    params[p] = { type: sql.DateTime, value: new Date(q.fechaFin) };
  }
  if (q.codTrjeta || q.codTarjeta) {
    const val = q.codTarjeta || q.codTrjeta;
    const p = `@p${paramIdx++}`;
    conditions.push(`t.CodTarjeta = ${p}`);
    params[p] = { type: sql.NVarChar(20), value: val };
  }
  if (q.codTrabajador) {
    const p = `@p${paramIdx++}`;
    conditions.push(`m.CodTrabajador = ${p}`);
    params[p] = { type: sql.Int, value: Number(q.codTrabajador) };
  }
  if (q.tipoMarcacion || q.estado) {
    const val = q.tipoMarcacion || q.estado;
    const p = `@p${paramIdx++}`;
    conditions.push(`m.Estado = ${p}`);
    params[p] = { type: sql.NVarChar(6), value: val };
  }
  if (q.incidencia) {
    const p = `@p${paramIdx++}`;
    conditions.push(`m.Incidencia = ${p}`);
    params[p] = { type: sql.NVarChar(4), value: q.incidencia };
  }
  if (q.ipEquipo) {
    const p = `@p${paramIdx++}`;
    conditions.push(`e.IP = ${p}`);
    params[p] = { type: sql.NVarChar(30), value: q.ipEquipo };
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  return { where, params };
}

// ============================================================
// QUERY: MARCACIONES
// ============================================================
export async function getMarcacionesCsharp(q: Record<string, string>) {
  const page = parseInt(q.page ?? "1", 10);
  const pageSize = Math.min(parseInt(q.pageSize ?? "50", 10), 200);
  const offset = (page - 1) * pageSize;
  const { where, params } = buildFilterCsharp(q);

  // Total
  const totalRows = await query<any>(
    `SELECT COUNT(*) as c
     FROM dbo.Marcaciones m
     LEFT JOIN dbo.Trabajadores t ON m.CodTrabajador = t.CodTrabajador
     LEFT JOIN dbo.Equipos e ON m.CodEquipo = e.CodEquipo
     ${where}`,
    params
  );
  const total = totalRows[0]?.c ?? 0;

  // Items con paginación
  const items = await query<any>(
    `SELECT
        m.FechaHoraMarcacion AS fechaHora,
        m.FechaHoraN AS recibidoEn,
        m.CodTrabajador AS codTrabajador,
        m.Num_Marca AS numMarca,
        m.Incidencia AS incidencia,
        m.Estado AS estado,
        m.Tardanza AS tardanza,
        m.Temprano AS temprano,
        m.Activo AS activo,
        m.Turno AS turno,
        m.Obs AS obs,
        m.CodEquipo AS codEquipo,
        t.CodTarjeta AS codTarjeta,
        t.Nombre1 AS nombre1,
        t.Nombre2 AS nombre2,
        t.ApellidoPat AS apellidoPat,
        t.ApellidoMat AS apellidoMat,
        t.Documento AS documento,
        t.PuestoLaboral AS puestoLaboral,
        t.EmailTrabajo AS emailTrabajo,
        t.EstadoDB AS estadoTrabajador,
        e.Descripcion AS equipoDesc,
        e.IP AS equipoIp,
        e.NumeroEquipo AS equipoNumero
      FROM dbo.Marcaciones m
      LEFT JOIN dbo.Trabajadores t ON m.CodTrabajador = t.CodTrabajador
      LEFT JOIN dbo.Equipos e ON m.CodEquipo = e.CodEquipo
      ${where}
      ORDER BY m.FechaHoraMarcacion DESC
      OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`,
    params
  );

  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    items: items.map((m: any) => {
      const nombreCompleto = [m.nombre1, m.nombre2, m.apellidoPat, m.apellidoMat]
        .filter((x: string | null) => x && x.trim())
        .join(" ");
      return {
        // ID sintético: combinación de codTrabajador + fechaHora (no hay ID autogenerado)
        id: `${m.codTrabajador}_${m.fechaHora?.toISOString?.() ?? m.fechaHora}_${m.numMarca}`,
        // Trama no aplica en modo lectura (los datos vienen procesados del C#)
        tramaHex: null,
        tramaParseada: null,
        codTarjeta: m.codTarjeta || String(m.codTrabajador),
        fechaHora: m.fechaHora?.toISOString?.() ?? m.fechaHora,
        recibidoEn: m.recibidoEn?.toISOString?.() ?? m.recibidoEn,
        lugar: 1, // default trabajo
        lugarDesc: "Trabajo",
        incidencia: m.incidencia,
        estado: m.estado,
        tipoMarcacion: estadoATipoMarcacion(m.estado, m.incidencia),
        esEntrada: estadoAEsEntrada(m.estado, m.incidencia),
        esSalida: estadoAEsSalida(m.estado, m.incidencia),
        byteMarcacion: m.incidencia === "01" ? 2 : 1,
        checksumValido: true, // viene procesado del C#
        numMarca: m.numMarca,
        tardanza: m.tardanza,
        temprano: m.temprano,
        activo: !!m.activo,
        turno: m.turno,
        obs: m.obs,
        ipEquipo: m.equipoIp,
        codEquipo: m.codEquipo,
        trabajador: nombreCompleto ? {
          nombre: nombreCompleto,
          documento: m.documento,
          area: m.puestoLaboral,
          email: m.emailTrabajo,
          codTrabajador: m.codTrabajador,
          estadoTrabajador: m.estadoTrabajador,
        } : null,
        equipo: m.equipoIp ? {
          descripcion: m.equipoDesc,
          ip: m.equipoIp,
          numeroEquipo: m.equipoNumero,
          codEquipo: m.codEquipo,
        } : null,
      };
    }),
  };
}

// ============================================================
// QUERY: STATS
// ============================================================
export async function getStatsCsharp() {
  const ahora = new Date();
  // Inicio de hoy en UTC (los datos del C# están en UTC)
  const inicioHoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  const finHoy = new Date(inicioHoy.getTime() + 86400000);
  const params = {
    inicio: { type: sql.DateTime, value: inicioHoy },
    fin: { type: sql.DateTime, value: finHoy },
  };

  const totalHoyRows = await query<any>(
    "SELECT COUNT(*) as c FROM dbo.Marcaciones WHERE FechaHoraMarcacion >= @inicio AND FechaHoraMarcacion < @fin",
    params
  );
  const entradasRows = await query<any>(
    "SELECT COUNT(*) as c FROM dbo.Marcaciones WHERE FechaHoraMarcacion >= @inicio AND FechaHoraMarcacion < @fin AND (Estado IN ('IE','EL') OR Incidencia = '00')",
    params
  );
  const salidasRows = await query<any>(
    "SELECT COUNT(*) as c FROM dbo.Marcaciones WHERE FechaHoraMarcacion >= @inicio AND FechaHoraMarcacion < @fin AND (Estado IN ('IS','ST','SL') OR Incidencia = '01')",
    params
  );
  const invalidasRows = await query<any>(
    "SELECT COUNT(*) as c FROM dbo.Marcaciones WHERE FechaHoraMarcacion >= @inicio AND FechaHoraMarcacion < @fin AND Activo = 0",
    params
  );

  const totalTrabajadoresRows = await query<any>(
    "SELECT COUNT(*) as c FROM dbo.Trabajadores WHERE EstadoDB = 1"
  );
  const totalEquiposRows = await query<any>(
    "SELECT COUNT(*) as c FROM dbo.Equipos"
  );

  // Ultimas 5 marcaciones
  const ultimas = await query<any>(
    `SELECT TOP 5
        m.FechaHoraMarcacion AS fechaHora,
        m.CodTrabajador AS codTrabajador,
        m.Incidencia AS incidencia,
        m.Estado AS estado,
        t.CodTarjeta AS codTarjeta,
        t.Nombre1 AS nombre1,
        t.ApellidoPat AS apellidoPat,
        e.IP AS equipoIp,
        e.Descripcion AS equipoDesc
      FROM dbo.Marcaciones m
      LEFT JOIN dbo.Trabajadores t ON m.CodTrabajador = t.CodTrabajador
      LEFT JOIN dbo.Equipos e ON m.CodEquipo = e.CodEquipo
      ORDER BY m.FechaHoraN DESC`
  );

  // Por tipo
  const porTipoRows = await query<any>(
    `SELECT Estado, COUNT(*) as c
     FROM dbo.Marcaciones
     WHERE FechaHoraMarcacion >= @inicio AND FechaHoraMarcacion < @fin
     GROUP BY Estado`,
    params
  );
  const porTipo: Record<string, number> = {};
  porTipoRows.forEach((r: any) => { porTipo[r.Estado || "DESCONOCIDO"] = r.c; });

  // Por equipo
  const porEquipoRows = await query<any>(
    `SELECT e.IP as ip, e.Descripcion as equipoDesc, COUNT(*) as c
     FROM dbo.Marcaciones m
     LEFT JOIN dbo.Equipos e ON m.CodEquipo = e.CodEquipo
     WHERE m.FechaHoraMarcacion >= @inicio AND m.FechaHoraMarcacion < @fin
     GROUP BY e.IP, e.Descripcion`,
    params
  );

  return {
    periodo: { inicio: inicioHoy.toISOString(), fin: finHoy.toISOString() },
    totalHoy: totalHoyRows[0]?.c ?? 0,
    entradasHoy: entradasRows[0]?.c ?? 0,
    salidasHoy: salidasRows[0]?.c ?? 0,
    refrigerioHoy: 0, // el C# no tiene campo "refrigerio" directo
    trabajoHoy: totalHoyRows[0]?.c ?? 0,
    tramasInvalidasHoy: invalidasRows[0]?.c ?? 0,
    totalTrabajadores: totalTrabajadoresRows[0]?.c ?? 0,
    totalEquipos: totalEquiposRows[0]?.c ?? 0,
    equiposConectados: 1, // asumimos 1 (Reloj Huachipa)
    porTipo,
    porEquipo: porEquipoRows.map((r: any) => ({ ip: r.ip, descripcion: r.equipoDesc, count: r.c })),
    ultimasMarcaciones: ultimas.map((m: any) => {
      const nombreCompleto = [m.nombre1, m.apellidoPat].filter(Boolean).join(" ");
      return {
        id: `${m.codTrabajador}_${m.fechaHora?.toISOString?.() ?? m.fechaHora}`,
        codTarjeta: m.codTarjeta || String(m.codTrabajador),
        trabajador: nombreCompleto || `Trabajador ${m.codTrabajador}`,
        tipo: estadoATipoMarcacion(m.estado, m.incidencia),
        estado: m.estado,
        fechaHora: m.fechaHora?.toISOString?.() ?? m.fechaHora,
        ip: m.equipoIp,
        equipo: m.equipoDesc,
        lugar: "Trabajo",
      };
    }),
  };
}

// ============================================================
// QUERY: EQUIPOS
// ============================================================
export async function getEquiposCsharp() {
  const items = await query<any>(`
    SELECT
      e.CodEquipo AS codEquipo,
      e.Descripcion AS descripcion,
      e.IP AS ip,
      e.PuertoIP AS puerto,
      e.NumeroEquipo AS numeroEquipo,
      e.Addres AS address,
      e.EstadoConexion AS estadoConexion,
      e.FechaUltimaDesconexion AS fechaUltimaDesconexion,
      e.SincronizarHora AS sincronizarHora,
      e.TxtDisplay AS txtDisplay,
      e.CodEmpresa AS codEmpresa,
      et.TipoComunicacion AS tipoComunicacion
    FROM dbo.Equipos e
    LEFT JOIN dbo.EquiposTipoComunicacion et ON e.CodEqTipCom = et.CodEqTipCom
    ORDER BY e.Descripcion
  `);

  // Equipos conectados actualmente
  const conectadosRows = await query<any>(`
    SELECT
      eqc_cod_equipo AS codEquipo,
      eqc_nombre_pc AS nombrePc,
      eqc_direccion_ip AS direccionIp,
      eqc_equipo_id AS equipoId
    FROM dbo.EquiposConectados
  `);

  // Última marcación por equipo
  const ultimaPorEquipo = await query<any>(`
    SELECT CodEquipo, MAX(FechaHoraMarcacion) AS ultima
    FROM dbo.Marcaciones
    GROUP BY CodEquipo
  `);
  const ultimaMap = new Map<number, Date>();
  ultimaPorEquipo.forEach((r: any) => {
    ultimaMap.set(r.CodEquipo, r.ultima);
  });

  // Cantidad de marcaciones por equipo
  const countPorEquipo = await query<any>(`
    SELECT CodEquipo, COUNT(*) AS c
    FROM dbo.Marcaciones
    GROUP BY CodEquipo
  `);
  const countMap = new Map<number, number>();
  countPorEquipo.forEach((r: any) => countMap.set(r.CodEquipo, r.c));

  return {
    items: items.map((e: any) => ({
      id: e.codEquipo,
      codEquipo: e.codEquipo,
      descripcion: e.descripcion,
      ip: e.ip,
      puerto: e.puerto,
      numeroEquipo: e.numeroEquipo,
      address: e.address,
      estadoConexion: e.estadoConexion,
      fechaUltimaDesconexion: e.fechaUltimaDesconexion?.toISOString?.() ?? null,
      sincronizarHora: !!e.sincronizarHora,
      txtDisplay: e.txtDisplay,
      codEmpresa: e.codEmpresa,
      tipoComunicacion: e.tipoComunicacion,
      conectado: conectadosRows.some((c: any) => c.codEquipo === e.codEquipo),
      ultimaConn: conectadosRows.find((c: any) => c.codEquipo === e.codEquipo)?.direccionIp ?? null,
      ultMarcacion: ultimaMap.get(e.codEquipo)?.toISOString?.() ?? null,
      totalMarcaciones: countMap.get(e.codEquipo) ?? 0,
    })),
    total: items.length,
    conectados: conectadosRows.length,
  };
}

// ============================================================
// QUERY: TRABAJADORES
// ============================================================
export async function getTrabajadoresCsharp() {
  const items = await query<any>(`
    SELECT
      t.CodTrabajador AS codTrabajador,
      t.CodTarjeta AS codTarjeta,
      t.Nombre1 AS nombre1,
      t.Nombre2 AS nombre2,
      t.ApellidoPat AS apellidoPat,
      t.ApellidoMat AS apellidoMat,
      t.Documento AS documento,
      t.PuestoLaboral AS puestoLaboral,
      t.EmailTrabajo AS emailTrabajo,
      t.EmailPersonal AS emailPersonal,
      t.EstadoDB AS estadoDB,
      t.FecIngreso AS fechaIngreso,
      t.FecSalida AS fechaSalida,
      t.Sexo AS sexo,
      t.CodEmpresa AS codEmpresa,
      t.CodSucursal AS codSucursal,
      (SELECT COUNT(*) FROM dbo.Marcaciones m WHERE m.CodTrabajador = t.CodTrabajador) AS totalMarcaciones,
      (SELECT MAX(m.FechaHoraMarcacion) FROM dbo.Marcaciones m WHERE m.CodTrabajador = t.CodTrabajador) AS ultimaMarcacion
    FROM dbo.Trabajadores t
    ORDER BY t.ApellidoPat, t.Nombre1
  `);

  return {
    items: items.map((t: any) => {
      const nombreCompleto = [t.nombre1, t.nombre2, t.apellidoPat, t.apellidoMat]
        .filter((x: string | null) => x && x.trim())
        .join(" ");
      return {
        id: t.codTrabajador,
        codTrabajador: t.codTrabajador,
        codTarjeta: t.codTarjeta,
        nombre: nombreCompleto,
        documento: t.documento,
        area: t.puestoLaboral,
        email: t.emailTrabajo || t.emailPersonal,
        activo: t.estadoDB === 1,
        fechaIngreso: t.fechaIngreso?.toISOString?.() ?? null,
        fechaSalida: t.fechaSalida?.toISOString?.() ?? null,
        sexo: t.sexo,
        codEmpresa: t.codEmpresa,
        codSucursal: t.codSucursal,
        totalMarcaciones: t.totalMarcaciones ?? 0,
        ultimaMarcacion: t.ultimaMarcacion?.toISOString?.() ?? null,
      };
    }),
    total: items.length,
  };
}

// ============================================================
// QUERY: LOG DEL C#
// ============================================================
export async function getLogCsharp(q: Record<string, string>) {
  const page = parseInt(q.page ?? "1", 10);
  const pageSize = Math.min(parseInt(q.pageSize ?? "50", 10), 200);
  const offset = (page - 1) * pageSize;

  const totalRows = await query<any>(`SELECT COUNT(*) as c FROM dbo.LogSistema`);
  const total = totalRows[0]?.c ?? 0;

  const items = await query<any>(`
    SELECT TOP ${pageSize} *
    FROM (
      SELECT
        l.CodRegistro AS id,
        l.FechaHora AS fechaHora,
        l.DetalleLog AS detalle,
        l.CodUsuario AS codUsuario,
        l.CodTipoLog AS codTipoLog,
        l.NombrePC AS nombrePc,
        l.CodExternoRelacionado AS codExterno,
        t.Descripcion AS tipoDescripcion,
        t.Detalle AS tipoDetalle
      FROM dbo.LogSistema l
      LEFT JOIN dbo.TipoLog t ON l.CodTipoLog = t.CodTipoLog
    ) x
    ORDER BY x.fechaHora DESC
    OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
  `);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    items: items.map((l: any) => ({
      id: l.id,
      fechaHora: l.fechaHora?.toISOString?.() ?? l.fechaHora,
      detalle: l.detalle,
      codUsuario: l.codUsuario,
      codTipoLog: l.codTipoLog,
      tipoDescripcion: l.tipoDescripcion,
      tipoDetalle: l.tipoDetalle,
      nombrePc: l.nombrePc,
      codExterno: l.codExterno,
    })),
  };
}

// ============================================================
// POLLING: detectar nuevas marcaciones
// ============================================================
// Devuelve las marcaciones insertadas desde un timestamp dado
export async function getMarcacionesDesde(ultimaFecha: Date): Promise<any[]> {
  const items = await query<any>(
    `SELECT TOP 50
        m.FechaHoraMarcacion AS fechaHora,
        m.FechaHoraN AS recibidoEn,
        m.CodTrabajador AS codTrabajador,
        m.Num_Marca AS numMarca,
        m.Incidencia AS incidencia,
        m.Estado AS estado,
        m.CodEquipo AS codEquipo,
        t.CodTarjeta AS codTarjeta,
        t.Nombre1 AS nombre1,
        t.ApellidoPat AS apellidoPat,
        e.IP AS equipoIp,
        e.Descripcion AS equipoDesc
      FROM dbo.Marcaciones m
      LEFT JOIN dbo.Trabajadores t ON m.CodTrabajador = t.CodTrabajador
      LEFT JOIN dbo.Equipos e ON m.CodEquipo = e.CodEquipo
      WHERE m.FechaHoraN > @ultima
      ORDER BY m.FechaHoraN ASC`,
    { ultima: { type: sql.DateTime, value: ultimaFecha } }
  );

  return items.map((m: any) => {
    const nombreCompleto = [m.nombre1, m.apellidoPat].filter(Boolean).join(" ");
    return {
      id: `${m.codTrabajador}_${m.fechaHora?.toISOString?.() ?? m.fechaHora}_${m.numMarca}`,
      tramaHex: null,
      tramaParseada: null,
      codTarjeta: m.codTarjeta || String(m.codTrabajador),
      fechaHora: m.fechaHora?.toISOString?.() ?? m.fechaHora,
      recibidoEn: m.recibidoEn?.toISOString?.() ?? m.recibidoEn,
      lugar: 1,
      lugarDesc: "Trabajo",
      incidencia: m.incidencia,
      estado: m.estado,
      tipoMarcacion: estadoATipoMarcacion(m.estado, m.incidencia),
      esEntrada: estadoAEsEntrada(m.estado, m.incidencia),
      esSalida: estadoAEsSalida(m.estado, m.incidencia),
      checksumValido: true,
      ipEquipo: m.equipoIp,
      codEquipo: m.codEquipo,
      trabajador: { nombre: nombreCompleto || `Trabajador ${m.codTrabajador}` },
      equipo: m.equipoIp ? { descripcion: m.equipoDesc, ip: m.equipoIp } : null,
    };
  });
}

// ============================================================
// EXPORT CSV
// ============================================================
export async function exportMarcacionesCsharpCSV(q: Record<string, string>): Promise<string> {
  const { where, params } = buildFilterCsharp(q);

  const items = await query<any>(
    `SELECT TOP 5000
        m.FechaHoraMarcacion AS fechaHora,
        m.FechaHoraN AS recibidoEn,
        m.CodTrabajador AS codTrabajador,
        m.Num_Marca AS numMarca,
        m.Incidencia AS incidencia,
        m.Estado AS estado,
        m.Tardanza AS tardanza,
        m.Temprano AS temprano,
        m.Activo AS activo,
        m.Turno AS turno,
        m.Obs AS obs,
        t.CodTarjeta AS codTarjeta,
        t.Nombre1 AS nombre1,
        t.Nombre2 AS nombre2,
        t.ApellidoPat AS apellidoPat,
        t.ApellidoMat AS apellidoMat,
        t.Documento AS documento,
        t.PuestoLaboral AS puestoLaboral,
        e.Descripcion AS equipoDesc,
        e.IP AS equipoIp
      FROM dbo.Marcaciones m
      LEFT JOIN dbo.Trabajadores t ON m.CodTrabajador = t.CodTrabajador
      LEFT JOIN dbo.Equipos e ON m.CodEquipo = e.CodEquipo
      ${where}
      ORDER BY m.FechaHoraMarcacion DESC`,
    params
  );

  const headers = ["FechaHora","RecibidoEn","CodTrabajador","CodTarjeta","NumMarca","Incidencia","Estado","Tipo","EsEntrada","EsSalida","Tardanza","Temprano","Trabajador","Documento","Area","Equipo","IP","Obs"];
  function csvEsc(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
  const rows = items.map((m: any) => {
    const nombreCompleto = [m.nombre1, m.nombre2, m.apellidoPat, m.apellidoMat].filter(Boolean).join(" ");
    return [
      m.fechaHora?.toISOString?.() ?? m.fechaHora,
      m.recibidoEn?.toISOString?.() ?? m.recibidoEn,
      m.codTrabajador,
      m.codTarjeta,
      m.numMarca,
      m.incidencia,
      m.estado,
      estadoATipoMarcacion(m.estado, m.incidencia),
      estadoAEsEntrada(m.estado, m.incidencia) ? "SI" : "NO",
      estadoAEsSalida(m.estado, m.incidencia) ? "SI" : "NO",
      m.tardanza,
      m.temprano,
      nombreCompleto,
      m.documento,
      m.puestoLaboral,
      m.equipoDesc,
      m.equipoIp,
      m.obs,
    ];
  });
  return [headers, ...rows].map((r) => r.map(csvEsc).join(",")).join("\n");
}
