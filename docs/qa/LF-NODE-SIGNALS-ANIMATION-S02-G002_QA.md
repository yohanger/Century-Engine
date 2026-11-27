# LF-NODE-SIGNALS-ANIMATION-S02-G002 — QA y evidencia

**Fecha:** 2026-11-02. **Estado:** IMPLEMENTADO · 22/22 NUEVAS NODE PASS · 345/345 REGRESIÓN FOCAL PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

| Prueba | Resultado |
|---|---|
| `scripts/test-node-signals-animation-s02-g002.mjs` | **22 PASS, 0 FAIL, 0 SKIP**. Estructura, clip natural, reemplazo, stop, loop, pausa, dos clips, identidad, sesión, Stop, ViewModel, Multiscript y colisión Custom |
| Suite Node focal 18 módulos, incluyendo Animation, Audio G001, Tree G003, Lifecycle G002, Signals S04-S06, Multiscript, Groups, CharacterBody3D/Area3D | **345 PASS, 0 FAIL, 0 SKIP** |
| `node scripts/gen-docs.mjs --check` | PASS (`referencia al día`) |
| `node --check` de módulos editados y fixture | PASS |
| `scripts/test-node-signals-animation-electron-s02-g002.mjs` | **NO VERIFICADO**, entorno sin `node_modules/vite`: `Falta Vite; ejecutar npm ci antes del QA` |
| `npm run build` | **NO VERIFICADO**, entorno sin Vite: `vite: not found` |
| QA local del usuario | PENDIENTE |

## QA Linux — SOURCE_BASELINE S02-G002

```bash
npm ci
node --test scripts/test-node-signals-animation-s02-g002.mjs
node --test scripts/test-node-signals-animation-electron-s02-g002.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

**Esperado Node:** 22/22 PASS. **Electron:** 30 o más verificaciones con WebGL2, Jolt WASM, `AnimRunner` real, `THREE.AnimationMixer`/`ModelRunner` real, `animation_finished(clipName)`, recepción de conexión persistente y ausencia de eventos en pausa, Stop, loop, reemplazo y cierre. La fixture **no importa un GLB real**; el usuario sí debe probar uno en el Editor o Player.

## QA manual de autoría y ejecución

1. En el Editor: seleccionar un nodo existente; abrir Signals; comprobar `animation_finished` y su firma de un string (`clipName`); conectar a un método `node.expose('onAnimation', fn)` del receptor (Script de Nodo). La UI visual no ha sido rediseñada todavía.
2. Reproducir un clip de claves LevelForge sin bucle: el método recibe el nombre correcto una única vez. Pausa, Stop, loop y sustitución no deben generar falsos eventos.
3. Reproducir clips GLB/GLTF importados sobre nodos con modelos. Verificar fin natural, dos capas diferentes si se admiten en ese modelo, Stop y reemplazo.
4. Abrir otra escena o detener y reiniciar: comprobar ausencia de eventos obsoletos y conexión persistente estable. Validar multiescript y un emisor sin Script propio.
5. Si un proyecto antiguo define una Custom Signal llamada `animation_finished`, comprobar diagnóstico de colisión sin pérdida de código ni datos; **no declararlo compatible hasta acordar migración**.

Enviar errores, pasos y evidencia si falla; la declaración «Aprobado» del usuario acredita QA LOCAL PASS sin exigir logs otra vez. El resultado de compilación no sustituye QA visual. No declarar G002 cerrado sin aprobación.

## Registro de G001 precedente

El usuario respondió **«Aprobado. Sigamos»** tras el paquete Audio S02-G001. Corresponde registrar **QA LOCAL PASS DECLARADO · APROBADO**. Los 15 casos Node propios y 345 PASS/8 SKIP siguen siendo la evidencia automatizada generada. **No hay nuevos logs Electron/build G001 adjuntos a esa aprobación**: no afirmar PASS de Electron ni compilación por inferencia. Este estado no convierte G002 en aprobado.
