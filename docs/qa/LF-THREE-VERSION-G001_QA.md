# LF-THREE-VERSION-G001 — Adopción final Three.js r186.1

**Gate autorizado:** `Listo. LF-THREE-VERSION-G001 autoriza comenzar` (2026-10-25).  
**QA gráfico de candidato aprobado:** el usuario informa que r186.1 funciona y pudo crear un modelo dentro del Editor.  
**Estado vigente:** **Three.js 0.186.1 fijada en el SOURCE_BASELINE de entrega**. El runner de migración histórico queda protegido contra una nueva ejecución en una fuente ya actualizada. La compilación de este ZIP final requiere revalidación con `npm ci` en Linux; la validación de candidatos r180/r186.1 fue exitosa.

## Evidencia real recibida: validación experimental en Linux

| Criterio | r180 | r186.1 |
|---|---|---|
| Instalación npm en la copia aislada | PASS | PASS |
| Preflight API, BVH y dependencias | 9 PASS, 0 FAIL, 0 SKIP | 9 PASS, 0 FAIL, 0 SKIP |
| Regresión Node | 872 PASS, 0 FAIL, 0 SKIP | 872 PASS, 0 FAIL, 0 SKIP |
| Vite Editor | PASS, 757 módulos | PASS, 757 módulos |
| Vite Player | PASS, 357 módulos | PASS, 357 módulos |
| Uso gráfico por usuario | No documentado | Aprobado; creó un modelo en el Editor |

Fuente de los resultados: `estado.json`, `r180-*.log`, `r186.1-*.log`, compartidos por el usuario, y su mensaje de aceptación visual. Los logs acreditan compilación pero no ensayos exhaustivos de todos los sistemas gráficos, rendimiento ni distribución exportada del Player. Las advertencias de Vite sobre bundles grandes, imports mixtos y la deprecación CommonJS de `require("three")` quedan registradas; no bloquearon el build.

## Cambios definitivos de este Gate

- `package.json`: se sustituye `^0.170.0` por **`0.186.1` exacto**.
- `package-lock.json`: versión raíz `0.186.1` y paquete `node_modules/three` `0.186.1`. URL: `https://registry.npmjs.org/three/-/three-0.186.1.tgz`; integridad `sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==`, corroborada con lockfiles públicos independientes que contienen la misma versión y checksum:
  - https://github.com/SDM-TIB/SHACLViewer/blob/master/package-lock.json
  - https://huggingface.co/spaces/Samosaa/PatientCare/blob/main/package-lock.json
  - **Precisión de procedencia:** este lockfile se reconstruyó a partir de la estructura del lockfile de LevelForge y de esa integridad contrastada; **no se extrajo del `candidate/package-lock.json` del usuario**, que no fue adjuntado. No se inventó el hash, pero la instalación con `npm ci` desde el ZIP final sigue pendiente de comprobación.
- `three-mesh-bvh@0.8.3`, Vite, Jolt, los shaders y el resto del runtime quedan sin cambios funcionales. `RGBELoader` continúa como import heredado: funciona en la copia experimental probada, pero está obsoleto. Su sustitución requerirá prueba .hdr independiente y no se incluye aquí.
- Tests de compatibilidad reforzados para exigir r186.1 en el baseline final, más suite de adopción. `qa-three-version-candidates.mjs` conserva la capacidad histórica desde r170 pero rechaza remigrar un baseline r186.1, incluidos los casos que intenten saltarse el aislamiento.
- Ledger actualizado en ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY.

## Validación obligatoria tras aplicar el CHANGE

Aplicar únicamente a un árbol de trabajo que coincida con `LevelForge_THREE_VERSION_G001_STAGE2_SOURCE_BASELINE.zip`. Antes, comparar archivos modificados y respaldar cambios locales. El proyecto base aprobado r170 debe conservarse como respaldo para rollback.

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
npm ci
node --test scripts/test-three-version-adoption.mjs scripts/test-three-version-g001.mjs scripts/test-three-version-candidates.mjs
npm run build
npm run electron:dev
```

- Si `npm ci` informa integridad o versión incompatible, **no** continuar con el despliegue. Contrastar el archivo final con `$HOME/Downloads/LevelForge-Three-Version-QA/candidate/package-lock.json` original (si todavía existe) para verificar exactamente el registro generado por npm en tu instalación; no forzar la instalación ni ejecutar `npm audit fix --force`.
- Verificar un proyecto existente, crear/guardar/abrir un modelo y entrar/salir de Play Mode. Confirmar adicionalmente SSR, Outline, Lensflare, WATER, cielo, PBR y Player exportado antes de declarar QA exhaustivo. La aprobación visual inicial no equivale a esa lista completa.
- Las 15 alertas previas de npm afectan al árbol de dependencias y deberán investigarse en un Gate independiente, sin mezclar actualizaciones.

## QA realizado en el entorno de preparación de entrega

Sin acceso a `registry.npmjs.org` (`EAI_AGAIN`), no es posible descargar `three@0.186.1` y ejecutar `npm ci`, Vite o WebGL aquí. Se verifican las estructuras de `package.json`/`package-lock.json`, sintaxis y pruebas Node que no requieren paquetes npm. Se distingue estrictamente entre esta evidencia y los PASS obtenidos en la instalación Linux del usuario.

## Historial de auditoría y preparación (estados supersedidos)

> Todo lo siguiente describe fases previas a la aprobación del candidato r186.1. Las menciones a “MIGRACIÓN BLOQUEADA” o “r170 conservada” **ya no representan el estado actual del baseline de entrega**.

**Gate autorizado:** `Listo. LF-THREE-VERSION-G001 autoriza comenzar` (2026-10-25).  
**Fuente de verdad:** `LevelForge_THREE_S05_G001_SOURCE_BASELINE.zip` (723 archivos, ZIP íntegro).  
**Estado de implementación:** **MIGRACIÓN BLOQUEADA**, se conserva **Three.js r170**. Se ejecutó la auditoría y se añadió una suite de preflight, sin modificar versiones, shaders ni runtime.  
**Motivo del bloqueo:** no es posible descargar e instalar `three@0.186.1` ni generar un lockfile válido (`npm view` falló con `EAI_AGAIN`); tampoco existe Vite local para compilar. El Gate exige no aplicar migración hasta comprobar la compatibilidad. La presencia de imports no demuestra compatibilidad WebGL o apariencia.

## Contrato de versiones

- `package.json`: `three: ^0.170.0`, `three-mesh-bvh: ^0.8.3`.
- `package-lock.json`: Three.js 0.170.0 y three-mesh-bvh 0.8.3. **No editar manualmente** `integrity`, `resolved` ni el grafo de dependencias.
- Objetivo evaluado: 0.186.1. La guía oficial recomienda actualizar en incrementos máximos de unas diez revisiones. **Secuencia propuesta en una copia aislada:** r170 → r180 → r186.1; no son dos cambios aplicados en producción.
- No cambiar WebGLRenderer por WebGPU, y no mezclar migración de física, WATER, CSM, LightProbe, simplificación o nueva GPU computation.

## Inventario técnico de compatibilidad

| Área y referencia del proyecto | Riesgo concreto | Estado y acción |
|---|---|---|
| `src/engine/runtime/render/chunks.js` | Sobrescribe globalmente `THREE.ShaderChunk.lights_fragment_maps`; r186 todavía conserva `getIBLIrradiance( geometryNormal )`, pero la compatibilidad del parche completo y del GLSL compilado no se infiere. Usa `inverseTransformDirection`, desaconsejado en r185. | **ALTO**: comparar programa GLSL final, clasico/realista y sondas SH; no migrar sin QA GPU. |
| `render/pbr.js`, `geometry/terrain.js`, `geometry/watershader.js`, `render/windlib.js`, `render/fogpatch.js` | Inyección de GLSL por `onBeforeCompile` y sustitución de chunks. | **ALTO**: compilar de verdad terreno, agua, niebla, PSX, viento y materiales PBR de varias capas. |
| `render/look.js`, `render/viewport.js` | Composer, SSRPass, OutlinePass, Lensflare, RectAreaLight, GTAO, resolución dinámica, MSAA y TAA. Las correcciones anteriores son específicas de r170. | **ALTO**: pruebas visuales con y sin SSR, Outline, Lensflare, cámara ortográfica, Mobile y Classic. |
| `render/scene/environment.js` | Importa `RGBELoader` para `.hdr`. En r186 existe aún como shim obsoleto; `HDRLoader` es el nombre oficial, sin necesidad de corregir antes de la prueba de dependencias. | **MEDIO**: reemplazo con prueba real de .hdr si la migración se desbloquea. |
| `render/static-batch.js` | BatchedMesh de decoración y `WEBGL_multi_draw`, culling/instancias. | **MEDIO-ALTO**: verificar API, fallback y tests de identidad y draw calls en r186. |
| `bake/core.js`, `bake/tracer.js` | Dependen de `three-mesh-bvh@0.8.3`; cambio mayor de tres.js puede romper uniforms/BVH o afectar baking visual. Changelog upstream de BVH 0.9.16 incluye corrección de BVHHelper con r186, **pero LevelForge no utiliza ese helper**; no justifica actualización automática de BVH. | **ALTO**: comprobar exports, lightmaps, sondas SH, raycasts y memoria; decidir versión BVH por evidencia. |
| `tools/editor/selection`, `render/look.js` | Selección, contorno e interacciones del editor frente al Player; efectos no deben filtrarse a juegos exportados. | **MEDIO**: QA separado en Editor/Player. |
| `scripts/test-three-s03.mjs` | Asume literal `package.json.dependencies.three === '^0.170.0'`. Tras migración el test fallaría por expectativa obsoleta aunque el runtime funcionase. | **BLOQUEO QA**: revisar esa expectativa **en el cambio real de versión**, no falsear resultados ahora. |
| `three/examples/jsm/*` y `three/addons/*` | Imports versionados utilizados en decodificación de GLB, EXR/HDR, luces y postprocesado. | **MEDIO**: resolver módulos bajo npm ci real para cada etapa. |

### Cambios documentados por upstream

- **r180–r181:** cambian la irradiancia especular indirecta, conservación de energía PBR y reflejos PMREM; pueden variar luces/materiales aunque no haya errores.
- **r183–r184:** se alinean rotaciones de environment/background; comprobar el cielo/IBL y orientación astronómica.
- **r184–r185:** `Object3D.updateWorldMatrix()` requiere `matrixWorldNeedsUpdate` cuando hay actualizaciones manuales de matrices; evaluar instancing y transformaciones.
- **r185–r186:** `Object3D.dispose()` y `SimplifyModifier` asíncrono; LevelForge no usa el modifier oficial, pero sí gestiona recursos propios. No cambiar ciclo de vida sin evidencia.
- **r179–r180:** `RGBELoader` se renombra a `HDRLoader` (en r186 se mantiene compatibilidad con aviso de deprecación).

Fuentes oficiales (verificar en cada nueva ejecución):
- https://github.com/mrdoob/three.js/wiki/Migration-Guide
- https://github.com/mrdoob/three.js/blob/r186/examples/jsm/loaders/HDRLoader.js
- https://github.com/mrdoob/three.js/blob/r186/examples/jsm/loaders/RGBELoader.js
- https://github.com/mrdoob/three.js/blob/r186/src/renderers/shaders/ShaderChunk/lights_fragment_maps.glsl.js
- https://github.com/gkjohnson/three-mesh-bvh/blob/master/CHANGELOG.md

## Evidencia del entorno de entrega

- `node --test` sobre todas las suites que no exigen dependencias externas (`test-starcat.mjs` excluida): **841 PASS, 0 FAIL, 15 SKIP** en r170.
- `node --test scripts/test-three-version-g001.mjs`: **6 PASS, 0 FAIL, 3 SKIP**. Revisa lockfile, inventario y riesgos de migración. Los tres SKIP requieren instalar Three.js y `three-mesh-bvh` para comprobar APIs reales.
- `npm view three@0.186.1 version --fetch-retries=0 --fetch-timeout=3500`: **EAI_AGAIN** (registro inaccesible). No se descargó la nueva versión.
- `npm run build`: **NO VERIFICADO**, `sh: 1: vite: not found`. No se afirma compilación Editor/Player bajo r170 ni r186 en este entorno.
- Prueba GPU y apariencia visual: **NO VERIFICADAS**. Ninguna modificación de producción aplicada.

## QA para desbloquear la migración — NO ejecutar sobre el proyecto activo

1. Conservar el ZIP aprobado de S05 intacto. Preparar **una copia aislada** del proyecto (no reemplazar archivos del directorio de trabajo habitual, especialmente ledger y scripts).
2. Verificar disponibilidad npm y ejecutar `npm ci` desde la copia; comprobar `node --test scripts/test-three-version-g001.mjs` y `npm run build` en r170 como referencia con dependencias reales.
3. En **otra copia temporal**, instalar `three@0.180.0` y generar su lockfile mediante npm; corregir solo incompatibilidades demostradas; ejecutar pruebas y build del Editor/Player. Repetir con `three@0.186.1` y lockfile resuelto por npm, nunca inventar integrities.
4. Registrar `node --test scripts/test-three-version-g001.mjs`, suite general, `npm run build`, tests de baking, SSR, Outline, Lensflare, WaterWorld, GLB/KTX2/Draco/Meshopt, materiales PBR, cielo, cámaras y raycast/Jolt. Corregir las expectativas de versión de los tests únicamente en una migración real.
5. Comparar capturas iguales con settings equivalentes, frame-time P95, draw calls, GPU y memoria sobre Intel UHD 605 en Editor y Player; revisar colores, exposición e iluminación tras cambios PBR/PMREM.
6. **Si alguna etapa falla o produce discrepancias relevantes**, mantener r170 y documentar qué incompatibilidad la causa. No pasar a la versión siguiente por omisión.
7. Solo tras pruebas y compatibilidad demostrada se autoriza reemplazar el runtime efectivo por r186.1 bajo el alcance de este Gate. El cambio de versión NO está entregado en este ZIP.

## Entrega

Esta entrega contiene una **auditoría ejecutada y suite de preflight**, con r170 intacto, no una migración completada. Los ZIP CHANGE y SOURCE_BASELINE conservan la fuente aprobada y las seis hojas del ledger registran el bloqueo. Sin dependencias ni artefactos generados ni archivos de suma SHA externos.

---

## Etapa de validación r180/r186.1 en copia aislada (continuación del mismo Gate, 2026-10-25)

**Evidencia recibida del usuario en Linux:** `npm ci` sobre el baseline r170 instaló 423 paquetes; `node --test scripts/test-three-version-g001.mjs` obtuvo **9 PASS, 0 FAIL, 0 SKIP**; `npm run build` compiló **Editor (755 módulos)** y **Player (355 módulos)**. Esta evidencia valida r170, no r186.1. npm informó 15 alertas de seguridad en dependencias; resolverlas requiere un Gate independiente de dependencias y no autoriza `npm audit fix --force`.

**Bloqueo en este entorno:** la consulta a `registry.npmjs.org` continúa devolviendo `EAI_AGAIN`. No se puede instalar aquí r180 ni r186.1, generar lockfiles por npm, compilar con esas revisiones o comprobar los cambios visuales. **No se ha cambiado la dependencia de producción**. No generar hashes de integridad ni resultados fingidos.

**Instrumentación añadida:** `scripts/qa-three-version-candidates.mjs` ejecuta la migración experimental **en una única copia aislada** y guarda un log por operación. El proyecto fuente no se modifica. Se añadió `scripts/test-three-version-candidates.mjs` para verificar el aislamiento, bloqueo de saltos y continuidad; `scripts/test-three-s03.mjs` deja de fijar r170 en una aserción que antes invalidaba toda actualización, comprobando en su lugar coincidencia manifiesto/lockfile y revisiones r170/r180/r186. Este cambio afecta solo al test, no al runtime.

### Ejecución reproducible en Linux

Desde la carpeta original del motor, después de aplicar este CHANGE:

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-three-version-candidates.mjs
node scripts/qa-three-version-candidates.mjs --check
node scripts/qa-three-version-candidates.mjs --stage=r180
```

Si r180 termina **PASS** (preflight, regresión y compilación de Editor + Player), continuar sobre **la misma copia candidata**:

```bash
node scripts/qa-three-version-candidates.mjs --stage=r186.1
```

El experimento se ubica por defecto en `$HOME/Downloads/LevelForge-Three-Version-QA/`: `candidate/` contiene el proyecto experimental, mientras que `reports/` guarda registros de npm, tests y compilación y `estado.json` indica `PASS/FAIL`. El runner mantiene una sola copia de dependencias para no duplicar espacio en equipos modestos. El resultado se detiene al primer fallo y **NO actualiza automáticamente el proyecto activo**, incluso si r186.1 compila. Reutilizar el mismo `--output` es obligatorio entre etapas; para comenzar desde cero, eliminar manualmente la carpeta experimental una vez respaldadas las evidencias o seleccionar otra ruta.

**Criterios para declarar migración completa:** resultados PASS en r180 y r186.1 más inspección manual del Editor/Player en la GPU del usuario; comparar escenas y pruebas de agua, cielo, PBR, sombras, baking, SSR, Outline, Lensflare, BatchedMesh, GLB y colisiones. Ningún `npm run build` prueba esos comportamientos por sí mismo. Si falla una etapa, se conserva r170 y se analiza el error antes de adaptar shaders o dependencias.

**Estado tras esta continuación:** preflight de aislamiento **6 PASS / 0 FAIL**, cambios de test y documentación aplicados, **migración r186.1 pendiente de ejecución en Linux y de QA WebGL**. El siguiente Gate no debe comenzar hasta resolver los bloqueos o acordar conservar r170.

**Nota de regresión en candidatos:** `test-three-version-candidates.mjs` solo valida el runner desde el baseline r170 y se excluye de las regresiones r180/r186; el preflight de versión (`test-three-version-g001.mjs`) sí se ejecuta en cada candidato. `test-starcat.mjs` conserva su exclusión previa.
