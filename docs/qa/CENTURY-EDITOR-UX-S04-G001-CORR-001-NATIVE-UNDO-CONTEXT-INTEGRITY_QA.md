# QA — Integridad nativa de Undo/Redo

Estado: corrección implementada en fuentes; no aprobada ni cerrada. El fallo de validación está reproducido con registros serializados reales y handlers productivos. El entorno no dispone de Vite ni smol-toml; no acredita la sesión Electron exacta.

| Verificación | Resultado |
|---|---|
| QA local previo comunicado por el usuario | 12/12 Node y 1/1 TOML PASS; Electron FAIL en Ctrl+Z |
| Doce pruebas focales con representación real, antes de la corrección | 10 PASS, 2 FAIL |
| Suite focal final (12 anteriores + 5 nuevas) | 17/17 PASS |
| Regresión de integridad numérica | 10/10 PASS |
| Regresión de 15 suites antes y después | 138 PASS, 36 FAIL, 1 omitida de 175; mismos nombres de fallos |
| Sintaxis JS y scripts del fixture | 6/6 PASS |
| QA Electron correctivo | Bloqueado antes de iniciar por ausencia de Vite; 0/78 |
| TOML real correctivo | Bloqueado antes de probar por ausencia de smol-toml; el usuario acreditó PASS en la entrega anterior |
| Build | Bloqueado: vite no encontrado |

Las pruebas focales ejecutan el historial, el preflight y el dispatcher productivos mediante VM, con colaboradores simulados. La geometría utilizada para el historial es la salida real de `PolyMesh.toJSON()`. No constituyen prueba de interacción nativa Electron. Se conservan las protecciones sobre geometría inválida. El fixture amplía la evidencia a 78 comprobaciones sin eliminar las 23 anteriores. Si la primera tecla falla, el reporte incluye todas sus condiciones y notificaciones. No se aumenta el timeout.

## Comandos de aceptación

- `npm run test:suite -- undo-context-and-mouse-sensitivity`
- `npm run test:suite -- editor-mouse-sensitivity-config`
- `npm run test:suite -- undo-context-and-mouse-sensitivity-electron`
- `npm run build`

Comprobar además Undo/Redo en una malla real con Modo Local, cambio de selección de aristas, cámara inmóvil y conversión incompatible. Mantener Gate abierto hasta QA local y aprobación explícita.
