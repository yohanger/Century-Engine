# LF-NODE-SIGNALS-NATIVE-CATALOG-S01-G001 — QA

**Fecha:** 2026-11-02. **Estado:** IMPLEMENTADO · TEST NODE PASS · ELECTRON NO VERIFICADO · BUILD NO VERIFICADO · QA LOCAL PENDIENTE · NO CERRADO.

## Verificaciones ejecutadas

| Comprobación | Evidencia | Resultado |
|---|---|---|
| Registro de cuatro nativas Area3D, metadata, fuente y firma | `scripts/test-node-signals-native-catalog-s01-g001.mjs` | 18/18 Node PASS |
| Regresión Area3D, custom, conexiones visuales S06 y Multiscript | 9 módulos históricos (uno con harness de importación adaptado) | 181/181 Node PASS |
| Regresión focal acumulada | 10 módulos Node | **199/199 PASS · 0 FAIL · 0 SKIP** |
| Generación/referencia documental | `node scripts/gen-docs.mjs --check` | PASS |
| Electron/WebGL2/Jolt WASM con sensor existente | `scripts/test-node-signals-native-catalog-electron-s01-g001.mjs` y fixture HTML | **NO VERIFICADO**: falta `node_modules/vite` |
| `npm run build` Editor y Player | Comando ejecutado | **NO VERIFICADO**: `vite: not found` |
| UI visual y QA local del usuario | Pruebas locales pendientes | PENDIENTE |

### Ejecutar QA local

```
npm ci
node --test scripts/test-node-signals-native-catalog-s01-g001.mjs
node --test scripts/test-node-signals-native-catalog-electron-s01-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

**Resultado esperado Node:** 18 PASS, 0 FAIL. **Electron:** comprobar 20+ verificaciones de WebGL2, Jolt WASM, metadata, un listener nativo por señal, payload, liberación al desconectar/Stop y ausencia de fuentes inventadas. El harness usa Electron del proyecto, sin Chromium/Brave externo. Electron no simula pruebas visuales del Editor completo, solo una fixture de integración y WebGL2.

### QA manual

Seleccionar `Area3D` con sensor, comprobar que se ven únicamente las cuatro señales nativas y que una conexión real en Play llega al receptor sin cambiar el payload. Seleccionar `StaticBody3D` y comprobar que no aparecen señales físicas falsas. Probar desconexión/Stop y conexión persistente. No exigir rediseño visual en G001.

### Riesgos conocidos y exclusiones

- El orden de conexiones frente a `_ready()` permanece sin cambio y deberá resolverse antes de añadir señal `ready`.
- Custom Signals sin conexiones siguen sin descubrirse en Edit Mode; el Gate de UX/metadata futura resolverá ese requisito.
- Las señales de Shape, señales comunes de Node, audio y física adicionales **NO ESTÁN IMPLEMENTADAS**.
- El harness histórico `scripts/test-node-character-area-s04-g001.mjs` fue adaptado para resolver imports de `data:` URL e inicializar el registro físico. Sus 28 pruebas forman parte de las 181 de regresión.

- La incidencia heredada `NE6-16` y seis fixtures Terreno/CSG previas quedan fuera del alcance.
- Consola del Editor y la pestaña Terreno **sin cambio**.

QA automatizado no sustituye QA local. El usuario deberá aprobar este Gate para marcarlo APROBADO/CERRADO. Actualizar ledger sin borrar evidencia anterior.
