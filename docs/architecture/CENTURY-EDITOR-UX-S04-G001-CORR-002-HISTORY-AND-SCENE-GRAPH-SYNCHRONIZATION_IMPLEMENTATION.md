# Sincronización del historial y SceneGraph

Gate ratificado y autorizado literalmente. Base inmediata: `CENTURY_EDITOR_UX_S04_G001_CORR001_SOURCE_BASELINE.zip`, 4.050 archivos. La verificación CRC y la comparación con la copia disponible anterior no detectan diferencias. El árbol local del usuario no es accesible. Se conservan los contratos existentes y la enmienda CE-EDITOR-SESSION-CA-001; no se ratifica ni se cierra ningún otro Gate.

## Defecto reproducido

La restauración histórica sustituye `project.objects` y otros recursos. La asignación posterior de `project.render` despierta un watcher síncrono antes de completar `syncAll()`. `applyRender()` llama a `refreshMaterials()`, que selecciona la definición por el tipo lógico actual. Si el historial convierte una primitiva en malla, la definición mesh recibe todavía la raíz visual de la primitiva, sin `userData.meshBody`; la lectura de `geometry` lanza la excepción registrada por el usuario. Una prueba aislada ejecuta las funciones productivas del historial, watcher, sincronización y material, con reactividad y objetos gráficos simulados, y reproduce la misma excepción antes de corregir. No es una reproducción GPU/Electron independiente.

## Autoridad y mecanismo

- `history.js` separa la restauración de la escena de la publicación posterior a `syncAll()`; el refresco explícito de vista asociado al cambio de terreno queda después de esta sincronización.
- `keys.js` utiliza `withHistorySceneSync()` para diferir las notificaciones de los watchers editoriales vinculados a la escena durante la restauración síncrona. Cada callback pendiente conserva su última notificación; únicamente se publica al completar la sincronización. Los observadores independientes de preferencias y navegación mantienen la ruta inmediata existente. No se modifica el mecanismo de `watch` de Vue, el store, ni el formato de los snapshots.
- La autoridad de construcción visual sigue siendo `syncAll()` / `syncObject()` / `signature()` / `_rebuild()`. El refresco de materiales no omite cuerpos ausentes ni silencia excepciones. Se ejecuta sobre la representación sincronizada, antes de recuperar el perfil de vista previa.
- Si la restauración falla, no se publican los callbacks pendientes; la recuperación del snapshot anterior vuelve a utilizar el mismo proceso. Si la recuperación también falla, se propagan ambas excepciones mediante `AggregateError`; no se afirma una recuperación exitosa en ese caso. El índice histórico solo avanza tras completar la restauración.
- La ruta directa del render fuera del historial conserva su comportamiento inmediato. No se modifican los comandos de teclado, Edit Mesh, los parámetros del ratón, TOML, el runtime, los materiales, los tipos de nodo ni las dependencias.

## Evidencia y límites

Se añade una suite focal de siete pruebas. El fixture Electron conserva las 78 comprobaciones previas y añade cuatro comprobaciones sobre la firma visual y los cuerpos de geometría durante Undo/Redo de conversión. El runner exige 82 comprobaciones. No se aumentan tiempos de espera. El resultado local del usuario anterior acredita 67 comprobaciones exitosas, incluida la secuencia de teclado nativo, hasta la excepción de SceneGraph.

QA específico y regresión Node completados; compilación y QA Electron bloqueados por Vite ausente. TOML real bloqueado por smol-toml ausente en este entorno (el usuario acreditó 1/1 anteriormente). La reparación nativa exacta, el rendimiento real y la aprobación quedan pendientes.
