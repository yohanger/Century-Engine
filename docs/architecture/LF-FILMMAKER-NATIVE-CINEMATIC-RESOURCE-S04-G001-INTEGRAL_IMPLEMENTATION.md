# S04-G001-INTEGRAL — Integración de Cinematic nativo

**Autorización exacta recibida:** `Listo. LF-FILMMAKER-NATIVE-CINEMATIC-RESOURCE-S04-G001-INTEGRAL autoriza comenzar`.
**Baseline de entrada:** `LF_CINEMATICS_S07_G001_CORR002_SOURCE_BASELINE.zip`. **Fecha:** 2026-11-05.
**CA vinculante:** `LF-FILMMAKER-NATIVE-CINEMATIC-RESOURCE-CA-001`, aprobado sin modificaciones.

## Auditoría del baseline

**Observado:** `src/filmmaker/FilmApp.vue` descargaba `.nfm` al guardar; `src/core/state/film.js` importaba datos en `project.timelines`; `src/core/project.js` representaba Cinematics de forma virtual. FilmMaker utilizaba una copia de trabajo `nfm_…`; LevelForge tenía registro de Assets, empaquetado `.lfproj`, IndexedDB y IPC Electron.

**Causa raíz:** no existía guardado de la película sobre una identidad nativa del proyecto ni comunicación entre la sesión FilmMaker y el editor dueño de ese recurso. El Timeline importado era derivado y la actualización exigía reimportar.

## Implementación en fuentes

1. `src/core/cinematic-resource.js`: contrato de identidad y token de edición CAS; serialización JSON de la película, validación de proyecto/ID y sello de escena. El token de edición **no es versión `.nfm`**.
2. `src/core/project.js`: `project.cinematics` almacena únicamente `{id,name,folder,sceneId,revision}`. Cada Cinematic aparece una sola vez en `Assets/Cinematics` con extensión `.cinematic`. El cuerpo cinematográfico **no** se incrusta en `project.json`.
3. `src/core/lfproj.js`: el formato `.lfproj` existente incluye y exige el archivo `.cinematic` referenciado, con contenido de autoría sin copia de `project.lfproj` anidada.
4. `src/core/state/film.js`: creación, duplicación, apertura y guardado por ID; guardado de película y nuevos Assets en una transacción IndexedDB; derivación de Timeline de reproducción solo si existe montaje real. Se excluyen pistas ficticias.
5. `src/core/state/project.js`: cola de persistencia compartida entre el autoguardado del editor y la transacción de recurso Cinematic.
6. `electron/main.cjs` y `electron/preload.cjs`: canales IPC acotados al proyecto, Cinematic y ventana solicitante; rechazan editor ausente o múltiples editores con igual proyecto. No existe servidor global nuevo.
7. `src/App.vue`: publicación de proyecto abierto al proceso principal y atención a solicitudes FilmMaker.
8. `src/filmmaker/session.js` y `FilmApp.vue`: apertura por ID de recurso, copia de trabajo aislada, envío de película serializable por IPC y guardado sin exportación; exportación `.nfm` queda como acción separada. Bloqueo de sustitución de escena/archivo en sesiones nativas.
9. `src/components/ProjectPanel.vue`, `CinematicResourceInspector.vue`, `InspectorDock.vue`: creación, selección, edición y consulta desde Assets; separa Cinematic vacío de montaje reproducible.
10. `src/core/state/filesystem.js`: identidad, edición y control de conflictos ante renombrar/mover/duplicar/eliminar; eliminación indirecta desde carpeta bloqueada. Al eliminar, el cuerpo permanece recuperable en IndexedDB para Deshacer; solo recursos registrados se incluyen en el .lfproj exportado.
11. `src/core/state/history.js`: cambios en el registro de Cinematics capturados por el historial del proyecto. El guardado externo de FilmMaker sincroniza snapshots de recursos existentes y no crea un Undo ficticio del cuerpo binario. Deshacer/Rehacer invalida tokens restaurados.
12. `src/core/timeline/model.js`: marcador `nativeResourceId` para la proyección temporal, que se omite de la lista editable de Assets cuando existe el recurso fuente.
13. `src/core/levelpackage.js`: exportación `.levelpackage` excluye recursos Cinematic nativos; la transferencia integral corresponde a `.lfproj` y el intercambio explícito al `.nfm`.

## Autoridad y guardado

- El recurso interno `Assets/Cinematics/<nombre>.cinematic` empaquetado en `.lfproj` conserva el mismo objeto de autoría `film.json` que utiliza `.nfm`, sin ser un segundo formato de exportación cinematográfica. No incluye el proyecto `.lfproj` anidado.
- `project.json` contiene su registro; `project.timelines` contiene el runtime derivado por ID y no puede usarse como segunda fuente editable.
- FilmMaker guarda a la **copia recuperable del proyecto dentro de LevelForge (IndexedDB)**; la confirmación del archivo `project.lfproj` en disco sigue siendo responsabilidad del mecanismo original **Guardar** del editor. No se introdujo escritura silenciosa independiente que sobrescriba el `.lfproj` de otra sesión.
- El editor serializa guardados nativos y autoguardados. Cada guardado valida token, proyecto, escena y estado antes de persistir. La película y assets nuevos se escriben en la transacción existente.
- Películas nuevas: cámara estructural; sin planos, clips, pistas ni efectos ficticios.

## Conservación y alcance

- Conservados `.nfm` único sin migraciones, `TimelinePanel.vue`, `NleTimeline.vue`, Player, antiguos recursos, importador externo S07 y copia aislada de FilmMaker.
- No se reescribió el motor de reproducción ni se modificaron nuevas funciones de cámara o dispositivos móviles.
- El importador explícito externo anterior permanece en su ruta S07: su conversión universal a Cinematic nativo no se declara implementada en este Gate.
- En el modelo actual la representación temporal derivada se persiste para Player; no constituye una copia de autoría y podría ser reconstruida desde el recurso fuente en una evolución posterior, **no autorizada aquí**.

## QA y limitaciones

- Test focal S04: pruebas Node de identidad, CAS, integridad del cuerpo, marcado de escena y puntos de integración. Consultar salida real de `scripts/test-filmmaker-native-cinematic-resource-s04-g001-integral.mjs`.
- Regresión S03: `scripts/test-filmmaker-timeline-unification-s03-g001-integral.mjs`.
- Compilador Vue / Vite / Electron **NO VERIFICADO** en este entorno sin `node_modules`.
- Reproducción Player, grabación real, proyecto `.lfproj` reabierto, archivo `.cinematic` dentro de ZIP, colisiones de nombres, escenas múltiples, conflictos concurrentes y QA visual requieren ejecución local. No declarar PASS sin evidencia.
- El proyecto no se cierra automáticamente: se conserva S04 **ABIERTO** hasta QA del usuario y aprobación. S02, S03 y S07 mantienen sus estados pendientes, sin cierre implícito.
