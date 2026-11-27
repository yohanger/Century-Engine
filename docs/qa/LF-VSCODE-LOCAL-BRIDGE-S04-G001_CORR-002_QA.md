# S04 CORR-002: usar la conexión antes de terminar el CLI

Estado vigente tras aprobación del usuario: APROBADO, QA LOCAL PASS declarado y CERRADO junto con S04. Véase `LF-VSCODE-LOCAL-BRIDGE-S04-G001_CLOSE.md`. Se conserva a continuación el historial anterior a esa aprobación, incluidos sus límites de evidencia automatizada.

2026-11-04. Corrección dentro de `LF-VSCODE-LOCAL-BRIDGE-S04-G001`, autorizado y abierto. Base exacta: `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CORR_001_SOURCE_BASELINE.zip`, 2.103 archivos. Estado: IMPLEMENTADO, TEST AUTOMATIZADO PASS, QA LOCAL CORREGIDO PENDIENTE. No aprobado ni cerrado.

## Diagnóstico demostrado

OBSERVADO EN EL INFORME REAL: VS Code 1.139.1 instaló la extensión 0.1.4; el driver la encontró en el perfil aislado, la activó y registró descriptor legible, raíz coincidente y host ready. El servidor contó una conexión, cero peticiones y cero ACK. El CLI de apertura comenzó a las 16:36:08.656Z y terminó a las 16:38:03.604Z (114,948 s). El host ya estaba ready a las 16:36:32.355Z. El usuario confirma: «Pues abre, y funciona.» Es observación funcional; no aprobación global de S04.

CAUSA RAÍZ REPRODUCIDA: `vscode-bridge.cjs` hacía `await launch` antes de buscar/esperar al cliente y enviar la primera apertura. El CLI podía seguir pendiente mientras la extensión ya estaba conectada. El runner, a su vez, necesitaba que el Editor enviase las aperturas antes de permitir que el driver completara y cerrara su ventana de QA. La conexión válida no desbloqueaba esa espera: por eso había una conexión y ninguna petición. Al terminar el CLI, la conexión podía haber desaparecido y se mostraba un timeout engañoso.

El mensaje no acredita un fallo de instalación o de acceso de Flatpak. Ambos pasaron en el informe. Tampoco acredita un defecto de IntelliSense: el host llegó a ready después de comprobarlo. El detalle de por qué ese CLI permaneció asociado al proceso no necesita suponerse para corregir la dependencia errónea: un cliente autenticado debe poder recibir peticiones aunque el CLI siga pendiente.

La reproducción controlada mantiene deliberadamente pendiente el lanzamiento y conecta el cliente productivo sobre TCP real. Antes de corregir, la apertura no recibe ACK y la prueba falla; después abre el archivo y confirma mientras el CLI sigue pendiente. Registros separados `reproduction-before.log` y `reproduction-after.log`. No se convierten en medición de VS Code real.

## Mecanismo corregido y aclaración del contrato

El servidor escucha al cliente durante el lanzamiento. Una conexión autenticada permite enviar la apertura y recibir ACK sin esperar a la salida del CLI. Se conserva un solo arranque compartido entre solicitudes concurrentes. La conexión por sí sola no sustituye al ACK: solo se declara apertura completada después de confirmar el destino.

El lanzador existente notifica cuando terminó de preparar la extensión y va a abrir la ventana. Desde ese punto corre el límite de conexión de 30 s. En modo puente, el proceso GUI/CLI usa una señal de cancelación en lugar del timeout fijo de 15 s del lanzador independiente. Un arranque sin cliente se cancela al vencer el límite o al liberar el proyecto; una ventana que ya conectó no se cancela porque el CLI siga abierto. La detección y la instalación conservan sus límites S03 y la identidad/perfil elegidos. El uso del lanzador independiente sin señal conserva su comportamiento anterior.

Un error tardío del CLI no invalida una apertura ya confirmada por la extensión. Sus promesas quedan atendidas. No se relanza automáticamente ni se repite un archivo cuyo ACK se perdió. Cerrar el proyecto libera el canal; no cierra una ventana de VS Code ya conectada.

El runner transmite al lanzador esa señal y la notificación de preparación. Espera la salida del CLI solo después de las 20 aperturas y de completar el driver. La espera final de cierre de QA está acotada a 30 s y se identifica como cli-exit si falla; no puede bloquear las aperturas previas. Se conserva el diagnóstico CORR-001.

Esta aclaración implementa el contrato original de prioridad de conexión/ACK; no rebaja aceptación, autenticación, rutas, versión activa ni requisitos de QA real. No añade dependencias, servidores ni extensiones paralelas. Extensión/VSIX siguen en 0.1.4 porque sus bytes no cambian.

## Validación

| Comprobación | Resultado |
|---|---|
| Reproducción antes de corregir | FAIL esperado: cliente conectado, apertura bloqueada por CLI |
| Misma reproducción después | PASS: apertura y ACK antes de terminar CLI |
| Servidor y lanzador productivos con TCP/API/CLI controlados | 23/23 PASS |
| Diagnóstico y runner completo con CLI controlado pendiente | 5/5 PASS |
| Suite VS Code S01/S02/S03/S04 completa | 62/62 PASS |
| Documentación | 12/12 PASS |
| Sintaxis main, servidor y lanzador | PASS |
| Paquete Linux sin instalador | Backend actualizado y VSIX 0.1.4 incluidos y comparados con fuente |
| VS Code/Flatpak reales con CORR-002 | NO VERIFICADOS aquí; reejecución local pendiente |

Las cinco regresiones nuevas del servidor comprueban: ACK con CLI pendiente; lanzador productivo sin matar el CLI conectado y sin propagar error tardío; cancelación por timeout tras preparar; cancelación al liberar antes de conectar; dos archivos con ACK compartiendo un único CLI pendiente. El nuevo caso del runner ejecuta el proceso completo con un CLI controlado que permanece abierto hasta recibir la señal final: completa las 20 aperturas sin nuevas llamadas CLI y limpia el perfil al terminar.

Electron visual: se conserva el PASS local anterior del usuario para las 15 comprobaciones del fixture controlado, cuyo contenido no cambia. Ese PASS no acredita esta corrección del proceso principal ni el nuevo QA real. Editor/Player y renderer permanecen idénticos a CORR-001: las compilaciones previas conservan validez para sus archivos, no se presentan como una nueva compilación. Se empaqueta nuevamente Linux para inspeccionar los CommonJS actualizados, que no dependen del build Vite. No se entrega instalador ni se afirma arranque visual del paquete.

## Entrega y aplicación

Exactamente dos ZIP: `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CORR_002_CHANGE.zip` y `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CORR_002_SOURCE_BASELINE.zip`. Inventario: `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-002_FILES.md`. No hay SHA separado ni .sh.

CHANGE: aplicar a una copia exacta de CORR-001 ya probada, comparando antes cambios locales y reemplazando únicamente las rutas del inventario. No hay eliminaciones. No tocar proyectos, Assets, datos/perfiles habituales de VS Code ni dependencias instaladas. Permite reutilizar node_modules; no hace falta npm ci de nuevo porque no cambian dependencias.

SOURCE_BASELINE: alternativa completa para carpeta nueva `~/Desktop/LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CORR_002_SOURCE_BASELINE`, con package.json en la raíz. Ejecutar npm ci si se elige una extracción nueva. No extraer ambos ZIP uno sobre otro. Conservar CORR-001, proyectos y diagnóstico recibido hasta aprobar el Gate.

## Revalidación local

Primero, desde la carpeta donde se aplicó la corrección:

```bash
node --test --test-concurrency=1 scripts/test-vscode-local-bridge-s04-g001.mjs scripts/test-vscode-local-bridge-diagnostics-s04-g001.mjs &&
node scripts/test-vscode-local-bridge-real-s04-g001.mjs --flatpak
```

Esperado: 28/28 Node; después JSON real con activation PASS, activeDocument Second.js, opens 20, cliCallsWhileConnected 0 y cliLaunchesWhileConnected 0. Dejar que el runner complete y cierre su ventana de QA; no cerrarla durante la espera. No se exige recargar la ventana como solución a la causa reproducida.

Si pasa, completar la cadena que el fallo anterior no permitió ejecutar:

```bash
npm run docs:check &&
npm run build &&
npm run electron
```

Esperado: docs 12/12, Editor y Player compilados y editor abierto. El build local se pide porque las cadenas anteriores del usuario se detuvieron antes de compilar S04. Comprobar doble clic, cambio entre archivos con VS Code abierto, cierre/reapertura y guardado externo. Deben retirarse los avisos con ACK y las aperturas conectadas reutilizar el canal. Si interesa repetir Electron controlado, su comando anterior sigue disponible; no reemplaza la prueba real corregida.

Ante fallo: devolver LF_VSCODE_REAL_FAIL o failure-report.json conservado por el runner. Si pasa el runner y el QA manual completo, devolver aprobación; no se requieren de nuevo logs completos salvo incidencia. Mantener el directorio de diagnóstico O5zkEo recibido hasta cerrar la incidencia. Tras resolverla puede retirarse únicamente ese directorio lf-vscode-real-* concreto; no borrar la caché general ni perfiles de uso habitual.

## Registro y siguiente acción

Las seis hojas conservan el fallo inicial y CORR-001. Se actualiza el estado de causa pendiente a diagnóstico confirmado y se registran la reproducción y CORR-002 implementado pendiente de QA. «Abre y funciona» no se usa para cerrar S04 ni para atribuir PASS a la revalidación corregida. Siguiente acción: runner real del usuario y QA manual; S04 sigue abierto.
