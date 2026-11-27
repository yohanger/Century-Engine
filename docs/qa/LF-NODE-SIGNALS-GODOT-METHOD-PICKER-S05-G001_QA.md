# LF-NODE-SIGNALS-GODOT-METHOD-PICKER-S05-G001 — QA y evidencia

**Pruebas Node nuevas:** `node --test scripts/test-node-signals-godot-method-picker-s05-g001.mjs` — **25/25 PASS**. Cubre literales, comillas dobles, comentarios/textos/templates/regex, nombres dinámicos, llamadas ajenas, callbacks ausentes evidentes, colisiones/duplicados/reservados, archivos faltantes, legacy `scriptId`, no ejecución, selección del receptor, persistencia, modo manual, edición histórica, cambios de receptor y APIs originales.

**Regresión acumulada:** **392 PASS, 0 FAIL, 1 SKIP** en 20 suites Node de Signals/Multiscript. SKIP: `@vue/compiler-sfc` ausente aquí; no declarar Vue PASS por tests textuales.

**Electron:** `node --test scripts/test-node-signals-godot-method-picker-electron-s05-g001.mjs`; fixture `scripts/fixtures/nodes/node-signals-godot-method-picker-s05-g001.html` con pruebas de diálogo real, catálogo contextual, elección literal, modo manual, Undo/Redo, WebGL2 y Jolt. **NO VERIFICADO**: runner invocado, `Falta Vite`.

**Build:** `npm run build` — **NO VERIFICADO** (`vite: not found`), no atribuir PASS Editor ni Player.

**Documentación:** `node scripts/gen-docs.mjs --check` — PASS.

## QA local obligatorio

1. Ejecutar `npm ci`, la suite nueva, el test Electron, `node scripts/gen-docs.mjs --check`, `npm run build`, `npm run electron`.
2. Seleccionar un nodo receptor con uno o varios Scripts de Nodo que publiquen métodos con `node.expose('abrir', fn)`; comprobar lista por propietario, botón de selección y que `method` se guarda mediante operación existente.
3. Comprobar entrada manual, nombre dinámico, método histórico no detectable y cambio de receptor; comprobar avisos de duplicados y scripts inexistentes.
4. Ejecutar Play/Stop, confirmar emisión y método realmente ejecutado, Undo/Redo y persistencia. El análisis estático no reemplaza QA runtime.
5. Devolver logs Electron/build/Node y capturas del diálogo si falla. Hasta su aprobación: IMPLEMENTADO, no CERRADO.

## Adenda de aprobación local (2026-11-02)

El usuario respondió «Aprobado. SIgamos» tras la entrega S05-G001. Se registra **APROBADO · QA LOCAL PASS declarado por el usuario · CERRADO** para el alcance de selector de métodos existente. El usuario no adjuntó nuevos logs de Electron ni build en esa aprobación: permanecen **NO VERIFICADOS documentalmente** esos subresultados de S05. La aprobación no habilita por sí sola generación automática de callbacks; esa función se tramita en `LF-NODE-SIGNALS-GODOT-CALLBACK-CONTRACT-S06-G001`.
