// Base de datos SQL Server Express usando el paquete mssql (tedious)
// Configuración por variables de entorno (.env)
//
// Importante: Las queries son asíncronas (a diferencia de bun:sqlite que era síncrono)
// Esto afecta todo el código que usa la BD - deben usar await.

import sql from "mssql";

// ===== Configuración =====
const config: sql.config = {
  server: process.env.SQL_SERVER || "localhost\\SQLEXPRESS",
  port: parseInt(process.env.SQL_PORT || "1433", 10),
  database: process.env.SQL_DATABASE || "Asistencia_DiconSolutions",
  user: process.env.SQL_USER || "sa",
  password: process.env.SQL_PASSWORD || "",
  options: {
    encrypt: process.env.SQL_ENCRYPT === "true",
    trustServerCertificate:
      process.env.SQL_TRUST_SERVER_CERTIFICATE !== "false",
    connectTimeout: parseInt(
      process.env.SQL_CONNECTION_TIMEOUT || "30000",
      10
    ),
    requestTimeout: parseInt(process.env.SQL_REQUEST_TIMEOUT || "30000", 10),
  },
};

// ===== Pool de conexiones (singleton) =====
let pool: sql.ConnectionPool | null = null;
let connecting = false;
let connectionError: string | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;
  if (pool && pool.connecting) {
    // Esperar a que termine la conexión en curso
    while (pool.connecting) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (pool.connected) return pool;
  }
  if (connecting) {
    // Otro hilo está conectando, esperar
    while (connecting) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (pool && pool.connected) return pool;
    throw new Error(
      `SQL Server no disponible: ${connectionError || "conexión fallida"}`
    );
  }

  connecting = true;
  connectionError = null;
  try {
    console.log(
      `[DB] Conectando a SQL Server: ${config.server}:${config.port}/${config.database}...`
    );
    pool = await new sql.ConnectionPool(config).connect();
    console.log("[DB] ✓ Conectado a SQL Server Express");

    // Asegurar que las tablas existan (no hace daño si ya existen)
    await asegurarTablas();

    return pool;
  } catch (err: any) {
    connectionError = err.message;
    console.error("[DB] ✗ Error conectando a SQL Server:", err.message);
    console.error(
      "[DB] Verifica: SQL_SERVER, SQL_PORT, SQL_DATABASE, SQL_USER, SQL_PASSWORD en .env"
    );
    pool = null;
    throw err;
  } finally {
    connecting = false;
  }
}

// ===== Verificar que la BD tenga las tablas (solo lectura, NO crea) =====
async function asegurarTablas(): Promise<void> {
  if (!pool) throw new Error("Pool no inicializado");
  const request = pool.request();

  // Verificar que las tablas principales existan
  const result = await request.query(`
    SELECT t.name AS tabla
    FROM sys.tables t
    WHERE t.name IN ('Marcaciones', 'Trabajadores', 'Equipos', 'Log_Eventos', 'Usuarios', 'Empresas')
    ORDER BY t.name
  `);

  const encontradas = result.recordset.map((r: any) => r.tabla);
  const requeridas = ['Marcaciones', 'Trabajadores', 'Equipos', 'Log_Eventos', 'Usuarios', 'Empresas'];
  const faltantes = requeridas.filter((t) => !encontradas.includes(t));

  if (faltantes.length > 0) {
    console.error(`[DB] ✗ Faltan tablas en la BD: ${faltantes.join(", ")}`);
    console.error(`[DB] Ejecuta el script de creación: bun crear-bd-nueva.ts`);
    throw new Error(`Tablas faltantes: ${faltantes.join(", ")}`);
  }

  await pool.request().query(`
    IF COL_LENGTH(N'dbo.Marcaciones', N'ModoMarcacion') IS NULL
      ALTER TABLE dbo.Marcaciones ADD ModoMarcacion NVARCHAR(50) NULL;
  `);

  console.log(`[DB] ✓ Tablas verificadas en SQL Server (${encontradas.length} tablas principales)`);
  console.log("[DB] ✓ Columna ModoMarcacion verificada");
}

// ===== Helpers de conveniencia =====

/**
 * Ejecuta una query con parámetros con nombre.
 * @param sqlText Query SQL con @param placeholders
 * @param params Objeto { nombreParam: valor }
 * @returns Resultado de la query
 */
export async function query<T = any>(
  sqlText: string,
  params: Record<string, { type: any; value: any }> = {}
): Promise<T[]> {
  const p = await getPool();
  const req = p.request();
  for (const [name, { type, value }] of Object.entries(params)) {
    req.input(name, type, value);
  }
  const result = await req.query(sqlText);
  // result.recordset puede ser undefined si la query es un INSERT/UPDATE/DELETE sin OUTPUT
  // o si es un SP que solo hace INSERT y no devuelve filas
  if (!result.recordset) return [];
  return result.recordset as T[];
}

/**
 * Ejecuta un INSERT/UPDATE/DELETE y devuelve info del cambio.
 */
export async function execute(
  sqlText: string,
  params: Record<string, { type: any; value: any }> = {}
): Promise<{ rowsAffected: number; lastInsertRowid?: number }> {
  const p = await getPool();
  const req = p.request();
  for (const [name, { type, value }] of Object.entries(params)) {
    req.input(name, type, value);
  }
  // Para INSERT con RETURNING, agregar OUTPUT INSERTED.id
  const result = await req.query(sqlText);
  const lastInsertRowid =
    result.recordset && result.recordset.length > 0
      ? result.recordset[0].id
      : undefined;
  return {
    rowsAffected: result.rowsAffected[0] || 0,
    lastInsertRowid,
  };
}

/**
 * Obtiene una sola fila (o null si no hay resultados).
 */
export async function queryOne<T = any>(
  sqlText: string,
  params: Record<string, { type: any; value: any }> = {}
): Promise<T | null> {
  const rows = await query<T>(sqlText, params);
  return rows.length > 0 ? rows[0] : null;
}

// Re-exportar tipos de mssql para conveniencia
export { sql };
export const Types = {
  Int: sql.Int,
  BigInt: sql.BigInt,
  NVarChar: (len?: number) => sql.NVarChar(len),
  Bit: sql.Bit,
  DateTime: sql.DateTime,
  Date: sql.Date,
};

// Estado de conexión para diagnóstico
export function getConnectionStatus(): {
  connected: boolean;
  error: string | null;
  server: string;
  database: string;
} {
  return {
    connected: pool?.connected ?? false,
    error: connectionError,
    server: config.server,
    database: config.database,
  };
}
