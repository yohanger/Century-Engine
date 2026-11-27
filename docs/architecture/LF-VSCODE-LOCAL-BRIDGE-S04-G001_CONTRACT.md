# LF-VSCODE-LOCAL-BRIDGE-S04-G001 · Contract Amendment

Autorización: «Listo. LF-VSCODE-LOCAL-BRIDGE-S04-G001 autoriza comenzar» (2026-11-04).
Base: SOURCE_BASELINE TIMELINE LIBRARY ASSETS S06 G001 CORR 001, 2.064 archivos, aprobado por el usuario con Node 18/18, Electron 23 comprobaciones, docs 12/12 y builds Editor/Player completos en el registro adjunto. El cierre S06 se incorpora en esta entrega sin borrar el fallo previo.

## Auditoría

OBSERVADO: cada openVSCode ejecuta --version, --list-extensions y apertura CLI, y verifica el VSIX. ensureExtension comparte solo la instalación en curso, sin conservar conexión. El renderer muestra un toast fijo de 4,5 s. createScriptSync escanea cada segundo y hace flush forzado antes de abrir; la extensión no mantiene un canal al Editor. No existe servidor de integración reutilizable.
CAUSA demostrada de trabajo repetido: la ruta de apertura repite descubrimiento y comprobación CLI en vez de reutilizar una extensión activa. El toast fijo no representa duración real.
INFERENCIA a medir: contribución concreta a CPU/memoria y latencia en el equipo del usuario. No se atribuye toda la lentitud a este flujo sin medición. Los benchmarks con clientes/CLI controlados no se presentarán como VS Code real.

## Objetivo y mecanismo

Extender el lanzador existente con un canal TCP de node:net, exclusivamente 127.0.0.1 y puerto asignado por el SO, servidor en el proceso principal de Electron y cliente en la extensión existente. Una sesión por raíz autorizada; descriptor temporal en .levelforge/vscode-session.json, con identidad de sesión y token aleatorio. No forma parte del .lfproj, del juego ni de sus recursos.

La extensión observa el descriptor y mantiene una conexión con autenticación, versión de protocolo, versión de extensión e identidad de raíz. Solo admite abrir/enfocar archivos .js de Assets de esa raíz y confirmar solicitudes. Validar rutas reales y rechazar escape por enlaces simbólicos. Sin evaluación de código ni comandos arbitrarios. Límites de mensajes y tiempos de respuesta acotados. Reconexión con espera progresiva; limpiar observadores, sockets y descriptores propios al cerrar/liberar el proyecto.

Una conexión activa válida al proyecto tiene prioridad sobre el CLI. Sin conexión, usar la detección, instalación/actualización y lanzamiento S03 existentes. Si hay una ventana previa que necesita recarga para activar la extensión actualizada, informar la causa; no fingir conexión. Varias ventanas se resuelven solo entre clientes autenticados de la misma raíz, prefiriendo la ventana enfocada. No abrir en otro proyecto como fallback.

Las peticiones idénticas pendientes se agrupan; las de archivos distintos conservan su destino y orden de envío. Un ACK informa apertura real por la extensión, no solo que se lanzó un proceso. Error, cancelación o cambio de proyecto retiran el aviso de espera. No mantener un toast fijo de apertura cuando ya terminó.

## Amendment vinculante respecto de S03-G001

Se sustituye la consulta CLI en cada apertura por comprobación de conexión autenticada y versión activa. La validación de instalación sigue en la ruta de arranque/recuperación. Se conservan la identidad levelforge.levelforge, instalación desde VSIX incluido, no degradar versiones superiores, misma instalación para preparación/lanzamiento CLI y protección de datos/sincronización. Un peer activo verifica su propia extensión/raíz antes de servir solicitudes.

Alcance: electron/vscode.cjs y su integración main/preload; módulos específicos de servidor y cliente del puente; extensión y VSIX actualizados; estado de apertura y liberación; runners/fixtures y medición; docs y seis hojas del ledger. Extensión 0.1.4. Sin framework de servidor ni nueva dependencia de transporte. El sincronizador existente se preserva salvo defecto demostrado; no duplicar sincronización ni reescribir jsconfig del usuario.

## Evidencia y aceptación

Aclaración CORR-002: escuchar la conexión durante el lanzamiento, sin exigir que el proceso CLI termine para poder enviar la primera petición. El límite de conexión de 30 s comienza al terminar la preparación de la extensión. El lanzador en modo puente admite cancelación del arranque aún no conectado; una conexión/ACK ya válidos no se invalidan por la duración o salida tardía del CLI. La espera final del proceso en QA ocurre después de completar las aperturas. Detalle y evidencia en `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-002_QA.md`.

- Medir baseline y flujo nuevo: latencia p50/p95, llamadas/procesos CLI y actividad de sincronización. Declarar el alcance de cada medición.
- Con peer conectado, cada apertura confirmada debe crear cero procesos CLI y no volver a consultar/instalar extensiones.
- Probar primer arranque, reapertura, dos proyectos, varias ventanas, duplicados, desconexión/reinicio, cierre del proyecto, token inválido, tramas dañadas y rutas con espacios/symlinks.
- Preservar sincronización bidireccional, tipos game/node, Signals y guardado/reapertura. QA con Electron embebido y VS Code real/Flathub; Windows según disponibilidad. Las plataformas no ejecutadas quedan NO VERIFICADAS.
- Compilar Editor/Player; preparar y comprobar VSIX y recursos distribuidos; documentación y ROADMAP/BACKLOG/DEPENDENCIES/GATES/EVIDENCE/TRACEABILITY. Entregar exactamente CHANGE y SOURCE_BASELINE contra CORR-001.

Fuera de alcance: instalar VS Code, modificar sus preferencias/perfiles, servicios remotos, cambios de Timeline/Cinematics/Player/Jolt y sustituir el sincronizador. Prerrequisitos: baseline aprobado y VS Code instalado para QA real. No hay contradicción pendiente: este Amendment resuelve explícitamente el mecanismo de apertura S03. Próxima acción tras implementación: QA local, sin declarar aprobado/cerrado antes de evidencia y aceptación.
