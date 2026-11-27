# QA — LF-EDITOR-VISUAL-LANGUAGE-AUDIT-S00-G001

**Tipo:** auditoría documental, sin cambios de aplicación. **Fuente:** `LevelForge_MESH_EDIT_MODAL_TRANSFORM_CORR_G001_SOURCE_BASELINE.zip`.

## Evidencia disponible

- [x] Verificado ZIP fuente: 1.453 entradas, sin error de integridad.
- [x] Inspeccionados archivos reales de tema, Inspector, ScenePanel, Assets, Gizmo, Toolbar, FilmMaker y contratos previos.
- [x] Inventario de componentes, inconsistencias, roles, límites de datos y orden de implementación documentado.
- [x] Tres documentos nuevos de auditoría/contrato/QA; seis hojas del ledger actualizadas sin borrar historial.
- [x] Verificar que el diff del SOURCE_BASELINE no modifica código de producción.
- [ ] Vite build: **NO EJECUTADO** — Gate documental; sin cambios de aplicación.
- [ ] Electron/WebGL: **NO EJECUTADO** — Gate documental.
- [ ] Comparación UI visual contra captura Unity en el equipo del usuario: **NO VERIFICADO**.
- [ ] QA/aceptación del contrato por el usuario: **PENDIENTE**.

## QA previsto, no atribuible a PASS en S00

- `LF-INSPECTOR-PRIMITIVES-UX-S01-G001`: encabezados, campos, plegado, Transform, Material, Script, escenas existentes, 260px y 1024×600.
- `LF-SCENE-INSPECTOR-OWNERSHIP-S02-G001`: matriz de ownership por clave, claves heredadas, cambios de escena, clima/cielo/nubes/bake, Editor/Player.
- `LF-GROUPS-API-S03-G001`: migración de tag, grupos de nodos, llamadas API, persistencia, preservar comportamiento Spawn/Trigger/goScene y exclusión del sistema de eventos.
- `LF-EDITOR-GIZMOS-UNITY-UX-S04-G001`: picking real, tres ejes, planos según cámara, parents rotados, snaps, Editor y Edit Mesh sin gizmo.
- `LF-ASSETS-BROWSER-UNITY-UX-S05-G001`: carpetas grises, lista/cuadrícula, DnD, importación, renombrado y assets del proyecto conservados.
- `LF-EDITOR-THEME-UNIFICATION-S06-G001`: contraste/foco, todos los docks, FilmMaker, Timeline, pantallas estrechas, rendimiento.

## Estado

**AUDITORÍA DOCUMENTADA · CONTRATO PROPUESTO · QA VISUAL NO VERIFICADO · APROBACIÓN PENDIENTE · NO CERRADO.**
No registrar PASS de Electron ni cierre por la sola existencia del contrato.
