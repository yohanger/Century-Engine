# LF-NODE-SIGNALS-TREE-S01-G003 — QA y evidencia

**Fecha:** 2026-11-02. **Estado:** IMPLEMENTADO · NODE 308/308 PASS · ELECTRON NO VERIFICADO · BUILD NO VERIFICADO · QA LOCAL PENDIENTE · NO CERRADO.

| Verificación | Evidencia / resultado |
|---|---|
| Suite G003, `scripts/test-node-signals-tree-s01-g003.mjs` | **22/22 Node PASS**, 0 FAIL |
| Regresión conjunta 16 suites (incluida G003, Signals S04-S06, G001/G002, Multiscript G001-G003, métodos, Groups, CharacterBody3D/Area3D) | **308/308 Node PASS**, 0 FAIL, 0 SKIP |
| Sintaxis de producción y fixture Electron | PASS (`node --check`) |
| `node scripts/gen-docs.mjs --check` | PASS — `referencia al día` |
| `scripts/test-node-signals-tree-electron-s01-g003.mjs` | **NO VERIFICADO**, el runner informa `Falta Vite; ejecutar npm ci antes del QA` |
| `npm run build` | **NO VERIFICADO**, `vite: not found` |
| QA visual y funcional local | PENDIENTE DE USUARIO |

### Comandos de QA local

```bash
npm ci
node --test scripts/test-node-signals-tree-s01-g003.mjs
node --test scripts/test-node-signals-tree-electron-s01-g003.mjs
node --test scripts/test-node-signals-lifecycle-s01-g002.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

**Esperado:** 22 pruebas Node G003 PASS. Electron comprueba WebGL2 y carga de Jolt WASM real, metadata nativa, conexión persistente `tree_entered`, `_exit_tree` y entrega de `tree_exiting` antes del desmontaje, `tree_exited` después, preservación de señales físicas Area3D, desconexión y Stop. Build Editor y Player PASS si el entorno está configurado.

**QA manual:** en Inspector seleccionar cualquier nodo registrado; confirmar las tres señales del árbol junto a `ready`. Crear emisor sin script, receptor con método `node.expose()` declarado en evaluación, conectar `tree_entered`, `tree_exiting`, `tree_exited`. Entrar en Play, eliminar/desechar el emisor mediante una operación válida del juego, comprobar entrega en orden y que no se repita al detener la ejecución. Probar subárbol padre/hijo, Multiscript y cambio de escena. Si falla, devolver pasos, captura y salida pertinente.

**Separación de evidencia:** las compilaciones y Electron locales de G002 adjuntadas por el usuario son PASS de **G002**, no de G003. No registrar PASS, FIXED ni CERRADO en G003 antes de su QA.

### Riesgos históricos fuera del Gate

Advertencias de bundles Vite y 31 vulnerabilidades reportadas por `npm ci` del usuario siguen pendientes de auditoría separada; no se actualizan dependencias sin autorización. Los tests históricos de Terreno/CSG y CSS fuera de alcance no se modifican. Limpieza de Consola queda al final, tras Signals y Terreno.

### Aprobación posterior del usuario (2026-11-02)

El usuario confirmó **«Aprobado. Sigamos.»** después de la entrega G003. Se registra como **APROBADO / QA LOCAL PASS declarado**, sin incidencias reportadas. El resultado de 308/308 Node PASS pertenece a la evidencia automatizada previa. Los logs Electron y build específicos de G003 no están presentes en el mensaje de aprobación; por eso siguen sin atribuirse resultados automatizados nuevos. Ledger actualizado durante Audio S02-G001.
