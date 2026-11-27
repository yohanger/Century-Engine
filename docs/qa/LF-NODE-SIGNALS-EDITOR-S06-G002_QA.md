# LF-NODE-SIGNALS-EDITOR-S06-G002 — QA

**Estado:** 19/19 pruebas nuevas NODE PASS · 151/151 regresión focal conjunta PASS · COMPILADO NO VERIFICADO · ELECTRON/JOLT NO VERIFICADO · QA LOCAL PENDIENTE · NO CERRADO.

## Comandos desde la raíz

```bash
node --test scripts/test-node-signals-editor-s06-g002.mjs
node --test scripts/test-node-signals-editor-electron-s06-g002.mjs
npm run build
npm run electron
```

Para Electron: ejecutar primero `npm ci` y utilizar Electron embebido; no se requiere Chromium/Brave externo.

## Casos

PERSIST-01–08: escenas anteriores, plantilla, valida campos/duplicados, separación del proyecto, migración v2/v3 y copia aislada. PERSIST-09–17: espera hasta después de `_ready`, no duplicación, destrucción/recreación, identidad, reparentado, diagnósticos, Stop, cambio de escena y actualización de vínculo. PERSIST-18–19: protección de formatos y continuidad de guardado/copia. E01: Electron con WebGL2 + Jolt WASM real, señales nativas y custom desde `_ready`.

## Regresión y límites

Suite seleccionada: 151 PASS, 0 FAIL, 0 SKIP. La nueva prueba sola: 19 PASS. No se pudo lanzar Vite (`vite: not found`). No se han ejecutado aquí exportación real, prueba de IndexedDB ni QA visual/Player; quedan **NO VERIFICADOS** para la prueba local. Los asserts de conservación `.lfproj`/Player se apoyan en rutas de serialización existentes: sin prueba de empaquetado extremo a extremo ejecutada por falta de dependencias.

## QA de usuario

Probar con escena que tenga custom signal declarado en `_ready`, receptor publicado en `_ready`, y Area3D sin script emisor. Guardar, cerrar, reabrir, Play/Stop, cambiar escena, recrear nodos con igual ID y Player exportado. Verificar error explícito ante conexión a método ausente. Confirmar que formatos aún no integrados rechazan exportación incompatible, sin pérdida silenciosa. Registrar QA LOCAL PASS solo tras «Aprobado» del usuario.

## Aprobación posterior del usuario (2026-11-01)

El usuario respondió «Aprobado. Sigamos.» después de recibir G002. Conforme a su regla de QA, ello constituye **QA LOCAL PASS declarado por el usuario y APROBADO**. El resultado de Electron y compilación de este entorno permanece **NO VERIFICADO**, sin reinterpretarlo como PASS técnico. La integración G004 sigue pendiente.
