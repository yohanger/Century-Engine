# QA · LF-CLOUD-STORM-S00-G001

**18-11-2026 · implementación de fuente entregada · revisión visual pendiente**

## Fuentes, integridad y autorización

- Autorización literal recibida del usuario para este Gate, exclusivamente.
- `source_baseline.zip` (3.868 entradas) y `threejs-lightning-storm-main.zip` (21 entradas): CRC PASS.
- Fuente de referencia externa usada solo para estudiar intención visual; NO se copiaron texturas con atribución Vecteezy ni recursos sujetos a licencia no verificada.
- SOURCE_BASELINE original extraído en una copia independiente antes de alterar archivos; pruebas históricas contrastadas contra control original.

## Comandos y resultados

| Comando/verificación | Resultado | Evidencia |
|---|---|---|
| `node --check` sobre cuatro módulos de producción | PASS | Sintaxis JS conforme |
| `node --test scripts/test-cloud-storm-s00-g001.mjs` | 8/8 PASS | Contrato del frente y de las descargas |
| `node --test scripts/test-cloud-storm-s00-g001.mjs scripts/test-weather-lightning-world-s11-g001.mjs scripts/test-cloud-evolution-s01-g001.mjs scripts/test-cloud-natural-3d-morphology-corr001.mjs scripts/test-weather-storm-activation-contract-g001.mjs` | 75/75 PASS, 0 FAIL | `docs/qa/evidence/LF_CLOUD_STORM_S00_G001/qa-focused.log` |
| Importación de `SKY_FRAG/SKY_VERT` y compilación/enlace mediante EGL surfaceless Mesa OpenGL 4.5 (GLSL 430 adaptado) | VERT PASS, FRAG PASS, LINK PASS | `docs/qa/evidence/LF_CLOUD_STORM_S00_G001/qa-glsl-mesa.log` |
| `npm run build` | BLOQUEADO · exit 127, `vite: not found` | Sin `node_modules` en entorno de ejecución |
| `node --test scripts/test-cloud-light-electron.mjs` | NO EJECUTADO | Requiere Electron, Three/Vite instalados y WebGL2 |
| Test gráfico en el mismo `cloud-light.html` | PREPARADO · 4 nuevas comprobaciones | A/B durante aproximación, durante descarga y cuando finaliza; no es evidencia visual ejecutada |
| Play/Runtime, captura gráfica, FPS, fallos GPU | NO VERIFICADO | Repetir en equipo local |

### Regresiones históricas y límites de la línea base

En la ejecución de la batería amplia (140 tests), se observaron 6 fallos recurrentes que también se reproducen en la **copia intacta del SOURCE_BASELINE**: uno en el runner de artefacto negro, tres en contratos que intentan leer el archivo ausente `src/engine/runtime/player/fps/movement.js`, y dos del runner antiguo `WU2` que evalúa `viewport-env.js` en VM sin proporcionar `stormCoverFromFrame`. Estos fallos preexistentes no son PASS y no acreditan regresión nueva. Durante una ejecución amplia apareció además `SA-02` intermitente de lluvia local; el mismo test PASS en repetición focal. No se ha probado su causa raíz; las pruebas focales consolidadas fueron 75/75 PASS.

**No se modifica el código o fixture histórico ajeno al Gate para esconder estos fallos.** Los 8 tests nuevos y los 75 focales quedan en PASS. No se declara batería amplia íntegra en PASS.

## Procedimiento de QA local solicitado

1. Descomprimir SOURCE_BASELINE completo, ejecutar `npm ci` usando el `package-lock.json` existente; luego `npm run build` (Editor y Runtime) y registrar el resumen de módulos y los errores reales.
2. `node --test scripts/test-cloud-storm-s00-g001.mjs` y `node --test scripts/test-cloud-light-electron.mjs`; verificar las 20 comprobaciones mínimas y ninguna salida de shader en `renderer.debug.onShaderError`.
3. `npm run electron`. En Play/Runtime, seleccionar clima `partly`, programar `storm` con 20 segundos, observar aproximación desde dirección contra viento. Comprobar que la cobertura y el oscurecimiento progresan, sin sky negro, flicker o nube plana adicional.
4. En modo `physical`, forzar `game.weather.strike` o la vía de descarga existente. Verificar canal visible, iluminación localizada en cúmulos, dos/tres pulsos coherentes con `World.flash`, trueno diferido y ausencia de un segundo relámpago artificial.
5. Mover cámara durante un rayo; comprobar que no se traslada la fuente. Probar clima `clear`, `storm`, sin rayos, rayos simples y una escena con tornado en formación.
6. Verificar Edit Mode estático, Play/Stop, cambio de escena, Player exportado y Weather Director. Comparar A/B con baseline a resolución y configuración iguales. Documentar FPS, tiempos GPU de 'Cielo atmosférico', memoria y capturas.

## Estado de cierre

**IMPLEMENTADO EN FUENTES · TEST NODE PASS · GLSL COMPILE/LINK PASS (MESA, NO WEBGL2) · NO COMPILADO VITE · QA VISUAL/ELECTRON/PLAYER NO VERIFICADOS · PENDIENTE APROBACIÓN/CERRADO NO.**
