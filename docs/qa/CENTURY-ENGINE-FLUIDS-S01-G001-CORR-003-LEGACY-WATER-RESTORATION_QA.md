# Evidencia de integración — Restauración del agua original

**Gate:** `CENTURY-ENGINE-FLUIDS-S01-G001-CORR-003-LEGACY-WATER-RESTORATION-AND-FLUIDS-INTEGRATION-PAUSE`  
**Estado:** implementación aplicada en fuente; **NO APROBADO / NO CERRADO**.

## Origen

- Baseline de partida: SOURCE_BASELINE CORR-002.
- Fuente original restaurada: `LF_TOOLING_S00_G001_CORR001_NATIVE_ELECTRON_LAUNCH_AND_BUILD_VALIDATION_SOURCE_BASELINE.zip` (SHA-256: `5b33b197eadf808e6c7031430efa24a7c6137a9d08e6d67bd5d250fc451bd4a7`).
- La biblioteca `vendor/century-fluids/` se cotejó byte a byte: **270 archivos idénticos** frente al baseline CORR-002.

## Pruebas ejecutadas

| Verificación | Evidencia | Resultado |
|---|---|---|
| Registro de `water` / `fluidcontainer3d`, paneles, `WaterWorld`, ciclo Play, pausa de biblioteca, Godot | `node --test scripts/test-water-legacy-restoration.mjs` | **6/6 PASS**; pruebas estáticas, no sustituyen QA gráfico |
| Prueba `smoke` del repositorio | `npm test` | **25/25 PASS**; se corrigió una expectativa obsoleta del número exacto de suites, conservando su validación de contenido |
| Sintaxis JavaScript de `src/` | `find src -name '*.js' ... node --check` | **PASS** |
| Lockfile coherente | `npm ci --dry-run --offline --ignore-scripts --no-audit --no-fund` | **PASS**; solo simulación, no es instalación completa |
| Integridad de biblioteca suspendida | Comparación byte a byte entre 270 archivos en `vendor/century-fluids/` y baseline CORR-002 | **PASS** |
| Pruebas de agua históricas | `node scripts/test-water-s01.mjs` | **BLOQUEADO**: `ERR_MODULE_NOT_FOUND` de `three` |
| Instalación completa | `npm ci --offline --ignore-scripts` | **BLOQUEADO**: `ENOTCACHED` para `zip-stream@4.1.1`; la caché npm local no incluye esa dependencia |
| Compilación Vite / Editor / Runtime | No ejecutable sin instalación completa | **NO VERIFICADO** |
| QA visual Electron y Player | No ejecutado en este entorno | **NO VERIFICADO** |
| Interacción real de agua con Terrain/Jolt, recipientes y guardado | No ejecutado en Electron | **NO VERIFICADO** |

## Límites de la evidencia

La restauración histórica y su vinculación a los consumidores actuales están implementadas en fuente, pero la paridad funcional con el agua original requiere compilar y reproducir escenarios reales. Ningún resultado de QA visual o FPS se infiere a partir de pruebas estáticas. No se declara el Gate aprobado o cerrado.

## Regresión pendiente en máquina del usuario

Instalar dependencias con `npm ci`, compilar con `npm run build`, abrir Electron, crear agua `water` (océano, lago, estanque, río) y `fluidcontainer3d`, probar Inspector, guardado/reapertura, Play, Player exportado, colisiones y terreno. Comprobar que Century Fluids no se inicializa.
