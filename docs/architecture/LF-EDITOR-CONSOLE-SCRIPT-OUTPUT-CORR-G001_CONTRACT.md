# LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001 — Contrato autorizado

Base vinculante: `LevelForge_TERRAIN_CAMERA_FRAME_S04_G001_INTEGRAL_SOURCE_BASELINE(1).zip`, íntegro, 1.647 archivos. Terreno S04 APROBADO y QA LOCAL PASS declarado por el usuario mediante «Aprobado. Sigamos.». Autorización actual: «Listo. LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001 autoriza comenzar».

## Objetivo y mecanismo

La Consola existente contiene exclusivamente salidas y diagnósticos de scripts del usuario. `console.log/info/warn/error/debug` se conectan mediante ámbito léxico en los puntos de ejecución existentes. `game.log()` conserva compatibilidad y entrega una entrada por llamada. No se reemplaza console global de Electron ni se filtran mensajes por palabras. Los mensajes administrativos conservan toast; los diagnósticos internos conservan consola técnica. Se reutilizan store.log, hosts y panel, con máximo 300 entradas y 8.000 caracteres por entrada.

Se conservan los cierres de scripts, callbacks de Signals, Multiscript, argumentos, await ya admitido, declaraciones locales console y compatibilidad con Player sin store del Editor. Los slots liberados y sesiones terminadas no vuelven a producir mensajes en otra sesión. Los errores disponibles se muestran con contexto; no se inventan ubicaciones o trazas. Las referencias explícitas a globalThis.console siguen dirigiéndose a la consola nativa. Esta conexión de salida no constituye un sandbox.

## Alcance autorizado

- Panel/contador: src/components/ConsolePanel.vue, BottomDock.vue.
- Estado/host Editor: src/core/state/state.js, src/core/editor/editor-host.js.
- Runtime eventos: src/engine/runtime/events/interpreter.js, play-host.js, play.js, play-route.js, exec-commands.js.
- Scripts de Nodo: src/engine/runtime/scene/node-scripts.js.
- Interfaces: src/engine/runtime/ui/manager.js.
- Host y Player: src/engine/runtime/host.js, src/engine/runtime/package/host.js.
- Medios incluidos: tests Node, runner y fixtures Electron embebido, compilador Vue, builds Editor/Player, documentación, informes y ledger de seis hojas. Cambios al runner solo para ejecutar estos medios, documentados y verificados.

Sin refactors de los subsistemas, cambios a escenas/recursos del usuario, Signals, Terreno, Jolt, física o render. Edit Mesh permanece DIFERIDO. Una causa de producción fuera de estas rutas o contradicción contractual bloquea la corrección y requiere Amendment.

## Evidencia y cierre

Verificar niveles y salida única en scripts globales, de Nodo, eventos, rutas e interfaces; callbacks de Signals y Multiscript; excepción con contexto; ausencia de mensajes administrativos; Play/Stop y cambios de escena sin duplicados; limpiar/contador/límite/desplazamiento coherentes; Player sin store. Separar IMPLEMENTADO, TEST NODE PASS, COMPILADO, ELECTRON PASS, QA LOCAL PASS y APROBADO. No cerrar sin QA local y aprobación del usuario.

Entrega: exactamente CHANGE y SOURCE_BASELINE, comparación contra la base, inventario de nuevos/modificados/eliminados y cambios inesperados. Excluir dependencias, builds, cachés y temporales. Cierre documental de Terreno S04 en las seis hojas, sin atribuirle resultados de compilación o Electron no suministrados por el usuario.
