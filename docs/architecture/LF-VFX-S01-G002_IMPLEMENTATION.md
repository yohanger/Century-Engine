# LF-VFX-S01-G002 — Integración con Assets y .levelpackage

**Autoridad:** contrato `LF-VFX-S00-G001_CONTRACT.md` y `LF-VFX-S00-G001_SPRINTS.md`; autorización exacta G002 del usuario. No supersede contratos precedentes ni habilita S02.

**Objetivo ejecutado:** permitir que el recurso VFX definido por G001 participe en los recursos Assets existentes, con identidad, referencias, importación y exportación seguras. Implementación pendiente de QA local y aprobación; no se declara Gate cerrado.

**Mecanismo:** extensiones precisas de ProjectPanel, Icon, filesystem, state/vfx, state/project, levelpackage y levelpackage-import. `project.vfx` continúa siendo la única definición; el paquete ZIP almacena el cuerpo `.vfx` en su ruta de Assets y metadata mínima en manifiesto. El plan de importación remapea los IDs de recursos de dependencia y valida VFX antes del commit transaccional existente de IndexedDB.

**Integridad:** el cierre de dependencias incorpora `appearance.textureId`; omitir textura necesaria o importar cuerpos inválidos bloquea la operación. Referencias a VFX/texture impiden eliminación destructiva en escenas activas/guardadas y prefabs. Un recurso reutilizado respeta la misma clase de asset. No se introducen copias paralelas de simulación.

**Fuera del alcance:** Inspector y workspace de VFX, edición visual, simulación de partículas, nodo VFX3D, render y Player VFX, cambios de eventos, motor nuevo o cambio de dependencias. Estas integraciones conservan su condición PENDIENTE PLANIFICADO de S02/S03.

**Evidencia y límites:** `docs/qa/LF-VFX-S01-G002_QA.md`. 13 pruebas G002 y 50 pruebas de regresión aprobadas en entorno aislado; compilación y QA local de G002 NO VERIFICADOS. Los artefactos generados se derivan exclusivamente del SOURCE_BASELINE G001; no se compararon los cambios locales del usuario tras G001.
