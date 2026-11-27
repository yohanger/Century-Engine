# LevelForge S17 — Documento de autoría funcional y continuidad

**Punto de recuperación para otro chat.** Fecha 2026-11-13. El lector debe empezar aquí, después consultar el contrato propuesto y el código, y **nunca tratar esta acta como fuente superior al último Gate/Amendment aprobado**.

## 1. Lo que quiere el propietario del producto

LevelForge es un editor/motor 3D **existente**, Electron/Vue/Vite/Three.js/Jolt, que incluye Editor Play y NGM Runtime exportado a AppImage. Su propietario quiere un orquestador **pequeño y explícito** que coordine optimización de Mesh, LOD, geometría procedural (triángulos, anillos, segmentos), texturas/mips/streaming, visibility/culling, instancing/batching y render, reutilizando los especialistas existentes. No quiere añadir tipos de Mesh ni obligar a marcar cada objeto o construir manualmente LOD, cuando pueda automatizarse de modo seguro. Inspiración Nanite en detalle proyectado y packages de GPU Instancer/Perfect Culling/DLSS; no se presume compatibilidad de implementaciones ni licencia de redistribución. Conservación perceptual de fidelidad, recursos originales, física y scripts es requisito central.

## 2. Última base y entregas acumuladas

- **SOURCE_BASELINE de entrada de ARCH-G001:** `LF_PERFORMANCE_S17_G003_AO_G004_INTEGRAL_COMPOSITE_OPTIMIZATION_SOURCE_BASELINE.zip` (3.345 archivos). El nuevo SOURCE_BASELINE de ARCH-G001, si se entrega, es su continuación documental sin modificar código de producción.
- **CHANGE documental de ARCH-G001:** se aplica únicamente sobre copia intacta de AO-G004; no debe aplicarse encima del SOURCE_BASELINE ARCH-G001 porque ya integra todos los cambios.
- **Ledger canónico:** `docs/qa/LevelForge_DB_Ledger.xlsx`, hojas ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY. Historial intacto; el Excel refleja evidencia real, no expectativas.
- **Regla ZIP LevelForge:** exactamente dos ZIP CHANGE y SOURCE_BASELINE; no checksum externo ni scripts shell de verificación. Excluir cachés, node_modules, dist y temporales.

## 3. Authority stack / contratos vigentes

1. Autorización exacta por Gate para cualquier modificación de archivos, scripts o código: `Listo. [Nombre exacto del Gate] autoriza comenzar`.
2. S17 Contract Amendments **ratificados**: `LF-PERFORMANCE-S17-CA-001-VISUAL-FIDELITY-FIRST` (fidelidad antes de recortes a ciegas), `LF-PERFORMANCE-S17-CA-002-OPTIN-EXPORT-DIAGNOSTICS` (Stats/DevTools solo opt-in por AppImage).
3. Gates técnicos S17 previos, sin otorgar autorización nueva: G001 baseline audit, G002 reconstrucción espacial experimental, G003 diagnósticos AppImage, AO-G001 instrumentación fases, AO-G002 escala 100/75/50, AO-G003 composición/escena, AO-G004 composición fusionada.
4. **ARCH-G001 autorizado**: exclusivamente auditoría, diagramas, propuesta de contrato, documentación y ledger. No implementación del orquestador.
5. **`LF-PERFORMANCE-S17-OPT-PA-001`**: **PROPUESTO, PENDIENTE DE RATIFICACIÓN**. Sus nombres `OptimizationOrchestrator`, `TextureResidency`, `ResourcePreparation` son roles conceptuales, no clases o módulos reales.
6. Ante discrepancia entre dos contratos aprobados: **BLOQUEAR y Contract Amendment**. Código demuestra qué existe, documentación obliga lo acordado, ledger consigna estado.

## 4. Propietarios observados

| Área | Código real de referencia |
|---|---|
| Coordinación LOD vigente | `src/engine/runtime/render/lodmgr.js`, integrado por `events/play.js`, `events/play-controls.js` |
| LOD decisión/simplificación | `render/lod.js`, `render/lodgeo.js` |
| Foliage/terrain | `geometry/foliage.js`, `render/lodmgr.js`, `render/lod.js` |
| Batching | `render/static-batch.js` (requiere `batchStatic` y `WEBGL_multi_draw`) |
| Mesh original compartido | `mesh/shared-mesh.js`; generadores `mesh/generators.js` |
| Texturas | `scene/textures.js`, `scene/environment.js`, `geometry/terrain.js`, `package/host.js` (sin streaming global comprobado) |
| Render/efectos | `render/look.js`, `render/config.js`, `render/upscale.js`, `render/viewport.js` |
| Telemetría | `render/perf.js`, `src/components/PerfPanel.vue` |
| Build/NGM | `electron/appimage.cjs`, `electron/player/main.cjs`, `src/engine/runtime/package/host.js` |

## 5. Evidencia y QA de S17 que no debe reinterpretarse

- AO-G002: Node 12/12 PASS, build local del usuario Editor 844 y Player 414 PASS en log anterior, selector 100/75/50 observado; la equivalencia visual y AppImage siguen pendientes. El directorio local mostrado por usuario tenía nombre de baseline G002 anterior; **verificar contenido real**, no inferir solo por el nombre.
- AO-G003: instrumentación vista por usuario, parte de QA local satisfactoria; sin cierre formal.
- AO-G004: Node 14/14 y suite focal 79/79 reportados en el Gate. Video de usuario de 2026-11-13 08:24:55 muestra composición fusionada activándose y menor costo puntual; **NO demuestra FPS netos ni equivalencia visual estable**. El último Gate no consta aprobado/cerrado por usuario.
- Nuevo ARCH-G001: documental; no requiere afirmar ganancia GPU. Se verificó código/baseline, contrato y seis hojas; aprobación documental del usuario aún pendiente.
- `Escena · dibujo` aproximadamente 45–53 ms en escenas de prueba; causa raíz NO VERIFICADA. No atribuirlo automáticamente a triángulos; estudiar HDR/MSAA/pixel ratio/materiales/cielo/fragmentos en Gate aparte.
- No afirmar AppImage, Vite ni QA local del nuevo documento si no hay prueba correspondiente. Archivos ZIP y verificaciones de estructura son evidencia documental, no pruebas GPU.

## 6. Decisiones pendientes ordenadas

1. **Revisión/ratificación de PA-001.** Sin esto, no reclamar autoridad contractual del nuevo diseño.
2. **Aislamiento `Escena · dibujo`** como área de diagnóstico y medidas, separado de AO; cámaras fijas y pruebas reproducibles.
3. **O-01:** elegir extensión mínima vs clase coordinadora nueva bajo Gate técnico; no sobrecargar `LodManager` con texturas y framebuffer.
4. **O-02/O-06:** contrato de derivados geométricos/procedurales, invalidación y compatibilidad de mallas.
5. **O-03:** auditoría de residencia real de texturas, carga/descarga, memoria y límites WebGL2.
6. **O-04/O-05:** visibilidad precomputada y batching automático solo con seguridad, pruebas y contrato de configuración (CA si corresponde).
7. **QA de integración de Sprint:** Editor, NGM Runtime, AppImage normal y de diagnóstico, recompilación y reversión, escena real UHD605/4GB.

## 7. Lo que NO debe hacer el siguiente chat

No crear motor 3D nuevo; no duplicar Mesh/LOD/Renderer/PerfMonitor/Assets; no copiar de paquetes Unity; no usar GPU compute WebGPU sin auditar compatibilidad; no prometer Nanite/DLSS/60 FPS universales; no reactivar TAA/DynRes retirados; no convertir propuestas en hechos; no sobrescribir proyectos locales ni borrar filas históricas; no cerrar Gates por simple compilación; no generar código/archivos sin literal Gate pertinente.

## 8. Próxima acción real

Validar con usuario el documento `docs/architecture/LF-PERFORMANCE-S17-OPT-PA-001_PROPOSED.md` y los diagramas. Si acepta, pedir ratificación separada del documento padre y planificar Gates técnicos pequeños. La implementación no queda autorizada por una ratificación aislada. Si un nuevo chat necesita fuente actualizada, **solicitar/verificar el ZIP SOURCE_BASELINE ARCH-G001 de esta entrega**, nunca reconstruir el proyecto desde la explicación.
