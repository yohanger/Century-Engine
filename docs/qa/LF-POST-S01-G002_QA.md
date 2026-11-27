# LevelForge — LF-POST-S01-G002 · PostProcessVolume

**Autorización exacta:** `Listo. LF-POST-S01-G002 autoriza comenzar` · 2026-10-26.  
**Baseline de entrada:** `LevelForge_POST_S01_G001_SOURCE_BASELINE.zip` (780 archivos).  
**Estado:** IMPLEMENTADO y regresión automatizada PASS. **No verificado visualmente en Electron, GPU ni Player exportado.**

## Objetivo y decisiones

Los nodos `PostProcessVolume` consumen perfiles existentes `.post` o `.profile`. Al desplazar la cámara dentro de una caja o esfera, modifican la configuración efectiva de postprocesado. Se mantiene **un único** `project.profiles`, `LookPipeline`, compositor y `Viewport.setRenderLive`. No se introduce ningún efecto PBR nuevo, un gestor de cámaras alternativo ni un sistema de colisiones.

## Contrato de comportamiento

1. **Nodo:** tipo `postvolume` en `nodes/index.js`, visible en Añadir → Ambiente. Transformable y escalable. Inspector con activo, caja/esfera, perfil (slot de Assets), prioridad, peso [0,1], distancia de mezcla [0,100] m, transición [0,10] s y color de guía.
2. **Volumen espacial:** la **cámara activa** (del jugador, fija o cinematográfica) es el observador. Las cajas se calculan con orientación y escala mundiales del nodo (incluidos padres); fuera de la caja se atenúan mediante la distancia euclidiana al borde. Esfera usa el radio de la mitad de la mayor escala y su gizmo se representa como esfera uniforme.
3. **Blend:** dentro del volumen, `weight` controla la contribución; fuera, el peso cae con `smoothstep` desde el límite de la geometría hasta `blendDistance` metros. Distancia cero: cambio espacial inmediato al cruzar el borde; `blendTime` puede suavizar temporalmente el cambio de render.
4. **Superposición:** volúmenes elegibles ordenados por prioridad creciente y, si empatan, por ID. Sus overrides de efectos se aplican en ese orden. El volumen de mayor prioridad domina cuando tiene peso completo; en los bordes, ambos pueden contribuir.
5. **Jerarquía de perfiles:** Render → GameManager → Spawn → Cámara → volúmenes → override explícito desde script o evento. Los scripts con `game.profile.set()` tienen prioridad mientras están activos; `game.profile.clear()` recupera los volúmenes y los perfiles de la cámara y de GameManager. La escena no altera permanentemente Render.
6. **Render:** se ejecuta después de colocar la cámara para el fotograma. La interpolación de salida continua hasta regresar al perfil de base. `renderChanged()` evita llamadas a `setRenderLive()` cuando no hay cambios relevantes. No se crea física Jolt, RenderTarget o EffectComposer por volumen.
7. **Editor:** la misma evaluación se usa en el visor de edición. La vista previa explícita del editor de `.post` tiene prioridad sobre los volúmenes mientras permanezca abierta. Al salir de la vista previa se recupera la evaluación espacial.
8. **Compatibilidad:** sin `postvolume`, se conserva la ruta anterior. Empty no necesita Player ni GameManager, solo cámara si se quiere ver la imagen. Los objetos de escena se serializan con las propiedades normales y las referencias a perfiles existentes. `.profile` y `.post` antiguos no se renombran ni se migran.
9. **Ayudas:** gizmo solo de edición; en Play/Player se oculta la geometría auxiliar pero el nodo raíz sigue activo para evaluar la transformación. Se excluye de bake y gráficos de prefabs.

## Archivos principales

- `src/engine/runtime/nodes/postvolume.js` — nuevo nodo 3D; caja/esfera y controles visuales.
- `src/engine/runtime/render/postvolumes.js` — evaluación espacial, prioridad, pesos y cambios de render.
- `src/engine/runtime/events/play-profile.js`, `play-controls.js`, `play.js` — integración de la cámara y del perfil temporal.
- `src/core/editor/environment.js`, `src/core/editor.js` — vista previa directa en el Editor.
- `src/components/Inspector.vue`, `src/components/Icon.vue` — propiedades y selección.
- `src/engine/runtime/bake/runtime.js`, `src/engine/runtime/nodes/prefab-graphic.js` — exclusiones de visuales auxiliares.

## Pruebas

- `node --test scripts/test-post-s01-g002.mjs` → **39 PASS / 0 FAIL**. Geometría, rotación, padres ocultos, pesos y borde de transición, prioridad, formato legado, override, retorno temporal, cámara y puntos de integración.
- Regresión acumulada `node --test scripts/test-*.mjs` excluyendo `test-starcat.mjs` (prueba de catálogo opcional) → **1255 PASS / 0 FAIL / 18 SKIP (39 pruebas nuevas)**.
- Sintaxis JS → `node --check` en archivos JS/MJS modificados.
- `npm run build` → **NO VERIFICADO:** `vite: not found` en este contenedor, sin `node_modules`.
- GPU/Electron/Player → **PENDIENTE DE QA LOCAL**. Las verificaciones de integración del test incluyen inspección de código, no equivalen a ejecutar Electron.

## QA manual obligatorio (Linux)

- [ ] Crear `Normal.post` y `Rojo.post`, activar Tint/Color Grading y asignar Rojo al volumen.
- [ ] Añadir PostProcessVolume (caja) a una escena con cámara y ajustar tamaño y orientación.
- [ ] Entrar, salir y moverse por el borde; verificar la interpolación espacial y temporal.
- [ ] Repetir con esfera, escala desigual y nodo hijo de un Group rotado.
- [ ] Solapar dos volúmenes con distintas prioridades y pesos; verificar cuál domina y ausencia de parpadeo.
- [ ] Comprobar cámara principal, cámara fija, Timeline y juego Empty con cámara añadida.
- [ ] Ejecutar `game.profile.set()` y luego `clear()` dentro del volumen; verificar precedencia correcta.
- [ ] Desactivar el volumen o su padre y verificar que el efecto desaparece.
- [ ] Editar `.post` con Antes/Después y confirmar que la vista previa editorial manda temporalmente.
- [ ] Guardar, cerrar y volver a abrir la escena; copiar/pegar nodos y exportar al Player; comprobar recursos.
- [ ] Comprobar Forward+, Mobile y Compatibility, memoria GPU y tasas de actualización al caminar por varias zonas.
- [ ] Ejecutar `npm run build`, comprobar Editor Electron y Player exportado.

## Exclusiones y límites conocidos

No se integran nuevos efectos de render ni Shader Graph, que pertenece al Gate siguiente `LF-SHADER-GRAPH-S02-G001`. Un volumen solo puede mezclar los parámetros soportados por `render/profiles.js`; los ajustes discretos (booleanos/selección) cambian en torno al peso 0,5. En jerarquías con escalados no uniformes y rotaciones compuestas (shear), la evaluación descompone la matriz mundial a posición/rotación/escala, por lo que los bordes pueden diferir de una caja cizallada. Una esfera transformada por un ancestro con escala no uniforme puede mostrar esa deformación. La validación visual queda pendiente.
