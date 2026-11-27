# LF-EDITOR-CAMERA-STATE-FIX-G001

Baseline: ZIP local `lf(1).zip` (verdad contractual).

## Implementación
- Se añade `EditorCameraViews`, caché temporal por proyecto/escena de snapshots del viewport existente.
- `switchScene` captura la vista ANTES de `saveNow`, bloquea transiciones simultáneas, y restaura después de `loadScene` y `resetSceneState`.
- Las escenas sin vista previa usan el snapshot inicial del proyecto: perspectiva (0,10,10) mirando al origen.
- `installProject` inicia caché limpia, sin herencia entre proyectos.
- `deleteScene` elimina el snapshot asociado.
- Sin cambios en Player, eventos, formato de proyecto ni cámaras de juego.

## Límite
La caché vive únicamente durante la sesión del editor. El QA Electron de A/B/A/B, Play/Edit y Focus Selected requiere ejecución local.
