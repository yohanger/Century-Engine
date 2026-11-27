# LF-LIQUID-RAINFLOW-S07-G001 — Precipitación sobre geometría 3D

**Autorización exacta:** `Listo. LF-LIQUID-RAINFLOW-S07-G001 autoriza comenzar`.
**SOURCE_BASELINE:** `LevelForge_LIQUID_HYDROLOGY_S06_G001_SOURCE_BASELINE.zip`.
**Contrato padre:** `LF-WATER-LIQUID-CA-001` (aprobado S05); WATER S01–S04 y S06 conservados.
**Estado:** IMPLEMENTADO · TEST NODE PASS · COMPILACIÓN/QA LOCAL NO VERIFICADOS.

## Auditoría / causa raíz

- **OBSERVADO:** `TerrainWaterConnection` ya contabilizaba lluvia sobre celdas de Terrain descubiertas, pero ignoraba la lluvia que interceptaban cubiertas. `scene/water.js` resolvía impactos mediante Three.js para los efectos visuales. `WaterWorld` gestionaba volumen en regiones, transferencias y balances; `WaterRegion` tenía el solver único de aguas someras.
- **CAUSA RAÍZ:** la intercepción de lluvia y el almacenamiento/escurrimiento de las superficies elevadas no tenían una ruta física que entregara el agua a `WaterWorld`; los efectos de gotas GPU no pueden reemplazar el balance de volumen.

## Mecanismo implementado

1. **Activación explícita:** `environment.waterSimulation.runoff.enabled = true` junto a `waterSimulation.enabled` y regiones físicas. Proyectos previos no crean película ni cambian de snapshot por defecto.
2. **Materiales originales:** `mat.runoff` opcional en el recurso `.material` y en materiales locales, validado por `normalizeMaterial()` / `normalizedRunoff()`. Campos: `enabled:boolean`, `retentionMm` [0,1000], `runoffMps` [0,20]. Las propiedades compartidas siguen resolviéndose mediante `effectiveMaterialObject()` y, para carreteras, `roadSlotMaterial()`.
3. **Autoría existente:** `MaterialSection.vue` expone activación, retención (mm) y velocidad de escurrimiento (m/s). `TerrainPanel.vue` habilita la función en la escena. No hay otro Inspector ni registro de materiales.
4. **Detección física acotada:** `scene/water.js` reutiliza el raycast Three.js, la matriz de normales y una relación de mallas a nodos cacheada con `WeakMap`; aporta `ownerId`, `materialId` y perfil hidráulico al muestreador. Solo superficies superiores visibles con normal Y >= 0.4, estáticas y ubicadas a no más de 80 m sobre el suelo de una celda física. En modo físico, se muestrean centros de celda (no raycasts por gota GPU).
5. **Estado único en `WaterWorld`:** `runoff` asocia a cada región física una película por celdas, con almacenamiento, aportes pendientes, geometría de rutas y ledger `{rain,delivered,exited}`. La película no es otro cuerpo de agua ni otro solver independiente. `WaterRegion` contiene las funciones puras de construcción y avance discreto de escurrimiento; su solver de aguas someras sigue intacto.
6. **Transporte:** el escurrimiento prioriza celdas vecinas más bajas del mismo objeto; en mesetas avanza por distancia hacia el borde. Una depresión interior retiene el agua. Al descargar desde borde interno entra como aporte a una celda válida de la región. Si alcanza el borde externo de la región muestreada, sale del dominio y queda registrada explícitamente.
7. **Balance físico:** las entradas desde la película se distinguen de la precipitación directa y de las transferencias interregionales S05. `WaterWorld.liquidBalance()` incorpora `surfaceFilmM3`, contabiliza el volumen pendiente ya aplicado y evita restar dos veces la entrega al suelo. Todo avanza en el paso fijo que ya usa Player.
8. **Snapshot v4:** solo cuando hay una película física real; incluye firma de geometría y material, almacenamiento, aportes pendientes y ledger. `restore()` valida todas las regiones y películas antes del commit, y admite v1/v2/v3 (película seca). Un fallo durante el avance revierte película, transferencias y regiones. Guardado normal de `.lfproj` persiste configuración y materiales, no los avances del solver.
9. **Cambio de superficie/relieve:** el muestreo se reconstruye al cambiar versión de Terrain o la firma de objetos y materiales (consulta cada 0,5 s). Se mantiene la masa en celdas de igual objeto y se libera la de superficies retiradas hacia la celda válida más cercana o hacia el ledger de salida cuando no queda suelo.
10. **Integración:** `events/play.js` inyecta muestreador de superficies y firma en `TerrainWaterConnection`; Editor y Player reutilizan `SceneGraph`. `PrecipFX` solo sigue pintando gotas/salpicaduras, no encola volumen físico.

## Límites explícitos (PENDIENTE PLANIFICADO o fuera de alcance)

- La película está **cuantizada por las celdas de las regiones físicas de Terrain** (máximo 4096 celdas por escena). No simula cubiertas que queden fuera de dichas regiones ni resuelve la geometría hidráulica subcelda.
- No implementa una malla PBR adicional para películas sobre tejados; el agua física resulta visible en la región de recepción y la lluvia mantiene los efectos previos. No equivale a un solver 2D general para todas las mallas; carece de tensión superficial, capilaridad, meniscos, gotas individuales físicas y escurrimiento vertical en paredes.
- El escurrimiento depende de una velocidad efectiva editable (m/s), no resuelve Navier–Stokes ni momento hidráulico 3D; pendientes, retenciones y destinos siguen una aproximación discreta.
- Una cubierta heredada sin perfil impide el aporte al suelo, pero no almacena volumen físico: su aspecto y comportamiento histórico permanecen. Los objetos dinámicos, caracteres y superficies con normales demasiado verticales no participan.
- Los límites externos de una región se consideran salidas contabilizadas; un sistema hidráulico general que conecte múltiples cubiertas y regiones o conduzca agua por canaletas no existe todavía.
- Se publica identidad de material de impacto para futuras funciones S08 de audio, **sin introducir voces de lluvia por superficie**. La conexión con ríos/océanos y cuerpos tradicionales, recipientes/café y clima extremo permanece S09–S13.
- No está verificado el rendimiento de raycast/caché ni la representación gráfica en Electron/Player de hardware objetivo; requieren QA local.

## Evidencias

- 29 pruebas nuevas de integración y conservación (`scripts/test-liquid-rainflow-s07-g001.mjs`).
- Regresión acumulada 136 WATER/hidrología/render; total 165 tests Node en la batería seleccionada, sin fallos.
- `npm run build` y `docs:build` no se declararán PASS sin dependencias y evidencia real.
