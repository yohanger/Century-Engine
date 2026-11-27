# Evidencia de QA

Estado: implementado en fuentes; no aprobado ni cerrado. El baseline inmediato contiene 4.017 archivos y coincide byte por byte con la copia de trabajo disponible. No se dispone del árbol local del usuario; la persistencia editorial y los Gates previos permanecen pendientes de aprobación según su ledger.

| Verificación | Resultado |
|---|---|
| Suite específica Node | 12/12 PASS |
| Regresión antes | 138 PASS, 36 FAIL, 1 omitida |
| Regresión después | 138 PASS, 36 FAIL, 1 omitida |
| Coincidencia de fallos históricos por nombre | 36/36 |
| Sintaxis JS/CJS/MJS y scripts de Vue/HTML | 22/22 PASS |
| Electron integrado | Bloqueado antes de iniciar: falta Vite (0/23) |
| Persistencia TOML real | Bloqueada antes de probar: falta smol-toml |
| Build | Bloqueado: vite no encontrado |

La suite focal ejecuta el código productivo de historial y edición mediante harness con colaboradores simulados; incluye selección vigente, agotamiento, conservación de modo y aislamiento, conversiones incompatibles, operaciones pendientes, referencias y jerarquía. La ganancia de navegación se ejecuta directamente. Se verifican además conexiones de preferencias mediante comprobaciones de código. No constituye prueba visual ni de interacción real con GPU. Las siete comprobaciones históricas de seis archivos se actualizaron para los nuevos nombres de transacción, fuente única de defaults y conexión del multiplicador, preservando el objetivo de cada prueba. No se corrigieron los 36 fallos preexistentes (entre ellos dependencias ausentes y assertions desactualizadas ajenas al alcance).

El nuevo runner Electron solicita teclado nativo y usa Editor, EditSession, Vue y proyecto real; incluye cámara, selección, Modo Local, conversión, Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y, búsqueda, plegado, sensibilidad y viewport estrecho. No se acredita su ejecución. La prueba TOML realiza lectura/escritura con el parser nativo sobre un archivo temporal; no se acredita su ejecución. Ventanas desacopladas y editores de recursos/scripts requieren comprobación local adicional; sus rutas no fueron reemplazadas. Se mantiene la preferencia heredada de paleta de herramientas; Restablecer usa el default efectivo del store (false), no la copia anterior inconsistente (true). La ganancia general afecta la navegación con ratón y mirada libre, no las sensibilidades independientes de gestos de trackpad, ni la velocidad del cursor del sistema ni el Player.

## Comandos de aceptación

- `npm run test:suite -- undo-context-and-mouse-sensitivity`
- `npm run test:suite -- editor-mouse-sensitivity-config`
- `npm run test:suite -- undo-context-and-mouse-sensitivity-electron`
- `npm run build`

Revisar manualmente el cierre de todas las ventanas, la reapertura de preferencias, las opciones conservadas, el efecto de 0.50x, el historial de editores de recursos y la responsividad real. Conservar estado pendiente hasta evidencia y aprobación.
