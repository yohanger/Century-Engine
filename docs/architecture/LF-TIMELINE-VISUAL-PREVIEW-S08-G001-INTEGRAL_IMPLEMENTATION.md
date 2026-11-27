# LF-TIMELINE-VISUAL-PREVIEW-S08-G001-INTEGRAL

**Autorización:** «Listo. LF-TIMELINE-VISUAL-PREVIEW-S08-G001-INTEGRAL autoriza comenzar» (usuario, 2026-11-05).
**Fuente:** `LF_TIMELINE_PRO_UX_S07_G001_CORR001_SOURCE_BASELINE` acumulativo.
**Estado:** IMPLEMENTADO EN FUENTES · QA LOCAL PENDIENTE · GATE ABIERTO.

## Diagnóstico previo

**OBSERVADO en código:**

- `TimelinePanel.vue` usaba `timelineRulerTicks()` para los números de regla, pero dibujaba en las pistas una sola retícula CSS que no diferenciaba marcas mayores y menores y no continuaba bajo la última pista.
- Las claves de cámara y nodo eran rombos y las pistas de nodo carecían de un tramo visible entre claves. La pista de cámara ya tenía un tramo exclusivo.
- `TimelinePreview` era el aplicador existente de cámara, nodos y física: no despacha comandos, métodos ni audio en Edit Mode.
- El watcher del Timeline no ejecutaba la aplicación inicial inmediatamente; al ocultar el panel se detenía la previsualización, pero un cambio posterior de tiempo podía reactivarla sin comprobar la visibilidad.

**INFERENCIA NO DEMOSTRADA:** no se dispone de una reproducción instrumentada del fallo visual que el usuario observó en Electron. Las causas anteriores son defectos concretos del ciclo de vida; no prueban que los comandos sean el origen del problema observado.

## Cambios en los originales

- `src/components/TimelinePanel.vue`: amplía el zoom máximo a 720 px/s para permitir marcas principales de décimas. Continúa reutilizando `timelineRulerTicks()` sin otro reloj.
- Dibuja una cuadrícula vertical de dos escalas (mayores/menores) sincronizada con la regla, incluso debajo de las pistas; cada fila conserva una línea horizontal.
- Representa claves instantáneas de cámara, nodo y método como círculos. Audio y comandos mantienen su forma de bloque por semántica.
- Reutiliza los intervalos reales entre claves para pintar continuidad horizontal de cámara y nodos, con discontinuidad punteada en cortes o interpolación nearest. No crea claves ni modifica interpolaciones.
- Activa la evaluación del preview al montar/cambiar el editor y al reabrir la pestaña. Impide su aplicación cuando el Timeline está oculto o cuando se usa Play/Cinematics.
- No se modifica `TimelinePreview`, el runtime, FilmMaker, Cinematics, Player ni docking. No se habilita ejecución de comandos de gameplay durante el scrubbing.

## QA automatizado

- `node --test scripts/test-timeline-visual-preview-s08-g001-integral.mjs`: 8 PASS, 1 SKIP si falta el compilador Vue.
- Pruebas de ruler adaptativo (1s, 0.5s, 0.1s), alineación de escalas, continuidad por intervalos reales, círculos y clips, ciclo de vida del preview y aplicación sobre un nodo simulado sin mutar sus datos persistidos.
- El test del aplicador utiliza una escena mínima simulada; **NO** demuestra un render real con WebGL.
- Las suites que necesitan `vite` o `jszip` no pueden arrancar aquí porque no están instalados. **No son PASS**.
- `npm run build` aquí: no arranca (`vite: not found`). Compilación real **NO VERIFICADA**.

## QA local obligatorio

En la raíz del proyecto existente, después de comparar/respaldar los archivos del CHANGE:

```bash
node --test scripts/test-timeline-visual-preview-s08-g001-integral.mjs
npm run build
npm run electron
```

En Electron:

1. Abrir un Timeline de 10 s con dos claves diferentes de **posición** del mismo nodo, con valores inequívocamente separados.
2. Confirmar regla con 1s, 0.5s y 0.1s al variar zoom; retícula mayor/menor en carriles y área inferior.
3. Confirmar claves circulares y línea entre las de posición; un corte/nearest se representa discontinuo.
4. Mover el cabezal entre ambas claves; el nodo deberá desplazarse en el viewport sin alterar el proyecto persistido. Probar reproducción y pausa.
5. Cambiar a otra pestaña, desactivar «Ver en viewport» y entrar en Play; los nodos deberán restaurarse a la pose del editor.
6. Confirmar que las pistas de comandos/métodos no disparan efectos secundarios durante scrubbing; su evaluación corresponde al modo de juego.
7. Guardar/reabrir y comparar el resultado del Timeline sin pérdida de referencias.

**Evidencia a devolver:** log de test y build, captura de regla/grid con zoom cercano y zoom normal, captura/vídeo del nodo en dos tiempos, observación de restauración y del estado del Player.

**NO declarar QA LOCAL PASS, APROBADO ni CERRADO** hasta recibir evidencia del usuario. Los Gates pausados de FilmMaker/Cinematics conservan sus estados.
