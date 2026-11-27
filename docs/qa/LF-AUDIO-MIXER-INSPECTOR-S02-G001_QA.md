# LF-AUDIO-MIXER-INSPECTOR-S02-G001 — Informe de implementación y QA

**Autorización exacta:** `Listo. LF-AUDIO-MIXER-INSPECTOR-S02-G001 autoriza comenzar`.
**SOURCE_BASELINE contractual:** `LevelForge_EDITOR_PROPERTY_READABILITY_S01_G001_SOURCE_BASELINE.zip`.
**Estado:** IMPLEMENTADO, TEST NODE PASS; BUILD, Electron/WebGL y QA local NO VERIFICADOS; NO CERRADO.

## Diagnóstico observado

`AudioMixer.vue` contenía una tercera columna de 280 px con un Inspector propio y dos refs locales `sel/selFx`. `Inspector.vue`/`InspectorDock.vue` ya proporcionaban la edición de propiedades del editor. `FilmApp.vue` reutilizaba `AudioMixer` y abría `Inspector.vue` directamente. Los cambios de audio pertenecen a `store.project.audio` y a los métodos existentes `state/audio.js`; duplicar formularios daría lugares divergentes para editar los mismos datos.

## Implementación dentro de S02

- `AudioMixer.vue` mantiene la lista de grupos y snapshots, canales Master y otros, faders, `MixerMeter`, botones Solo, Mute y Bypass, e indicadores seleccionables y de activación de efectos. Se elimina el tercer panel de propiedades y sus 280 px reservados; se retiran de las tiras la creación detallada de efectos y selección de salida, que ahora están en el Inspector.
- `AudioMixerInspector.vue` contiene la **única** edición detallada para grupos (nombre, color, volumen, mute/bypass, salida, cadena de efectos) y FX (habilitar, sliders para todos los parámetros del catálogo, reordenar, eliminar, presets Reverb). Se monta en `Inspector.vue` sin introducir otro dock ni estado de audio paralelo.
- `state/audio.js` expone `selectAudioInspector` / `audioInspectorTarget`: selección efímera `{ groupId, effectId }` que nunca se guarda en `project.audio`. Todas las mutaciones usan `updateAudioGroup`, `setGroupParent`, `addAudioFx`, `removeAudioFx`, `moveAudioFx`, `updateAudioFx` existentes. La eliminación de un FX limpia su identidad seleccionada.
- `state.js` invalida la selección efímera al cambiar de proyecto o elegir otro recurso. `selectObject` la limpia al seleccionar objetos o escena.
- `FilmApp.vue` usa los mismos componentes sin clonar propiedades. Al seleccionar un grupo o efecto, el Inspector derecho se activa en escritorio; en ancho estrecho se abre la hoja Inspector para editar, con acceso posterior al Mixer mediante navegación existente.
- No se modifican los procesadores Web Audio, el runtime/Player, los snapshots ni el formato de datos persistidos.

## Evidencia automatizada

- `node --test scripts/test-audio-mixer-inspector-s02-g001.mjs`: **18/18 PASS**, selección con métodos reales evaluados, integridad de snapshots, limpieza de FX y composición Editor/FilmMaker.
- Regresión focal (6 suites de audio y legibilidad): **80 PASS / 0 FAIL / 8 SKIP**. Los SKIP se deben a dependencias no disponibles; no contabilizarlos como PASS.
- Regresión extendida (Inspector, FilmMaker, Audio, escenas): **324 PASS / 9 FAIL / 8 SKIP**. Los 9 FAIL se reproducen idénticos en el SOURCE_BASELINE anterior: 8 tests EI de extracción de código mediante `vm`, 1 prueba FilmMaker que requiere Vite. No se han corregido fuera del alcance.
- `scripts/test-audio-mixer-inspector-electron-s02-g001.mjs` y `scripts/fixtures/audio/mixer-inspector-s02.html`: Electron con Vue e Inspector reales, **NO VERIFICADO**, runner se detiene por `Falta Vite; ejecutar npm ci antes del QA`.
- `npm run build`: **NO VERIFICADO** (`vite: not found`). La comprobación GPU y el audio real no se han ejecutado en este entorno.

## QA obligatorio en el equipo del usuario

Desde la raíz del nuevo SOURCE_BASELINE:

```bash
npm ci
node --test scripts/test-audio-mixer-inspector-s02-g001.mjs
node --test scripts/test-editor-property-readability-s01-g001.mjs
node --test scripts/test-audio-mixer-inspector-electron-s02-g001.mjs
npm run build
npm run electron
```

Resultados esperados: 18/18 Node, 15/15 PR1 Node, 1/1 Electron con al menos 16 comprobaciones internas, Editor y Player compilados. Luego:

1. Seleccionar **Master** en Audio Mixer: el Inspector general muestra su nombre, color, volumen, bypass y cadena; el canal Master, su fader y medidor permanecen en Mixer.
2. Seleccionar Música, SFX, Voz, Ambiente y UI. Editar nombre/color de un grupo personalizado, salida y volumen; comprobar sincronización inmediata de las tiras.
3. Añadir Eco, Compresor, Reverb y otro efecto **desde el Inspector**. Seleccionar efectos desde las tiras. Modificar parámetros, activar/desactivar, reordenar, eliminar y regresar al grupo. Confirmar que el audio reproduce cambios reales.
4. Guardar y cargar un snapshot; sus volúmenes y parámetros de FX deben reflejarse en ambos paneles. Guardar/recargar proyecto; no cambiar el formato de audio.
5. Seleccionar un nodo, escena o recurso después de audio: el Inspector debe mostrar el nuevo contexto, no quedar retenido en Master.
6. Abrir FilmMaker escritorio y pantalla estrecha; seleccionar canal y FX. Inspector accesible sin panel interno; comprobar playback, selección al cerrar y reabrir la hoja y presets.
7. Verificar que desaparece la tercera columna del mezclador incluso con dock pequeño y que el mezclador no genera scroll horizontal artificial adicional.

Entregar salida de Node, Electron, build, capturas de Mixer con Master y del Inspector con Eco/Reverb, prueba de FilmMaker y resultado de escucha/export Player. No declarar QA local PASS sin evidencia.

## Dependencias fuera de alcance

El Gate `LF-TERRAIN-INSPECTOR-UNIFICATION-S03-G001` permanece **PENDIENTE**: no se elimina ahora la pestaña Terreno. `setPointerCapture`, otros avisos Electron y los 9 FAIL heredados pertenecen a áreas ajenas y no se presentan como resueltos.

## Entrega LevelForge

Exactamente dos ZIP: CHANGE con los archivos nuevos/modificados y SOURCE_BASELINE completo. Sin `node_modules`, builds, cachés ni scripts `.sh`. Conservar los proyectos del usuario y el baseline anterior para comparar.
