# LF-SHADER-GRAPH-UX-S02-G001 — Workspace profesional de Shader Graph

**Autorización exacta:** `Listo. LF-SHADER-GRAPH-UX-S02-G001 autoriza comenzar` (2026-10-27).

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · BUILD / QA VISUAL LOCAL NO VERIFICADOS · APROBACIÓN PENDIENTE.

## Objetivo y alcance

Reorganización del editor nodal original para asemejarse a la dirección visual aprobada: barra de herramientas superior, lienzo de nodos principal, panel derecho de propiedades y previsualización, panel inferior de salida/GLSL y barra de estado. Se utiliza el componente original `ShaderGraphEditor.vue`, `ShaderPreview.vue` sin modificar, y la ventana reutilizable `FloatingEditorWindow.vue`. No se crea otro editor ni se incorporan bibliotecas UI.

**Cambios de producción:**

- `src/components/ShaderGraphEditor.vue`: reorganización de **template y CSS**; mueve el panel de propiedades a la derecha, la vista previa a una región fija del rail derecho y GLSL al panel inferior. Añade controles funcionales Guardar y Compilar en el toolbar y muestra diagnósticos concretos en el panel Salida; conserva crear nodo, selección múltiple, pan/zoom, aristas, Undo/Redo, copiar/pegar, borrar, buscar y encuadre.
- `src/components/FloatingEditorWindow.vue`: introduce `startMaximized` **opcional con valor por defecto `false`**, empleado solo desde Shader Graph. Conserva la geometría de restauración y no cambia el comportamiento de los otros editores.
- `src/components/ShaderPreview.vue`: **sin cambios**. Se reutiliza una sola instancia a tamaño fijo en el panel lateral, sin recrear el renderizador ni duplicar WebGL.

**Fuera de alcance (no modificados):** compilador GLSL (`compile.js`), catálogo (`nodes.js`), estado compartido (`state/shaders.js`), formatos/IDs, undo del grafo, renderer PBR, shaders de runtime/Player, Jolt, exportación, Database y materiales compartidos.

## Evidencia de pruebas

| Comprobación | Resultado |
|---|---|
| Suite específica nueva `scripts/test-shader-graph-ux-s02-g001.mjs` | **15 PASS / 0 FAIL** |
| Suites previas de grafo/post y UX de materiales | **74 PASS / 0 FAIL** |
| Regresión Node disponible, excluido `test-starcat.mjs` | **1728 PASS / 0 FAIL / 18 SKIP** |
| Verificación de estructura de template HTML | PASS (balance de etiquetas) |
| `npm run build` | **NO VERIFICADO**: dependencias de Vite ausentes en este entorno (`vite: not found`, exit 127) |
| Electron / Player / GPU / QA visual | **NO VERIFICADOS** |

La suite específica verifica integración estructural de los componentes y algunos contratos del compilador real. **No demuestra posiciones píxel a píxel, accesibilidad con teclado, render WebGL real ni comportamiento visual en Electron.** La validación final corresponde al QA local.

## Aplicación de solo CHANGE

Este Gate parte del `LevelForge_RESOURCE_INSPECTOR_S01_CLOSE_G001_SOURCE_BASELINE.zip` validado (843 archivos). Si la instalación local contiene ese cierre y ninguna edición propia incompatible, aplicar **solo** `LevelForge_SHADER_GRAPH_UX_S02_G001_CHANGE.zip`:

```bash
cd ~/ENGINES/lf-0.26.13/lf
mkdir -p ~/ENGINES/LevelForge_BACKUPS/LF-SHADER-GRAPH-UX-S02-G001
cp --parents src/components/ShaderGraphEditor.vue src/components/FloatingEditorWindow.vue docs/qa/LevelForge_DB_Ledger.xlsx \
  ~/ENGINES/LevelForge_BACKUPS/LF-SHADER-GRAPH-UX-S02-G001/
unzip -l ~/Downloads/LevelForge_SHADER_GRAPH_UX_S02_G001_CHANGE.zip
# Comparar diferencias locales no incluidas en el baseline, si existen.
unzip -o ~/Downloads/LevelForge_SHADER_GRAPH_UX_S02_G001_CHANGE.zip -d .
node --test scripts/test-shader-graph-ux-s02-g001.mjs scripts/test-shader-graph-s02-g001.mjs scripts/test-material-ux-s01-g001.mjs
npm run build
npm run electron
```

**Esperado para las tres suites anteriores:** 89 PASS / 0 FAIL. En Electron abrir un grafo de material y uno de Post Processing. Comparar visualmente con la referencia aprobada.

## Checklist visual y funcional pendiente del usuario

- [ ] Ventana de Shader Graph abre maximizada dentro del viewport y se puede restaurar, mover, redimensionar y cerrar.
- [ ] El lienzo central tiene prioridad visual; arrastrar nodos, crear conexiones y seleccionar varios nodos sigue funcionando.
- [ ] Las propiedades se encuentran en el rail derecho; añadir, renombrar y eliminar propiedades sigue funcionando.
- [ ] Previsualización a la derecha, **nunca encima** de las conexiones; Esfera/Cubo/Plano y Girar siguen funcionando.
- [ ] Panel inferior Salida informa correctamente de éxito o error; GLSL se muestra mediante la pestaña Código GLSL, sin tapar nodos.
- [ ] Botones Guardar, Compilar, Deshacer/Rehacer, Buscar, Copiar/Pegar, Eliminar, Enfocar siguen activos.
- [ ] UI con ventana de tamaño reducido: toolbar desplazable, rail derecho y código legibles, sin desbordamientos ni controles inutilizables.
- [ ] Crear/guardar/reabrir un grafo Material y uno Post conserva IDs, parámetros, conexiones y sus resultados renderizados.
- [ ] Otros editores flotantes siguen abriendo con su tamaño anterior; Editor y Player no presentan regresiones.

**Evidencia de retorno solicitada:** salida del `node --test` de tres suites, resultado completo de `npm run build`, captura del Shader Graph Material y Post abiertos en Electron, y cualquier error de la consola. No marcar QA visual PASS hasta comprobarlo.

## Continuidad

El Sprint 01 de recursos está aprobado y cerrado a nivel técnico/documental, con QA visual separado. Este es el **primer Gate del Sprint 02** de refinamiento visual de Shader Graph. G002 (interacciones/refinamientos) y G003 (QA integral) no están autorizados. Conservar los dos ZIP de este Gate y el SOURCE_BASELINE del Gate anterior. No sobrescribir cambios locales propios antes de compararlos.

## Dictamen posterior — corrección visual autorizada

El usuario **rechazó visualmente** la entrega G001: toolbar con desplazamiento, nodos de aspecto básico, Inspector sin formulario contextual y preview demasiado pequeña. Sus 15 tests estructurales fueron PASS pero **no demostraron fidelidad visual**. El Gate G001 queda SUPERSEDIDO SOLO EN SU ACEPTACIÓN VISUAL por `LF-SHADER-GRAPH-UX-S02-G001_CORR-001` (autorizado 2026-10-27); se conserva íntegro el historial técnico, sin reescribir la evidencia original. La revisión de aceptación corresponde al nuevo informe QA; no se adelanta acoplamiento de ventanas.
