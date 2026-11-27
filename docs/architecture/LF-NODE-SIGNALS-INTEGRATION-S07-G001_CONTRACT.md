# LF-NODE-SIGNALS-INTEGRATION-S07-G001 — Contrato de integración final

**Autorización literal:** `Listo. LF-NODE-SIGNALS-INTEGRATION-S07-G001 autoriza comenzar`.

**SOURCE_BASELINE:** `LevelForge_NODE_SIGNALS_GODOT_CALLBACK_S06_G002_INTEGRAL_SOURCE_BASELINE.zip` (1.629 entradas).

**Situación previa:** S06-G002-INTEGRAL fue **APROBADO PARCIALMENTE** por el usuario. Los errores de Edit Mesh reportados son incidencias separadas y están diferidos. No se debe convertir aquella aprobación en PASS integral ni en cierre.

## Objetivo

Verificar el trayecto de `signalConnections` desde los datos de autoría de cada escena, a través de empaquetado LevelForge y carga Player, hasta la emisión real y el receptor activo de NodeScriptRuntime. Solo corregir defectos causales demostrados. La exportación Godot externa continúa bloqueada si contiene conexiones sin conversión.

## Mecanismo autorizado y ejecutado

- `src/engine/runtime/package/host.js`: cargar la lista autorada de la **escena activa** al montar el Player y en `switchScene`; sustituirla al cambiar, admitir escenas antiguas sin el campo con lista vacía y rechazar un campo presente de tipo incorrecto.
- Mantener `writePackage` y `readPackage` existentes; las escenas ya guardaban los datos completos. No introducir otro contenedor, conversor ni bus.
- Mantener el sistema de registro de señales, las reglas de `NodeLifecycle`, la semántica `node.expose()`/Multiscript y la transacción S06 tal como están.
- Comprobar conexiones creadas por autoría, nativas y Custom con tests de NodeScriptRuntime + NodeLifecycle. La instancia del emisor y la del receptor deben permanecer vigentes.
- Probar desde Electron embebido con ZIP Player real (`writePackage`/`readPackage`), Vue/Vite del proyecto, WebGL2 y Jolt WASM. En este entorno la ejecución Electron no pudo completarse; **NO VERIFICADO**.

## Restricciones

- No modificar Edit Mesh, Terreno, Consola, Three.js, Jolt, scripts de usuario ni otra interfaz.
- No añadir nuevos eventos, One Shot, Deferred, Unbind o implementaciones ficticias.
- No modificar contratos previos para legitimar regresiones. Guardar en el ledger estados separados de Node PASS, Electron, compilación, QA local y aprobación.
- Mantener proyectos existentes y escenas sin conexiones. `signalConnections` sigue siendo autoría de escena y no datos globales del proyecto.
- Si una causa demostrada obliga a tocar archivos fuera del alcance del Gate, bloquear y declarar Amendment; nunca ampliar en silencio.

## Aceptación

Tests Node y QA local deben corroborar: carga inicial, transferencia al cambiar de escena, liberación de conexiones viejas, reentrada sin duplicados, emisión Custom/nativa, publicación del callback, compatibilidad con escenas antiguas, guardado/carga, Editor, Player exportado, y ejecución real en Electron con Jolt. Solo el usuario puede ratificar QA LOCAL PASS.

## Entrega

Dos ZIP exclusivamente: CHANGE y SOURCE_BASELINE completo acumulado, sin SHA separado ni scripts `.sh`. Ledger ROADMAP/BACKLOG/DEPENDENCIES/GATES/EVIDENCE/TRACEABILITY con estados reales. El siguiente baseline parte del paquete acumulado S07 una vez aprobado.
