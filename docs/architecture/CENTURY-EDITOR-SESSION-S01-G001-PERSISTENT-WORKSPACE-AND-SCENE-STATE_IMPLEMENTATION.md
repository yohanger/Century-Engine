# Persistencia del espacio de trabajo editorial

Gate autorizado y enmienda CE-EDITOR-SESSION-CA-001-PERSISTENT-AUTHORING-STATE ratificada. Estado: implementación en fuentes, QA integrado pendiente, no aprobado ni cerrado.

## Mecanismo y alcance
- `EditorCameraViews` sigue siendo autoridad de las vistas. Snapshots de cámara con posiciones, cuaterniones unitarios, proyección, zoom, FOV, punto de órbita y límites de controles; restauración tras sincronizar la escena.
- `EditorWorkspaceState` conserva datos versionados por ID de proyecto en el almacenamiento local del perfil/origen del editor. No se incluyen en `.lfproj` ni en el Player. No hay nuevas dependencias. Se reutilizan los mecanismos existentes de preferencias y cierre; Snap y pliegues del árbol pasan a ser estado editorial, con valores heredados de respaldo.
- Se mantienen selección y nodo activo, expansión y scroll del árbol, modo del viewport por escena; pestañas, escena activa, gizmo, espacio, Snap, Grid y demás ayudas del visor, carpeta de Assets por proyecto. Los valores booleanos false son explícitos. Se descartan referencias obsoletas y snapshots no finitos, conservando la última vista válida.
- Captura cada dos segundos si hay contexto editorial válido; escritura solo si cambia la representación serializada; captura antes de cambio de escena, proyecto o cierre autorizado. No se serializan gestos, Play, diálogos ni operaciones temporales de edición. No se cambia la arquitectura del runtime ni se obliga a migrar proyectos existentes.
- La persistencia es local al mismo perfil/origen de Electron; no es sincronización entre dispositivos, rutas de instalación/orígenes diferentes ni copia de seguridad. El almacenamiento puede fallar por cuota o permisos; se registra la excepción. Un cierre abrupto puede perder los últimos cambios desde la captura/escritura anterior.

## Límites de acreditación
No se dispone del árbol local del usuario. El ZIP suministrado es la fuente auditada. No se acreditan reapertura real, scroll visible, pérdida de proceso ni rendimiento en el hardware objetivo hasta el QA integrado/manual. Se mantiene abierto el Gate de estabilidad anterior; no se deduce aprobación de otros Gates.
