# Manifest de entrega — LF-PERFORMANCE-S17-G003-AO-G002-INTEGRAL-OPTIMIZATION

**Base de comparación:** `LF_PERFORMANCE_S17_G003_AO_G001_INTEGRAL_COST_DIAGNOSIS_SOURCE_BASELINE.zip`.

**Autorización:** `Listo. LF-PERFORMANCE-S17-G003-AO-G002-INTEGRAL-OPTIMIZATION autoriza comenzar`.

**Contrato vigente:** CA-001 fidelidad primero; CA-002 diagnóstico exportado opt-in; GTAOPass Three.js r186.1 y S17 AO-G001 como instrumentación previa. No se modifican los parámetros por defecto de 16 muestras GTAO / 16 Poisson Denoise.

## MODIFICADOS (4)

- `src/engine/runtime/render/perf.js` — escala experimental solo del buffer GTAO, modos 100/75/50 %, reset de medias, liberación del pase y restauración al cerrar Stats; reutiliza `wrapAO()`.
- `src/engine/runtime/render/look.js` — al disponer el compositor desvincula el antiguo GTAOPass del monitor.
- `src/components/PerfPanel.vue` — selector contextual experimental y restauración al cerrar panel; mismo componente Editor/NGM Runtime.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — seis hojas sincronizadas; histórico preservado y estados QA pendientes correctos.

## NUEVOS (9)

- `scripts/test-performance-s17-g003-ao-g002-optimization.mjs`
- `docs/architecture/LF-PERFORMANCE-S17-G003-AO-G002-INTEGRAL-OPTIMIZATION.md`
- `docs/qa/LF-PERFORMANCE-S17-G003-AO-G002_QA-LOCAL.md`
- `docs/qa/LF-PERFORMANCE-S17-G003-AO-G002_CHANGE-MANIFEST.md`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G002/01-ao-optimization-new-tests.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G002/02-performance-focal-regression.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G002/03-build-unavailable.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G002/04-render-regression-current.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G002/05-render-regression-baseline.log`

## ELIMINADOS (0)

Ningún archivo eliminado. Sin reubicaciones, dependencias nuevas, paquetes de Unity importados ni cambios locales sobrescritos. Todas las entradas originales ajenas a los cuatro archivos modificados mantienen sus bytes.

## RESULTADOS VERIFICADOS

- Node nuevos: **12/12 PASS**.
- Node focal performance/seguridad: **54/54 PASS**.
- Node render ampliado: **40 PASS, 6 FAIL**. Los mismos seis casos fallan en el baseline previo AO-G001; no se modificaron tests fuera del Gate. No afirmar PASS global.
- `npm run build`: **NO VERIFICADO** (`vite: not found`, dependencias ausentes en entorno del asistente).
- Vue compilado, shaders WebGL2 reales, Electron local y AppImage: **NO VERIFICADOS**.
- Ahorro GPU real, FPS y fidelidad equivalente frente a 100 %: **NO VERIFICADOS**.

## INSTRUCCIONES DE USO

- **Preferido:** extraer el SOURCE_BASELINE completo en una carpeta nueva y conservar el anterior.
- **CHANGE**: si se actualiza una copia intacta del SOURCE_BASELINE AO-G001, extraer CHANGE sobre esa copia reemplazando solamente las 4 rutas indicadas; antes, comparar todo cambio local. No usar CHANGE encima del nuevo SOURCE_BASELINE.
- Desde raíz `package.json`: `npm ci`, `node --test scripts/test-performance-s17-g003-ao-g002-optimization.mjs`, `npm run build`, `npm run electron`.
- En Editor/Play abrir Stats con F3. Con AO + perfil Alto, comparar «AO · resolución experimental» 100 %, 75 %, 50 %. En AppImage solo estará accesible si exportación habilitó NGME-STATS (`Ctrl+Shift+F3`).
- Cerrar Stats restaura 100 %. Las pruebas deben devolver logs, capturas, calidad de contactos y tiempos GPU p50/p95 por fase siguiendo el documento QA.
- Conservar los dos ZIP y los proyectos de QA. Eliminar exclusivamente la carpeta temporal de experimentación si el usuario lo decide; no borrar baseline ni proyectos guardados.

**Estado:** IMPLEMENTADO EXPERIMENTAL; NODE PASS; QA LOCAL PENDIENTE; NO APROBADO; NO CERRADO. No activar el modo reducido automáticamente hasta decisión posterior basada en GPU real + imagen.
