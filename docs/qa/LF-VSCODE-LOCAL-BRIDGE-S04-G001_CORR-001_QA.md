# S04 CORR-001: diagnóstico del runner real

Estado vigente: incluido en el cierre aprobado de S04 tras CORR-002. Véase `LF-VSCODE-LOCAL-BRIDGE-S04-G001_CLOSE.md`. El contenido siguiente conserva el estado histórico de esta corrección.

2026-11-04. Corrección dentro de `LF-VSCODE-LOCAL-BRIDGE-S04-G001`, autorizado y aún abierto. Base exacta: `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_SOURCE_BASELINE.zip` (2.093 archivos entregados). No se declara solucionada la conexión con VS Code Flatpak.

Actualización posterior CORR-002: el diagnóstico local ya fue recibido y permitió reproducir la causa: esperar la salida del CLI antes de atender al cliente conectado. El texto siguiente conserva el estado histórico de CORR-001. La implementación corregida y QA vigente están en `LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-002_QA.md`; aún requieren revalidación real.

## Evidencia del usuario y estado

OBSERVADO: `npm ci` completó; Node S04 19/19 PASS; Electron embebido completó 15 comprobaciones PASS. El runner real `--flatpak` falló en `first.ok` con «No se conectó la extensión de LevelForge…». Como los comandos estaban enlazados con `&&`, docs, build y arranque posteriores no se ejecutaron. Las compilaciones anteriores del asistente no sustituyen esa ejecución local interrumpida.

Estado S04: QA LOCAL FAIL en el runner real. Causa raíz de la falta de conexión: NO DETERMINADA. El mensaje acredita que no quedó un cliente autenticado al terminar la espera; no identifica instalación, activación, sandbox, arranque, protocolo o transporte como culpable. Tampoco demuestra que recargar una ventana sea la solución de este caso.

DEFECTO DEMOSTRADO DEL RUNNER: solo verifica el resultado de conexión, descarta stdout/stderr del CLI en esa ruta y borra incondicionalmente el perfil aislado en finally. El fixture no persistía sus etapas ni errores de activación. Esta pérdida de evidencia impide diagnosticar el timeout original. Corregir esa pérdida es el alcance de CORR-001; no es una causa demostrada del fallo de conexión.

Se auditó también el wrapper de Flathub y el parser oficial de argumentos de VS Code. El wrapper añade un extensions-dir, pero el parser toma el último valor; ese hecho por sí solo no prueba una colisión del perfil. No se modifica el lanzador ni se atribuye el fallo a Flatpak sin diagnóstico local.

Fuentes primarias consultadas (2026-11-04):

- https://github.com/flathub/com.visualstudio.code/blob/master/code.sh
- https://github.com/microsoft/vscode/blob/main/src/vs/platform/environment/node/argv.ts
- https://code.visualstudio.com/api/working-with-extensions/testing-extension

## Alcance implementado

- El runner conserva stdout/stderr y errores del CLI con límites de tamaño. No captura todo el entorno ni imprime el token de sesión.
- Antes del arranque, comprueba con `flatpak run --command=test` que los tres archivos del fixture sean legibles dentro del sandbox. No cambia permisos ni instala overrides.
- El driver registra inicio del Extension Host, versión/ruta de la extensión instalada, activación, workspace, lectura del descriptor sin token, IntelliSense, ready/complete y stack de error. Conserva el historial de etapas y los datos previos cuando avanza.
- Ante fallo, escribe `failure-report.json`, imprime su contenido y conserva el perfil de QA. Ante éxito, limpia como antes. El descriptor del puente se retira al cerrar el servidor incluso si se conserva el perfil.
- Si el Editor aborta y el driver estaba esperando su señal, la señal abort permite finalizar el test con fallo explícito; no convertir un aborto en PASS.
- El timeout de conexión sigue en 30 s. `--connect-timeout-ms` es una opción acotada de QA usada en pruebas controladas para comprobar los fallos del runner. No modifica los tiempos del producto ni se usa en el comando recomendado al usuario.

Únicamente cambian el runner real existente, su fixture, una nueva prueba de diagnóstico, documentación/evidencia y las seis hojas del ledger. Electron, renderer, extensión, VSIX 0.1.4, sincronización, dependencias, runtime y datos del juego quedan byte por byte idénticos a S04.

## Validación

Suite VS Code de 56/56 PASS: 52 comprobaciones anteriores más cuatro del diagnóstico. Tras mejorar la conservación de etapas, se repitieron las cuatro afectadas: 4/4 PASS. Las pruebas del runner usan CLI controlado y el fixture usa API VS Code controlada; no equivalen a ejecutar Flatpak o VS Code reales.

Se verifica que un CLI que devuelve cero con error de activación no produzca PASS, que el informe conserve ese error y stderr, que un fixture inaccesible se identifique antes de esperar TCP, que un error del lanzador quede registrado y que se retire el descriptor de sesión aunque se preserve el diagnóstico. Docs 12/12 PASS. Producto sin cambios: se conservan las compilaciones previas, no se ejecuta otro build innecesario.

VS Code/Flatpak reales: NO VERIFICADOS en este entorno. El fallo local original sigue abierto. Electron 15 comprobaciones PASS es evidencia recibida del usuario para el fixture controlado anterior, que permanece sin cambios; no acredita el puente dentro del Extension Host real.

## Instalación y siguiente acción

Se entregan exactamente dos ZIP: `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CORR_001_CHANGE.zip` y `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CORR_001_SOURCE_BASELINE.zip`.

SOURCE_BASELINE: extraer en una carpeta nueva `~/Desktop/LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CORR_001_SOURCE_BASELINE`, dejando package.json en su raíz. Conservar S04 entregado y los proyectos del usuario. Ejecutar npm ci una vez si es una extracción nueva.

CHANGE: aplicar solo a una copia exacta del SOURCE_BASELINE S04 entregado, comparando antes cambios locales. Reemplazar únicamente los archivos inventariados en `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-001_FILES.md`; no hay archivos eliminados en esta corrección. No tocar proyectos, Assets del usuario, perfiles habituales de VS Code, node_modules ni builds. Esta ruta permite usar las dependencias ya instaladas, sin repetir npm ci ni compilar por cambios exclusivos de QA/documentación. No aplicar ambos ZIP uno sobre otro.

Ejecutar únicamente:

```bash
node --test scripts/test-vscode-local-bridge-diagnostics-s04-g001.mjs &&
node scripts/test-vscode-local-bridge-real-s04-g001.mjs --flatpak
```

Esperado primero: 4/4 PASS. Después puede ocurrir:

1. Éxito real: JSON con activation PASS, activeDocument Second.js, 20 aperturas y cero llamadas CLI mientras está conectado. El perfil aislado se elimina.
2. Fallo real: `LF_VSCODE_REAL_FAIL`, etapa, información del host si llegó a ejecutar y salida CLI. Se imprime la ruta exacta de `failure-report.json`. No es aprobación ni solución del timeout.

Devolver ese bloque completo o adjuntar el archivo failure-report.json. No hace falta repetir npm ci, Electron, docs ni build si se aplicó CHANGE sobre la copia exacta. Conservar la carpeta de diagnóstico hasta analizar el fallo. Después de resolverlo, retirar únicamente esa carpeta temporal lf-vscode-real-* indicada por el runner, nunca la carpeta general de caché ni perfiles habituales. No se pide recargar VS Code o cambiar permisos como solución supuesta.

Bloqueo real: sin ejecución del runner corregido en el entorno que falla, no se puede atribuir la causa del timeout. S04 permanece abierto; la próxima acción es obtener esa evidencia y corregir el mecanismo demostrado, sin un nuevo Gate para esta incidencia dentro de S04.
