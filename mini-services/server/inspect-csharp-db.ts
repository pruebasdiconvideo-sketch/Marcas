// Script de inspección de la BD del C# (BDASISTENCIA15_GruasdelPacifico)
// Lista todas las tablas, sus columnas, y muestra las primeras filas de las tablas relevantes.
// Ejecutar con: bun inspect-csharp-db.ts
//
// Nota: Bun carga automáticamente el archivo .env, no hace falta dotenv.

import sql from "mssql";

const SQL_SERVER = process.env.SQL_SERVER || "DESKTOP-FOOD01U\\SQLEXPRESS2022";
const SQL_DATABASE = process.env.SQL_DATABASE || "BDASISTENCIA15_GruasdelPacifico";
const SQL_USER = process.env.SQL_USER;
const SQL_PASSWORD = process.env.SQL_PASSWORD;
const SQL_PORT = parseInt(process.env.SQL_PORT || "1433", 10);

async function main() {
  console.log("=".repeat(70));
  console.log(`INSPECCIÓN DE BD: ${SQL_DATABASE}`);
  console.log(`Servidor: ${SQL_SERVER}:${SQL_PORT}`);
  console.log(`User: ${SQL_USER || "(Windows Auth - trustedConnection)"}`);
  console.log("=".repeat(70));

  const config: any = {
    server: SQL_SERVER,
    port: SQL_PORT,
    database: SQL_DATABASE,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };

  if (SQL_USER && SQL_PASSWORD) {
    config.user = SQL_USER;
    config.password = SQL_PASSWORD;
  } else {
    config.trustedConnection = true;
  }

  const pool = await sql.connect(config);

  // ===== 1. LISTAR TODAS LAS TABLAS =====
  console.log("\n📋 TABLAS EN LA BD:");
  console.log("-".repeat(70));
  const tablas = await pool.request().query(`
    SELECT t.name AS tabla, s.name AS esquema,
           (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS n_columnas,
           p.rows AS n_filas
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    JOIN sys.partitions p ON t.object_id = p.object_id
    WHERE p.index_id IN (0, 1)
    ORDER BY s.name, t.name
  `);
  for (const t of tablas.recordset) {
    console.log(`  [${t.esquema}.${t.tabla}] ${t.n_columnas} cols, ${t.n_filas} filas`);
  }

  // ===== 2. DETALLAR COLUMNAS DE CADA TABLA =====
  console.log("\n📋 COLUMNAS DE CADA TABLA:");
  console.log("-".repeat(70));
  const columnas = await pool.request().query(`
    SELECT t.name AS tabla, c.name AS columna, ty.name AS tipo,
           c.max_length, c.is_nullable, c.is_identity
    FROM sys.tables t
    JOIN sys.columns c ON t.object_id = c.object_id
    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    ORDER BY t.name, c.column_id
  `);
  const tablaCols: Record<string, any[]> = {};
  for (const c of columnas.recordset) {
    if (!tablaCols[c.tabla]) tablaCols[c.tabla] = [];
    tablaCols[c.tabla].push(c);
  }
  for (const [tabla, cols] of Object.entries(tablaCols)) {
    console.log(`\n  Tabla: ${tabla}`);
    for (const c of cols) {
      const nullable = c.is_nullable ? "NULL" : "NOT NULL";
      const identity = c.is_identity ? " [IDENTITY]" : "";
      console.log(`    - ${c.columna} (${c.tipo}${c.max_length > 0 ? `(${c.max_length})` : ""}) ${nullable}${identity}`);
    }
  }

  // ===== 3. MOSTRAR PRIMERAS FILAS DE TABLAS RELEVANTES =====
  // Heurísticas: tablas que parecen contener marcaciones, empleados, equipos
  const relevantesPatrones = ["marcac", "asist", "asis", "marc", "atch", "track", "log", "event", "emple", "employ", "trab", "user", "equipo", "device", "dispo", "mach"];
  const tablasRelevantes = tablas.recordset.filter((t: any) =>
    relevantesPatrones.some((p) => t.tabla.toLowerCase().includes(p))
  );

  if (tablasRelevantes.length > 0) {
    console.log("\n\n🔍 PRIMERAS 5 FILAS DE TABLAS RELEVANTES:");
    console.log("-".repeat(70));
    for (const t of tablasRelevantes) {
      console.log(`\n  Tabla: [${t.esquema}.${t.tabla}] (${t.n_filas} filas totales)`);
      try {
        const muestra = await pool.request().query(`SELECT TOP 5 * FROM [${t.esquema}].[${t.tabla}]`);
        if (muestra.recordset.length === 0) {
          console.log("    (tabla vacía)");
          continue;
        }
        const cols = Object.keys(muestra.recordset[0]);
        console.log(`    Columnas: ${cols.join(", ")}`);
        for (const fila of muestra.recordset) {
          const valores = cols.map((c) => {
            const v = fila[c];
            if (v === null || v === undefined) return `${c}=NULL`;
            if (v instanceof Date) return `${c}=${v.toISOString()}`;
            const s = String(v);
            if (s.length > 50) return `${c}=${s.substring(0, 50)}...`;
            return `${c}=${s}`;
          });
          console.log(`    → ${valores.join(" | ")}`);
        }
      } catch (e) {
        console.log(`    Error al leer: ${(e as Error).message}`);
      }
    }
  } else {
    console.log("\n⚠️  No se encontraron tablas con nombres relacionados a marcaciones/asistencia.");
    console.log("    Vamos a mostrar las primeras 5 filas de TODAS las tablas no vacías:");
    console.log("-".repeat(70));
    for (const t of tablas.recordset) {
      if (t.n_filas === 0) continue;
      console.log(`\n  Tabla: [${t.esquema}.${t.tabla}] (${t.n_filas} filas)`);
      try {
        const muestra = await pool.request().query(`SELECT TOP 3 * FROM [${t.esquema}].[${t.tabla}]`);
        const cols = Object.keys(muestra.recordset[0] || {});
        console.log(`    Columnas: ${cols.join(", ")}`);
        for (const fila of muestra.recordset) {
          const valores = cols.map((c) => {
            const v = fila[c];
            if (v === null || v === undefined) return "NULL";
            if (v instanceof Date) return v.toISOString();
            const s = String(v);
            return s.length > 50 ? s.substring(0, 50) + "..." : s;
          });
          console.log(`    → [${valores.join(" | ")}]`);
        }
      } catch (e) {
        console.log(`    Error: ${(e as Error).message}`);
      }
    }
  }

  // ===== 4. VIEWS Y STORED PROCEDURES =====
  console.log("\n\n📋 VISTAS (views) EN LA BD:");
  console.log("-".repeat(70));
  const vistas = await pool.request().query(`
    SELECT s.name AS esquema, v.name AS vista
    FROM sys.views v
    JOIN sys.schemas s ON v.schema_id = s.schema_id
    ORDER BY s.name, v.name
  `);
  if (vistas.recordset.length === 0) {
    console.log("  (sin vistas)");
  } else {
    for (const v of vistas.recordset) {
      console.log(`  [${v.esquema}.${v.vista}]`);
    }
  }

  console.log("\n\n📋 STORED PROCEDURES:");
  console.log("-".repeat(70));
  const procs = await pool.request().query(`
    SELECT s.name AS esquema, p.name AS proc
    FROM sys.procedures p
    JOIN sys.schemas s ON p.schema_id = s.schema_id
    WHERE p.is_ms_shipped = 0
    ORDER BY s.name, p.name
  `);
  if (procs.recordset.length === 0) {
    console.log("  (sin stored procedures personalizados)");
  } else {
    for (const p of procs.recordset) {
      console.log(`  [${p.esquema}.${p.proc}]`);
    }
  }

  await pool.close();
  console.log("\n" + "=".repeat(70));
  console.log("Inspección finalizada.");
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("\n❌ ERROR:", err.message);
  console.error("\nStack:", err.stack);
  process.exit(1);
});
