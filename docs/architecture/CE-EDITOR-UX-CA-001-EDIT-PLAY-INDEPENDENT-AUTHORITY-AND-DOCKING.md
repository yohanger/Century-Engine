# CE-EDITOR-UX-CA-001-EDIT-PLAY-INDEPENDENT-AUTHORITY-AND-DOCKING

**Estado contractual:** RATIFICADO por el usuario el 2026-11-22.

## Autoridad

1. Edit Mode continúa siendo el ámbito editorial al ejecutar Play; navegación, selección, gizmos, herramientas e Inspector no deben convertirse en un observador de solo lectura.
2. Play Mode mantiene la sesión única de juego, con su cámara, física, scripts, entrada y eventos.
3. Los cambios de simulación no tienen autoridad para sobrescribir el proyecto persistido. Toda edición durante Play requiere mecanismo de separación o reconciliación explícita y verificable; no está implícitamente autorizada la persistencia de mutaciones de runtime.
4. El frustum de la cámara activa y el resultado del sistema de oclusión deben poder observarse desde Edit Mode utilizando datos auténticos del renderer, distinguiendo visualización estimada de descarte efectivamente aplicado.
5. `src/core/editor/docking.js` continúa como autoridad única de docking. `sceneView` y `gameView` son trasladables, divisibles y flotantes, pero nunca ocultables ni eliminables.
6. La distribución inicial abre Jerarquía, Proyecto, Inspector y Consola, además de ambas vistas. Los demás paneles continúan disponibles sin mostrarse por defecto. La distribución guardada por el usuario se preserva.
7. Este Amendment prevalece sobre las cláusulas de `LF-EDITOR-DOCKING-CA-001/002/003` que prohibían acoplar vistas centrales. Las restantes garantías siguen aplicándose.

## Regla de avance

La ratificación contractual no equivale a validar su cumplimiento técnico. Cualquier limitación de los subsistemas de edición durante Play, separación persistente, rendimiento o visibilidad debe permanecer abierta hasta contar con pruebas de ejecución y aprobación expresa.
