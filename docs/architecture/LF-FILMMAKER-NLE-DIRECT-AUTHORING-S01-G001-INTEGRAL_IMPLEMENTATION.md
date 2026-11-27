# Nether FilmMaker — NLE Direct Authoring S01 G001 integral

**Estado: IMPLEMENTADO EN FUENTES.** No confundir con compilación, QA local o cierre.

## Baseline y auditoría

Fuente real: `LF_TIMELINE_ADVANCED_DIRECTION_S09_G001_INTEGRAL_SOURCE_BASELINE(1).zip`, 2.254 archivos. Este SOURCE_BASELINE incluye documentos y corrección `LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001-INTEGRAL_CORR-001`, además del trabajo acumulativo S09; la rama `lf(9).zip` disponible es anterior para los componentes FilmMaker afectados y **no se ha usado como base**.

**Observado:** la apertura nativa en `FilmApp.vue` y `session.openNativeFilm()` ya conserva `projectId/cinematicId/revision/sceneStamp` y `.cinematic` con montaje. `NleTimeline.vue` exigía `author.active` para soltar nodos, agregar pistas y editar claves. El botón «Animar» implementaba un bloqueo de UX, no un formato necesario. `montage.js` ya usa `passes + shots` pero el usuario solo podía crear passes desde `session.startPass`/grabación. Efectos y audio ya usan las pistas reales. El preview de transformaciones es reversible mediante `FilmNodePose`/`FilmPhysicsPose`, pero `previewNodeTracks` estaba vinculado al modo manual.

**Causa raíz:** flujo de autoría condicionado por acciones de grabación y modo `Animar`, aun existiendo un recurso Cinematic único y una Timeline editable.

## Integraciones realizadas

- `session.mount`: habilita la autoría temporal al completar montaje y apertura del Cinematic. `ensureFilmEditMode` conserva `session.author.active` solo como salvaguarda de preview/Undo/Redo y lo reanuda después de detener Play. No usa Auto-key por defecto.
- `NleTimeline`: elimina el requisito visible «Animar»; permite drag de nodos `application/x-lf-node`, crear pistas, añadir/editar claves, Auto-key manual y Undo/Redo. El cabezal llama a `previewFilmTime`, el mismo evaluador de nodos y física con cámara de montaje cuando existe.
- `CameraPanel`: muestra cámaras editoriales arrastrables al NLE (`application/x-lf-film-camera`) y conserva íntegro el botón `Grabar pase de cámara`.
- `montage.createEditorialShot`: crea **un pass real** con dos claves de cámara idénticas (`take:-1`, `input:'editor'`) y su shot en el mismo modelo. Usa el encuadre **guardado** de la cámara editorial, de forma determinista; la acción de guardar encuadre ya existía. La Timeline también permite + Plano desde cámara activa.
- `montage.resizeEditorialShot`: permite extender o recortar la salida de los planos editoriales, conservando ID; solo al extender mantiene continuidad estática hasta el nuevo tiempo. Los pases grabados conservan límites de fuente y no se reescriben.
- `FilmApp`: overlay editorial DOM para `text`, `fade`, `letterbox` mediante `montage.effectsAt` al tiempo del cabezal. No cambia `store.play`, no crea otro renderer, no reproduce audio ni scripts durante scrubbing. El efecto `shake` se aplica mediante el `montageCamera` existente si hay plano.
- `session.restoreEditorialCamera`: conserva el encuadre original del viewport y lo restaura al dejar la pose temporal. La escena y su paquete no se escriben durante preview. La identidad y persistencia Cinematic se gestionan por la ruta nativa original `prepareFilmForSave` → `window.lf.cinematic('save')` → `syncCinematicRuntime`.
- No se modificó ningún módulo `filmmaker-mobile`, `electron/main.cjs`, `src/core/state/film.js` o Cinematics.

## Límites explícitos

- Los planos editoriales son inicialmente encuadres fijos; animar internamente la cámara de un pass con claves arbitrarias no está implementado por este Gate. Se mantienen los pases grabados y sus movimientos existentes.
- Los clips de plano siguen componiéndose **secuencialmente**. Arrastrar reordena; no se introduce una pista de cámara superpuesta con huecos ni un segundo modelo de edición.
- Las capas de efecto aisladas sin cámara/audio/animación pueden mostrarse al mover el cabezal en Editor; la reproducción de una película solo con overlays sigue la restricción anterior `hasMontageContent` (overlays no son fuente de vídeo por sí solos).
- Preview editorial de audio no se ejecuta durante scrubbing. Audio y composición completa necesitan Play en Electron.

## Pruebas y aceptación

- Suites del área FilmMaker Node: **161 PASS, 2 SKIP, 0 FAIL**; 15 pruebas nuevas S01. Los dos SKIP pertenecen a dependencias opcionales de QA; no son PASS.
- Regresión adicional Cinematics: **83 PASS, 1 SKIP, 1 FAIL preexistente**. La aserción obsoleta de ProjectPanel en `test-cinematics-viewer-s05-g002.mjs` y el archivo ProjectPanel son idénticos al SOURCE_BASELINE recibido. Se registra, sin corregir archivos ajenos al alcance.
- El intento `npm ci --offline --ignore-scripts` no completó porque faltó `zip-stream` en caché. **Vite, Vue SFC, Electron WebGL y Player no verificados aquí.**
- El usuario debe probar el flujo **crear Cinematic en Assets → abrir FilmMaker → arrastrar nodo → añadir propiedad + clave → arrastrar cámara → recortar/estirar plano → efecto → previsualizar → Play → guardar → reabrir el MISMO Cinematic → comprobar datos e identidad.**

**No declarar Gate CERRADO antes de QA y aprobación expresa.**
