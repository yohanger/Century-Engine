# LF-SHADER-GRAPH-UX-S02-G001_CORR-001 — Corrección visual de Shader Graph

**Autorización literal:** `Listo. LF-SHADER-GRAPH-UX-S02-G001_CORR-001 autoriza comenzar` (27 de octubre de 2026).

**Estado:** IMPLEMENTADO / TEST AUTOMATIZADO PASS / COMPILACIÓN LOCAL Y QA VISUAL **NO VERIFICADOS** / APROBACIÓN PENDIENTE.

## Contrato de referencia

La imagen de referencia aprobada por el usuario (segunda captura, editor profesional de materiales de estética Unreal Engine 4.27) prevalece sobre la entrega visual G001. La anterior fue rechazada visualmente y se considera **SUPERSEDIDA VISUALMENTE**, sin borrar su implementación ni su evidencia de tests. El acoplamiento de ventanas será un Gate posterior y está **EXPRESAMENTE FUERA DE ALCANCE**.

La corrección extiende los mismos componentes y estado de Shader Graph. No se crea editor alternativo, no se añaden nodos ni se cambia el compilador, la topología, el formato de recursos, el runtime o el Player.

## Cambios reales

- `src/components/ShaderGraphEditor.vue`: workspace con lienzo dominante, cabeceras de nodos por categoría, puertos y aristas estilizados, miniaturas de texturas obtenidas del material real asociado cuando están disponibles y muestra de color. Toolbar superior con acciones prioritarias y menú «Más» para operaciones secundarias, sin scroll horizontal. El Inspector derecho tiene pestañas **Detalles** (parámetros e inputs editables del nodo realmente seleccionado) y **Propiedades del grafo** (propiedades públicas originales). Las dos vistas reutilizan los mismos `setParam`, `setInline`, `setProp`, `setPropDef`, Undo/Redo, y la misma instancia de grafo. Preview y consola continúan en regiones separadas.
- `src/components/ShaderPreview.vue`: tamaño adaptable mediante `ResizeObserver`, esfera/cubo/plano, luces de estudio, mapeo PBR del material asignado al mismo shader y carga real de imágenes del proyecto con `assetImage`. No se usan imágenes inventadas o demos como si fueran el material del proyecto; si no hay un material vinculado o textura asignada, se muestra el shader con sus parámetros originales y no se simula una textura. Se liberan texturas, compositor y contexto WebGL al desmontar.
- `scripts/test-shader-graph-ux-s02-g001.mjs`: actualiza cuatro expectativas del diseño anterior rechazado (dimensiones rígidas, summary sin edición, preview rígida y toolbar con scroll) al contrato ahora autorizado. Se mantienen los demás tests funcionales.
- `scripts/test-editor-color-picker-g001.mjs`: inventario actualizado de 47 a **48** controles (mismo selector existente; un uso adicional en el Inspector del nodo).
- `scripts/test-shader-graph-ux-s02-g001-corr001.mjs`: 16 nuevas verificaciones de jerarquía de vista, acciones, edición contextual, recursos/texturas reales, limpieza WebGL, Material/Post y ausencia de acoplamiento.

El pipeline Shader Graph sigue siendo autoritativo. La carga de imágenes usa las funciones del proyecto (`assetImage`) y no cambia `state/shaders.js`, `compile.js`, `nodes.js` ni `pbr.js`. Se conserva la ventana flotante existente; la modificación no introduce docking.

## Evidencia automatizada observada

| Prueba | Resultado |
|---|---|
| 16 tests nuevos CORR-001 | **16 PASS, 0 FAIL** |
| Suites específicas G001 + Material + Shader Graph | **89 PASS, 0 FAIL** (después de actualizar expectativas obsoletas) |
| Regresión Node disponible (`--test-concurrency=4`, sin `test-starcat.mjs`) | **1744 PASS, 0 FAIL, 18 SKIP** |
| `test-clouds.mjs` aisladamente | PASS (en ejecución concurrente inicial falló el proceso; pasó con concurrencia limitada) |
| Verificación de anidación de templates Vue con HTMLParser | Sin etiquetas desbalanceadas; **NO equivale a compilación Vue** |
| `npm run build` | NO VERIFICADO aquí (`vite: not found`, exit 127) |
| Electron / Player / GPU / QA visual comparativo | **NO VERIFICADOS** |

La UI estática y los tests Node prueban conexiones estructurales y APIs; **no demuestran fidelidad píxel a píxel ni el comportamiento final de WebGL/Electron**. La entrega no se presenta como visualmente aprobada.

## Verificación local obligatoria del usuario

Aplicar CHANGE sobre la instalación con el G001 anterior instalado y sin modificaciones locales incompatibles. Resguardar los archivos antes de sobrescribir:

```bash
cd ~/ENGINES/lf-0.26.13/lf
mkdir -p ~/ENGINES/LevelForge_BACKUPS/LF-SHADER-GRAPH-UX-S02-G001_CORR-001
cp --parents src/components/ShaderGraphEditor.vue src/components/ShaderPreview.vue scripts/test-shader-graph-ux-s02-g001.mjs scripts/test-editor-color-picker-g001.mjs docs/qa/LF-SHADER-GRAPH-UX-S02-G001_QA.md docs/qa/LevelForge_DB_Ledger.xlsx ~/ENGINES/LevelForge_BACKUPS/LF-SHADER-GRAPH-UX-S02-G001_CORR-001/
unzip -o ~/Downloads/LevelForge_SHADER_GRAPH_UX_S02_G001_CORR_001_CHANGE.zip -d .
node --test scripts/test-shader-graph-ux-s02-g001-corr001.mjs scripts/test-shader-graph-ux-s02-g001.mjs scripts/test-shader-graph-s02-g001.mjs scripts/test-material-ux-s01-g001.mjs
npm run build
npm run electron
```

Se esperan **105 PASS, 0 FAIL** para esas cuatro suites. Ejecutar el build completo hasta terminar, no detenerlo con Ctrl+C.

### Aceptación visual (pendiente de usuario)

- [ ] Abrir gráfico Material en Electron a **1366 × 768**; contrastar con la imagen aprobada: lienzo dominante, toolbar compacta sin barra horizontal ni acciones recortadas, proporciones profesionales.
- [ ] Crear y seleccionar nodos de texturas, operaciones y salida: tarjetas oscuras, cabeceras por categoría, puertos tipados y curvas legibles.
- [ ] Seleccionar Color, Número, Textura y salida: panel «Detalles» muestra y modifica parámetros del nodo en uso; «Propiedades del grafo» sigue permitiendo añadir, editar y borrar parámetros públicos.
- [ ] Asociar una textura real a un material con Shader Graph: la textura se ve en la miniatura y se usa en la vista previa cuando el recurso asignado existe. Sin recurso, no inventar una textura.
- [ ] Comprobar preview Esfera/Cubo/Plano y Giro; tamaño razonable y sin superposición con el grafo.
- [ ] Salida/GLSL ocupa el dock inferior, con errores reales, sin tapar el lienzo.
- [ ] Crear, conectar, desconectar, editar, guardar, deshacer, rehacer y reabrir un grafo Material y uno Post Processing.
- [ ] Restaurar/maximizar la ventana, confirmar que no se añadió acoplamiento y que otros editores no se alteraron.
- [ ] Comprobar a 1920 × 1080; enviar capturas comparables y logs si falla.

**Evidencia solicitada:** salida de Node, build Editor/Player, dos capturas de Electron de Material y Post a 1366 × 768 y observaciones visuales específicas. No marcar QA visual PASS hasta tu aceptación expresa.

## Continuidad

Una vez aprobado visualmente, se podrá planificar el refinamiento funcional posterior y, separadamente, el acoplamiento de ventanas. Los errores o carencias detectados deberán entrar en un Gate nuevo o Amendment si exceden CORR-001. SOURCE_BASELINE de salida incluye acumulativamente todo lo aprobado y los cambios de esta corrección.
