# QA — LF-ROAD-PAINT-S01-G001

**Autorización:** recibida. **Cierre:** NO. **Fecha:** 2026-10-29.

## Evidencia ejecutada

- `node --test scripts/test-road-paint-s01-g001.mjs`: 19/19 PASS.
- `node --test scripts/test-road-material-s01-g001.mjs scripts/test-road-material-s02-g001.mjs scripts/test-road-paint-s01-g001.mjs`: 44/44 PASS.
- `node --check`: sintaxis de módulos JS modificados PASS.
- `npm run build`: pendiente, dependencias Vite/Three.js no disponibles en entorno de generación; **no afirmar build PASS**.
- QA visual de GLSL y Electron, persistencia `.lfproj`, export Player: **PENDIENTES**.

## Matriz de pruebas en estación del usuario

| ID | Pasos | Criterio de aceptación | Estado |
|---|---|---|---|
| RP-01 | Crear carretera sin pintura | Blockout idéntico al del Gate anterior | PENDIENTE |
| RP-02 | Crear recursos `.material` asfaltado y tierra | Permiten mezclarse en la calzada | PENDIENTE |
| RP-03 | Pintar con radio 1 m, suavidad 0.5, opacidad 0.7 | Mancha suave, sin polígonos añadidos | PENDIENTE |
| RP-04 | Borrar parcialmente | Se recupera material inferior | PENDIENTE |
| RP-05 | Ocultar/restaurar capa | Los trazos no se pierden | PENDIENTE |
| RP-06 | Deshacer/rehacer trazo | Una sola entrada de historial por drag | PENDIENTE |
| RP-07 | Cambiar repetición del material base | Mancha permanece en la estación longitudinal | PENDIENTE |
| RP-08 | Carretera curva y cerrada | Sin trazos cortados cerca de la unión | PENDIENTE |
| RP-09 | Acera izquierda/derecha | Manchas separadas; líneas viales intactas | PENDIENTE |
| RP-10 | Cambiar puntos o ancho | Máscaras siguen coordenadas normalizadas; sin pérdida de datos | PENDIENTE |
| RP-11 | Guardar y reabrir `.lfproj` | Trazos/mask persistentes y mismos materiales | PENDIENTE |
| RP-12 | Abrir carretera de proyecto antiguo | Idéntica apariencia, sin cambios de colisión | PENDIENTE |
| RP-13 | Ejecutar Player con carretera pintada | Paridad visual con Editor | PENDIENTE |
| RP-14 | Normal map de una capa | Relieve coherente con normal map (GLSL) | PENDIENTE |
| RP-15 | 1024×768 | Inspector no pierde controles de pintura | PENDIENTE |
| RP-16 | 4 GB RAM, múltiples carreteras | Sin bloqueo del viewport, sin crecimiento descontrolado | PENDIENTE |
| RP-17 | `npm run build` | Editor y Player compilan | PENDIENTE |

**Go/no-go:** requiere RP-01..17 con evidencia real, especialmente compilación GLSL/Player. La batería Node no sustituye QA gráfico.
