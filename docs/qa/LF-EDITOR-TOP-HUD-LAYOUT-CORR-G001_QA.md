# LevelForge — LF-EDITOR-TOP-HUD-LAYOUT-CORR-G001

**Autorización literal:** `Listo. LF-EDITOR-TOP-HUD-LAYOUT-CORR-G001 autoriza comenzar`

**SOURCE_BASELINE vinculante:** `LevelForge_MESH_VERTEX_WORKFLOW_CORR_G001_SOURCE_BASELINE.zip` (1.436 archivos; ZIP íntegro).

**Estado:** IMPLEMENTADO · TEST NODE GATE PASS · BUILD/ELECTRON/QA LOCAL NO VERIFICADOS · NO CERRADO.

## Incidencia observada y causa raíz

La captura del usuario exhibe una tercera celda en la barra superior: el mensaje de escala `Escala × ... Enter confirmar · Esc cancelar`. `Toolbar.vue` define `.tb { display: grid; grid-template-columns: minmax(0,1fr) auto; height:36px }`, pero el elemento `uniform-scale-hud` se insertaba como tercer hijo de grid; eso provoca una fila implícita. `ViewportOverlay.vue` añadía encima del viewport una banda de mensajes con modo, vista y ruta del objeto seleccionado, ocupando espacio encima de la escena y compitiendo con sus herramientas.

## Contrato implementado

- La Toolbar queda con **dos hijos estructurales**, los grupos de herramientas izquierdo y derecho. El texto de escala numérica deja de formar parte de su layout; no se tocan atajos, acciones ni estado `uniformScaleHud`.
- `ViewportOverlay.vue` elimina la banda superior de mensajes (`mode`, `view`, `path`, `crumb`) y conserva exclusivamente el control funcional `OrientGizmo` si la preferencia está activa.
- El contenedor temporal `.hud` **ya existente en la parte inferior del viewport** muestra el texto `store.edit.hud` en Edit Mode, o `store.uniformScaleHud` en Object Mode. Nunca muestra ambos simultáneamente. Al terminar, desaparece sin generar nodos vacíos. Es accesible mediante `role=status` y `aria-live=polite`, no intercepta eventos de ratón y trunca mensajes largos en áreas estrechas.
- `StatusBar.vue`, `core/editor/keys.js`, el historial, Editor y Player no se alteran.
- No se agregan gestores, estado de proyecto ni overlays alternativos. El gizmo de orientación y la barra de herramientas siguen operativos.

## Evidencia automatizada disponible

- `scripts/test-editor-top-hud-layout-corr-g001.mjs`: **15/15 Node PASS**, valida ausencia de HUD en Toolbar y viewport superior, único HUD inferior, controles de orientación, escala numérica, Edit Mode, visibilidad en Player y responsive CSS.
- `scripts/test-transform-uniform-scale-s04-g001.mjs`: **23/23 PASS** después de actualizar una aserción de localización del HUD al contrato actual.
- Regresión amplia de viewport, cámara, Edit Mode, herramientas, Snap, malla y escala: **488 PASS / 4 FAIL / 0 SKIP**. Los 4 FAIL (CAM-09, G004-15, EXT001-10, EXT001-11) se ejecutaron en el SOURCE_BASELINE inmediatamente anterior y fallaron de forma idéntica. **No declarar 492/492 PASS.**
- Runner `scripts/test-editor-top-hud-layout-electron-corr-g001.mjs`, fixture `scripts/fixtures/editor/top-hud-layout-corr-g001.html`: prepara 18 verificaciones con Toolbar, ViewportOverlay, Three.js y Vue reales en el Electron embebido. **NO VERIFICADO** aquí por falta de `node_modules`/Vite.
- Build `npm run build`: **NO VERIFICADO**, el comando devuelve `vite: not found`.
- QA visual local: **PENDIENTE**.

## QA local del usuario

Extraer el nuevo SOURCE_BASELINE en una carpeta independiente; no sobrescribir proyectos, Assets ni cambios locales. Desde la raíz:

```bash
npm ci
node --test scripts/test-editor-top-hud-layout-corr-g001.mjs
node --test scripts/test-transform-uniform-scale-s04-g001.mjs
node --test scripts/test-editor-top-hud-layout-electron-corr-g001.mjs
npm run build
npm run electron
```

Verificar:

1. En Object Mode, seleccionar un objeto y activar escala uniforme con **S**. La barra superior conserva su altura y sus botones; el mensaje de factor/Enter/Esc aparece **debajo del viewport**, no en la barra.
2. Cambiar el factor, confirmar Enter, cancelar Esc y repetir un factor inválido. El HUD se actualiza, se retira al terminar y no bloquea clicks del viewport.
3. Cambiar entre Mover, Rotar, Escalar, selección, Edit Mode y herramientas de modelado. Nunca se muestran etiquetas superiores como «Mover», «Edición», «Perspectiva» o la ruta «Propiedad / SM_Rampa / Cubo 2»; el control de orientación sí permanece accesible.
4. En Edit Mode, ejecutar la transformación modal G/R/S. Su información temporal aparece debajo del viewport y no duplica el mensaje de Object Mode.
5. Repetir con ancho reducido de ventana, múltiples nodos, escenas y paneles abiertos. No debe aparecer una fila extra ni desplazar el toolbar.
6. Play y Player exportado: no se muestra el overlay del editor, no hay efectos secundarios en HUD del juego.

**Entregar como evidencia:** salidas Node, Electron, build; capturas antes/después de escala con la barra de herramientas y el borde inferior del viewport visibles; resultado visual de Edit Mode. Solo cerrar con aceptación expresa y evidencia suficiente.

## Exclusiones y continuidad

No se cambian la API de scripts, Global/Local, malla, Terrain Inspector, el sistema de notificaciones ni los mensajes operativos de ventanas separadas. Mantener el próximo Gate `LF-TERRAIN-INSPECTOR-UNIFICATION-S03-G001` como PENDIENTE.

La entrega LevelForge exige exactamente dos ZIP: CHANGE con los archivos afectados y SOURCE_BASELINE completo, sin SHA separado ni scripts `.sh`.
