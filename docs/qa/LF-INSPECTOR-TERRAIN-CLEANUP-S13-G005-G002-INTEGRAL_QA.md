# QA · S13-G005-G002

## QA automatizado preparado

- Node: `node --test scripts/test-inspector-terrain-cleanup-s13-g005-g002.mjs scripts/test-inspector-terrain-folding-s13-g005-g001.mjs scripts/test-transform-uniform-scale-s04-g001.mjs scripts/test-editor-top-hud-layout-corr-g001.mjs`.
- Regresión compatible: véase evidencia `LF_S13_G005_G002_NODE_COMPATIBLE.log`. Una omisión por dependencia del entorno no es un fallo ni un PASS.
- Electron real: `node --test scripts/test-inspector-terrain-cleanup-s13-g005-g002-electron.mjs`; requiere 45/45 comprobaciones e InspectorDock/TerrainPanel reales; adicionalmente repetir `node --test scripts/test-inspector-terrain-folding-s13-g005-g001-electron.mjs` (37/37).
- Compilación Editor/Player: `npm run build`.
- QA visual: `npm run electron`.

## Checklist QA del usuario

1. Los siete grupos se pliegan y conservan preferencias, controles y avisos.
2. No hay párrafos instructivos en Terreno, incluso con ayudas globales activadas.
3. Costa/relieve heredados, alto coste de resolución y advertencia sobre Generate siguen visibles.
4. Agua, pincel, hidráulica, capas, texturas, vegetación, generador y tamaño editan datos como antes.
5. Al superar umbrales las listas tienen scroll interno y todos sus elementos siguen accesibles; las listas cortas no lo tienen.
6. Panel ancho y estrecho sin solapamientos; drag-and-drop de texturas/vegetación intacto.
7. En Object Mode S no activa escala modal ni HUD; R activa gizmo, Ctrl+S guarda, Inspector sigue escalando.
8. En Edit Mesh S inicia la escala modal, Enter confirma, Esc cancela y Undo/Redo funciona.
9. Exportación y Player de proyecto existente sin regresiones.

## Estado real

- Node focal y regresión compatible: PASS, evidencia adjunta.
- Electron: NO VERIFICADO (Vite no instalado en preparación).
- Build: NO VERIFICADO (Vite no instalado en preparación).
- QA local visual/funcional: PENDIENTE. No declarar APROBADO/CERRADO antes de prueba y decisión del usuario.
