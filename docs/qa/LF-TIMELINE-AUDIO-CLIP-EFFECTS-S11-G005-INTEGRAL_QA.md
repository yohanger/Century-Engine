# QA — LF-TIMELINE-AUDIO-CLIP-EFFECTS-S11-G005-INTEGRAL

Estado: IMPLEMENTADO. Node PASS; ELECTRON / BUILD / QA LOCAL / PLAYER NO VERIFICADOS. Gate NO APROBADO / NO CERRADO.

## Evidencia del entorno de generación
- `docs/qa/evidence/LF_S11_G005_NODE_FOCAL.log`: 25 PASS / 0 FAIL / 0 SKIP.
- `docs/qa/evidence/LF_S11_G005_NODE_TARGETED_REGRESSION.log`: 101 PASS / 0 FAIL / 5 SKIP (106). No se confundió SKIP con PASS.
- `docs/qa/evidence/LF_S11_G005_NODE_REGRESSION.log`: 117 PASS / 3 FAIL / 5 SKIP (125). AMI-15 y AMI-17 son aserciones históricas de la suite S02 no modificada, sobre una implementación anterior; el tercer fallo se produce antes de ejecutar G003 porque falta `@vue/compiler-sfc`.
- `docs/qa/evidence/LF_S11_G005_ELECTRON_ENV.log`: no arranca; falta `node_modules/vite/bin/vite.js`. **No constituye Electron PASS.**
- `docs/qa/evidence/LF_S11_G005_BUILD_ENV.log`: exit 127 `vite: not found`. **No constituye compilación PASS.**

## QA en la carpeta local del usuario (raíz con package.json)
Antes de aplicar CHANGE, comparar los archivos incluidos contra el SOURCE_BASELINE anterior y los cambios locales; respaldar cualquier divergencia. No sustituir el proyecto completo sin comparar.

1. Dependencias cuando sea necesario: `npm ci` (con Internet y las dependencias aprobadas del proyecto, sin alterar el lockfile).
2. Node focal: `node --test scripts/test-timeline-audio-clip-effects-s11-g005.mjs` — esperado 25 PASS, 0 FAIL.
3. Node de ruteo: `node --test scripts/test-timeline-audio-mixer-routing-s11-g004.mjs scripts/test-timeline-audio-mixer-routing-s11-g004-corr001.mjs` — esperado 25 PASS.
4. Electron embebido: `node --test scripts/test-timeline-audio-clip-effects-s11-g005-electron.mjs` — esperado 1 test PASS, al menos 40 comprobaciones internas, WebGL y Web Audio reales.
5. Build completo: `npm run build` — requieren finalizar ambas etapas: `vite build` y `vite build --mode player`.
6. UI real: `npm run electron` — en una escena/proyecto de prueba EXISTENTE, abrir Timeline, seleccionar clave Audio Play, comprobar edición y persistencia de un EQ/eco/reverb y reproducción auditiva. No hacer esta prueba con un proyecto valioso sin respaldo.
7. Reproducir dos claves Audio simultáneas con procesadores diferentes, enviadas al mismo bus. Comprobar que solo cada una recibe sus propios FX y que los FX del bus siguen aplicando a ambas. Probar desactivar, reordenar, eliminar, volumen y Stop.
8. Pausar y reanudar Preview, seleccionar otra clave, cambiar a Mixer, arrastrar el cabezal y verificar transporte junto al reloj. Comprobar Stop sin cola residual indeseada. Reabrir el proyecto y escuchar en el Player real; conservar evidencia visual/auditiva separada de Node/Build.

## Aceptación
- FX-01..FX-11 del Gate: ocho tipos, edición de clave, aislamiento por voz, audio antiguo sin FX, bus posterior, Preview y Player, pausa/Stop, guardado/reapertura, forma de onda fuente sin alteraciones y ausencia de regresiones nuevas.
- El usuario devuelve logs de Node/Electron/build y resultado del QA local en Editor y Player (capturas/logs si hay incidencias).
- Solo tras QA LOCAL PASS declarado y aprobación explícita se actualiza G005 a APROBADO/CERRADO. Si falla se declara un Gate CORR específico.
