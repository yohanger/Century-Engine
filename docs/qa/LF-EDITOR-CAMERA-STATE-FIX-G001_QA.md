# QA — LF-EDITOR-CAMERA-STATE-FIX-G001

- Pruebas específicas: 8 PASS, 0 FAIL (`node --test scripts/test-editor-camera-state-fix-g001.mjs scripts/test-editor-camera-editmode-corr-g001.mjs`).
- CAM-INT-01 comprueba A/B/A/B mediante la clase real `EditorCameraViews` y un adaptador de viewport simulado; no es una prueba end-to-end de Electron.
- CAM-INT-02 comprueba aislamiento entre proyectos y eliminación de estado.
- CAM-INT-03 comprueba orden de captura/restauración y exclusión de transiciones.
- Compilación completa Vite y QA visual Electron: PENDIENTES (dependencias no instaladas en este entorno).
- Regresión global: no ejecutada en este entorno.
- Validar manualmente A/B/A/B, Focus Selected, ortográfica/perspectiva, Play/Edit, escenas nuevas y eliminación.
