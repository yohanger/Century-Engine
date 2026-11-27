# LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_CORR-002 — Implementación

**Gate autorizado expresamente:** `Listo. LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_CORR-002 autoriza comenzar`.
**SOURCE_BASELINE:** `LF_INSPECTOR_TERRAIN_FOLDING_S13_G005_G001_CORR001_SOURCE_BASELINE.zip`.
**Contrato:** UX-01..UX-08 ratificado; S13-G005-G001 y CORR-001 siguen abiertos hasta QA usuario.

## Evidencia y causa raíz

**Observado en QA local:** tras aplicar CORR-001, 19/19 Node PASS; Electron informa `stage: "1: WebGL real disponible"`, `gl:true`, falla en `ScenePanel.vue` por acceso a `undefined.samples`. No hay evidencia de fallo del plegado Terrain.

**Auditoría del código:** el Inspector selecciona primero Escena y monta `ScenePanel.vue`. La fixture anterior definía `const project={...}` sin `bake` y con `environment`, `render`, `audio` y `settings` incompletos. `ScenePanel` usa `store.project.bake.samples`. La causa raíz es un entorno de pruebas que no cumple el esquema del proyecto, no una insuficiencia de tolerancia a nulos en el componente de producción.

## Mecanismo aplicado

- La fixture importa **`createProjectData()` de `/src/core/project.js`**, initializer oficial usado por LevelForge.
- Conserva los defaults completos de escenas, World/environment, Bake, render, audio y demás metadatos; solo sustituye `project.objects` por el cubo existente de la fixture, etiqueta la escena y ajusta los parámetros Terrain requeridos.
- Se preserva `store.editor` de pruebas con Terrain y los identificadores de selección. La fixture sigue comprobando Scene → Terrain → Cubo → Terrain.
- No se añaden `bake.samples` improvisados ni defensas en `ScenePanel.vue`.
- **37 comprobaciones Electron sin cambios**, mismo runner y colector, fallos reales no silenciados.
- Nuevo test Node CORR-002: uso del initializer oficial, defaults de Bake/World, personalización acotada, 37 checks y sintaxis de ambos bloques HTML.

## Prohibiciones respetadas

Sin cambios en `src/`, `TerrainPanel.vue`, `ScenePanel.vue`, `InspectorDock.vue`, `core/project.js`, AudioEngine, herramientas Terrain, física, World, Bake ni Player. Ningún gestor ni árbol paralelo.

## Estado

Node focal **24 PASS/0 FAIL**. Regresión compatible **151 PASS/1 SKIP/0 FAIL**. Electron real y build Editor/Player **NO VERIFICADOS** en preparación por ausencia de Vite; la prueba Electron del usuario debe ejecutarse localmente. No inferir QA visual ni aprobación.
