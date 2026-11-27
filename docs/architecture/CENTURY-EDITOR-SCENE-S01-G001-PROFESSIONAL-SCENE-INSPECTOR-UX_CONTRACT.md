# Inspector profesional de Escena — contrato de alcance

Gate: `CENTURY-EDITOR-SCENE-S01-G001-PROFESSIONAL-SCENE-INSPECTOR-UX`.

Ratificado y autorizado por el usuario en la conversación del 23 de noviembre de 2026.

## Autoridad y alcance

- Se conserva la organización de `LF-SCENE-INSPECTOR-OWNERSHIP-S02-G001`: Escena, Mundo y atmósfera, Recursos de iluminación.
- El título del dock identifica la escena; no se repite una cabecera con globo, nombre ni texto de escena activa.
- Secciones con iconos nativos, preferencias de plegado existentes, búsqueda, controles precisos, diseño compacto adaptable y representación horaria editorial.
- Streaming, transiciones, TriangHor y horneado mantienen sus operaciones. Se separan parámetros, acciones, progreso y resultados.
- No se modifican autoridad de World, shaders, persistencia, algoritmos, Player ni comportamiento del runtime. Sin nuevas dependencias o contextos de renderizado.
- Las advertencias de autoridad y estados funcionales se mantienen; las explicaciones redundantes se reducen o trasladan a tooltips.

## Baseline

`CENTURY_EDITOR_MESH_S02_G001_CORR001_SOURCE_BASELINE.zip`, 3932 archivos verificados byte por byte contra la copia disponible. Se conserva acumulativamente la corrección del fixture; su QA Electron y aprobación siguen pendientes, sin cierre implícito.

## Aceptación

Pruebas focales de búsqueda, plegado y correspondencia de controles; regresión comparada con el baseline; compilación, QA visual Electron, responsividad y comprobación integrada de cambios de escena. El fixture se construye con `createProjectData()`. No se declara PASS visual ni cierre sin evidencia.
