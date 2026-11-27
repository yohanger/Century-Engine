# QA — LF-NODE-SCRIPT-LIFECYCLE-DISPATCH-CORR-G001

**Estado:** IMPLEMENTADO · 24/24 TESTS NODE NUEVOS PASS · Electron/Build/Player NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

## Pruebas desde raíz de SOURCE_BASELINE G001 (Linux)

```bash
npm ci
node --test scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs
node --test scripts/test-node-script-s05-g001.mjs scripts/test-node-script-s05-corr001.mjs scripts/test-groups-api-s03-g001.mjs
node --test scripts/test-node-script-lifecycle-dispatch-electron-corr-g001.mjs
npm run build
npm run electron
```

**Esperado (sin errores nuevos):** pruebas nuevas 24/24 PASS; conjunto focal restante 64/64 PASS; Electron 1/1 y al menos 17 verificaciones, si el hardware y Vite/Electron pueden ejecutarlo; build de Editor y Player sin errores. Estas son expectativas para QA local, no evidencia ya observada.

## QA funcional obligatoria del usuario

1. 10.000 nodos sin callbacks: comprobar que no se realiza despacho periódico de scripts; diferencia frente a S03 mediante instrumentación CPU, sin declarar mejoras porcentuales sin medir.
2. Scripts que solo definen `_ready()` o funciones personales: se evalúan una vez y no reciben `_process/_physics_process`.
3. Dos scripts con `_process` y un script con `_physics_process`: comprobar orden, tasas y pausas.
4. VFX3D nativo que necesita `onProcess`: emisión y simulación siguen activas.
5. Al eliminar un nodo suscrito con `game.on`: no recibe emisiones posteriores; reentrar no multiplica callbacks.
6. `game.once`: se dispara una vez y se libera tanto al recibir como al salir prematuramente.
7. `game.waitFor`: recibir señal mantiene datos; cancelar nodo/escena resuelve `undefined` y libera timers/waiters.
8. Script global `game.on` continúa activo aunque se elimine un nodo.
9. Cambiar `scriptId`, padre o escena: no se retienen callbacks anteriores, sin afectar el orden de callbacks restantes.
10. Error en `_exit_tree`, error de evaluación y callback asíncrono tardío: no dejan suscripciones huérfanas.
11. Play/Stop repetidos, Editor y Player exportado: sin errores ni diferencias funcionales; verificar física Jolt real cuando sea posible.

## Evidencia a devolver

- Texto completo de resúmenes `node --test` (y primeros errores si fallan).
- Salida de test Electron incluyendo WebGL y número de comprobaciones.
- Salida final de ambos builds, Editor y Player.
- QA local de escenas de scripts y VFX3D; prueba del Player.
- Captura de rendimiento de una escena comparable en S03 y G001, idealmente p50/p95 y recuento de scripts participantes.

## Resultados ya observados aquí

- 24/24 pruebas nuevas PASS.
- 88/88 batería focal PASS.
- 276/278 regresión extendida PASS; `NC-25` y `AUD-10` preexistentes en S03 (58/60 baseline antiguo).
- Test Electron **NO VERIFICADO** (falta Vite en este entorno).
- Build **NO VERIFICADO** (`vite: not found`).
- Ninguna evidencia QA visual/Player/PASS usuario de este Gate.

**No declarar CERRADO** hasta completar QA local y aprobación explícita del usuario; actualizar ledger a partir de los logs reales.
