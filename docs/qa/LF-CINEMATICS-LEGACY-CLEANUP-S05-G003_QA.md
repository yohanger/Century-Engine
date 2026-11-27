# LF-CINEMATICS-LEGACY-CLEANUP-S05-G003 · QA e instrucciones

**Estado:** IMPLEMENTADO · 110/110 Node PASS · Electron, build Editor/Player, QA LOCAL **NO VERIFICADOS**. Sin cierre.
**Baseline de entrada:** `LevelForge_CINEMATICS_VIEWER_S05_G002_INTEGRAL_SOURCE_BASELINE.zip` APROBADO por QA local declarado el 2026-11-04.
**Amendment:** `docs/architecture/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003_AMENDMENT.md` (CA-003).

## Instalación sin sobrescrituras

1. Conservar intacto el SOURCE_BASELINE G002 aprobado y todo proyecto `.lfproj` personal.
2. Extraer el **SOURCE_BASELINE G003 completo** a una carpeta independiente:
   `~/Desktop/LevelForge_CINEMATICS_LEGACY_CLEANUP_S05_G003_SOURCE_BASELINE/`.
3. CHANGE es solo el diferencial para revisión: **no extraer encima** de una copia con modificaciones locales no comparadas.
4. Desde la raíz del SOURCE_BASELINE G003:

```bash
npm ci
node --test scripts/test-cinematics-legacy-cleanup-s05-g003.mjs scripts/test-cinematics-viewer-s05-g002.mjs scripts/test-timeline-ux-integration-s04-g004.mjs scripts/test-timeline-node-method-track-s04-g003.mjs scripts/test-timeline-interpolation-s04-g002.mjs scripts/test-timeline-hierarchy-dnd-s04-g001.mjs scripts/test-temporal-context-menu-s03-g001.mjs scripts/test-temporal-inspector-s02-g001.mjs
node --test scripts/test-cinematics-legacy-cleanup-s05-g003-electron.mjs
npm run docs:check
npm run build
npm run electron
```

Esperado: 110 Node PASS (19 G003 + 91 regresión), 30 verificaciones del fixture Electron, documentación válida y build Editor/Player sin errores. Solo Node está confirmado en el entorno de entrega.

## QA local del usuario

1. Crear dos timelines normales y desde FilmMaker importar una película `.nfm` con al menos dos elementos (pases o montaje).
2. En Assets raíz, clic derecho sobre Timeline. Comprobar **Eliminar habilitado**, confirmación, desaparición, y Deshacer/Rehacer. Repetir con **Supr**.
3. En `Assets/Cinematics`, clic derecho sobre una película. Comprobar **Eliminar habilitado** pero Renombrar/Mover/Exportar aún restringidos. Confirmar y verificar que otras películas no desaparecen.
4. Con el recurso abierto en Cinematics o Timeline, repetir la eliminación. Verificar lista e Inspector sin selección obsoleta, stop y restauración de poses.
5. Seleccionar múltiples recursos del mismo catálogo y eliminar; un solo Deshacer debe recuperar los temporales borrados juntos.
6. Crear un evento que use expresamente el Timeline y verificar que el diálogo advierte la referencia antes del borrado; cancelar no debe alterar nada. Probar con una escena no activa y guardada.
7. Confirmar que la carpeta `Assets/Cinematics` no puede eliminarse, ni por menú ni por Supr.
8. Comprobar que no existe el dock «Editor de clips», ni «Editar animación…», ni creación de clips desde Assets. Verificar que **Cinematics solo muestra FilmMaker** y que no aparecen controles de autoría.
9. Verificar que clips antiguos usados por CameraShake/Gameplay siguen reproduciéndose y que el proyecto conserva datos de `project.animations`. Borrar uno solo si se desea y previa revisión de sus referencias.
10. Probar panel estrecho (~260 px), docking normal/flotante, guardar/reabrir `.lfproj`, Player exportado (First Person/Jolt) y proyectos existentes con preferencias anteriores.

## Evidencia necesaria

El usuario reporta aprobación si superó QA local; no necesita reenviar logs históricos de G002. Ante incidencia nueva: acción exacta, recurso implicado, captura/screencast y resultado esperado/observado. Distinguir siempre **NODE PASS**, **ELECTRON PASS**, **BUILD PASS**, **QA LOCAL PASS DECLARADO**, **APROBADO** y **CERRADO**.

Limitación técnica: los scripts que formen dinámicamente el nombre de un Timeline no pueden detectarse antes del borrado; el diálogo muestra una advertencia conservadora.

## Evidencia guardada en el Gate

- `docs/qa/evidence/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003/node-110-pass.log` (ejecutado)
- `docs/qa/evidence/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003/electron-unverified.log` (runner bloqueado por falta de Vite)
- `docs/qa/evidence/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003/build-unverified.log` (Vite ausente)

La aprobación local de G002 se registrará en el ledger sin atribuirle una nueva ejecución automatizada.
