# LF-LIQUID-WATERBODY-COUPLING-S09-G001 — Implementación

**Autorización:** `Listo. LF-LIQUID-WATERBODY-COUPLING-S09-G001 autoriza comenzar`.
**SOURCE_BASELINE:** `LevelForge_LIQUID_RAIN_AUDIO_S08_G001_SOURCE_BASELINE.zip`.
**Amendment:** `LF-WATER-LIQUID-CA-002`, complementa `LF-WATER-LIQUID-CA-001`.
**Estado:** IMPLEMENTADO · TEST NODE PASS · COMPILACIÓN Y QA VISUAL LOCAL NO VERIFICADOS · NO CERRADO.

## Auditoría

- **OBSERVADO:** `WaterWorld` disponía de regiones finitas, transferencia manual S05 y consultas de cuerpos heredados sin conectores hidráulicos; `TerrainWaterConnection` rechazaba todos los solapamientos; `WaterRegion` no contabilizaba ocupación sólida; Jolt aplicaba empuje, pero no devolvía desplazamiento al agua.
- **CAUSA RAÍZ:** faltaban interfaces físicas entre las representaciones y la retroacción de ocupación; el render ocultaba el problema con superficies que podían superponerse.

## Implementación y puntos de integración

1. **Puertos:** `WaterWorld.configureCouplings()` valida ID, extremos, dominios, sección, coeficiente, sentido y caudal. Máximo 64 puertos. Los puertos de región usan índices de celda; los cuerpos tradicionales no tienen celdas propias.
2. **Caudales:** `WaterWorld._planCouplings(dt)` calcula caudal por desnivel y sección en cada paso fijo. Orígenes finitos se limitan por disponibilidad (incluye pendientes y reservas). Las transferencias región→región reutilizan `transferVolume()`; las fronteras heredadas encolan aporte/drenaje externos mediante `WaterRegion.queue()`.
3. **Contabilidad:** `WaterWorld.liquidBalance()` presenta `coupledBoundaryInM3` / `coupledBoundaryOutM3` como desglose informativo de los ledgers existentes. No resta ni suma el volumen por segunda vez. Los cuerpos tradicionales siguen como dominio `legacy-boundary` no finito.
4. **Integración de escena:** `TerrainWaterConnection` configura conexiones después de crear regiones. Permite solapamiento solo cuando el cuerpo heredado está asociado expresamente a esa región mediante `physicalRegionId`. Los restantes solapamientos siguen siendo errores.
5. **Editor:** `TerrainPanel.vue` configura puertos, sección, caudal y modo bidireccional. `WaterPanel.vue` permite vincular cuerpo de agua a una región física. `scene/water.js` oculta malla tradicional de ese cuerpo cuando está activa la región; restaura su visibilidad al desmontarla.
6. **Desplazamiento:** `WaterWorld.setDisplacements()` recoge formas soportadas y distribuye volumen sumergido sobre las celdas de su huella. `WaterRegion.occupied` expresa elevación equivalente del fondo y `effectiveBed` participa en flujo, consulta y render. No modifica `depth`, `volume()`, `ledger.added` ni `massKg`.
7. **Jolt:** `play-bodies.js` muestrea la pose física previa al paso fijo del agua. `node-bodies.js` propaga dimensiones de una forma `CollisionShape3D` simple sin offsets ni compuestos. Las formas no verificables se excluyen del desplazamiento pero siguen participando en Jolt.
8. **Versiones:** el snapshot v5 registra configuración de conexiones, contadores externos y geometría ocupada. La restauración v1–v4 mantiene los contratos anteriores; el rollback del paso incluye el avance de las nuevas conexiones.

## Límites explícitos de precisión

- Los puertos son **puntuales** entre celdas; el caudal sigue una ecuación simplificada sin transporte de momento a través del puerto, no es una hidrodinámica fluvial 3D.
- `WaterRegion` sigue usando el dominio 2D existente. Ríos/lago solo se consideran físicos si el autor crea una región compatible y vincula el cuerpo manualmente. El océano es una condición de frontera externa, no depósito finito.
- Ocupación de cuerpos está acotada a 64 cuerpos por paso, región que contiene el centro, objetos simples y hasta 4096 celdas en total según S02. El volumen sumergido se calcula a partir de un nivel de referencia y se reparte por huella (círculos mediante cuadratura 4×4). No admite rotación arbitraria de cajas ni compuestos; no se simulan olas 3D, ondas de choque ni desplazamiento preciso en superficies subcelda.
- Los nodos y recursos antiguos no reciben campos activos por defecto. Las configuraciones de nueva física son optativas; se almacenan mediante los campos existentes de `.lfproj`.
- No se han verificado Vite, Electron, Player exportado ni el rendimiento en hardware de 4 GB. **No declarar QA LOCAL PASS.**

## QA

Archivo: `scripts/test-liquid-waterbody-coupling-s09-g001.mjs` y `npm run test:liquid-waterbody-coupling`; 37/37 pruebas nuevas PASS; 333 declaradas en suite acumulada: 324 PASS, 0 FAIL, 9 SKIP. Consultar `docs/qa/LF-LIQUID-WATERBODY-COUPLING-S09-G001_QA.md` para evidencia y límites.
