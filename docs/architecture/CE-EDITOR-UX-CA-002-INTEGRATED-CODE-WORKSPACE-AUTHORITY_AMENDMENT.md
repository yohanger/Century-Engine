# CE-EDITOR-UX-CA-002 — Integrated Code Workspace Authority

**Estado contractual: RATIFICADO por el usuario el 22 de noviembre de 2026.**

## Autoridad y precedencia

Este Amendment prevalece sobre las cláusulas previas que obligaban a abrir el editor de scripts de Century como ventana externa o lo situaban como panel contextual inferior. Conserva las decisiones sobre Edit Mode, Play Mode, docking, datos del proyecto, CodeMirror e integración opcional con VS Code que no entren en conflicto.

1. `codeView` es la tercera vista central permanente, junto a `sceneView` y `gameView`.
2. Las tres vistas son acoplables, divisibles y flotantes, pero no se pueden ocultar o suprimir del layout.
3. `ScriptEditor.vue` continúa siendo la única implementación del editor de scripts de Century; no se crea otro sistema de autoría.
4. En escritorio, abrir un script desde Proyecto, Inspector, Jerarquía o Señales selecciona Code, sin crear una ventana Electron adicional.
5. Code usa `store.project.scripts`, `store.scriptEditId`, `setScriptCode`, `saveAll` e IntelliSense existentes; no duplica documentos ni cambia el lenguaje de scripting.
6. Pasar a Code durante Play no detiene ni reinicia la simulación; el foco de teclado y ratón se libera del jugador.
7. Los layouts anteriores mantienen sus zonas personalizadas. La normalización registra Code una sola vez y descarta únicamente la ubicación obsoleta de `scriptEditor`, sin transformar archivos de proyecto.
8. VS Code permanece como acción externa opcional y explícita.
9. Cualquier cierre depende de compilación y QA visual real; Node PASS no implica conformidad Electron o aprobación.

**Sin migración obligatoria de proyectos pre-1.0.**
