# LF-VSCODE-LOCAL-BRIDGE-S04-G001: implementación y QA

Estado vigente tras aprobación del usuario: APROBADO, QA LOCAL PASS declarado y CERRADO. Véase `LF-VSCODE-LOCAL-BRIDGE-S04-G001_CLOSE.md`. Las secciones siguientes conservan el historial de implementación y revalidación.

Fecha: 2026-11-04. Autorización literal recogida en `docs/architecture/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CONTRACT.md`.

Estado: IMPLEMENTADO, TEST AUTOMATIZADO PASS y COMPILADO. QA LOCAL PENDIENTE. No aprobado ni cerrado.

Actualización posterior: QA local del usuario pasó Node 19/19 y Electron 15 comprobaciones, pero falló el runner real Flatpak por timeout. S04 queda QA LOCAL FAIL en ese punto. La corrección de diagnóstico y el estado vigente están en `LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-001_QA.md`; los resultados anteriores se conservan como historial, sin atribuirles la validación real pendiente.

Actualización CORR-002: el informe posterior demostró host ready y una conexión mientras el CLI seguía pendiente. Se reprodujo y corrigió la espera de launch antes de usar el cliente. Estado vigente y revalidación en `LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-002_QA.md`. S04 continúa pendiente de QA local corregido.

## Resultado y límites

Se extiende la integración S03 con un servidor TCP dentro de Electron y un cliente en la extensión existente, versión 0.1.4. Escucha solo en 127.0.0.1, con puerto automático, token y sesión por raíz autorizada. No requiere instalar un servidor adicional. La conexión activa confirma que el archivo se abrió y evita detección, consulta de extensiones y lanzamiento CLI en cada apertura. Sin cliente activo se conserva el lanzador S03 para detectar VS Code, preparar/actualizar la extensión y recuperar la conexión. No se degradan extensiones superiores.

El descriptor temporal `.levelforge/vscode-session.json` no pertenece al juego ni a los recursos. Al liberar el proyecto se eliminan únicamente los descriptores de la sesión propia. Hay reconexión progresiva, selección de ventana enfocada dentro de la misma raíz, agrupación de aperturas idénticas y límites de protocolo/rutas. No se repite automáticamente una apertura cuyo ACK se perdió. Un timeout ofrece la recuperación explícita existente. Varias peticiones que fallan comparten el diálogo de recuperación.

El aviso deja de tener una duración fija: representa conexión, arranque y apertura, y se retira con confirmación, fallo, cancelación o cierre/cambio del proyecto. La sincronización bidireccional y la preparación de tipos siguen usando el código existente. El doble clic de Assets conserva su ruta de apertura externa; no se añade un editor alterno.

Timeout inicial: hasta 30 s esperando la extensión tras lanzar VS Code, además del tiempo propio del lanzador. Conexión ya activa: hasta 5 s esperando ACK por apertura. Si había una ventana con la extensión antigua, puede ser necesario recargarla una vez; el error lo explica y permite reintentar. No confundir este caso de actualización con una apertura confirmada.

## Evidencia ejecutada

| Comprobación | Resultado |
|---|---|
| Servidor TCP real y cliente productivo con API VS Code controlada | 18/18 PASS |
| Estado real del editor mediante Vite SSR y disco/IPC controlados | 1/1 PASS |
| Regresión de integración S01/S02/S03 | 33/33 PASS |
| Timeline S06/CORR-001 y Signals | 52/52 PASS |
| Documentación web | 12/12 PASS; portal de 190 páginas al día |
| Editor / Player | Compilación completa PASS |
| Linux empaquetado sin instalador | Contenido revisado: backend, preload, VSIX y cliente 0.1.4 incluidos |
| Electron embebido S04, S03 y S02 | NO VERIFICADO: el entorno carece de pantalla; falla antes del fixture |
| VS Code nativo / Flathub reales | NO VERIFICADO: no hay CLI disponible |
| Windows real | NO VERIFICADO |

`evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/node-final.log` contiene el total 52/52 de la integración VS Code. Incluye primer arranque, duplicados, archivos distintos concurrentes con un único arranque, dos proyectos, ventanas enfocadas, desconexión/reinicio, token anterior, versión superior, ACK perdido, JSON inválido y escapes de raíz/symlinks. Se verifica también la retirada inmediata de avisos/listeners al cerrar el proyecto y que una respuesta antigua no altere una apertura nueva.

La prueba TCP ejecuta ambos módulos de producto, pero su API VS Code está controlada: no acredita Electron visual ni el Extension Host real. La inspección de distribución acredita archivos incluidos; no acredita el arranque visual del paquete.

## Medición controlada

| 20 aperturas | CLI S03 anterior | Conexión S04 activa |
|---|---:|---:|
| Procesos CLI | 60 (3 por apertura) | 0 |
| p50 | 210,13 ms | 0,259 ms |
| p95 | 226,77 ms | 0,581 ms |

Baseline: orquestador S03 congelado, con procesos Node reales que responden a los flags del CLI. S04: transporte TCP productivo y peer controlado que confirma inmediatamente. Son cargas distintas para aislar el coste del mecanismo; no representan VS Code real, UI, CPU/RAM del usuario ni una mejora porcentual de su computador. Solo queda demostrado que la ruta conectada no crea procesos CLI. JSON crudos en `baseline-cli.json` y `bridge-benchmark.json`.

El sincronizador existente, con 100 scripts y disco controlado, realizó dos escaneos en 2,2 s de reposo: cero lecturas y cero escrituras adicionales. No se eliminó ni sustituyó su escaneo periódico. La sincronización puede seguir contribuyendo al coste total de un proyecto grande; este Gate no atribuye toda la lentitud al CLI.

## Instalación y extracción

Entrega: exactamente `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CHANGE.zip` y `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_SOURCE_BASELINE.zip`. Inventario completo en `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_FILES.md`.

Ruta recomendada: extraer SOURCE_BASELINE en una carpeta nueva, de modo que `package.json` quede en `~/Desktop/LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_SOURCE_BASELINE/package.json`. Se conservan el SOURCE_BASELINE S06/CORR-001 aprobado, los proyectos del usuario y cualquier cambio local. No copiar `node_modules`, `dist`, `dist-player` ni `release` de otra entrega; ejecutar `npm ci` en la carpeta nueva. No sustituir ni borrar carpetas de proyectos, sus Assets o datos de VS Code.

CHANGE es el delta respecto del SOURCE_BASELINE S06/CORR-001, para comparación/aplicación controlada; no es un proyecto completo. Si se aplica sobre una copia exacta de esa base, reemplazar solo rutas inventariadas y retirar únicamente `vendor/vscode-extension/levelforge-0.1.3.vsix`, sustituido por 0.1.4. Comparar cualquier modificación local antes de reemplazarla. No aplicar ambos ZIP uno sobre otro. No hay cambios de dependencias raíz ni del lockfile. No se incluye SHA separado ni script .sh.

## Comandos locales

Desde la carpeta nueva, ejecutar en orden; detenerse en el primer fallo:

```bash
npm ci
node --test --test-concurrency=1 scripts/test-vscode-local-bridge-s04-g001.mjs scripts/test-vscode-local-bridge-state-s04-g001.mjs scripts/test-vscode-extension-integration-s03-g001.mjs scripts/test-vscode-project-workspace-s01-g001.mjs scripts/test-vscode-default-script-editor-s02-g001.mjs
node --test --test-concurrency=1 scripts/test-vscode-local-bridge-s04-g001-electron.mjs scripts/test-vscode-extension-integration-s03-g001-electron.mjs scripts/test-vscode-default-script-editor-s02-g001-electron.mjs
npm run docs:check
npm run build
npm run electron
```

Esperado: Node 52/52, tres pruebas Electron PASS (mínimos 15, 12 y 19 comprobaciones respectivamente), docs 12/12, build Editor y Player completo. Los avisos de tamaño de chunks y Jolt externalizado de Vite son conocidos; no equivalen a fallo del build.

Runner adicional para VS Code Flatpak instalado:

```bash
node scripts/test-vscode-local-bridge-real-s04-g001.mjs --flatpak
```

Sin `--flatpak` usa el CLI nativo. Reutiliza el runner S03, con proyecto/perfiles de QA aislados. Comprueba instalación/activación, comandos, tipos y snippets; realiza 20 aperturas por el puente, verifica que no crece el número de llamadas CLI tras conectar y que el Extension Host terminó mostrando `Second.js`. Imprime medición real de esas aperturas. No altera el perfil habitual. Si no hay CLI, termina NO VERIFICADO, no PASS. No instalar la extensión manualmente como sustituto de esta prueba.

## QA manual y evidencia a devolver

1. Con VS Code cerrado, abrir un script con doble clic desde Assets. Debe aparecer el archivo correcto y retirarse el aviso cuando la extensión confirme. Primera ejecución prepara la extensión automáticamente.
2. Mantener VS Code abierto: alternar scripts al menos 20 veces y repetir doble clic sobre uno pendiente. Debe reutilizar la conexión, sin lanzar procesos CLI por cada apertura, sin avisos acumulados ni diálogo duplicado.
3. Dos proyectos con scripts homónimos y varias ventanas: comprobar raíz correcta y preferencia de la ventana enfocada de ese proyecto. No abrir scripts del proyecto B en A.
4. Cerrar/reabrir VS Code y cerrar/cambiar proyecto con una petición pendiente. Comprobar reconexión, retirada de avisos y ausencia de apertura tardía atribuida al nuevo proyecto. Cancelar la recuperación no debe dejar un aviso permanente.
5. Modificar y guardar un script con Ctrl+S en VS Code: contenido actualizado en LevelForge; guardar/reabrir conserva los cambios. Comprobar tipos game/node y métodos receptores Signals. Verificar que `jsconfig.json` propio no se sobrescribe.
6. Si VS Code ya ejecutaba 0.1.3, recargar su ventana una vez cuando lo indique la integración y repetir. Una vez activa 0.1.4, las aperturas siguientes deben usar el puente.

Devolver la aprobación tras QA local completo. Ante una incidencia, enviar el bloque del primer fallo, paso exacto, versión activa de la extensión, modalidad nativa/Flatpak y captura si es visual. Conservar ambas entregas hasta aprobar S04. No borrar proyectos ni desinstalar la extensión de uso habitual para simular un arranque limpio.

## Documentación, trazabilidad y siguiente acción

El Amendment autoriza expresamente sustituir la consulta CLI por conexión autenticada y versión activa, preservando la instalación/actualización S03 en el arranque. Se registra el cierre S06/CORR-001 y S04 implementado pendiente de QA en ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY. Valores históricos, estilos, estructura, columnas y tablas del ledger se compararon con la base; solo cambian diez estados autorizados y se añaden dos filas por hoja.

Siguiente acción: QA local del usuario. No iniciar otro Gate ni declarar S04 aprobado/cerrado sin evidencia y aprobación.
