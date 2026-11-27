# LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL — Implementación

**Estado:** IMPLEMENTADO EN FUENTES · QA LOCAL PENDIENTE · NO CERRADO. Autorización literal del usuario: `Listo. LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL autoriza comenzar`.

## SOURCE_BASELINE y alcance

Fuente de autoridad: `LF_TIMELINE_UNITY_REPLACEMENT_S10_G004_CLOSURE_SOURCE_BASELINE.zip`, acumulando G001 (cabeceras fijas), G002 (selección múltiple), G003 (clips Mix/Ripple/Replace), G004 (grupos, bloqueo, marcadores). No se modifican Nether FilmMaker, Cinematics, Jolt ni los recursos del usuario.

## Extensiones reales

- **`src/components/TimelinePanel.vue`**: incorpora el botón Curvas y monta un único componente gráfico dentro de la Timeline, vinculándolo al mismo recurso, selección, tiempo e historial; no introduce otra Timeline.
- **`src/components/TimelineCurveEditor.vue`**: UI especializada integrada bajo la Timeline, selección por pista/canal, arrastre gráfico de claves en tiempo y valor, Snap heredado de G002, búsqueda/encuadre, ampliación horizontal/vertical, desplazamiento gráfico, control editable de tangentes cúbicas y asas Bézier temporales. Descarta tramos fuera de la ventana visible y limita el muestreo por tramo según su tamaño en pantalla. Los canales son X/Y/Z de nodo, o posición/rotación/FOV para cámaras cuyos fotogramas son todos de tipo libre. Las pistas discretas, visibles y las cámaras dependientes de nodos/jugador no ofrecen falsa edición numérica.
- **`src/core/timeline/curves.js`**: operaciones puras de edición y validación de claves originales por ID; no evalúa, reproduce ni mantiene una segunda representación de curvas. Asegura límites de duración, orden temporal entre claves, bloqueo, restricciones de FOV y referencias a fuentes de clips; pendientes opcionales por eje y borrado de overrides.
- **`src/core/timeline/model.js`**: normalización acotada de `tanIn`/`tanOut` opcionales de claves de pista `node`; arrays de tres componentes, `null` implica tangente automática. Los proyectos anteriores sin campos siguen idénticos. No se añaden nuevas estructuras persistentes a Timeline ni a Clip.
- **`src/engine/runtime/timeline/eval.js`**: el Hermite **existente** utiliza `a.tanOut[n]` y `b.tanIn[n]` finitas si están definidas, de lo contrario conserva exactamente su derivada automática original. Lo consumen tanto `evalTimelineNode` de Preview como el Player. La curva angular sigue usando sus ángulos desarrollados y ruta más corta.
- **`src/components/TemporalResourceInspector.vue`**: Inspector original permite valores de tangente por eje en claves `node` cúbicas y retorno a automático. Conservar el inspector Bézier numérico original y la selección por ID.

## Contratos de interacción

1. El editor gráfico no crea ni serializa clips adicionales: representa las **claves fuente** y su resultado de evaluación. G003 continúa remapeando esos segmentos en la reproducción.
2. Extremos de clips por ID: el tiempo de una clave de origen `from`/`to` no puede arrastrarse desde la curva; su valor sí puede editarse. El panel lo advierte.
3. La edición gráfica se bloquea en `track.locked`, modo Play o proyecto bloqueado; `bake` siempre de solo lectura.
4. Arrastre: cambios en vivo sobre la clave original; un único `commit()` en `pointerup` si el estado final cambió; `pointercancel` restaura el origen sin commit. Flechas del teclado generan edición puntual con commit. La selección pasa por `pick` y `selectTemporal` preexistentes.
5. Dos familias distintas: interpolación de pista cúbica usa pendientes `tanIn/tanOut`; claves sin interpolación explícita usan `ease === 'bezier'` y sus cuatro controles `bz` ya existentes. **No** se aplica Bézier cuando hay interpolación explícita (precedencia S04-G002).
6. Para el gráfico de cámara solo se habilitan claves libres; en poses ligadas al jugador o a nodos el valor real depende de la escena y no se inventa como dato editor.
7. No se modifica el esquema de interpolación de clips ni el protocolo del Player; el único cambio de evaluación es la lectura opcional de las pendientes de nodo.

## Límites y deuda técnica

No se implementa un editor de expresiones ni edición por lotes de múltiples curvas simultáneas; la gráfica presenta un canal activo por vez. Las curvas de audio/comandos/métodos y visibilidad no admiten edición numérica. Las cámaras no reciben pendientes Hermite por canal: conservan su trayectoria `smooth/linear` original y el Bézier temporal existente. Las rutas de compilación con Vue/Vite/Electron y QA visual/Player local requieren dependencias y pruebas en el equipo del usuario. La equivalencia integral con Unity no está certificada.

## Verificación obtenida

- `scripts/test-timeline-unity-replacement-s10-g005-integral.mjs`: **24 PASS, 1 SKIP, 0 FAIL** (25 pruebas). SKIP: compilador Vue ausente.
- 15 suites Node independientes de dependencias externas: **222 PASS, 9 SKIP, 0 FAIL** (231 pruebas).
- 3 suites legacy adicionales no arrancaron por falta de `jszip` o `vite` (no se contabilizan como regresiones funcionales ni como PASS).
- `npm ci --offline --ignore-scripts`: **BLOQUEADO** por `zip-stream@4.1.1` no disponible en la caché.
- Compilación Vite/Electron, guardado y reapertura real, visual, Player 3D, rendimiento: **NO VERIFICADOS**.
