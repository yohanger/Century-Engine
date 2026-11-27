# Diferencias G008-G002 CORR-001 vs G008-G002

## Contrato y diagnóstico

Autorización literal CORR-001 recibida del usuario. En el log Electron local G008-G002 se ejecutaron 43 checks, con 42 PASS y 1 FAIL («Marcador y clip siguen alineados al desplazar»). La prueba comparaba borde izquierdo, aunque el marcador de 14px está centrado mediante translateX(-50%), resultando en 7px de diferencia esperada.

## Archivos existentes modificados

- `scripts/fixtures/editor/timeline-temporal-geometry-s13-g008-g002.html`: mide centro del marcador, extremo del clip y proyección de regla; hace comprobación antes/después de scroll, conserva las 43 aserciones y añade medidas a fallos.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: incorpora registros de corrección y evidencia real en las seis hojas, sin alterar las 29.007 celdas históricas con datos/fórmulas ni 12 tablas.

## Nuevos

Pruebas Node CORR001-01..08 con geometría simulada y mutaciones negativas; informes QA, inventario, arquitectura y evidencia original del fallo usuario, ejecución Node y limitación de Vite.

## Evidencias y límites

- Node focal 32 PASS; 0 FAIL.
- Misma batería de 51 scripts históricos en baseline anterior y CORR-001: en ambos casos 601 PASS, 18 SKIP y los mismos 10 FAIL; no se han corregido ni ocultado.
- Electron NO VERIFICADO en este entorno porque no hay Vite (se detiene antes del montaje); build Editor/Player NO VERIFICADO (vite: not found).
- Producción 0 modificados. Eliminados 0. QA local y aprobación final pendientes.
