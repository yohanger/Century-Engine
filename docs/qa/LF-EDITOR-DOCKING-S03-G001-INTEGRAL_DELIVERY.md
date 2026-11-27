# Entrega S03 — Instalación, inventario y evidencias

**Origen autorizado:** `LevelForge_EDITOR_VIEWPORT_CONTROLS_S02_G001_INTEGRAL_CORR-002_SOURCE_BASELINE.zip`.

## Paquetes obligatorios

A. `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_CHANGE.zip`: solo rutas nuevas o modificadas desde el baseline de entrada. Para instalarlo, **extraer en la raíz de una copia idéntica del SOURCE_BASELINE S02 CORR-002**, respetando las rutas internas; reemplazar solo las rutas incluidas. No instalar sobre otro baseline ni sobre cambios locales sin comparación.

B. `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_SOURCE_BASELINE.zip`: proyecto completo actualizado. **Recomendado:** extraerlo en una carpeta nueva, por ejemplo `~/Desktop/LevelForge_S03_DOCKING_QA/`, y no mezclarlo con otro ZIP. Será la base del siguiente Gate únicamente si QA local lo aprueba.

No extraer A y B encima uno del otro. Conservar S02 CORR-002 hasta obtener aprobación de S03. Se excluyen `node_modules`, builds `dist*`, `.git`, cachés y temporales. No tocar proyectos personales, Assets ajenos al baseline ni escenas locales.

## Inventario y límites

La comparación de cada paquete con S02 CORR-002 determina los archivos exactos; todos los cambios corresponden a: modelo de docking, shell Editor, contenedores de panel, ventanas, integración de editores persistentes, preferencia de distribución, pruebas, contrato CA-001 y las seis hojas del ledger. Ningún archivo de Player, runtime de física, escena, exportador ni modelos de proyecto fue modificado.

## Pruebas locales

Desde la raíz extraída:

```bash
npm ci
node --test scripts/test-editor-docking-s03-g001-integral.mjs scripts/test-editor-windows-layout-corr-g001.mjs
node --test scripts/test-editor-docking-s03-g001-integral-electron.mjs
npm run build
npm run electron
```

Esperado: Node **76 PASS/0 FAIL**, Electron **1 PASS** con **28 verificaciones DOM**, compilación Editor y Player sin errores fatales y apertura de la ventana Electron. En el entorno de entrega Node pasa; Electron y compilación no se han podido ejecutar. Las advertencias Vite y el estado real de GPU deben interpretarse por separado.

QA visual: seguir D01–D15 en `docs/qa/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_QA.md`. Devolver salida completa de comandos, capturas de layouts, acople/desacople, Shader Graph, Play maximizado, persistencia tras reinicio, y errores observados. Si falla, no aprobar el Gate y no avanzar.

**Conservar:** ambos ZIP de S03, SOURCE_BASELINE S02 hasta el cierre y evidencia de QA. **Eliminar solo después de aprobar:** copias de trabajo temporales o builds generados prescindibles; no eliminar proyectos personales.

## Inventario exacto respecto a S02 CORR-002

- Nuevos (11):
  - `docs/architecture/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CA-001.md`
  - `docs/architecture/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_IMPLEMENTATION.md`
  - `docs/qa/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_DELIVERY.md`
  - `docs/qa/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_QA.md`
  - `scripts/fixtures/editor/docking-s03-g001-integral.html`
  - `scripts/test-editor-docking-s03-g001-integral-electron.mjs`
  - `scripts/test-editor-docking-s03-g001-integral.mjs`
  - `src/components/DockFloating.vue`
  - `src/components/DockPanelBank.vue`
  - `src/components/DockTree.vue`
  - `src/core/editor/docking.js`
- Modificados (21):
  - `docs/qa/LevelForge_DB_Ledger.xlsx`
  - `scripts/test-editor-windows-layout-corr-g001.mjs`
  - `scripts/test-shader-graph-ux-s02-g001-corr002.mjs`
  - `src/App.vue`
  - `src/components/AnimationPanel.vue`
  - `src/components/AppWindow.vue`
  - `src/components/BottomDock.vue`
  - `src/components/EventEditor.vue`
  - `src/components/FloatingEditorWindow.vue`
  - `src/components/InspectorDock.vue`
  - `src/components/ScriptEditor.vue`
  - `src/components/ShaderEditor.vue`
  - `src/components/ShaderGraphEditor.vue`
  - `src/components/TimelinePanel.vue`
  - `src/components/Toolbar.vue`
  - `src/components/UiEditor.vue`
  - `src/components/VersionControlPanel.vue`
  - `src/core/editor/window-layout.js`
  - `src/core/state/animation.js`
  - `src/core/state/state.js`
  - `src/core/state/timelines.js`
- Eliminados: ninguno.

## Sucesión: S03 CORR-001 (2026-11-03)

La entrega original fue **NO APROBADA en QA visual** por previsualización de destino persistente y falta de agrupación inequívoca en pestañas. El nuevo baseline válido candidato es `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_CORR-001_SOURCE_BASELINE.zip` (pendiente de QA), y el CHANGE correctivo es incremental contra el S03 original. Consulte `LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CORR-001_DELIVERY.md`, `LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CORR-001_QA.md` y CA-002; las instrucciones de esta entrega histórica permanecen como evidencia, no como referencia del resultado correctivo.
