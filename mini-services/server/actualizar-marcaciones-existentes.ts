// Actualiza las marcaciones existentes en la BD que fueron guardadas con
// TipoMarcacion='DESCONOCIDO' pero tienen ByteMarcacion=0x10 (SIN BOTONES).
// Las cambia a 'SIN-BOTONES-ENTRADA' con EsEntrada=1.
//
// Esto arregla las marcaciones guardadas antes del fix del parser.
//
// Uso: bun actualizar-marcaciones-existentes.ts

import { query, execute, sql, getPool } from "./db";

async function main() {
  console.log("=".repeat(70));
  console.log("ACTUALIZACIÓN DE MARCACIONES EXISTENTES");
  console.log("=".repeat(70));

  await getPool();

  // 1. Contar cuántas marcaciones hay con TipoMarcacion='DESCONOCIDO' y ByteMarcacion=16
  const stats = await query<any>(`
    SELECT
      COUNT(*) AS total_desc,
      SUM(CASE WHEN ByteMarcacion = 16 THEN 1 ELSE 0 END) AS sin_botones
    FROM dbo.Marcaciones
    WHERE TipoMarcacion = 'DESCONOCIDO'
  `);
  const totalDesc = stats[0]?.total_desc ?? 0;
  const sinBotones = stats[0]?.sin_botones ?? 0;
  console.log(`\nMarcaciones con TipoMarcacion='DESCONOCIDO': ${totalDesc}`);
  console.log(`  De esas, con ByteMarcacion=0x10 (SIN BOTONES): ${sinBotones}`);

  if (sinBotones === 0) {
    console.log("\n✅ No hay marcaciones para actualizar. Todo OK.");
    return;
  }

  // 2. Mostrar algunas para verificación
  console.log("\nMuestras antes de actualizar:");
  const muestras = await query<any>(`
    SELECT TOP 5 Id, CodTarjeta, FechaHora, TipoMarcacion, ByteMarcacion, EsEntrada, EsSalida
    FROM dbo.Marcaciones
    WHERE TipoMarcacion = 'DESCONOCIDO' AND ByteMarcacion = 16
  `);
  for (const m of muestras) {
    console.log(`  id=${m.Id} cod=${m.CodTarjeta} fecha=${m.FechaHora?.toISOString()} tipo=${m.TipoMarcacion} byte=${m.ByteMarcacion} entrada=${m.EsEntrada} salida=${m.EsSalida}`);
  }

  // 3. Actualizar
  console.log("\nActualizando...");
  const result = await execute(`
    UPDATE dbo.Marcaciones
    SET TipoMarcacion = 'SIN-BOTONES-ENTRADA',
        EsEntrada = 1,
        EsSalida = 0
    WHERE TipoMarcacion = 'DESCONOCIDO' AND ByteMarcacion = 16
  `);
  console.log(`✅ ${result.rowsAffected} marcación(es) actualizada(s) a SIN-BOTONES-ENTRADA`);

  // 4. Verificar
  const stats2 = await query<any>(`
    SELECT TipoMarcacion, COUNT(*) AS c
    FROM dbo.Marcaciones
    GROUP BY TipoMarcacion
    ORDER BY c DESC
  `);
  console.log("\nDistribución de TipoMarcacion después de actualizar:");
  for (const s of stats2) {
    console.log(`  ${s.TipoMarcacion}: ${s.c}`);
  }
}

main().catch((err) => {
  console.error("\n❌ ERROR:", err.message);
  process.exit(1);
});
