# CE-EDITOR-DOCKING-CA-004 — Native drag destination authority

Ratificado por el usuario el 24 de noviembre de 2026. Prevalece sobre las expectativas históricas incompatibles; el resto de `CE-EDITOR-DOCKING-CA-003-UNIVERSAL-NATIVE-WINDOW-AUTHORITY` continúa vigente. La propuesta original se conserva sin modificaciones.

1. Los destinos válidos tienen prioridad sobre el desacoplamiento nativo. Umbrales existentes: 12 px de inicio y 24 px fuera de destino válido.
2. Es válido desacoplar y volver a acoplar durante el mismo gesto. Soltar sin destino mantiene la ventana nativa.
3. La zona, grupo, borde y orden de pestañas elegidos prevalecen sobre la restauración predeterminada. Restaurar es una operación distinta.
4. Los títulos acoplables deben excluir las regiones de arrastre del sistema operativo que impidan recibir la entrada. El documento que inicia el gesto posee su captura; no se duplican autoridades ni componentes. Se mantiene el movimiento nativo de ventanas, con límites del compositor.
5. Solo se reemplazan expectativas históricas incompatibles; se preservan verificaciones de identidad, foco, recuperación, persistencia y estado editorial. No se certifica continuidad del gesto, DPI o multimonitor sin QA de Electron y del sistema operativo.

Gate autorizado: `CENTURY-EDITOR-UX-S03-G001-CORR-005-NATIVE-DOCKING-RESTORATION`. Ratificación contractual no equivale a aprobación de implementación o QA.
