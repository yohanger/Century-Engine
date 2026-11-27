# QA — navegación independiente de selección

Estado: correcciones aisladas implementadas en fuentes, QA Electron y reproducción exacta del síntoma del usuario pendientes. Base acumulativa posterior a precisión visual. No se tiene acceso al árbol local del usuario.

## Diagnóstico
La navegación y TransformControls comparten el lienzo y el ciclo de captura. En Chromium con dos listeners reales de pointerdown, el primero captura y solicita Pointer Lock; el segundo intenta capturar el mismo puntero y produce InvalidStateError. Esto acredita el conflicto a nivel del navegador, no la identidad exacta con el síntoma del usuario. Las pruebas aisladas reproducen además pérdida de captura al pasar a Pointer Lock, denegación asíncrona y bloqueo previo propio en liberación.

Se deshabilita temporalmente la entrada de gizmos, sin ocultarlos ni deseleccionar; se mantiene la prioridad de WASD durante vuelo, y se recupera la autoridad previa al finalizar. No se roba captura ajena ni se ignoran cancelaciones reales. Se modifica la ruta editorial del Viewport compartido bajo src/engine/runtime/render; sin cambios intencionados a gameplay/Player ni exportación. Paridad real no verificada.

## QA ejecutado
- Antes: 1/8 PASS; después: 8/8 PASS, con colaboradores simulados y métodos productivos.
- Regresiones: 51/53 PASS antes y después. Fallos históricos sin cambios: OCG-12 (assertion de código desactualizada) y «el vuelo no solicita una nueva captura mientras el puntero está bloqueado» (dependencia del fixture). No se relajan assertions.
- Reproducción aislada del conflicto nativo en Chromium: ver evidencia.
- Electron: 0/29 comprobaciones ejecutadas (Vite ausente). Runner amplía protocolo opcional de gestos con teclado nativo sin alterar los pasos existentes. Compilación bloqueada por Vite.

## QA local
`npm run test:suite -- selection-independent-fly-navigation`

`npm run test:suite -- selection-independent-fly-navigation-electron`

Probar selección en viewport y Jerarquía, vuelo inmediato RMB+WASD, selección múltiple, Edit Mesh y Modo Local, soltar y reanudar rápidamente; verificar sensibilidad y restauración de gizmos; probar ventanas desacopladas y pérdida de foco. No se acredita estabilidad definitiva hasta reproducción local y aprobación.
