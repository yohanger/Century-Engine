# Century Fluids — Integración y corrección de reutilización de nodos

**Gate:** `CENTURY-ENGINE-FLUIDS-S01-G001-CORR-001-EXISTING-WATER-NODE-REUSE`  
**Estado:** implementado en fuente; no aprobado ni cerrado.

## Baseline

- `Source(2).zip` (Century 0.26.13).
- `Century-Fluids-main(1).zip` (`@century/fluids` 1.0.0).
- Sin cambios de Century Smart Build ni operación Git.

## Resultados locales

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Compilación TypeScript de la biblioteca | PASS | `npm run fluids:prepare` (exit 0) |
| Regresión de tipo único `water`, conservación de `fluidcontainer3d`, preview de Play, ciclo Jolt y API voxel | 5/5 PASS | `node --test scripts/test-century-fluids-existing-water.mjs` |
| Física voxelizada de la biblioteca | 13/13 PASS | `node --test vendor/century-fluids/tests/voxel_physics.test.mjs` desde el directorio de la biblioteca |
| Pruebas históricas `jolt_bridge.test.mjs` y `surface_s07.test.mjs` | 2 FAIL | Importan `LiquidSolverConfig` y `SurfaceConfig`, símbolos que el candidato voxel no exporta; no son pruebas nuevas de la integración |
| Sintaxis de módulos modificados del Runtime | PASS | `node --check` sobre `water.js`, `events/play.js`, `fluids/century-water.js` |
| Build Vite/Editor | NO VERIFICADO | No existe instalación `node_modules` de Century en esta copia |
| QA interactivo Electron | NO VERIFICADO | Electron/Three.js no están instalados en esta copia |
| QA Jolt WASM real y colisiones de agua | NO VERIFICADO | Requiere las dependencias y el runner del juego |
| QA Player/AppImage exportado | NO VERIFICADO | No se generó build de distribución |
| Aprobación del usuario / cierre del Sprint | PENDIENTE | Revisión local solicitada |

## Riesgos y puntos pendientes

- `fluidcontainer3d` sigue preservado como dato histórico, sin simulación física activada. No se registra un nodo adicional.
- Verificar que los datos `water` anteriores se comporten como espera el usuario; el esquema nuevo utiliza valores predeterminados para las propiedades no presentes.
- Verificar superficies y colisiones con Terrain, cuerpos estáticos, dinámicos y Player en el Editor real.
- No se modificaron las pruebas históricas de retirada del agua que contradicen explícitamente la nueva autorización; su conflicto queda documentalmente supersedido, no borrado.
