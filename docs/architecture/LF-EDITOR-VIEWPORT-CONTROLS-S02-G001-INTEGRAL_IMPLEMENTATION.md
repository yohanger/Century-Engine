# LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL — Implementación

**Autorización literal:** `Listo. LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL autoriza comenzar`.
**SOURCE_BASELINE:** `LevelForge_EDITOR_MENUS_UX_S01_G001_INTEGRAL_CORR-001_SOURCE_BASELINE.zip` íntegro (S01 aprobado y evidencia posterior incorporada).
**Contract Amendment vinculante:** `LF-EDITOR-VIEWBAR-UX-CA-003.md`.

## Auditoría: observado / inferencia / causa raíz

- **OBSERVADO:** `ViewBar.vue` incluía dos botones de pestaña `role="tab"` que estaban inactivos alternativamente. El estado real ya procedía de `store.play.on`, de modo que no eran controles para navegar entre dos visores.
- **CAUSA RAÍZ (pestañas):** presentación redundante y semántica ARIA inapropiada respecto del funcionamiento real.
- **OBSERVADO:** `gizmo.js::_addBackHandles` clonaba geometría y picker de cada eje de mover/escalar. `_stripHandles` retiraba el centro `XYZ` de Scale y los anillos E/XYZE de Rotate. Los tres `TransformControls` oficiales ya estaban conectados a los mismos eventos y su priorización.
- **INFERENCIA de UX:** la duplicación y el tamaño 0.5 de Scale reducen la claridad visual y hacen difícil reconocer la escala uniforme. Ninguna mejora estética demuestra por sí misma menor carga GPU.
- **MECANISMO:** extensión y simplificación del código existente, sin un nuevo gestor de gizmos. Se reutiliza la API pública de Three.js 0.186.1, `setMode`, `setSize`, `getHelper`, `setSpace` y `showXYZE` ([documentación oficial](https://threejs.org/docs/pages/TransformControls)). No se actualiza Three.js ni se altera la licencia MIT ni el paquete instalado.

## Archivos productivos

1. `src/components/ViewBar.vue`: retira botones/estilos de pestañas y separador decorativo; la raíz pasa a `role="toolbar"` contextual. Se conserva `tab` como derivación reactiva de Play, los grupos, ratón/trackpad y los controles de Juego.
2. `src/core/editor/gizmo.js`: usa los tres controles nativos sin duplicación ni supresión de XYZ; mantiene E, deshabilita solamente `XYZE` con API pública y ajusta tamaños diferenciados para modo independiente/Universal. `_sizeObjectGizmos` reutiliza el `gizmoScale` existente. Eventos, snapping, Terrain, film y Undo quedan intactos.
3. `src/core/editor/selection.js`: reaplica tamaños al cambiar el modo, sin modificar los enlaces a visual/raíz/pivote, escalado local, orientaciones ni lógica de multiselección.

### CORR-001 — QA visual rechazado

- El usuario documentó seis asas de Move y exceso de tamaño con captura; **S02 NO APROBADO**.
- **Causa raíz:** Three.js r186 incorpora dos mallas y dos pickers por eje de Move/Scale; retirar `_addBackHandles` solo eliminaba la clonación anterior, no las mitades negativas nativas.
- `gizmo.js::_keepPositiveHandles` examina los bounds de los handles de los grupos nativos `gizmo/picker` y retira solo los del semieje negativo; sin geometrías duplicadas, preservando `XYZ` y los planos. Esta integración depende del layout interno de Three.js r186.1 y debe verificarse en Electron tras actualizar el addon.
- `gizmo.js::_sizeObjectGizmos` restaura los factores anteriores a S02 (0.5/0.85/0.95) para todos los modos, multiplicados por `store.prefs.gizmoSize`. No se altera la preferencia compartida.
- CA-004 actualiza las cláusulas 3 y 5 de CA-003 exclusivamente dentro del Gate existente.
- Se amplía la suite Node a VC-22 y se modifica el fixture Electron para verificar la geometría **real** de los gizmos/pickers. No se declara PASS Electron sin ejecución.


## Impacto contractual y QA

- Se actualizan solamente las 4 aserciones incompatibles de pruebas antiguas en `test-editor-ux-s01-g002.mjs` (3) y `test-editor-viewbar-ux-g001.mjs` (1). No se eliminan los identificadores históricos ni se tocan las demás verificaciones.
- La suite S02 agrega pruebas de inicialización, tamaños, eventos, acceso al visual de escala, multiselección, modo Universal, modo ninguno, y un fixture de integración Vue + Three en el Electron embebido existente.
- `LF-EDITOR-VIEWBAR-UX-CA-003` autoriza explícitamente estos reemplazos. No se modifican `Toolbar.vue`, API de nodos, formato de escena, Script, Mesh Edit, Player ni exportación.
- El único error de la regresión ampliada `SCENE-09` se reprodujo en el SOURCE_BASELINE anterior con idéntica prueba y `src/core/mesh/session.js` byte idéntico. Es un **FAIL histórico**, no una regresión S02; no se corrige dentro de este Gate.

**Documentación S01:** evidencia local de Electron y build recibida por el usuario incorporada al cierre de S01 sin ocultar su FAIL inicial.

**Estado S02:** IMPLEMENTADO, NODE PASS salvo fallo histórico indicado. ELECTRON y BUILD NO VERIFICADOS en entorno de entrega. QA LOCAL PENDIENTE; NO CERRADO.

**Estado tras CORR-001:** corrección implementada, Node focal PASS; Electron y compilación NO VERIFICADOS, QA local NO APROBADO, Gate ABIERTO.


### CORR-002 — Orientación de asas según cámara (QA parcial)

- **OBSERVADO:** la captura del usuario confirma que CORR-001 ya presenta un solo extremo por eje, pero los extremos permanecen en el semieje positivo aun cuando la cámara orbita detrás del objeto. El usuario declara aceptación parcial, no aprobación del Sprint.
- **CAUSA RAÍZ:** `_keepPositiveHandles` eliminaba físicamente las mitades negativas del addon y sus pickers; no quedaba geometría para cambiar de lado.
- **CORRECCIÓN:** CA-005 supersede las cláusulas de extremos fijos de CA-004. `_cameraFacingHandles` retiene ambas puntas nativas, muestra una sola por eje en el lado hacia la cámara, alinea el picker mediante `layers.mask` y refleja la línea original sin nuevas geometrías. El cálculo usa mundo/local según Three.js y congela selección durante gestos. Los tamaños de CA-004 permanecen intactos.
- **ALCANCE:** solo `gizmo.js` en producción, las pruebas Node/fixture Electron, Contract Amendment, QA, ledger y evidencia. Sin cambios de comandos, escenas, exportación, Player, terreno o docking.
- **VERIFICACIÓN DISPONIBLE:** Node focal 123/123 PASS; ampliada 133/134 con `SCENE-09` histórico preexistente. Electron/build NO VERIFICADOS aquí (Vite no instalado). Deben validarse en el entorno local con Three.js r186.1 real.
- **ESTADO:** CORR-002 implementada para QA. Gate S02 **NO APROBADO / NO CERRADO**.
