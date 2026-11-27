# LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001 — Revisión tras QA fallido

**Gate autorizado:** `LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001`.  
**Parent:** `LF-TIMELINE-UNITY-REPLACEMENT-S10-G001`.  
**Fuente actual:** SOURCE_BASELINE completo de **S10-G001 CORR-001** (primera entrega).  
**Estado:** REIMPLEMENTADO EN FUENTES, QA LOCAL PENDIENTE, **NO APROBADO / NO CERRADO**.

## Evidencia y diagnóstico diferencial

**OBSERVADO:** el usuario rechazó la primera corrección y aportó la captura `docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001/user-qa-reject-scroll.png`. Al desplazar horizontalmente las pistas, los bloques y la regla invaden/cortan el área de cabeceras. El log `docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001/user-qa-tests-build.txt` demuestra 9 PASS de las pruebas antiguas y una compilación Vite exitosa desde una carpeta local con nombre S01 FilmMaker; **no acredita QA visual PASS** ni garantiza que el árbol local sea idéntico al SOURCE_BASELINE S10-G001 CORR-001. La interfaz continúa defectuosa.

**CAUSA RAÍZ DEL DISEÑO ANTERIOR (código real):** `.hcorner`, `.head`, `.ruler` y `.lane` pertenecían al **mismo** `.inner` dentro del scroll horizontal. CORR-001 anterior intentó compensar el desplazamiento mediante `translateX(var(--tl-scroll-left))` sobre las cabeceras. Ese mecanismo seguía permitiendo a la regla, el playhead y los clips circular por detrás del área de cabeceras dentro del mismo contexto de recorte, dando un resultado visual incorrecto. Su batería Node solo validaba fórmulas de compensación; por eso no detectó el problema. **Mecanismo anterior SUPERSEDIDO por la evidencia de QA del usuario.**

## Mecánica actual de CORR-001 reimplementada

Se modifica **el componente original** `src/components/TimelinePanel.vue` sin crear otro panel ni alterar modelo temporal o reproductor.

- `.main` distribuye la vista en **dos columnas de presentación**: `.pinned-column` (cabeceras, control `+ Pista`, resize de cabecera, mute y nombres) y `.scroll` (regla, marcas, claves, segmentos y playhead). Las cabeceras **no son descendientes del scroller horizontal**; no se aplica transform horizontal de compensación.
- `.scroll` sigue siendo el **único scrollbar horizontal y vertical**. Las filas de las cabeceras se mueven solo verticalmente mediante la posición `scrollTop` del scroller real, sin duplicar reloj ni datos. La rueda sobre la columna izquierda reenvía el movimiento al mismo scroll real.
- Se mantienen los mismos IDs de pistas y el mismo orden `tl.tracks` a ambos lados, con altura de fila **36 px** y altura de regla/esquina **29 px**. El viewport de cabeceras se recorta en el eje vertical, pero no permite el paso visual de claves/regla desde la derecha.
- El área temporal tiene origen X=0 **en la columna derecha**. `ruler`, `lane`, `time-grid` y `playhead` usan ese origen y el zoom original, sin restar dos veces el ancho de la cabecera. `scrub` sigue midiendo coordenadas contra el elemento real.
- El ancho se calcula desde el contenedor `.main` a través del padre de `.scroll`. Se conserva la preferencia de anchura y el ResizeObserver original; se observa además el contenedor padre cuando existe. El `header-resizer` permanece accesible en la nueva columna.
- `pickTrack`, `toggleTrackMute`, `keyDown`, `scrubDown`, menús, `nodeDrop`, preview, historial y persistencia mantienen funciones y datos originales. No se modifican `model.js`, `preview.js`, Player o FilmMaker.

## Pruebas y límites

- Se reemplazaron las aserciones **inválidas** del test original CORR-001, que exigían expresamente `translateX`, por pruebas de **separación real del DOM**, desplazamiento vertical simulado, rueda sobre cabeceras, geometría y origen de tiempo único.
- Las pruebas de S04, S07 y S08 que exigían expresamente que cabeceras y carriles fueran hermanos flex o que el cabezal añadiera `headerWidth` se actualizaron al nuevo contrato de layout; **no se eliminaron sus comprobaciones funcionales**.
- Regresión seleccionada: **117 PASS, 5 SKIP, 0 FAIL**. Los SKIP requieren el compilador Vue no instalado aquí.
- Intento adicional de renderizar un layout HTML aislado con Chromium headless: **NO CONCLUYÓ** por limitación del navegador en este contenedor. No declararlo prueba visual PASS.
- Compilación Vite/Electron **de esta nueva revisión: NO VERIFICADA**. QA local real pendiente del usuario, indispensable para cerrar G001.

## Alcance excluido

Sin cambios en FilmMaker, Cinematics, editor de curvas, física, estado de recursos, UI global, sistema de docking, Player o datos de proyectos. Sin nuevos scripts auxiliares de ejecución, sin nueva Timeline y sin copia de código Unity.
