# S13-G001 · Cobertura y clasificación del Inspector

Fuente: SOURCE_BASELINE S12-G007-G001 CORR-001. Inventario estático, sin montaje Electron. Rutas/líneas se refieren al baseline autorizado, no al código futuro.

| Familia/montaje | Archivo real y referencia | Estructura observada | Clasificación del problema y protección | Gate propuesto |
|---|---|---|---|---|
| Contenedor único | `src/components/InspectorDock.vue:37-112` | `.sect > header`, estado `inspFold`, rutas object/signals/mesh/paint | Claves por texto y cobertura parcial de subeditores; no duplicar dock | G002 |
| CSS/ayudas | `src/styles.css:115-131,160-165`; `src/core/tooltips.js:11-16` | plegado `.sect.closed`, ayudas condicionadas por `lf-tips` | Texto docente oculto solo bajo preferencia; preservar aviso de estado y aplazar tooltips globales | G002-G010 |
| Nodos comunes | `src/components/Inspector.vue:258-333` | `.sect`, 35 secciones en plantilla; `v-if` por tipo | textos sobre transformación/física; conservar validaciones físicas | G003 |
| Nodos scripts/material/cámara | `Inspector.vue:411-436,472-475,582-729` | `.sect` y editores anidados | instrucciones largas, referencias ausentes, propiedad de recurso compartido | G003 |
| Nodos trigger/audio/nav | `Inspector.vue:729-883` | `.sect`; widgets especializados | instrucciones API/Play; conservar estados y errores | G003 |
| Escena/World/bake | `ScenePanel.vue:91-191,320`; contrato Scene Ownership S02 | `gm-section`, `.section-title`, `<details>`, `owner-heading`; 10 `<details>` | contenido docente + autoridad World/Clima/Bake; no alterar reset heredado | G004 |
| Terreno | `TerrainPanel.vue:322-570`; contrato Terrain Context S04A | secciones `<h4>`, sin `.sect` nativo | sin plegado global automático; riesgo destructivo generate/flat, warnings legacy/rendimiento | G005 |
| Material recurso | `MaterialResourceEditor.vue:2-15` → `MaterialSection.vue:102-140` → `MaterialSurfaceDetail.vue` | 6 `<details class="mr-group">` en sección material | plegado propio reutilizable; recurso compartido + validaciones; no reinventar | G006 |
| Líquido recurso | `LiquidResourceEditor.vue:11-13` | `.sect` y `.hint lf-help` | ayuda sobre Play; preservar configuración de perfil compartido | G006 |
| Perfil render | `ProfileEditor.vue:58-105` | búsqueda, lista de FX, `.properties-title`, `post-help` | instrucciones de override, estado de búsqueda y edición no confundibles | G006 |
| GameManager recurso | `GameManagerEditor.vue:20-39` | formulario y tres `.hint` | explicaciones extensas; conservar prioridades/referencias | G006 |
| VFX recurso | `VfxEditor.vue:91-150`; CA VFX 001 | categorías y `vfx-fields`, preview explícita | preservar IDs, recurso único y autoría VFX; no introducir propiedad legacy prohibida | G007 |
| Timeline recurso | `TemporalResourceInspector.vue:432-588` | una `.sect`, notas internas, puntos Audio colapsables propios | eliminar notas docentes, conservar errores de receptor/método/FX históricos/volumen | G008 |
| Cinematics | `CinematicResourceInspector.vue:10-20` | `.sect`, `lf-help` solo lectura | conservar propiedad de películas en FilmMaker; sin autoría nueva | G008 |
| Audio Mixer contextual | `AudioMixerInspector.vue:81-97` montado desde `Inspector.vue:216` | `.sect` + controles FX bus | preservar edición de bus y contraer sin bloquear controles | G008 |
| Señales (pestaña) | `SignalConnectionsPanel.vue:326-422` | árbol y diálogo, no `.sect` | no convertir árbol en lista normal; preservar method picker y warning receptor | G009 |
| Malla (pestaña) | `MeshPanel.vue:96-297` | `<h4>` secciones; instrucciones | limpieza de ayudas vs operaciones vértices/UV/pintura; conservar foco | G009 o Gate independiente |
| Pintura (pestaña) | `PaintPanel.vue:22-97` | cinco `.sect` | ya compatible con plegado delegado; conservar capas/pincel/edición | G009 o Gate independiente |

## Clases semánticas para la matriz de implementación

- **DOC:** tutoriales, instrucciones, atajos, ejemplos API → retirar del espacio de propiedades, no relocalizar de forma especulativa.
- **PROP:** etiqueta/valor/unidad/acción → conservar compacto.
- **VALID:** errores y restricciones actuales (`methodNameError`, geometría inválida, duración obligatoria) → conservar visibles y accesibles.
- **STATE:** estado de carga, progresión, vacío, recursos faltantes, autoridad de World y estado de Preview → conservar y abreviar si procede.
- **DESTRUCT:** consecuencias de operación destructiva, reseteos, horneado y generación → conservar.
- **A11Y:** encabezados y mensajes `role=status`/`aria-*` → conservar y probar.
- **UNKNOWN:** texto mixto que exige auditoría contextual y QA antes de eliminar o reclasificar.

**Alcance no confirmado por pruebas UI:** cantidad de secciones visualmente abiertas por contexto, colisiones efectivas de claves `inspFold`, experiencia en panel de ancho mínimo y frecuencia de mensajes. Requiere Electron en Gates de implementación.
