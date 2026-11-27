# QA · LF-TIMELINE-HIERARCHY-DND-S04-G001

**Autorización exacta:** `Listo. LF-TIMELINE-HIERARCHY-DND-S04-G001 autoriza comenzar`.

**SOURCE_BASELINE de entrada:** `LevelForge_TIMELINE_ANIMATION_CONTEXT_MENU_S03_G001_SOURCE_BASELINE.zip` (S03 aprobado por QA local declarado). La aprobación S03 queda documentada en `LF-TIMELINE-ANIMATION-CONTEXT-MENU-S03-G001_CLOSE.md` y el ledger.

**Estado al entregar:** IMPLEMENTADO · Node PASS 27/27 (12 focales S04 + 15 de regresión S02/S03) · Electron NO VERIFICADO · compilación Editor/Player NO VERIFICADA · QA LOCAL PENDIENTE. No declarar CERRADO.

## Auditoría previa (fuentes y causalidad)

- **OBSERVADO:** `SceneTree.vue` emite un array JSON de IDs de nodo mediante el tipo MIME `application/x-lf-node` y permite arrastrar solo elementos no bloqueados. `TimelinePanel.vue` carecía de destino de drop. `DockTree.vue` reconoce su propio MIME `application/x-lf-dock-panel` y deja pasar los demás, de modo que no hay que alterar el docking.
- **OBSERVADO:** `newTrack('node')` y `normalizeTrack()` admiten `node`, `prop` y `byId`; el Player utiliza `h.node(..., {byId: tr.byId === true})`. `InspectorDock.vue` y `TemporalResourceInspector.vue` seleccionan pistas temporales por ID. La edición previa del Inspector permitía seleccionar nodos por nombre, lo que dejaba una pista heredada sin conversión a ID.
- **OBSERVADO:** la previsualización de Timeline elegía objetos por nombre **o** ID, sin aplicar explícitamente `tr.byId`. La pista por ID puede referirse de forma inequívoca; resolver sin distinguir el modo sería incorrecto en caso de colisiones de nombres.
- **INFERENCIA:** la reutilización de MIME y del menú existente permite un flujo sin servicio paralelo; los IDs son la identidad contractual para resistir renombrados.
- **CAUSA RAÍZ DEL ALCANCE:** faltaba enlazar el arrastre de la Jerarquía al creador de pistas; el Inspector y el preview debían resolver el modo de referencia con coherencia.

## Implementación autorizada

- `src/components/TimelinePanel.vue`: `.main` acepta únicamente el MIME existente de nodo con efecto `copy`; destaca visualmente el destino, consume `getData` en el drop y rechaza JSON inválido, selecciones múltiples y referencias fuera de la escena activa con notificación. Abre `store.menu` para que el usuario elija **Posición**, **Rotación**, **Escala** o **Visibilidad**. Al confirmar, revalida el ID del Timeline y del nodo antes de llamar al creador `newTrack('node', {node:id, byId:true, prop})` y `commit('Añadir pista de nodo')`.
- Para una pista equivalente existente se selecciona esa pista, no se crea una segunda. Si el enlace heredado era por nombre, se considera equivalente únicamente cuando ese nombre es único en la escena. No se migran automáticamente los enlaces anteriores.
- `TimelinePanel.vue`: tanto la lectura de valor inicial para añadir clave como el preview visual ahora resuelven explícitamente por ID en pistas `byId===true`, conservando el comportamiento anterior de las heredadas por nombre y el de pistas horneadas.
- `TemporalResourceInspector.vue`: el selector muestra los nombres actuales pero sus valores son siempre IDs. Al seleccionar un nodo, guarda el ID y activa `byId`; si el nodo vinculado ya no existe, informa de la referencia ausente. Se conservan el Inspector principal, `commit()`, `temporalEditRevision`, vistas y claves.
- Ningún cambio en modelos persistentes, Player, Jolt, animación externa, menús genéricos ni jerarquía. Se conserva el flujo «＋ Pista» preexistente.

## Evidencia técnica

| Comprobación | Resultado | Evidencia |
|---|---|---|
| 12 tests Node S04 (MIME, propiedades, duplicados, renombrado, modelo serializable, documento obsoleto, error y sintaxis) | PASS | `docs/qa/evidence/LF-TIMELINE-HIERARCHY-DND-S04-G001/node-regression.log` |
| 15 tests Node de regresión S02/S03 | PASS | Mismo registro (27/27 global) |
| Fixture Electron embebido Jerarquía/Timeline/Inspector; 20+ verificaciones previstas | PREPARADO · NO EJECUTADO | `scripts/fixtures/editor/timeline-hierarchy-dnd-s04-g001.html`; `electron-blocked.log` |
| Compilación Editor y Player | NO VERIFICADO: falta Vite | `build-blocked.log` |
| Verificación general de documentación | NO VERIFICADA: falta `marked` | `docs-check-blocked.log` |
| QA local del usuario en Electron real | PENDIENTE | Declaración de aprobación posterior |

Las pruebas Node utilizan el modelo real para normalización, pero simulan el DOM y la integración de Vue. No sustituyen el QA visual Electron.

## Instalación local

1. Conserva el ZIP S03 aprobado como rollback. Extrae `LevelForge_TIMELINE_HIERARCHY_DND_S04_G001_SOURCE_BASELINE.zip` en una **carpeta nueva** `~/Desktop/LevelForge_TIMELINE_HIERARCHY_DND_S04_G001_SOURCE_BASELINE/`. No sobrescribas fuentes ni proyectos locales.
2. Desde la raíz extraída:

```bash
npm ci
node --test scripts/test-timeline-hierarchy-dnd-s04-g001.mjs scripts/test-temporal-context-menu-s03-g001.mjs scripts/test-temporal-inspector-s02-g001.mjs
node --test scripts/test-timeline-hierarchy-dnd-s04-g001-electron.mjs
npm run docs:check
npm run build
npm run electron
```

**Resultados esperados (no verificados aquí):** 27/27 Node; 20 o más comprobaciones del fixture Electron; build de Editor y Player sin fallos. Ejecuta Electron embebido, no Brave/Chromium externo.

## QA visual/manual obligatorio en Electron

1. Abre una Cinemática desde Assets y localiza un nodo no bloqueado de la Jerarquía. Arrástralo al cuerpo de Timeline vacío o con pistas; al soltar debe aparecer el menú contextual **Animar «Nodo»** sin overlay azul ni modal independiente.
2. Prueba las cuatro propiedades, cada una con un nodo real: Posición, Rotación, Escala, Visible. El Inspector principal debe mostrar la pista exacta, el nodo y la propiedad elegida. Crear pistas y claves no debe alterar la pose real fuera del modo preview.
3. Repite la misma propiedad arrastrando el mismo nodo: debe seleccionar la pista existente, sin crear otra. En otra cinemática, el mismo nodo debe poder tener una pista propia.
4. Renombra el nodo **después** de crear la pista. Comprueba que el Inspector muestre el nuevo nombre del nodo y que el preview y el Player sigan usando el ID correcto. Si borras el nodo, comprueba la indicación de referencia inexistente y que no se anime otro nodo por coincidencia de nombre.
5. Edita el nodo vinculado desde el selector del Inspector, prueba una pista heredada por nombre y comprueba el guardado/reapertura: el selector debe escribir ID y `byId` coherente.
6. Prueba selección múltiple arrastrada, arrastre inválido y arrastre de otros tipos (Assets y docking): deben rechazarse sin perder el estado del recurso. Abre un menú de propiedades, cambia de cinemática y pulsa la acción anterior: no debe editar el nuevo recurso.
7. Añade claves, haz scrub y Play; prueba Deshacer/Rehacer sobre creación de pistas, y compara valores tras guardar/reabrir `.lfproj`. Confirma que no cambió el formato de escenas ni recursos.
8. Repite la operación con Timeline **acoplado, estrecho y flotante** y el Inspector de **260 px**. Comprueba que el menú se mantenga dentro del viewport, que no haya clipping ni interferencia con el docking. La prueba automatizada prepara la superficie de drop y el Inspector; el docking flotante real se valida manualmente.
9. En Player exportado con First Person/Jolt, reproduce una pista por ID, manteniendo separada la incidencia previa de la plantilla sin controlador.

Si falla, devuelve el paso exacto, selección de nodo/pista, captura o screencast y error de consola si está disponible. Si todo funciona, basta tu aprobación local explícita para cerrar el Gate en la siguiente entrega autorizada.

## Pendientes fuera de este Gate

Interpolación completa tipo Godot (S04-G002); pistas de métodos de scripts (S04-G003); pulido integral de Timeline (S04-G004); el cambio de nombre de «Animación» queda al final; instalación integrada de la extensión VS Code después de Timeline/Animación; renombrado transaccional de referencias heredadas por nombre; incidencia de plantilla sin controlador. No están implementados ni autorizados por S04-G001.

## Inventario diferencial respecto de S03 aprobado

**Archivos modificados (3):**

- `src/components/TimelinePanel.vue`
- `src/components/TemporalResourceInspector.vue`
- `docs/qa/LevelForge_DB_Ledger.xlsx`

**Archivos nuevos (9):**

- `scripts/test-timeline-hierarchy-dnd-s04-g001.mjs`
- `scripts/test-timeline-hierarchy-dnd-s04-g001-electron.mjs`
- `scripts/fixtures/editor/timeline-hierarchy-dnd-s04-g001.html`
- `docs/qa/LF-TIMELINE-HIERARCHY-DND-S04-G001_QA.md`
- `docs/qa/LF-TIMELINE-ANIMATION-CONTEXT-MENU-S03-G001_CLOSE.md`
- `docs/qa/evidence/LF-TIMELINE-HIERARCHY-DND-S04-G001/node-regression.log`
- `docs/qa/evidence/LF-TIMELINE-HIERARCHY-DND-S04-G001/electron-blocked.log`
- `docs/qa/evidence/LF-TIMELINE-HIERARCHY-DND-S04-G001/build-blocked.log`
- `docs/qa/evidence/LF-TIMELINE-HIERARCHY-DND-S04-G001/docs-check-blocked.log`

**Eliminados:** ninguno. **Cambios inesperados:** ninguno. No se entregan `node_modules`, builds, cachés ni temporales. Se incluyen exactamente los dos ZIP contractuales `CHANGE` y `SOURCE_BASELINE`.
