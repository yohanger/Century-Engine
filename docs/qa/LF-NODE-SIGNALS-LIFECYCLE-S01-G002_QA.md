# LF-NODE-SIGNALS-LIFECYCLE-S01-G002 — Evidencia y QA

**Fecha:** 2026-11-02. **Estado actualizado tras QA del usuario:** APROBADO · NODE PASS · ELECTRON PASS · BUILD EDITOR/PLAYER PASS · QA LOCAL PASS.

| Verificación | Resultado / evidencia |
|---|---|
| Suite nueva `scripts/test-node-signals-lifecycle-s01-g002.mjs` | **18/18 Node PASS**, 0 FAIL, 0 SKIP |
| Regresión acumulada: 12 suites Node, incluyendo Area3D/CharacterBody3D, Signals S04-S06, Multiscript G001-G003 y despachador | **241/241 Node PASS**, 0 FAIL, 0 SKIP (incluye las 18 nuevas) |
| `node scripts/gen-docs.mjs --check` | PASS — `referencia al día` |
| `scripts/test-node-signals-lifecycle-electron-s01-g002.mjs` | NO VERIFICADO — falta `node_modules/vite`; fixture y runner incluidos |
| `npm run build` | NO VERIFICADO — `vite: not found` |
| QA local del usuario | PENDIENTE |

Se reprodujeron inicialmente dos discrepancias en la nueva suite: (1) el orden observado de `ready` en hermanos seguía el orden inverso del SceneGraph, como exige el contrato; se corrigió la expectativa. (2) `node.connect('ready')` durante el `_enter_tree` del emisor fallaba porque la identidad de entrada se registraba después del callback. Se corrigió en `NodeLifecycle` y la prueba quedó PASS. No se ocultan ni se atribuyen a Jolt.

### Comandos QA local

```bash
npm ci
node --test scripts/test-node-signals-lifecycle-s01-g002.mjs
node --test scripts/test-node-signals-lifecycle-electron-s01-g002.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

**Esperado:** 18/18 nuevos Node; Electron WebGL2/Jolt WASM y comprobaciones `ready`, fuente sin script, conexión persistida, callback receptor, física Area3D, Stop. Validación visual en el Editor: `ready` debe figurar como nativa de tipos registrados; seleccionar nodo emisor y receptor con Script de Nodo que exponga un método antes de `_ready`, crear una conexión y entrar en Play; verificar una sola invocación tras inicialización, y Stop/Play sin duplicados. Validar que `body_entered/body_exited/area_entered/area_exited` continúan con sensor Jolt real.

**No concluir:** compilación no equivale a QA visual; que una fixture Node pase no confirma señales físicas ejecutadas en Electron. El comportamiento del sistema sobre métodos publicados después del evento requiere nuevos eventos reales, no reemisión del primero.

### Incidencias históricas fuera del Gate

La prueba de estilo `NE6-16` y seis fixtures Terreno/CSG previas estaban pendientes/heredadas. No se corrigen. Consola y UX Signals siguen sin modificaciones.

### Evidencia local posterior a la entrega G002 (usuario, 2026-11-02)

El usuario respondió **«Aprobado. Sigamos.»** e incluyó `Texto pegado(20261102-153348).txt` con `18/18 Node PASS`, runner Electron/Jolt WASM/WebGL2 `26` comprobaciones PASS, documentación al día, y ambos builds Vite Editor y Player PASS. Este resultado revierte únicamente el estado pendiente de G002; la incapacidad del entorno de generación para ejecutar Electron/compilación permanece como limitación histórica de su propia ejecución. El ledger G003 registra la aprobación local de G002 y su evidencia. No atribuir esos resultados a G003.
