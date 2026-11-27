# QA de LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-INSPECTOR-KEYFRAMES-SELECTION-INTEGRAL

**Estado:** pruebas Node ejecutadas PASS; build/Electron/QA local NO VERIFICADOS. No cerrar G007 ni G008 sin evidencia y aprobación explícita.

## Preparación

Desde la carpeta del proyecto que contiene `package.json` (CHANGE debe haberse aplicado tras comparar modificaciones locales):

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008.mjs
```

**Esperado:** 24 tests PASS; 0 FAIL.

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g006.mjs scripts/test-timeline-property-animation-s13-g008-g007.mjs scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs scripts/test-timeline-property-animation-s13-g008-g008.mjs
```

**Esperado:** 89 PASS; 0 FAIL.

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-electron.mjs
```

**Esperado:** 20 checks Electron/WebGL PASS (expectativa, NO EJECUTADO en este entorno). Si no inicia Electron o hay fallos, registrar salida completa; no forzar PASS.

```bash
npm run build
npm run electron
```

**Esperado:** Editor y Player compilan sin errores; el Inspector se abre en Electron embebido. El número exacto de módulos puede cambiar por los nuevos imports; compilación NO VERIFICADA aquí.

## Matriz funcional — selección

| ID | Paso | Resultado requerido |
|---|---|---|
| SEL-01 | Inspector temporal abierto → clic en nodo ya seleccionado de Jerarquía | Inspector del nodo al primer clic |
| SEL-02 | Inspector Cinematics abierto → clic en mismo nodo | Inspector del nodo al primer clic |
| SEL-03 | Abrir otro recurso (Material/Perfil) → clic en nodo | Inspector del nodo al primer clic |
| SEL-04 | Alternar A/B, Timeline y nuevamente A | Sin necesidad de clic en nodo intermedio |
| SEL-05 | Nodo → pista Timeline | Inspector temporal correcto; no bloquear selección temporal |
| SEL-06 | Nodo → recurso Cinematics | Inspector correspondiente correcto |
| SEL-07 | Inspector acoplado/desacoplado | Mismo resultado del primer clic |
| SEL-08 | Cambios repetidos rápidos entre recursos/nodos | Nunca queda inspector obsoleto |

## Matriz funcional — keyframes manuales

| ID | Paso | Resultado requerido |
|---|---|---|
| KEY-01 | Seleccionar nodo compatible y recurso Timeline abierto; llave por primera vez | Una pista y una clave en cabezal |
| KEY-02 | Mover cabezal y pulsar segunda vez | Segunda clave en la misma pista |
| KEY-03 | Pulsar llave en tiempo ya usado con valor distinto | Actualiza valor conservando ID; no duplica |
| KEY-04 | Dos nodos del mismo nombre o dos escenas | ID escena+nodo+propiedad sin colisión |
| KEY-05 | Recurso no editable, pista bloqueada o fuera de duración | Rechazo sin mutación |
| KEY-06 | Undo/Redo tras insertar clave | Revierte/recupera la operación completa |
| KEY-07 | Guardar/cerrar/reabrir | Pistas y claves intactas |
| KEY-08 | Preview activo vs dato autoral | La llave guarda valor autoral, no pose visual temporal |
| KEY-09 | Nodo/propiedad incompatible o FilmMaker | No aparece llave operativa |
| KEY-10 | Light energía/color | Muestra llaves y crea datos tipados, autoridad G007 aparte |
| KEY-11 | Cuerpo físico dinámico | No fuerza keyframe de transformaciones no autorizadas |
| KEY-12 | Editor y Player | Ninguna regresión de reproducción/exportación |

## Límite de evidencia G007

La autoridad sobre accesos directos `object3D` permanece NO VERIFICADA. G008 certifica inserción de datos, no proclama exclusividad total en runtime. Si se detecta bypass, resolverlo en corrección G007 autorizada separadamente antes de su cierre.

## Evidencia que devolver

1. Salida de las tres ejecuciones `node --test` y `npm run build`.
2. Captura/vídeo mostrando Timeline → mismo nodo en Jerarquía → propiedades al primer clic, y Cinematics → mismo nodo.
3. Captura/vídeo de la llave en un Light, movimiento del cabezal, dos claves, Undo y Redo.
4. Indicar explícitamente qué escenarios fallaron o `QA LOCAL PASS` si todos los escenarios exigidos se comprobaron.

Conservar el SOURCE_BASELINE nuevo para el próximo Gate; no borrar el anterior hasta confirmar la instalación y regresión.
