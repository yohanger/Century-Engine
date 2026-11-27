# LF-EDITOR-VISUAL-LANGUAGE-AUDIT-S00-G001 — Auditoría de fuente

**Autorización literal:** `Listo. LF-EDITOR-VISUAL-LANGUAGE-AUDIT-S00-G001 autoriza comenzar`.
**Fecha:** 2026-11-01.
**SOURCE_BASELINE vinculante:** `LevelForge_MESH_EDIT_MODAL_TRANSFORM_CORR_G001_SOURCE_BASELINE.zip` (1.453 entradas; verificación de integridad ZIP efectuada).
**Tipo:** auditoría estática + contrato visual. **Sin cambios de producción, esquemas, eventos ni runtime.**
**Estado:** AUDITORÍA DOCUMENTADA · QA VISUAL ELECTRON/PLAYER NO VERIFICADO · ACEPTACIÓN USUARIO PENDIENTE · NO CERRADO.

## 1. Fuentes contrastadas y límites

- `src/styles.css` — tokens actuales, componentes de panel y campos, densidad y reglas responsive.
- `src/components/Inspector.vue`, `InspectorDock.vue`, `ScenePanel.vue`, `TagLayerRow.vue`, `ParamForm.vue`, `MaterialSection.vue` — Inspector y sus modelos de propiedad.
- `src/components/ProjectPanel.vue`, `SceneTree.vue`, `Toolbar.vue`, `ViewBar.vue`, `MenuBar.vue`, `BottomDock.vue`, `AudioMixer.vue`, `TimelinePanel.vue`, `TerrainPanel.vue` — superficie del Editor y navegación.
- `src/core/editor/gizmo.js` — `TransformControls` de Object Mode.
- `src/filmmaker/film-ux.css` — paleta diferenciada de FilmMaker.
- `docs/architecture/LF-EDITOR-ASSETS-S03-G001_CONTRACT.md`, `docs/architecture/LF-EDITOR-ASSETS-S03-G001_CORR-001_CONTRACT.md`, `docs/architecture/LF-EDITOR-VIEWBAR-UX-G001_IMPLEMENTATION.md`, `docs/qa/LF-SCENE-INSPECTOR-S01-G001_QA.md`, `docs/architecture/LF-WEATHER-UNIFICATION-S04-G001_IMPLEMENTATION.md` — decisiones previas relevantes.
- Imagen de Unity proporcionada por el usuario el 2026-11-01, analizada como **referencia de jerarquía y color**, no como especificación pixel-perfect ni recurso reutilizable en la distribución.

**Limitación:** se auditó el código entregado, documentación y referencia visual. No se compiló Vite ni se ejecutó Electron/Player; no se ha comprobado que cada estilo se vea exactamente como en una sesión local. El inventario cuantitativo de colores es un recuento léxico, no un análisis de contraste renderizado.

## 2. Inventario visual actual (OBSERVADO)

| Área | Archivo/función real | Patrón ya disponible | Problema observado / riesgo |
|---|---|---|---|
| Shell/tema | `src/styles.css`, `:root` | `--g-950..600`, `--hair`, `--text*`, `--blue*`, `--amber*`; IBM Plex Sans 12 px | Paleta grafito muy oscura; azul está usado como acción, selección y foco sin distinción semántica explícita. |
| Secciones comunes | `src/styles.css`, `.sect`, `.field`, `.panel-head` | Plegado de sección, encabezados de 26 px, campos con dos columnas, labels, responsive | Hay componentes que no usan el mismo patrón. |
| Inspector nodo/primitiva | `src/components/Inspector.vue` | Header del objeto, Transform, Script, Prefab, Material, Malla, cortes; usa `.sect` | Muchas secciones condicionales comparten una plantilla grande; diferentes pesos visuales y propiedades de utilidad discutible; la auditoría **no autoriza retirar propiedades**. |
| Inspector de Escena | `src/components/Inspector.vue` + `ScenePanel.vue` | Escena sin objeto seleccionado -> ScenePanel; formularios con `ParamForm` | Usa `.section-title`, `.row`, `.fold/.subfold` y `details`, diferentes de `.sect/.field`; mezcolanza visual de escena y entorno. |
| Dock derecho | `InspectorDock.vue` | Tabs Inspector, Terreno, Malla y Pintura; plegado por contexto, ancho de label modificable | Pestaña propia «Terreno» aún presente. **Pendiente previo** de integración con Inspector del nodo; no ejecutar en auditoría. |
| Hierarquía | `SceneTree.vue` | Árbol, selección y DnD | Requiere conservar inserción, reparent y compatibilidad visual; QA nativo del Gate correctivo aún no aportado. |
| Assets Browser | `ProjectPanel.vue` | Árbol + contenido, lista/cuadrícula, ordenación, filtro, rename, DnD, import | Icono de carpeta en árbol y tile usa amarillo `#c9a45a`; `--blue-wash` para selección; inconsistencia con estilo gris pedido. |
| Toolbar/ViewBar | `Toolbar.vue`, `ViewBar.vue`, `MenuBar.vue` | Herramientas, Snap, modos, vista, pestañas | Conservar altura/responsividad y prohibición de mensajes operativos arriba; no repoblar HUD retirado. |
| Docks inferiores | `BottomDock.vue` + AudioMixer/Timeline/Animation/Versiones | Pestañas y paneles especializados | Espaciados y resaltados locales no completamente unificados; no homogeneizar semánticas de timelines/audio por fuerza. |
| Gizmos | `src/core/editor/gizmo.js` | Tres `TransformControls` para objeto; función `_addBackHandles` duplica X/Y/Z del addon; Edit Mesh ya modal | El requisito Unity de tres ejes visuales y orientación de asas XY/XZ/YZ requiere Gate técnico, no solo CSS. |
| FilmMaker | `src/filmmaker/film-ux.css` | `--film-*` propios, redefine `--blue`, `--blue-hi`, `--amber` | Subtema más azulado: unificación exige adaptar tokens en la raíz/subtema sin perder contrastes de timeline ni estados de grabación. |
| Tags/Layer | `TagLayerRow.vue`, `Inspector.vue` | `tag` de nodo, `project.tagLayers`, capas y superficies | Conversión a Groups cambia API/esquema/consumidores; prohibida como simple limpieza de UI. |

### Evidencia cuantitativa (inventario estático)

Exploración de **109 ficheros** `*.vue`/`*.css` en `src` (incluidos temas secundarios): **1.135 apariciones** de literales de color hexadecimal y **756 literales distintos**, contando CSS, código JS, SVG, colores semánticos y valores de presets. Por ello **no** significa que existan 756 colores visibles diferentes en el editor; sí evidencia una dispersión que exige clasificación antes de sustituir valores.

En `src/styles.css` se observa explícitamente `--g-900: #0d0d0d`, `--g-850: #141414`, `--g-800: #1d1d1d`, `--blue: #478cbf`, `--amber: #ffb547`; en `ProjectPanel.vue`, `.fi` y `.thumb.folder` usan `#c9a45a`. El subtema FilmMaker contiene fondos azulados como `--film-dock: #131d27`, y redefine `--blue: #4f9ed8` y `--amber: #4f9ed8` en su ámbito.

## 3. Hallazgos por prioridad

| ID | Severidad | Clasificación | Hallazgo verificable | Acción siguiente |
|---|---|---|---|---|
| VL-01 | Alta | OBSERVADO | Inspector de objeto basado en `.sect/.field` y Escena en `section/details/.row` con reglas locales distintas | Unificar patrón de presentación tras revisar ownership. |
| VL-02 | Alta | OBSERVADO | `ScenePanel.vue` manipula `activeScene().transitions`/GameManager y `project.environment`/`project.bake` en la misma pantalla | Matriz de campos, fuente de verdad, escritura y consumidores; NO mover datos por apariencia. |
| VL-03 | Alta | OBSERVADO | `InspectorDock.vue` sigue mostrando tab Terreno | Respetar Gate específico `LF-TERRAIN-INSPECTOR-UNIFICATION-S03-G001`; pendiente, no duplicarlo en S01. |
| VL-04 | Media | OBSERVADO | Carpetas amarillo fijo `#c9a45a`, pese a paleta gris de referencia | S05: neutralizar icono/estados visuales sin tocar operaciones. |
| VL-05 | Alta | OBSERVADO | Los estilos de FilmMaker redefinen `--blue/--amber` e introducen colores `--film-*` | S06: inventario de alias/variables por ámbito y prueba de contraste. |
| VL-06 | Media | OBSERVADO | Azul usado para selección, hover/foco y principal | Contrato de roles visuales; no cambiar arbitrariamente estados funcionales. |
| VL-07 | Alta | OBSERVADO | `gizmo.js` agrega asas negativas en X/Y/Z | Gate S04: reducir ruido visual; validar picker, orientación cámara y Snap, sin duplicar addon. |
| VL-08 | Alta | OBSERVADO | `TagLayerRow.vue` y runtime usan tag/capas; otros `props.tag` son atributos de componentes | Gate S03 Groups exige migración y compatibilidad; no convertir `props.tag` ajenos sin mapa de consumidores. |
| VL-09 | Media | OBSERVADO | `ProjectPanel.vue` ya cumple navegación/ordenación/renombrado/lista/cuadrícula | S05 únicamente UX visual; prohibido recrear navegador. |
| VL-10 | Media | OBSERVADO | Header `ScenePanel` combina «Entorno» con GameManager y transiciones de escena | S02: jerarquía semántica escena/entorno; evitar etiquetas repetidas. |
| VL-11 | Media | INFERENCIA | 756 literales heterogéneos pueden aumentar deuda visual y dificultad de tema | Separar valores semánticos (colores de eje, errores, gráficos, sprites) antes de tokenizar. |
| VL-12 | Alta | RIESGO QA | No hay evidencia visual Electron de esta auditoría, ni prueba de legibilidad a ventana estrecha | QA S01/S06 con Electron embebido, tamaños 1366×768 y 1024×600, y pruebas de contraste/foco. |

### 3.1 Ownership: hechos frente a hipótesis

**OBSERVADO:** `ScenePanel.vue` lee/escribe `activeScene().gameManagerId` y `activeScene().transitions`; los controles de hora, clima, cielo, nubes, iluminación y fog emplean `store.project.environment`; el bake utiliza `store.project.bake`/`store.project.environment.bake` (líneas de referencia del SOURCE_BASELINE: ScenePanel 29–45, 88–119, 149–211). Weather básico/avanzado surge de `WEATHER_PARAMS`; controles de nubes usan `cloudsOn`, `cloudsPreset` y demás propiedades del sky, todos actualizados mediante `updateEnvironment`.

**NO DEMOSTRADO:** dos interruptores «Activar nubes» persistiendo la misma clave en dos componentes; no se halló un segundo setter idéntico en el Inspector de Escena auditado. El usuario reporta duplicación perceptual; se requiere inventario del runtime y los presets antes de declarar causa raíz y eliminar campos. Cielo y clima pueden actuar sobre el mismo sistema **sin** ser el mismo dato; la atribución definitiva se pospone al Gate S02.

**DEPENDENCIA CONTRACTUAL:** los Gates previos de Weather Unification y Scene Inspector definen caminos de datos y compatibilidad; no se modifican contratos aprobados para justificar un cambio de apariencia. La migración de `tag` a Groups debe revisar `play-nodes.js`, escena/Trigger/Spawn, loaders, serialización y APIs; si un contrato aprobado obliga a conservar tags, se necesitará Contract Amendment antes de retirarlos.

## 4. Mapa de reutilización — EXTEND BEFORE DUPLICATE

| Necesidad | Reutilizar | Evitar |
|---|---|---|
| Tokens de aplicación | `:root` de `src/styles.css` | Segunda hoja global de tokens competitiva. |
| Campos compactos | `.field`, `NumberField`, `Vec3Field`, `ParamForm` | Implementar inputs numéricos personalizados por sección. |
| Encabezados plegables | `.sect` + plegado en `InspectorDock.vue` | Nuevo gestor de colapsado, IDs o estados paralelos. |
| Escena | `ScenePanel.vue` + `updateEnvironment`, `commit`, `activeScene()` | Copiar sliders/funciones al Inspector del objeto. |
| Recursos | `ProjectPanel.vue`, `store.prefs.projView/projSort/projSize` | Segundo Assets Browser, importador o árbol. |
| Gizmos | `gizmo.js` + `TransformControls` | Nuevo gizmo/renderer y sistema de picking. |
| Editor modal | `src/core/mesh/session-modal.js` | Recuperar gizmos de TransformControls en Edit Mesh. |
| Filmmaker | Tokens `--film-*` como subtema con alias explícitos | Reemplazar estilos de video/animación sin revisar contexto. |

## 5. Orden de Gates propuesto y dependencias

1. **S01** `LF-INSPECTOR-PRIMITIVES-UX-S01-G001`: presentación de primitivas con `.sect/.field`, revisión de utilidad de cada control con contrato; **no** eliminar funcionalidad salvo autorización posterior específica. Dependencia: contrato visual S00 aprobado.
2. **S02** `LF-SCENE-INSPECTOR-OWNERSHIP-S02-G001`: auditoría de propiedad de cada campo y reorganización UI; cambios de datos sujetos a Contract Amendment si entra en conflicto con Weather. Dependencia: S00 y auditoría de Weather/Scene preexistente.
3. **S03** `LF-GROUPS-API-S03-G001`: propuesta para sustituir tag de nodo por grupos para scripting. **Bloqueo condicional:** contratos de `tag`, migraciones/escenas/Spawn/Trigger identificados; requerirá CA antes de eliminar campos o semánticas aprobadas. No ampliar sistema de eventos.
4. **S04** `LF-EDITOR-GIZMOS-UNITY-UX-S04-G001`: tres handles visuales por transformación, cara cámara para planos y picking, global/local, Snap, selección múltiple; Object Mode. Dependencia: revisar API/addon Three.js instalado y QA real.
5. **S05** `LF-ASSETS-BROWSER-UNITY-UX-S05-G001`: folder icon gris, navegación/lista/grid y selección coherentes sin alterar importación/DnD. Dependencia: contrato de Assets S03.
6. **S06** `LF-EDITOR-THEME-UNIFICATION-S06-G001`: aplicar tokens en todo Editor y FilmMaker, controles de foco/contraste; pruebas de UX global. Dependencia: S01–S05 y aceptación visual de S00.

**Trabajos anteriores no absorbidos:** `LF-TERRAIN-INSPECTOR-UNIFICATION-S03-G001` (pestaña Terreno), orientación de handles de gizmo previa, etiqueta de ruta en HUD y QA Electron/Player de Gates ya entregados. Son dependencias/incidencias conocidas, no conexiones olvidadas ni cierres automáticos.

## 6. Evidencia y estado

- **PASS documental estático:** ZIP fuente íntegro; rutas y patrones de código auditados; contrato y matriz de alcance trazados; producción no modificada.
- **NO VERIFICADO:** render de Vue en Electron, CSS real en diferentes densidades, contrastes medidos en pantalla y rendimiento, QA local, build y Player.
- **Aprobación requerida:** usuario revisa paleta/densidad y precedencia de Gates; S00 no autoriza S01–S06.

Ver: `docs/architecture/LF-EDITOR-VISUAL-LANGUAGE-S00-G001_CONTRACT.md` y `docs/qa/LF-EDITOR-VISUAL-LANGUAGE-AUDIT-S00-G001_QA.md`.
