// Crea la BD nueva Biometrico_Dicon_Nuevo desde cero ejecutando el script SQL.
// Se conecta al SQL Server con la BD master (para poder DROP/CREATE DATABASE)
// y luego ejecuta todos los CREATE TABLE, INSERT y CREATE PROCEDURE.
//
// Uso: bun crear-bd-nueva.ts
//
// Requisitos: el archivo Biometrico_Dicon_Nuevo.sql debe estar en la misma carpeta.

import sql from "mssql";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";

// ===== CONFIGURACIÓN (lee de .env pero con defaults) =====
const SQL_SERVER = process.env.SQL_SERVER || "DESKTOP-FOOD01U\\SQLEXPRESS2022";
const SQL_USER = process.env.SQL_USER;
const SQL_PASSWORD = process.env.SQL_PASSWORD;
const SQL_PORT = parseInt(process.env.SQL_PORT || "1433", 10);
const SQL_NEW_DB = process.env.SQL_NEW_DATABASE || "Biometrico_Dicon_Nuevo";

// ===== BLOQUES GO =====
// SQL Server no soporta "GO" como comando SQL normal; es un separador de lotes
// usado por sqlcmd/SSMS. Necesitamos partir el script en bloques por "GO".
function splitScriptByGo(scriptContent: string): string[] {
  const lines = scriptContent.split(/\r?\n/);
  const batches: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Detectar "GO" en línea propia (case insensitive)
    if (/^go$/i.test(trimmed)) {
      if (current.length > 0) {
        batches.push(current.join("\n"));
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    batches.push(current.join("\n"));
  }
  return batches;
}

async function main() {
  console.log("=".repeat(70));
  console.log(`CREACIÓN DE BD NUEVA: ${SQL_NEW_DB}`);
  console.log(`Servidor: ${SQL_SERVER}:${SQL_PORT}`);
  console.log(`User: ${SQL_USER || "(Windows Auth)"}`);
  console.log("=".repeat(70));

  // ===== Leer el archivo SQL =====
  const sqlPath = resolve(dirname(import.meta.dir.startsWith("file:") ? import.meta.dir.replace(/^file:/, "") : import.meta.dir), "Biometrico_Dicon_Nuevo.sql");
  // Bun: usar ruta relativa simple
  const sqlFile = resolve("./Biometrico_Dicon_Nuevo.sql");
  console.log(`Leyendo script SQL: ${sqlFile}`);

  let sqlScript: string;
  try {
    sqlScript = readFileSync(sqlFile, "utf8");
  } catch {
    console.error(`\n❌ No se encontró el archivo Biometrico_Dicon_Nuevo.sql`);
    console.error(`   Asegúrate de que esté en la misma carpeta que este script.`);
    process.exit(1);
  }

  // Reemplazar el nombre de la BD si es customizado
  if (SQL_NEW_DB !== "Biometrico_Dicon_Nuevo") {
    sqlScript = sqlScript.replace(/Biometrico_Dicon_Nuevo/g, SQL_NEW_DB);
    console.log(`Nombre de BD personalizado: ${SQL_NEW_DB}`);
  }

  // Partir por GO
  const batches = splitScriptByGo(sqlScript);
  console.log(`Script dividido en ${batches.length} bloque(s) SQL (separados por GO)\n`);

  // ===== Conectar a SQL Server (BD master) =====
  const config: any = {
    server: SQL_SERVER,
    port: SQL_PORT,
    database: "master",  // siempre master para poder CREATE/DROP DATABASE
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    connectionTimeout: 15000,
    requestTimeout: 60000,  // 60s para operaciones largas
  };

  if (SQL_USER && SQL_PASSWORD) {
    config.user = SQL_USER;
    config.password = SQL_PASSWORD;
  } else {
    config.trustedConnection = true;
  }

  console.log("Conectando a SQL Server (BD master)...");
  const pool = await sql.connect(config);
  console.log("✓ Conectado\n");

  // ===== Ejecutar cada bloque =====
  let successCount = 0;
  let errorCount = 0;
  let currentDb = "master";

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i].trim();
    if (!batch) continue;

    // Detectar si el bloque tiene "USE <database>" y cambiar la BD activa
    const useMatch = batch.match(/^USE\s+(\[[^\]]+\]|[\w]+)/im);
    let targetDb = currentDb;
    let sqlToExecute = batch;

    if (useMatch) {
      targetDb = useMatch[1].replace(/^\[|\]$/g, "");
      currentDb = targetDb;
      // Si el bloque es SOLO "USE xxx", ejecutarlo y continuar
      if (/^USE\s+(\[[^\]]+\]|[\w]+)\s*;?\s*$/i.test(batch.trim())) {
        try {
          await pool.request().query(`USE [${targetDb}]`);
          console.log(`[${i + 1}/${batches.length}] USE [${targetDb}] ✓`);
          successCount++;
        } catch (e) {
          console.error(`[${i + 1}/${batches.length}] USE [${targetDb}] ❌: ${(e as Error).message}`);
          errorCount++;
        }
        continue;
      }
    }

    // Ejecutar el bloque
    try {
      // Cambiar a la BD correcta antes de ejecutar
      if (targetDb !== "master" && currentDb === "master") {
        // ya está en master, pero el bloque usa USE database internamente
      }

      // Cada request se ejecuta en la BD actual del pool
      // Pero como USE cambia de BD dentro de la sesión, debería funcionar
      await pool.request().query(sqlToExecute);

      // Truncar el output para no spamear la consola
      const preview = batch.split("\n")[0].substring(0, 70);
      console.log(`[${i + 1}/${batches.length}] ✓ ${preview}...`);
      successCount++;
    } catch (err) {
      const e = err as Error;
      const preview = batch.split("\n")[0].substring(0, 70);
      // Algunos errores son esperados (ej: PRINT ya hecho, etc.)
      if (e.message.includes("already exists") || e.message.includes("ya existe")) {
        console.log(`[${i + 1}/${batches.length}] ⚠️  ya existe: ${preview}`);
        successCount++;
      } else {
        console.error(`[${i + 1}/${batches.length}] ❌ ${preview}`);
        console.error(`    ${e.message}`);
        errorCount++;
      }
    }
  }

  // ===== Verificación final =====
  console.log("\n" + "=".repeat(70));
  console.log("VERIFICACIÓN DE LA BD NUEVA");
  console.log("=".repeat(70));

  try {
    // Reconectar a la nueva BD
    await pool.close();
    const configNew: any = { ...config, database: SQL_NEW_DB };
    const poolNew = await sql.connect(configNew);

    // Listar tablas
    const tablas = await poolNew.request().query(`
      SELECT t.name AS Tabla,
             (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS Cols,
             p.rows AS Filas
      FROM sys.tables t
      JOIN sys.partitions p ON t.object_id = p.object_id
      WHERE p.index_id IN (0, 1)
      ORDER BY t.name
    `);
    console.log(`\n📋 Tablas en ${SQL_NEW_DB} (${tablas.recordset.length} total):`);
    for (const t of tablas.recordset) {
      console.log(`   - dbo.${t.Tabla}  (${t.Cols} cols, ${t.Filas} filas)`);
    }

    // Listar vistas
    const vistas = await poolNew.request().query(`
      SELECT v.name AS Vista
      FROM sys.views v
      ORDER BY v.name
    `);
    if (vistas.recordset.length > 0) {
      console.log(`\n📋 Vistas (${vistas.recordset.length}):`);
      for (const v of vistas.recordset) {
        console.log(`   - dbo.${v.Vista}`);
      }
    }

    // Listar procedures
    const procs = await poolNew.request().query(`
      SELECT p.name AS Proc
      FROM sys.procedures p
      WHERE p.is_ms_shipped = 0
      ORDER BY p.name
    `);
    if (procs.recordset.length > 0) {
      console.log(`\n📋 Stored Procedures (${procs.recordset.length}):`);
      for (const p of procs.recordset) {
        console.log(`   - dbo.${p.Proc}`);
      }
    }

    // Datos iniciales
    const empresas = await poolNew.request().query("SELECT CodEmpresa, RazonSocial FROM dbo.Empresas");
    console.log(`\n📊 Empresas (${empresas.recordset.length}):`);
    for (const e of empresas.recordset) {
      console.log(`   - CodEmpresa=${e.CodEmpresa}: ${e.RazonSocial}`);
    }

    const equipos = await poolNew.request().query("SELECT CodEquipo, Descripcion, IP FROM dbo.Equipos");
    console.log(`\n📊 Equipos (${equipos.recordset.length}):`);
    for (const e of equipos.recordset) {
      console.log(`   - CodEquipo=${e.CodEquipo}: ${e.Descripcion} (${e.IP})`);
    }

    const usuarios = await poolNew.request().query("SELECT Usuario, Nombre FROM dbo.Usuarios");
    console.log(`\n📊 Usuarios (${usuarios.recordset.length}):`);
    for (const u of usuarios.recordset) {
      console.log(`   - ${u.Usuario}: ${u.Nombre}`);
    }

    await poolNew.close();
  } catch (err) {
    console.error(`\n❌ Error al verificar: ${(err as Error).message}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log(`✅ CREACIÓN COMPLETADA`);
  console.log(`   Bloques ejecutados: ${successCount} OK, ${errorCount} errores`);
  console.log(`   BD: ${SQL_NEW_DB}`);
  console.log("");
  console.log(`PRÓXIMOS PASOS:`);
  console.log(`   1. Edita tu archivo .env y cambia:`);
  console.log(`      SQL_DATABASE=${SQL_NEW_DB}`);
  console.log(`   2. Reinicia el servidor: bun index.ts`);
  console.log(`   3. El equipo biométrico debe conectar al puerto 5000`);
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("\n❌ ERROR FATAL:", err.message);
  console.error("\nStack:", err.stack);
  process.exit(1);
});
