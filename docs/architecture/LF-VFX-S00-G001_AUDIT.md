# LF-VFX-S00-G001 — Auditoría del recurso VFX

Fecha: 2026-10-28 (America/Santo_Domingo). Estado: auditoría documental realizada; revisión del usuario PENDIENTE. No se ha implementado VFX.

## 1. Autoridad y continuidad

Autorización recibida: «Listo. LF-VFX-S00-G001 autoriza comenzar». Precisión del usuario en el mismo mensaje: el editor de VFX debe ser profesional y funcionar mediante un recurso.

Base vinculante: `LevelForge_EDITOR_MENUBAR_UX_G001_CORR-001_SOURCE_BASELINE.zip`. El usuario aprobó su correctivo antes de autorizar S00. Se contrastó con la copia local adjunta `lf(2).zip`:

| Comparación por contenido, no solo nombre | Resultado observado |
|---|---|
| Archivos del SOURCE_BASELINE | 991 |
| Archivos de la copia local | 1.015 |
| Archivos comunes idénticos byte por byte | 991 |
| Modificados / eliminados respecto al baseline | 0 / 0 |
| Añadidos locales | 24, todos dentro de `dist-player/` |
| Integridad CRC de ambos ZIP de entrada | Sin errores detectados |

Los 24 añadidos son salida de compilación; se excluyen de la entrega de fuente. Su presencia no acredita fecha, comandos ni resultado de compilación de este Gate. El ZIP adjunto se conserva intacto. No hay cambios locales de fuente que fusionar.

Se revisaron los contratos Node S01, Script S05 y CORR-001, Assets S03, Inspector de recursos, correctivo de historial, adopción de Three.js, cámara y menubar, además de los archivos concretos de la matriz siguiente. No hay archivos identificados como GDD/TDD/SRS/URS generales ni contratos VFX previos en este baseline. No se reconstruyen documentos ausentes desde memoria. El alcance S00 sí puede completarse; cualquier contrato externo vinculante que aparezca deberá conciliarse antes de implementar sus áreas afectadas.

## 2. Recorrido real y puntos de integración

Las referencias corresponden a la fuente de entrada; S00 no cambia sus líneas. OBSERVADO significa inspección estática, no ejecución gráfica.

| Área | Evidencia observada | Integración necesaria para VFX |
|---|---|---|
| Tipos de recursos | `src/core/project.js:51`, `fileKind`; `:82`, `allEntries`; `:172`, `createProjectData`; `:258`, `ensureFs` | No existe tipo VFX ni colección propia. Añadirlos al sistema actual, conservando IDs y carpetas. |
| Organización de Assets | `src/components/ProjectPanel.vue`, `select`, `activate` y rutas de creación; `src/core/project.js`, `DEFAULT_FOLDERS` | Crear en la carpeta elegida. No introducir carpetas vacías predeterminadas. Seleccionar, crear, asignar y editar son acciones distintas. |
| CRUD de recursos | `src/core/state/filesystem.js`, `importFiles`, `refOf`, `renameEntry`, `duplicateEntry`, `removeEntry`, `deleteFolder` | Extender cada rama concreta. No basta con mostrar un icono nuevo. |
| Edición compartida | `src/core/state/materials.js`, `createMaterial`, `updateMaterial`, `materialUsagesInOtherScenes` | Reutilizar patrón de ID estable y búsqueda de usos; no copiar la conversión de material a valores locales para un VFX. |
| Historial | `src/core/state/history.js:21`, `captureEntry`; `:61`, `applyEntry` | El snapshot enumera materiales/perfiles/GameManagers. VFX necesitará captura y restauración explícitas, incluidos cambios de carpeta que pertenezcan a su operación. |
| Gestos de edición | `src/components/ParamForm.vue`, `NumberField`, `ColorInput`; `docs/qa/LF-RESOURCE-HISTORY-CORR-G001_QA.md` | Diferenciar vista inmediata y confirmación. Un arrastre debe producir una sola operación de Undo. |
| Metadatos persistidos | `src/core/project.js:220`, `splitProject`; `src/core/db.js`, `saveProject`, `saveScene` | La separación meta/escena ya existe. El recurso pertenece al proyecto; la referencia pertenece al nodo de escena. |
| Archivo `.lfproj` | `src/core/lfproj.js:25`, `buildLfproj`; `:58`, `parseLfproj`; `src/core/state/project.js:167`, `buildProjectFile` | La serialización contiene ramas por tipo. Añadir contenido `.vfx`, índice e hidratación; impedir fuentes de datos divergentes. |
| Paquetes de recursos | `src/core/levelpackage.js`, `payloadOf`, `resolveLevelPackageSelection`, `buildLevelPackage`; `src/core/levelpackage-import.js:13`, `allowedKinds`, `collection`, `planLevelPackageImport` | Declarar VFX, dependencia de textura y referencia de nodo; validar y remapear IDs al importar. |
| Aplicación de importación | `src/core/state/project.js:254`, lista de colecciones después de `saveLevelPackageImport` | La colección nueva debe actualizarse tanto en IndexedDB como en memoria. Probar la operación pública completa. |
| Nodos | `src/engine/runtime/nodes/registry.js`, `registerNode`; `nodes/index.js`, `makeObject` | Utilizar Node3D y el mismo registro. No crear ECS ni segundo árbol. |
| Representación y eliminación | `src/engine/runtime/scene/objects.js`, `_rebuild`, `syncObject`, `removeObject`; `scene-graph.js:95`, `loadScene`, `:214`, `dispose` | Hay liberación explícita de recursos por tipo. VFX necesita cobertura de reemplazo, borrado, cambio de escena y cierre, también en Edit. |
| Contexto de recursos del nodo | `scene-graph.js:174`, `_ctx`; `scene/textures.js`, `spriteTexture`, `_mapTexture` | Pasar acceso al recurso y textura por el contexto existente. No usar un localizador global. |
| Simulación en Play | `scene/node-lifecycle.js:16`, `_call`, `:88`, `process`; `events/play-controls.js`, `_simStep` | `onProcess` ya se llama desde el paso de juego y respeta la puerta de pausa/foco. No hace falta reordenar Event Order Flow. |
| Simulación en Edit | `scene-graph.js:190`, `_sceneFrame`; `src/core/editor.js:82`, `_frame`; `render/viewport.js:155`, `onFrame` | Usar el reloj existente solo para la previsualización nativa. Nunca activar scripts de usuario en Edit. Evitar que el VFX avance dos veces en Play. |
| Player | `src/core/state/game.js:64`, `buildGamePackage`; `runtime/package/format.js`, `writePackage`, `readPackage`; `runtime/package/game.js`, `openGame` | El Player utiliza SceneGraph y PlayMode compartidos. Probar paquete real con sus texturas y misma implementación VFX. |
| Editor especializado | `src/components/ShaderGraphEditor.vue`; `FloatingEditorWindow.vue`; `src/core/editor/window-layout.js`; `src/App.vue` | Reutilizar ventanas, divisores, foco, controles y guardado. Un editor VFX propio no implica otro gestor de ventanas ni copiar Shader Graph. |
| Previsualización existente | `src/components/ShaderPreview.vue` | Está acoplada a materiales y tiene renderer/RAF propios. No duplicarla para VFX ni presentarla como preview universal existente. |
| Cámara de edición | `src/core/state/editor-camera-views.js`; `render/viewport.js`, `saveEditorView`, `restoreEditorView` | La vista previa VFX debe devolver exactamente la cámara, proyección y controles del usuario. Preservar el correctivo aprobado. |

## 3. Partículas que ya existen

| Capacidad | OBSERVADO | Decisión recomendada |
|---|---|---|
| Lluvia y nieve | `src/engine/runtime/world/fx.js`, `PrecipFX`: lluvia con geometría instanciada y nieve con `Points`; origen/volumen ligado a cámara y clima. | Conservar. No convertir el clima en backend del recurso VFX ni extraer una abstracción para dos usos distintos. |
| Impactos de lluvia | Mismo archivo, buffers de salpicaduras y consultas `ground`, `impact`, `onImpact`. | Conservar su integración con agua. La colisión de partículas VFX queda fuera del primer alcance. |
| Salpicaduras | `src/engine/runtime/world/splash.js`, `SplashFX`: pool de 480 partículas en arrays, `burst`, `update`, `dispose`. | Aprovechar el patrón de capacidad fija. No copiar su dependencia de agua, gravedad fija ni `Math.random()` como solución determinista. |
| Materiales y texturas | Three.js, cachés por escena y recursos Material existentes. | Reutilizar carga de textura y renderizador. El material PBR no resuelve por sí solo atributos por partícula. |

**INFERENCIA:** un pool acotado con billboards instanciados es una primera opción razonable para vapor de café. La fuente demuestra que estas técnicas ya se emplean, pero no demuestra su coste en el equipo del usuario.

**CAUSA RAÍZ:** no se diagnostica un fallo VFX reproducido. Esta capacidad aún no existe como recurso. La carencia observada es la ausencia de un modelo de recurso, su autoría y su unión con una instancia; se registra como PENDIENTE PLANIFICADO, no como conexión olvidada de un Gate VFX anterior.

## 4. Three.js: versión, core, addons, licencia y límites

- `package.json` y `package-lock.json` fijan `three` en **0.186.1**; el lock declara MIT. `docs/qa/LF-THREE-VERSION-G001_QA.md` registra su adopción previa.
- `render/viewport.js:23` construye `THREE.WebGLRenderer`. No es un backend WebGPU.
- En esta copia de trabajo no hay `node_modules/three`. Se consultó documentación oficial publicada; la descarga de archivos del tag r186 mediante la consulta web no estuvo disponible. No se afirma haber inspeccionado ni ejecutado el paquete instalado 0.186.1. El Gate de render requiere verificar esa versión exacta localmente, sin actualizarla.

| Alternativa revisada | Evaluación para el primer efecto |
|---|---|
| `Points` / `PointsMaterial` | Core útil para partículas simples. No ofrece por sí mismo el ciclo de vida y las curvas del recurso; no es un editor VFX. |
| `InstancedBufferGeometry` / `InstancedBufferAttribute` | Core y uso confirmado en `PrecipFX`. Recomendado para una geometría de quad con datos por partícula. |
| `ShaderMaterial` | Core compatible con el renderer WebGL actual. Recomendado para orientación a cámara, tamaño, color y opacidad por partícula. No se promete compatibilidad con Shader Graph PBR. |
| `GPUComputationRenderer` | Addon oficial de simulación con texturas float y dos render targets por variable. Evaluado; no recomendado para el primer vapor sin evidencia de necesidad. Añade complejidad y memoria. |

No se identificó en las APIs revisadas un editor de recursos VFX que pueda importarse como solución completa. Esa conclusión está limitada al material consultado. No se afirma haber auditado todos los addons. Se implementaría únicamente la autoría y semántica propias de LevelForge que el core no suministra.

Fuentes primarias consultadas el 2026-10-28:

1. https://threejs.org/docs/pages/PointsMaterial.html — material de puntos y texturas.
2. https://threejs.org/docs/pages/InstancedBufferGeometry.html — geometría instanciada y capacidad de dibujo.
3. https://threejs.org/docs/pages/ShaderMaterial.html — shaders personalizados y WebGLRenderer.
4. https://threejs.org/docs/pages/GPUComputationRenderer.html — simulación mediante texturas y doble buffer.
5. https://raw.githubusercontent.com/mrdoob/three.js/dev/LICENSE — licencia MIT publicada por el proyecto, no una verificación del archivo del tag fijado. Conservar los avisos al distribuir.

## 5. Discrepancias y decisiones

1. **Ledger desfasado:** las seis hojas tenían como encabezado el resumen de menubar CORR-001, pero sus últimas filas correspondían al correctivo inicial de cámara. No contenían filas completas para CAMERA-STATE-FIX, HUB-POLISH ni MENUBAR y su correctivo. S00 agrega la conciliación con los mensajes de aprobación del usuario y mantiene las filas anteriores. Los contadores y tablas históricas tienen cobertura parcial; no se reconstruyen ni se presentan como totales globales.
2. **Propuesta anterior centrada en nodo/Inspector:** la instrucción actual exige recurso y editor profesional. Se concreta en el contrato adjunto sin modificar contratos aprobados de Material, Perfil, Script o eventos. El Inspector del nodo asignará el recurso; no será dueño de su definición.
3. **Exportación Godot:** `src/core/exporter.js` es una ruta distinta; un tipo sin exportador se convierte en `Node3D` sin efecto. El alcance inicial recomendado es Player de LevelForge. Debe impedirse una exportación Godot que pierda VFX silenciosamente; implementar su equivalente queda pendiente de decisión, no prometido.
4. **Riesgos previos de recursos:** la lista pública de exportación `.levelpackage` en `state/project.js` omite `material`, y la lista de actualización de memoria tras importación también omite `materials`. Es una observación estática fuera del Gate; no se declara un fallo reproducido ni se corrige aquí. VFX no deberá repetir esas omisiones.
5. No se detectó una contradicción entre contratos aprobados que obligue a reescribirlos para realizar S00. Las restricciones de alcance de Gates antiguos se leen dentro de sus propios Gates. Cualquier cambio futuro de una obligación vigente exige Contract Amendment antes de ejecutarse.

## 6. Resultado y siguiente acción

La base es continua y los puntos de integración están identificados. Se entrega un contrato recomendado, una secuencia de Gates y QA verificable. El requisito de recurso y acabado profesional procede del usuario; el resto de decisiones técnicas propuestas no equivalen a autorización de implementación. Siguiente acción real: revisar este paquete documental y después declarar/autorizar el primer Gate de recurso con la frase exacta. S00 no deja un emisor, editor ni preset implementados.
