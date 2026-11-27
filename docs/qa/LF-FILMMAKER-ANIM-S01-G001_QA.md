# LF-FILMMAKER-ANIM-S01-G001 — QA

Estado al 2026-10-29: IMPLEMENTADO · 129/129 TEST NODE PASS · BUILD NO VERIFICADO · QA ELECTRON NO VERIFICADO · NO CERRADO.

## Comandos de regresión (ejecutados)

```bash
node --test scripts/test-filmmaker-anim-s01-g001.mjs scripts/test-filmmaker-ux-s01-g002-corr001.mjs scripts/test-filmmaker-ux-s01-g002.mjs scripts/test-filmmaker-frame-s01-g001.mjs scripts/test-road-material-s01-g001.mjs scripts/test-editor-safety-s01-g001.mjs scripts/test-editor-safety-s01-g002.mjs scripts/test-vfx-editor-s03-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs
```

129/129 PASS; 0 FAIL; se corrigieron cuatro aserciones históricas que daban `.nfm` v2 como versión fija en vez de comprobar la migración v3 exigida por el nuevo Gate. No se relajaron los demás checks.

## Comandos que requieren la instalación local

```bash
npm ci
node --test scripts/test-filmmaker-anim-zip-s01-g001.mjs
npm run build
npm run filmmaker
```

La prueba JSZip contiene un archivo de proyecto opaco simulado, sin escribir assets ni escenas de ejemplo en el producto.

## Checklist local

- [ ] Abrir un `.nfm` v1/v2 y guardar: formato v3, sin pérdida de cámara, passes, takes, filtros, audio ni frame.
- [ ] Abrir `.nfm` v3 con pistas por ID y comprobar restauración de posiciones/rotaciones/escalas al detener.
- [ ] Seek 1 → 0 → 0.6 s: misma pose a 0.6 s que seek directo, incluidos cortes de cámara.
- [ ] Renombrar nodo: conserva su ID y su pista; eliminar nodo: da advertencia y no enlaza por nombre.
- [ ] Guardar después de preview: las transformaciones temporales NO aparecen en `overrides` ni en `scene.lfproj`.
- [ ] Comprobar rechazo de actor filmado y cuerpos físicos (nunca dos escritores de Transform).
- [ ] Importar `.nfm` con nodeTracks a LevelForge Editor: error explícito de función S02 pendiente; no importa una película incompleta.
- [ ] Montajes antiguos, cámara, clima, audio, timeline y eventos sin regresiones.
- [ ] QA a 1440×900, 1280×720, 1024×768 en GPU real con un proyecto desechable.
- [ ] Guardar y reabrir `.nfm` real con JSZip y verificar ease, claves, ID y resolución.

## Límites de evidencia

El test Node de FilmNodePose utiliza un doble Object3D ligero y el `sampleTrack()` real. No representa una ejecución de Three.js/Electron en pantalla. No se ha ejecutado todavía `packNfm` con JSZip real ni una compilación. La primera fase permite previsualizar pistas que existan en el archivo pero **no** permite crearlas desde la UI; eso es exclusivamente S01-G002.
