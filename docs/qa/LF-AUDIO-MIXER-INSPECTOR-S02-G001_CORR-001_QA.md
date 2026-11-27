# LevelForge · LF-AUDIO-MIXER-INSPECTOR-S02-G001_CORR-001

**Autorización exacta:** `Listo. LF-AUDIO-MIXER-INSPECTOR-S02-G001_CORR-001 autoriza comenzar`

**SOURCE_BASELINE:** `LevelForge_AUDIO_MIXER_INSPECTOR_S02_G001_SOURCE_BASELINE.zip`. **Estado:** IMPLEMENTADO · TEST NODE PASS · QA LOCAL PENDIENTE · NO CERRADO. S02 anterior fue APROBADO PARCIALMENTE por el usuario.

## Incidencia observada

`AudioMixerInspector.vue` utilizaba `effectId` para cambiar entre dos pantallas excluyentes. Al seleccionar un efecto, el Inspector reemplazaba las propiedades de Master o del grupo por una sección de procesamiento, y aparecía el botón «Grupo» para regresar. El usuario solicitó mantener el Inspector del grupo siempre visible y expandir los controles de cada efecto bajo «Cadena de efectos», admitiendo varios abiertos simultáneamente.

## Corrección aplicada

- `AudioMixerInspector.vue`: las propiedades de grupo permanecen montadas. Cada efecto es un bloque desplegable en la misma cadena. El botón de su nombre alterna expandir/colapsar, con `aria-expanded`, controles identificados y teclado nativo.
- Cada bloque contiene activar/desactivar, subir/bajar en orden, eliminar, parámetros de `FX_TYPES` y presets de Reverb. No hay navegación a otra pantalla ni botón «Grupo».
- La expansión se guarda únicamente en estado local Vue de interfaz, nunca en `project.audio`. El Editor y FilmMaker siguen usando el componente Inspector común.
- Seleccionar un efecto desde Audio Mixer despliega su bloque, incluso si se vuelve a seleccionar el mismo efecto después de cerrarlo. Cambiar de grupo limpia las expansiones del anterior. Añadir efecto lo expande, eliminarlo elimina su estado desplegado.
- Se reutilizan las acciones existentes `updateAudioFx`, `moveAudioFx`, `removeAudioFx`, `addAudioFx`, `selectAudioInspector` y los presets existentes. No cambia el formato de snapshots, efectos ni el grafo WebAudio.
- Se ajustó la prueba histórica de S02 para reemplazar su única aserción sobre la vista de efecto ahora retirada. Se actualizó su fixture Electron para verificar la interfaz contractual nueva.

## Evidencia automatizada

- `scripts/test-audio-mixer-inspector-s02-corr001.mjs`: **17/17 Node PASS**; ejecuta lógica del `<script setup>` real con acciones existentes, expansión múltiple, selección externa, remoción, reorden, preset y edición de parámetros.
- `scripts/test-audio-mixer-inspector-s02-g001.mjs`: **18/18 PASS** después de actualizar una aserción del contrato antiguo.
- Regresión focal Audio / Legibilidad: **72 PASS, 0 FAIL, 8 SKIP** verificados en la ejecución final.
- Regresión amplia Audio / FilmMaker / Inspector: **288 PASS, 2 FAIL, 8 SKIP**; dos casos requieren dependencias ausentes: `test-filmmaker-anim-zip-s01-g001.mjs` (falta `jszip`) y `test-filmmaker-frame-ui-s01-g001.mjs` (falta Vite). El primero fue reproducido en el baseline anterior. No declarar la suite completa como PASS.
- Runner Electron `scripts/test-audio-mixer-inspector-electron-s02-corr001.mjs` y fixture Vue real con más de 30 verificaciones internas: **NO VERIFICADO** sin `node_modules`/Vite/Electron.
- Build Editor y Player: **NO VERIFICADO**.

## QA local (Linux, Electron)

Extraer el nuevo SOURCE_BASELINE en una carpeta independiente. Desde su raíz:

```bash
npm ci
node --test scripts/test-audio-mixer-inspector-s02-corr001.mjs
node --test scripts/test-audio-mixer-inspector-s02-g001.mjs
node --test scripts/test-audio-mixer-inspector-electron-s02-corr001.mjs
npm run build
npm run electron
```

Revisión manual necesaria:

1. Abrir Audio Mixer, seleccionar Master: su Inspector conserva Propiedades y Cadena de efectos simultáneamente.
2. Añadir Ecualizador y Eco; abrir ambos, modificar parámetros diferentes y comprobar que ambos permanecen desplegados.
3. Colapsar Eco, volver a seleccionar Eco desde su tira en Mixer y comprobar que se expande nuevamente sin abrir otra pantalla.
4. Activar/desactivar FX, reordenarlos, eliminarlos y añadir Reverb con preset; comprobar identidad y valores del efecto correcto.
5. Guardar, recargar proyecto, snapshots, reproducir audio con FX y verificar Play/Player. Expandir/cerrar no debe ensuciar el proyecto.
6. En FilmMaker, comprobar Inspector del grupo y expansión múltiple de efectos en modo escritorio y compacto.
7. Volver a un nodo normal y a otro grupo; no debe persistir el contexto de efectos del grupo anterior.

**Evidencia a devolver:** salida Node, Electron y build; captura de Inspector con Master y dos efectos expandidos; comprobación de FilmMaker y reproducción real. El usuario ejecuta el QA visual. No declarar QA LOCAL PASS ni CERRADO sin esa evidencia.

**Fuera del Gate:** unificación Inspector de Terrain, rediseño del motor de audio, ajustes de CSP y reparación de Jolt/pointer capture.

**Entrega:** exactamente dos ZIP, CHANGE con solo archivos nuevos/modificados y SOURCE_BASELINE completo. Mantener las seis hojas ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY sin borrar historial.
