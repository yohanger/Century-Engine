# Evidencias de diagnóstico

`dock6-before.log` y `dock6-after.log`: 28/28 y 31/31 Node. `dock6-runner.log`: 11/11 pruebas del diagnóstico compartido. `dock6-pointer.log`, `dock6-mesh.log`, `dock6-icons.log`: 70/70, 9/9 y 11/11. `dock6-electron-before.log` y `dock6-electron-after.log`: runner bloqueado por falta de Vite; no acreditan el comportamiento del motor.

`dock6-fresh-before.log` y `dock6-fresh-after.log`: Chromium aislado, CDP con módulos de gesto productivos y DOM mínimo (no Vue ni Electron). En ambos se detecta centro sin solicitud nativa, se confirma el destino y se libera la captura. `dock6-reuse-before.log`, `dock6-reuse-nohover.log`, `dock6-reuse-hover.log`: reutilización de un target CDP al reemplazar el documento, captura rechazada; el TypeError al leer un destino nulo corresponde al assert de la prueba aislada, no al motor. La traza posterior muestra el rechazo antes del hit-test. No se equipara al fallo integrado del usuario.

QA del usuario: 28/28 Node; 0/1 Electron, «Destino válido no abre ventana» FAIL. La causa raíz integrada permanece no acreditada. No hay evidencia visual de transferencia nativa.
