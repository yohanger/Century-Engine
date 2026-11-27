# Evidencia QA — integridad de ejes y pivote

| Verificación | Resultado |
|---|---|
| Pruebas focales sobre fuente anterior | 0/16 PASS, 16 FAIL reproducidos |
| Pruebas focales corregidas | 16/16 PASS |
| Regresión de 11 suites (baseline y actual) | 144/151 PASS, mismos 7 FAIL preexistentes |
| Compilación `npm run build` | BLOQUEADA, vite: not found |
| Runner Electron | BLOQUEADO antes de iniciar, Vite ausente |
| QA manual, render real, picking, rendimiento, Player | NO VERIFICADOS |

Los siete fallos históricos: OCG-12, SNAP-15, SNAP-17, UX-10, EXT-12, EXT-13, EXT-14. Las pruebas GL-04, GL-07, SNAP-02 y una expectativa del fixture Global/Local se actualizan para expresar la restricción de ejes autorizada; su evidencia anterior se conserva. Los adaptadores de selección múltiple y FilmMaker reciben el nuevo resolver de escala. Los 16 casos focales son pruebas de código con dobles de vectores y cuaterniones; no equivalen a ejecutar Three.js en Electron.

QA local:

- `npm run test:suite -- gizmo-axis-pivot-integrity`
- `npm run test:suite -- gizmo-axis-pivot-integrity-electron`
- `npm run build`
- Escena con Node3D padre rotado y escalado, un hijo rotado y otro independiente: arrastrar X/Y/Z, XY/XZ/YZ, cambiar Global/Local y probar con y sin Snap y Shift, órbita y cámara ortográfica. Rotar más de 180° y con vista frontal del anillo. Escalar Node3D con hijos y una malla en XYZ; comprobar el pivote, proporciones, cancelación, multiselección e historial. Repetir después de guardar/reabrir y en Edit Mesh para validar regresión visual.

**Estado:** implementado en fuentes; QA focal PASS; QA real pendiente. No aprobado ni cerrado.
