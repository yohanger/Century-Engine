# LF-NODE-SIGNALS-CUSTOM-DISCOVERY-S03-G001 — QA

**Fecha:** 2026-11-02. **Estado:** IMPLEMENTADO · TEST NODE PASS · ELECTRON NO VERIFICADO · BUILD NO VERIFICADO · QA LOCAL PENDIENTE · NO CERRADO.

| Prueba | Evidencia |
|---|---|
| `scripts/test-node-signals-custom-discovery-s03-g001.mjs` | **28/28 PASS**. Detectar sin conexiones, literales, comentarios/strings/regex/plantillas, dinámicas, propietarios, duplicados, nativas, faltantes, legacy, cambio de código, inmutabilidad y no ejecución. |
| Regresión focal 19 suites Node con nuevos tests, G001/G002 Signals/Audio/Animation, Multiscript S01, Methods, Groups, CharacterBody3D y Jolt Area3D | **373/373 PASS**, 0 FAIL, 0 SKIP. |
| `node scripts/gen-docs.mjs --check` | PASS — referencia al día |
| Sintaxis JS y fixture HTML (script extraído con `node --check`) | PASS |
| `scripts/test-node-signals-custom-discovery-electron-s03-g001.mjs` | **NO VERIFICADO**: falta `node_modules/vite`; fixture Vue + Jolt WASM/WebGL2 preparada. |
| `npm run build` | **NO VERIFICADO**: `vite: not found`. |
| QA local Editor/Player | PENDIENTE DE USUARIO |

### Comandos Linux

```bash
npm ci
node --test scripts/test-node-signals-custom-discovery-s03-g001.mjs
node --test scripts/test-node-signals-custom-discovery-electron-s03-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

**Esperado:** Node 28 PASS/0 FAIL; Electron verifica render Vue real, WebGL2 y Jolt WASM; detecta sin conexión, actualiza al editar código, reporta duplicados/reservadas/faltantes, mantiene conexiones antiguas y no evalúa Scripts de Nodo. Los builds deben terminar para Editor y Player.

**QA visual:** seleccionar un nodo con script que incluya `node.define_signal('alerta')` sin conexiones. Debe aparecer bajo Personalizadas con cero conexiones y etiqueta «Detectada en código». Editar el código y comprobar que se actualiza el nombre; probar Undo/Redo, dos scripts declarando el mismo nombre, colisión `ready`, script ausente, argumento dinámico y enlace guardado cuyo script ya no declara la señal. Comprobar que el panel no ejecuta scripts en Edit Mode y que la conexión durante Play funciona con método `node.expose()`.

**Separación de evidencia:** Animation S02-G002 recibió QA LOCAL PASS declarado por el usuario; sus 22/22 Node y 345/345 focales se conservaron como evidencia automatizada. No hay logs específicos Electron/build de S02-G002 en la conversación actual y no se marcaron PASS por inferencia. Compilar no equivale a QA local.

**Fuera de alcance:** rediseño visual completo estilo Godot, Terreno en Inspector y limpieza final de Consola, que se mantienen al final de la secuencia aprobada.

### Aprobación local posterior (2026-11-02)

El usuario declaró «Aprobado. Sigamos» tras la entrega S03-G001, con QA LOCAL PASS. El registro de aprobación se incorpora al ledger durante el Gate S04-G001. No se recibieron logs Electron/build específicos, por lo que esas comprobaciones siguen **NO VERIFICADAS documentalmente**; la declaración del usuario cubre el QA local funcional.
