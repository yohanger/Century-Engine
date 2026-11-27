# CE-EDITOR-SESSION-CA-001 — Persistent authoring state

Ratificada por el usuario junto con CENTURY-EDITOR-SESSION-S01-G001-PERSISTENT-WORKSPACE-AND-SCENE-STATE.

Enmienda el límite temporal de LF-EDITOR-CAMERA-STATE-FIX-G001: las vistas de autoría pueden sobrevivir al proceso. La autoridad sigue siendo EditorCameraViews y la cámara editorial existente. El almacenamiento local versionado por ID de proyecto conserva vistas, selección, árbol, pestañas, carpeta y preferencias de visualización. No se incorpora al contenido exportable ni a los checkpoints del juego. Los ajustes Snap y plegado heredados se leen como valores iniciales; las modificaciones editoriales se mantienen separadas. Los paneles y pliegues del Inspector conservan su mecanismo actual. Los estados temporales no son restaurables. Guardado diferido con comparación de cambios y captura en cierre autorizado; datos inválidos se descartan sin sustituirlos por ceros. Sin migración obligatoria.
