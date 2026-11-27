# LevelForge · GLOBAL-PLAYBACK-ROOT-CAUSE-G001 · CA-005 ratificada

**Estado:** IMPLEMENTADO EN FUENTES · TEST NODE SELECT PASS · COMPILACIÓN Y QA LOCAL NO VERIFICADOS · CORR-003 ABIERTO.

**SOURCE_BASELINE:** GLOBAL_PLAYBACK_ROOT_CAUSE_G001 de 3.138 entradas ZIP; integridad CRC verificada antes de modificar.
**Proyecto del usuario:** `proyecto_3.zip` analizado, nunca incorporado ni modificado. El test reducido conserva la semántica de dos cámaras, claves `camera.main=false/true`, con el cambio en t≈3.967 s.
**Autoridad:** CA-005-PLAYBACK-INDEPENDENCE ratificada 2026-11-11; S15-G005 CORR-001 solo queda desplazado en los puntos contradictorios. Gate autorizado GLOBAL-PLAYBACK-ROOT-CAUSE-G001.

## Diagnóstico y corrección

- **OBSERVADO:** `TimelinePreview.animatedCameraPose()` priorizaba `selectedTrack`/`selectedNodeId` y no `camera.main` temporal; `pause()` apagaba `previewEnabled` y restauraba poses; selección/activación de herramienta/panel cedían Preview.
- **CAUSA RAÍZ ACOTADA:** la autoridad del Preview estaba ligada a estado editorial y a la política de pausa previa. El evaluador de pistas del Editor y el Player ya recorría todas las pistas sin filtrar por selección. No se afirma que todas las familias de nodos compartieran exactamente esta causa.
- **IMPLEMENTADO:** `animatedCameraPose` usa `timelineMain` aplicado por el propietario `camera.main` o su valor autoral. Si hay dos principales válidas no elige arbitrariamente. La toma explícita mantiene su lease prioritario.
- **IMPLEMENTADO:** `pause()` conserva la pose temporal; seleccionar nodos, abrir Timeline y cambiar herramientas no ceden Preview. `yieldToEditing()` queda reservado para la acción explícita de editar pose autoral o edición de claves autorizada. Un control en la barra permite volver al Preview; no crea estados ni gestores.
- **IMPLEMENTADO:** `_mainCameraNode()` del Player detecta conflicto de cámaras principales efectivas durante una animación temporal, sin alterar Camera Orchestration ni FilmMaker.
- **NO TOCADO:** serialización `.lfproj`, proyectos del usuario, Jolt, Materiales, audio, Cinematics, importación, exportación o dependencias externas.

## Evidencia automatizada de esta intervención

- Reproducción previa: 2 PASS / 3 FAIL, preservada en `node-regression-2-pass-3-fail.log`.
- Batería seleccionada tras CA-005: **309 PASS / 0 FAIL / 0 SKIP**, `node-ca005-regression-309-pass.log`. Incluye las tres pruebas que fallaban, pruebas históricas reconciliadas, 9 casos nuevos sobre dos objetos, dos luces, varias cámaras, conflictos de principal y Player, CORR-003 y S15-G007.
- Sintaxis Node JS de módulos modificados y extracción `<script setup>` de `App.vue` y `TimelinePanel.vue`: PASS. No equivale a compilación Vue.
- `npm run build`: **NO VERIFICADO** (salida 127, `vite: not found`; dependencias no instaladas). Evidencia `build-ca005-vite-absent.log`.
- Editor Electron y Player AppImage: **NO VERIFICADOS**. No se ha simulado GPU ni Jolt real.

## QA local obligatorio (usuario)

1. Abrir `proyecto_3` en la nueva copia de LevelForge. Sin seleccionar cámara, Play y verificar cambio a Cámara 2 cuando `camera.main=true` (~3.967 s). Probar también Cámara 1 seleccionada y otra pista seleccionada.
2. Crear o usar una escena con dos objetos (movimiento) y dos luces (energía/color). Iniciar Play sin selección y cambiar entre Jerarquía, Inspector, herramientas y pestañas: ninguna pista habilitada debe detenerse.
3. Pausar en un tiempo intermedio: pose congelada, sin restauración. Seek en pausa: actualizar todas las pistas. Reanudar sin salto.
4. Usar explícitamente **Editar pose autoral** durante Pausa: recuperar gizmos y valores de autoría sin modificar claves. Volver a vista previa al mismo tiempo.
5. Comprobar pista muteada, cambio de Camera3D, tomas explícitas, Camera Orchestration y Shake, loop y STOP con restauración de snapshots.
6. Guardar, cerrar/reabrir y repetir. Verificar Editor Electron y Player AppImage **independiente**, con revisión de consola y `game.log`.

### Comandos locales desde la raíz con `package.json`

```bash
npm ci
node --test scripts/test-timeline-global-playback-ca005-g001.mjs scripts/timeline-global-playback-root-cause-g001-red.mjs scripts/test-camera-orchestration-s15-g005-corr001.mjs scripts/test-camera-orchestration-s15-g007.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr003*.mjs scripts/test-camera-shake-s01-g004.mjs
npm run build
npm run electron
```

**Cierre:** los PASS Node no son QA local. `GLOBAL-PLAYBACK-ROOT-CAUSE-G001` y `CORR-003` siguen ABIERTO hasta que el usuario entregue evidencia visual y apruebe. No reabrir propiedades de Timeline sin defectos reales.
