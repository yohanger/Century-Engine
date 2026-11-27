# LF-THREE-S01-G001 — Contrato ejecutado y QA pendiente

## Autorización y frontera

Declaración del usuario: `Listo. LF-THREE-S01-G001 autoriza comenzar` (24-10-2026).
Contrato integral único para el Sprint 01. No autoriza actualizar Three.js, cambiar de renderizador, crear un importador paralelo, agregar compresión automática ni implementar decals dinámicos.

Decisiones del Sprint: T18 EXTENDER materiales físicos; T16 INTEGRAR KTX2 dentro de GLB; T17 INTEGRAR Draco/Meshopt dentro de GLB; T15 EXTENDER nodos existentes con DecalGeometry estático. Se aplica EXTEND BEFORE DUPLICATE.

En este Sprint queda formalizada la ejecución por Sprint integral y la entrega de dos archivos: Change ZIP y SHA-256. Se conserva el baseline original y no se emite Source Baseline ZIP adicional.

## Intervenciones

- `src/engine/runtime/render/pbr.js`: opciones físicas de `MeshPhysicalMaterial` bajo `obj.mat.physical`; si faltan se restauran los valores nativos compatibles. No se modifican mapas GLSL importados.
- `src/components/Inspector.vue`: edición de propiedades físicas en primitivas y mallas editables; textura, malla objetivo, volumen y opacidad de decals.
- `src/engine/runtime/scene/models.js`: un único GLTFLoader con DRACOLoader, MeshoptDecoder y KTX2Loader. Los loaders se reutilizan y liberan al destruir SceneGraph.
- `src/engine/runtime/scene-graph.js`: enlaza textura y objetivo del decal con el host compartido; limpieza de los loaders.
- `src/engine/runtime/nodes/decal.js` (nuevo): DecalGeometry estático, anclado a un target ID existente, sin afectar la geometría original.
- `src/engine/runtime/nodes/index.js` y `src/engine/runtime/scene/objects.js`: integración del registro existente, reconstrucción/actualización y liberación de geometrías.
- `src/engine/runtime/scene/textures.js`: resincronización de decals cuando se actualiza la textura del proyecto.
- `vite.config.js`: assets oficiales Draco glTF y BasisU tomados de `node_modules/three` r170 tanto en editor como en Player; las rutas de carga no dependen de red.
- `scripts/test-three-s01.mjs` y fixture `scripts/fixtures/three-s01/plain-triangle.glb`: QA de contratos y GLB autocontenido estándar.
- Este documento y `docs/qa/LevelForge_DB_Ledger.xlsx`.

El acceso a los decodificadores funciona a través de la instalación normal de Three.js hecha por `npm ci`. Los binarios WASM de esa dependencia se empaquetan al ejecutar Vite: no se descargan en tiempo de ejecución.

## Observado en el entorno de elaboración

- ZIP original: fuente disponible, sin `node_modules`.
- `node --check` para los JS del cambio: verificado sin errores de sintaxis.
- `node --test scripts/test-three-s01.mjs`: 8 comprobaciones estáticas PASS, 0 FAIL, 1 SKIP (tests dinámicos dependen de `npm ci`).
- `node --test scripts/test-db-contract.mjs`: 408 PASS, 0 FAIL, 0 SKIP (regresión heredada de Node ejecutada en este entorno).
- `npm ci --ignore-scripts --prefer-offline`: no completó por ausencia de acceso al registro npm; no hay build verificable en este entorno.
- No se han ejecutado Electron, Chromium real, GLB Draco/Meshopt/KTX2, AppImage, shader GPU ni QA visual. Estado: PENDIENTE, no PASS.
- Se incluye fixture GLB normal. No se pudieron obtener/verificar aquí fixtures comprimidos oficiales: las pruebas dinámicas con ellos siguen BLOQUEADAS hasta aportar archivos conocidos y validar su procedencia.

## QA Linux del usuario — no se declara completado

Conservar antes de extraer el ZIP una copia del código local y del Change ZIP. Usar el destino acordado `$HOME/ENGINES/lf-0.26.13/lf` (raíz del ZIP). No extraer sobre otro proyecto ni eliminar activos del usuario.

```bash
cd "$HOME/Downloads"
sha256sum -c LF-THREE-S01-G001_CHANGE.sha256
unzip -o LF-THREE-S01-G001_CHANGE.zip -d "$HOME/ENGINES/lf-0.26.13/lf"
cd "$HOME/ENGINES/lf-0.26.13/lf"
npm ci
node --test scripts/test-three-s01.mjs
node --test scripts/test-db-contract.mjs
npm run build
```

Salidas esperadas: `sha256sum` informa `OK`; pruebas Node sin FAIL (la prueba dinámica S01 no debe omitirse después de `npm ci`); Vite genera `dist/` y `dist-player/`. Confirmar que ambos contienen `three-decoders/draco/{draco_decoder.js,draco_decoder.wasm,draco_wasm_wrapper.js}` y `three-decoders/basis/{basis_transcoder.js,basis_transcoder.wasm}`.

```bash
find dist dist-player -path '*/three-decoders/*' -type f | sort
npm run electron:dev
```

QA visual/manual pendiente:

1. Crear una primitiva y malla editable; configurar barniz, transmisión, IOR, espesor, sheen, iridiscencia y anisotropía. Verificar persistencia al guardar/reabrir y no regresión del shader PSX.
2. Abrir un proyecto antiguo y comprobar que su apariencia inicial se conserva.
3. Importar GLB no comprimido (fixture incluido); importar GLB propios o de fuente reconocida con extensiones `KHR_draco_mesh_compression`, `EXT_meshopt_compression`, `KHR_texture_basisu`, por separado y combinadas cuando existan.
4. Crear `Calcomanía` desde el flujo existente de añadir nodos; elegir target primitiva/malla/modelo y textura importada. Colocar sobre la superficie y guardar/reabrir.
5. Mover/rotar la malla objetivo, modificar el decal, cambiar su imagen y borrar objetivo e imagen en pruebas separadas; no debe colapsar la escena.
6. Repetir modelos y decals en juego exportado; confirmar sin conexión externa y buscar errores CSP/WASM/Worker en consola.
7. Comparar memoria, tiempo de carga y FPS con y sin estas capacidades; no concluir mejora sin medición.

Adjuntar: salida completa de `node --test` y `npm run build`, capturas del inspector y del render, árbol de archivos del Player, registros de consola, GLB de prueba y estado visual de exportación (incluido AppImage si se genera). La aceptación visual y el cierre del Gate pertenecen al usuario.

## Riesgos conocidos

- Three.js r170 conserva GLSL y hooks PBR personalizados de LevelForge; la calidad de combinaciones físicas con esos shaders necesita prueba GPU.
- DecalGeometry proyecta polígonos y puede deformarse al cruzar esquinas o superficies complejas. No es un sistema de decals animados ni acepta objetivo vacío.
- El transcodificador KTX2 exige formato BasisU compatible y capacidades GPU. No todos los contenedores KTX2 son válidos.
- Los binarios WASM oficiales deben estar presentes después de `npm ci`; el build falla deliberadamente si faltan.
- La CSP de `file://` y los workers reales requieren QA en Electron/Player. El check estático no acredita su funcionamiento.

**Estado final:** implementación preparada para QA local; sin declaración de cerrado, READY, FIXED o APROBADO a nivel QA.

## CORR-001 — Lectura numérica en los controles de Material

**Autorización:** `Listo. LF-THREE-S01-G001_CORR-001 autoriza comenzar` (24-10-2026).

**Defecto observado por el usuario:** los sliders de Rugosidad, Metálico y Opacidad no mostraban el valor numérico. Las propiedades físicas avanzadas ya tenían campos numéricos.

**Mecanismo aplicado:** se reutiliza `NumberField.vue` en la misma fila de cada slider, vinculados al mismo valor de `obj` y a las rutas existentes `setNum()` / `commitNum()`. No se agrega estado local paralelo ni se cambia la representación material ni el contrato de persistencia.

| Propiedad | Slider | Campo numérico | Precisión |
|---|---|---|---|
| Rugosidad | 0–1 | 0–1 | Paso 0,01; 2 decimales |
| Metálico | 0–1 | 0–1 | Paso 0,01; 2 decimales |
| Opacidad (Material) | 0,05–1 | 0,05–1 | Paso 0,01; 2 decimales |

**Archivos corregidos:** `src/components/Inspector.vue`, `scripts/test-three-s01.mjs`, este documento y `docs/qa/LevelForge_DB_Ledger.xlsx`. `NumberField.vue` se reutiliza sin modificaciones. La opacidad del nodo Decal y el resto de sliders permanecen intactos.

### Evidencia ya recibida y controles ejecutados

- Antes de CORR-001, el usuario ejecutó `npm ci`, obtuvo **14 PASS / 0 FAIL / 0 SKIP** en S01, **408 PASS / 0 FAIL** en regresión y completó dos builds Vite (`dist/` y `dist-player/`). No atribuir estos builds a CORR-001.
- Para CORR-001, en el entorno de elaboración: **10 PASS / 0 FAIL / 1 SKIP** en `scripts/test-three-s01.mjs` (8 estáticos originales + 2 nuevos); **408 PASS / 0 FAIL** en regresión. La prueba dinámica completa requiere `npm ci` local.
- `node --check scripts/test-three-s01.mjs`: sin errores de sintaxis.
- `npm run build` en el entorno de elaboración: **NO VERIFICADO**, error `vite: not found` (dependencias no disponibles). Build CORR-001 y QA visual **PENDIENTES**.

### QA local obligatorio

Después de verificar el hash y extraer el ZIP de corrección en `$HOME/ENGINES/lf-0.26.13/lf`, ejecutar:

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-three-s01.mjs
node --test scripts/test-db-contract.mjs
npm run build
npm run electron:dev
```

**Salida esperada con dependencias ya instaladas:** `scripts/test-three-s01.mjs` 16 PASS, 0 FAIL, 0 SKIP; regresión heredada 408 PASS; los dos builds Vite completados. Si el proyecto local cambió desde el último QA, reportar esa diferencia antes de aplicar cualquier otra corrección.

1. Seleccionar una primitiva o malla, abrir `Material` y comprobar que **Rugosidad**, **Metálico** y **Opacidad** tienen slider y campo editable en la misma fila; no debe existir desplazamiento horizontal ni quedar cortado el valor en el ancho habitual del Inspector.
2. Mover cada slider y confirmar actualización simultánea del número, incluyendo 0, 1 y valores intermedios (para Opacidad el mínimo es 0,05).
3. Introducir valores desde el campo numérico (`0.25`, `0.70`, `0.05`) y comprobar movimiento del slider; respetar límites y resolución de 0,01.
4. Confirmar el cambio, probar deshacer y rehacer por el mecanismo existente y guardar/reabrir proyecto. El valor final debe mantenerse.
5. Verificar que Barniz y las propiedades físicas avanzadas continúan funcionando, así como la opacidad del decal. Comprobar en una malla y en un nodo de texto que utilice el bloque Material.
6. Repetir en el editor compilado; verificar que el Player mantiene los materiales. No debe aparecer ninguna regresión visual o en consola.

**Evidencia a devolver:** log de los dos comandos Node y build, captura del Inspector con los tres valores, resultado de edición numérica + slider, Undo/Redo, guardado/reapertura y cualquier error en consola. No declarar el Gate cerrado sin confirmación del usuario.

**Conservar:** baseline original, ZIP original de Sprint 01 y proyecto local. **No eliminar** activos, `node_modules`, `dist/` ni alterar archivos fuera del Change ZIP por esta corrección.
