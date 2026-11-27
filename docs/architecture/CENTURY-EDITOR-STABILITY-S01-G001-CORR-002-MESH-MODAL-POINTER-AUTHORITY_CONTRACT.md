# Autoridad de entrada modal de Edit Mesh

Gate ratificado: `CENTURY-EDITOR-STABILITY-S01-G001-CORR-002-MESH-MODAL-POINTER-AUTHORITY`.

El guard editorial delega primero la entrada a la sesión modal activa si `ContinuousGrab` acredita autoridad sobre el documento. El receptor modal existente consume el evento antes de OrbitControls y de la selección. Capturas ajenas o reservas incompatibles permanecen protegidas. La confirmación, cancelación y el historial pertenecen a EditSession; no se añade un controlador paralelo. Enter, Escape y el fallback convencional conservan su semántica. El corte en bucle respeta sus fases existentes.

El diagnóstico conserva propietario, operación, error y estado, pero acota el stack a 2048 caracteres y sustituye la carga de URLs data de JavaScript por un marcador. No modifica la excepción original. No se sustituye ningún contrato de recuperación vigente.
