# Contract Amendment — LF-FILMMAKER-NLE-DIRECT-AUTHORING-CA-001

**Estado: APROBADO POR EL USUARIO.** Ratificación literal recibida el 6 de noviembre de 2026: «Apruebo LF-FILMMAKER-NLE-DIRECT-AUTHORING-CA-001 sin modificaciones.»

**Contrato parent afectado:** `LF-FILMMAKER-ANIM-S00-G001_CONTRACT.md`. Solo queda sustituido el requisito operativo que exigía activar el modo «Animar» antes de trabajar con las pistas. Se conservan las restricciones de persistencia, físicas, escena base y recursos Cinematic aprobadas previamente.

## Reglas vinculantes

1. Abrir un Cinematic nativo habilita inmediatamente la edición de su Timeline.
2. Arrastrar un nodo desde Jerarquía permite añadir su pista sin activar «Animar» previamente.
3. Auto-key es opcional y comienza desactivado; los cambios de gizmo no crean claves sin esta decisión.
4. Una cámara editorial puede crear un plano sin grabación, usando el modelo original `passes` + `edit.shots`. Su duración será editable y no se inventarán tomas de actor.
5. Texto, audio y efectos se incorporan al mismo recurso mediante los controles existentes.
6. Cabezal, preview y reproducción funcionan sin tomas grabadas. La pose de edición es temporal y reversible: no escribe datos de escena mientras se navega el tiempo.
7. Guardar conserva el mismo recurso Cinematic y su ID. Otra película es otro recurso, creado explícitamente.
8. Grabar —incluida la cámara móvil— es una opción independiente. La implementación móvil queda fuera de alcance.

## Decisión de arquitectura

Reutilizar **exclusivamente** el `NleTimeline.vue` y la lógica de `montage.js` y `session.js` actuales. Mantener `session.author.active` **como salvaguarda interna** de la previsualización reversible; eliminarlo como paso/manual de acceso. No convertir `shots` en un segundo tipo de clip ni introducir editor paralelo. La cámara estructural de FilmMaker proporciona el encuadre guardado; un pase editorial tiene `take = -1` y `input = 'editor'`. Las pasadas grabadas conservan límites de captura. El preview editorial de textos, fundidos y letterbox es una composición DOM no destructiva sobre el mismo visor y se oculta en Play para evitar dobles overlays.

## Restricciones y exclusiones conservadas

Sin nuevas versiones de `.nfm`, sin manipular identidad del recurso, sin copiar pistas del Timeline de LevelForge, sin reescrituras de exportación ni del Player, sin ejecutar scripts arbitrarios en Edit y sin tocar FilmMaker móvil. Las claves siguen identificadas por ID y la simulación de física sigue teniendo el mismo contrato de seguridad.

**Gate que habilita la ejecución:** `LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL`, autorizado literalmente por el usuario en el mismo mensaje de ratificación.
