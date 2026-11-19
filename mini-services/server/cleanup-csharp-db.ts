// Script de limpieza: elimina las tablas que nuestro código creó por error
// en la BD del C# (BDASISTENCIA15_GruasdelPacifico).
//
// Tablas a eliminar (nuestras, NO del C#):
//   dbo.marcacion, dbo.trabajador, dbo.equipo, dbo.log_evento, dbo.usuario
//
// Ejecutar con: bun cleanup-csharp-db.ts

import sql from "mssql";

const SQL_SERVER = process.env.SQL_SERVER || "DESKTOP-FOOD01U\\SQLEXPRESS2022";
const SQL_DATABASE = process.env.SQL_DATABASE || "BDASISTENCIA15_GruasdelPacifico";
const SQL_USER = process.env.SQL_USER;
const SQL_PASSWORD = process.env.SQL_PASSWORD;
const SQL_PORT = parseInt(process.env.SQL_PORT || "1433", 10);

const TABLAS_NUESTRAS = ["marcacion", "trabajador", "equipo", "log_evento", "usuario"];

async function main() {
  console.log("=".repeat(70));
  console.log(`LIMPIEZA DE BD: ${SQL_DATABASE}`);
  console.log(`Servidor: ${SQL_SERVER}:${SQL_PORT}`);
  console.log("=".repeat(70));
  console.log("\n⚠️  Se eliminarán las siguientes tablas (creadas por nuestro código):");
  TABLAS_NUESTRAS.forEach((t) => console.log(`   - dbo.${t}`));
  console.log("\nEstas tablas NO son del C# original y pueden ensuciar su BD.");
  console.log("Las tablas reales del C# (Marcaciones, Trabajadores, Equipos, etc.) NO se tocan.\n");

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

  // Verificar cuáles tablas existen antes de intentar borrarlas
  console.log("Verificando existencia de tablas...");
  const existentes: string[] = [];
  for (const tabla of TABLAS_NUESTRAS) {
    const result = await pool.request().input("nombre", sql.NVarChar(100), tabla)
      .query(`
        SELECT t.name AS tabla
        FROM sys.tables t
        WHERE t.name = @nombre
      `);
    if (result.recordset.length > 0) {
      existentes.push(tabla);
      // Contar filas
      const countResult = await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.[${tabla}]`);
      console.log(`  ✓ dbo.${tabla} existe (${countResult.recordset[0].n} filas)`);
    } else {
      console.log(`  ✗ dbo.${tabla} no existe (no se crea)`);
    }
  }

  if (existentes.length === 0) {
    console.log("\n✅ No hay tablas nuestras que borrar. Todo limpio.");
    await pool.close();
    return;
  }

  // Borrar las tablas existentes
  console.log(`\n🗑️  Eliminando ${existentes.length} tabla(s)...`);
  for (const tabla of existentes) {
    try {
      // Paso 1: encontrar y eliminar FKs que referencian a esta tabla
      const fks = await pool.request().input("nombre", sql.NVarChar(100), tabla)
        .query(`
          SELECT
            fk.name AS fk_name,
            schema_name(tp.schema_id) AS parent_schema,
            tp.name AS parent_table,
            schema_name(tr.schema_id) AS ref_schema,
            tr.name AS ref_table
          FROM sys.foreign_keys fk
          INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
          INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
          WHERE tr.name = @nombre
        `);

      if (fks.recordset.length > 0) {
        console.log(`  ℹ️  dbo.${tabla} tiene ${fks.recordset.length} FK(s) que la referencian. Eliminando FKs primero...`);
        for (const fk of fks.recordset) {
          try {
            await pool.request().query(`
              IF OBJECT_ID(N'${fk.parent_schema}.[${fk.fk_name}]', N'F') IS NOT NULL
                ALTER TABLE ${fk.parent_schema}.[${fk.parent_table}] DROP CONSTRAINT [${fk.fk_name}]
            `);
            console.log(`    ✓ FK ${fk.fk_name} eliminada (de ${fk.parent_schema}.${fk.parent_table})`);
          } catch (e) {
            console.error(`    ❌ No se pudo eliminar FK ${fk.fk_name}: ${(e as Error).message}`);
          }
        }
      }

      // Paso 2: también eliminar FKs que esta tabla tiene hacia otras (para poder borrarla)
      const fksOut = await pool.request().input("nombre", sql.NVarChar(100), tabla)
        .query(`
          SELECT
            fk.name AS fk_name,
            schema_name(tp.schema_id) AS parent_schema,
            tp.name AS parent_table
          FROM sys.foreign_keys fk
          INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
          WHERE tp.name = @nombre
        `);

      if (fksOut.recordset.length > 0) {
        for (const fk of fksOut.recordset) {
          try {
            await pool.request().query(`
              IF OBJECT_ID(N'${fk.parent_schema}.[${fk.fk_name}]', N'F') IS NOT NULL
                ALTER TABLE ${fk.parent_schema}.[${fk.parent_table}] DROP CONSTRAINT [${fk.fk_name}]
            `);
            console.log(`    ✓ FK saliente ${fk.fk_name} eliminada`);
          } catch (e) {
            console.error(`    ❌ No se pudo eliminar FK ${fk.fk_name}: ${(e as Error).message}`);
          }
        }
      }

      // Paso 3: ahora sí, borrar la tabla
      await pool.request().query(`
        IF OBJECT_ID('dbo.[${tabla}]', 'U') IS NOT NULL
          DROP TABLE dbo.[${tabla}]
      `);
      console.log(`  ✓ dbo.${tabla} eliminada`);
    } catch (e) {
      console.error(`  ❌ Error al eliminar dbo.${tabla}: ${(e as Error).message}`);
    }
  }

  // Verificar que ya no existan
  console.log("\nVerificación final:");
  let todasBorradas = true;
  for (const tabla of existentes) {
    const result = await pool.request().input("nombre", sql.NVarChar(100), tabla)
      .query(`SELECT t.name FROM sys.tables t WHERE t.name = @nombre`);
    if (result.recordset.length === 0) {
      console.log(`  ✓ dbo.${tabla} ya no existe`);
    } else {
      console.log(`  ❌ dbo.${tabla} todavía existe`);
      todasBorradas = false;
    }
  }

  await pool.close();

  console.log("\n" + "=".repeat(70));
  if (todasBorradas) {
    console.log("✅ Limpieza completada exitosamente.");
    console.log("La BD del C# ya no tiene tablas nuestras.");
  } else {
    console.log("⚠️  Algunas tablas no se pudieron borrar automáticamente.");
    console.log("   Elimínalas manualmente con SSMS o sqlcmd.");
  }
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("\n❌ ERROR:", err.message);
  console.error("\nStack:", err.stack);
  process.exit(1);
});
