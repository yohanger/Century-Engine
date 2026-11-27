# QA — Low-cost default water and activity-driven simulation

**Gate:** `CENTURY-ENGINE-FLUIDS-S01-G001-CORR-002-LOW-COST-DEFAULT-WATER-AND-ACTIVITY-DRIVEN-SIMULATION`  
**Estado:** implementado en fuente; QA local Electron/Player y aprobación PENDIENTES.

## Baseline

`CENTURY-ENGINE-FLUIDS-S01-G001-CORR-001-EXISTING-WATER-NODE-REUSE_SOURCE_BASELINE.zip` como única fuente de esta corrección. No se incorporan Smart Build, otro solver ni nuevos nodos. Biblioteca `@century/fluids` 1.0.0 inalterada.

## Verificaciones ejecutadas

| Validación | Resultado | Procedimiento |
|---|---|---|
| Compilación independiente de Century Fluids | PASS | `tsc -p vendor/century-fluids/tsconfig.json` |
| Pruebas focales del ajuste | **6/6 PASS** | `node --test scripts/test-century-fluids-low-cost-water.mjs` |
| Regresión de reutilización de nodos | **5/5 PASS** | `node --test scripts/test-century-fluids-existing-water.mjs` |
| Física voxelizada de la biblioteca | **13/13 PASS** | `node --test vendor/century-fluids/tests/voxel_physics.test.mjs` |
| Sintaxis de módulos JavaScript modificados | PASS | `node --check` sobre adaptador, política y definición de nodo |
| Coherencia del lockfile npm | PASS en simulación | `npm ci --dry-run --ignore-scripts --offline --no-audit --no-fund` (exit 0) |
| Instalación completa `npm ci` | NO VERIFICADO | Red npm inaccesible en este entorno (`EAI_AGAIN`); la simulación anterior no instala paquetes |
| Compilación Vite del Editor/Player | NO VERIFICADO | `node_modules` de Century no disponible en esta copia |
| Pruebas Jolt WASM real y física en Electron | NO VERIFICADO | No se instaló Three.js/Electron/Jolt en el entorno de QA |
| QA visual y FPS sobre hardware objetivo | NO VERIFICADO | Requiere ejecución del Editor y Player por el usuario |

## Comparación cuantitativa reproducible

Comando: `node scripts/bench-century-fluids-default-water.mjs`.

Escenario: **3 × 1,5 × 3 m**, 9,45 m³ de agua, piso y cuatro paredes como planos; cuatro pasos físicos de `1/60 s`. Mismo solver y mismos techos de capacidad física para comparar únicamente resolución. Tiempos de CPU observados en este entorno, no en el hardware objetivo.

| Indicador | Celda 0,25 m | Celda 0,40 m |
|---|---:|---:|
| Celdas ocupadas | 864 | 256 |
| Caras físicas procesadas en cuatro pasos | 21.888 | 6.656 |
| Triángulos de superficie | 1.728 | 768 |
| CPU de los cuatro pasos (única muestra) | 57,10 ms | 24,36 ms |
| Error de masa observado | 0 kg | 0 kg |

Los contadores acreditan menor trabajo en este escenario. El tiempo es una observación no estadística; no representa una garantía de aceleración, FPS ni resultado en escenas reales.

## Riesgos y pendientes

- Comparar el agua inmóvil y los cuerpos lejos/cerca del agua en Play, validando que la inscripción dinámica del bridge se reactiva cuando un cuerpo se aproxima y que no se pierden flotabilidad ni reacciones.
- Comprobar con el Editor las escenas que guardaron explícitamente la resolución antigua y las que la omiten, especialmente mundos con varios nodos `water`.
- Validar la superficie incremental y la convergencia cuando un mundo tiene más chunks de los que caben en un presupuesto de render.
- Verificar el coste en CPU/GPU y memoria con Terrain, recipientes, obstáculos estáticos y cuerpos dinámicos en el equipo objetivo.
- Compilar con Vite y exportar Player/AppImage cuando estén disponibles sus dependencias.
- No inferir aprobación ni cierre de los resultados de Node.

**Cierre:** PENDIENTE DE APROBACIÓN DEL USUARIO.
