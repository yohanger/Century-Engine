# QA G008-CORR-001 — Universal Keyframes

Fecha: 2026-11-10. **Estado:** 113/113 Node seleccionados PASS; Electron, build Editor/Player, Player independiente y QA visual **PENDIENTES**. El usuario es quien ejecuta pruebas locales. No confundir pruebas estáticas con runtime.

## 1. Comandos desde la raíz del proyecto (carpeta con package.json)

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-universal-corr001.mjs
```
**Esperado:** 24 PASS.

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g006.mjs scripts/test-timeline-property-animation-s13-g008-g007.mjs scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs scripts/test-timeline-property-animation-s13-g008-g008.mjs scripts/test-timeline-property-animation-s13-g008-g008-universal-corr001.mjs
```
**Esperado:** 113 PASS, 0 FAIL.

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-universal-corr001-electron.mjs
```
**Esperado:** 30 comprobaciones Electron/InspectorDock/WebGL PASS (**NO EJECUTADAS** en este entorno). No inventar PASS por tener fixture preparado.

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-electron.mjs
npm run build
npm run electron
```
**Esperado:** 20 comprobaciones Electron G008 previas, builds Editor + Player correctos, arranque en Electron embebido. No cambiar Electron por navegador externo.

La prueba runtime Three.js de G007 continúa como evidencia independiente:

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g007-runtime.mjs
```
No certifica por sí sola el acceso directo no mediado a `object3D`; revisar la reserva G007 antes de declarar cierre.

## 2. Matriz específica de aceptación

| ID | Prueba | Esperado |
|---|---|---|
| UA-01 | Nodo ficticio QA con descriptor `props.pulse` | Registro desde node registry; cero código por tipo en Timeline/Inspector |
| UA-02 | Nodo de otra clase con el mismo ID de propiedad | Rechazo de elegibilidad; no pisa datos |
| UA-03 | Control genérico del Inspector | Llave operativa solo con Timeline editable |
| UA-04 | Primer clic | Crea pista `node` con `sceneId`, ID y propiedad |
| UA-05 | Misma marca temporal | Actualiza key conservando ID, sin duplicar |
| UA-06 | Recurso bloqueado | No muta datos |
| UA-07 | Valores inválidos o rutas no declaradas | Rechazo tipado |
| UA-08 | Captura del Inspector | Lee dato autoral, no pose modificada por preview |
| UA-09 | Valor Timeline a tiempo intermedio | Muestra lineal/ease a través de evaluador existente |
| UA-10 | Snapshot de propiedad nueva | Restauración exacta al terminar Preview o reproducción |
| UA-11 | Animation Clips simultáneo | No sobreescribe propiedad reservada; otras pistas continúan |
| UA-12 | Guardar/cargar Timeline | Misma identidad e IDs, ningún campo antiguo perdido |
| UA-13 | Inspector Jerarquía, mismo nodo tras Timeline/Cinematics | Primer clic y sin selección obsoleta |
| UA-14 | Cinco llaves anteriores | Conservan posición/rotación/escala/luz con labels válidas |
| UA-15 | No Timeline o FilmMaker | Llaves inactivas/ausentes y sin writes |
| UA-16 | Nodo Jolt dinámico | No transforma arbitrariamente ni crea kinematic |
| UA-17 | Camera Orchestration y Cinematics | Sin cambiar autoridad ni Player |
| UA-18 | Event Loop/render | No iterar propiedades globales por fotograma |
| UA-19 | Error de descriptor/snapshot | Error observable, no creación de datos fantasma |
| UA-20 | Editor+Player | Código compartido y compilación, sin segunda implementación |

## 3. Pruebas visuales manuales

1. Abrir Timeline, seleccionar luz o Mesh; verificar llaves a la derecha de campos originales.
2. Mover cabezal y pulsar llave; verificar pista única, clave temporal, Undo/Redo y nuevo valor.
3. Desde Inspector de Cinematics volver a seleccionar **el mismo nodo**; propiedades deben aparecer al primer clic.
4. Comprobar que sin Timeline editable, al estar reproduciendo o con pista incompatible no se presenta llave operativa.
5. Guardar/reabrir proyecto, previsualizar, detener, ejecutar Play Mode y comprobar que el editor no conserva pose temporal ni modifica el archivo autoral.
6. Revisar Editor/Player de forma independiente y confirmar que FPS template, cámaras, audio, Jolt y `.ui` no han sufrido regresiones.

El nodo de QA `qa-universal-node` es una definición **solo de fixture Electron**, no un nodo de producción disponible en menú del Editor.

## 4. Evidencia solicitada al usuario

Copiar las salidas de los comandos Node/Electron/build anteriores y describir resultados. Captura o vídeo del Inspector al primer clic, inserción de keyframe, Undo/Redo, preview y Play Mode. Indicar explícitamente incidencias. **G007 y G008 originales NO cerrados** por estas pruebas.
