# LF-THREE-S02-G001 — Iluminación de área rectangular

**Fuente de entrada:** `LevelForge_OPENCODE_CONFIG_G001_SOURCE_BASELINE.zip` (710 entradas, ZIP íntegro).  
**Autorización exacta:** `Listo. LF-THREE-S02-G001 autoriza comenzar` (2026-10-25).  
**Estado:** IMPLEMENTADO EN CÓDIGO; QA VISUAL, EDITOR/PLAYER, EXPORT Y APROBACIÓN PENDIENTES.

## Contrato implementado

- T01: `RectAreaLight` oficial como variante **área** del nodo `light` existente. Se conserva el mismo registro y los contratos de serialización y scripting. Nuevos campos `light.areaWidth` y `light.areaHeight` (metros, rango 0,05–100, valores iniciales 2 × 1). Color, energía, temperatura y estilo siguen usando el circuito existente.
- `RectAreaLightUniformsLib.init()` en `Viewport` compartido por Editor y Player antes del primer render. Import desde `three/addons/lights/RectAreaLightUniformsLib.js` de la versión actual r170; no se actualizó Three.js.
- Inspector: selección de tipo, ancho y alto editables y un contorno rectangular editor-only, alineado con la orientación -Z del motor.
- Restricciones reales: Three.js RectAreaLight solo ilumina materiales PBR; **no tiene sombras propias ni distancia de corte**. El Inspector no presenta controles de sombras/rango/volumétrica ni modos de baking para este tipo; el runtime ignora tales campos antiguos incluso si llegan a través de serialización. `collectBakeScene` lo excluye deliberadamente: el baker actual solo representa punto, spot y direccional. No se simulan capacidades inexistentes.
- Scripts de luces: encendido/apagado, color, energía y fundidos conservados; `range` se trata como no aplicable (0) y `shadow` no se puede activar en una luz de área. Las luces viejas siguen con las mismas rutas.

## T02 — CSM: evaluación únicamente

- `three/addons/csm/CSM.js` es un sistema oficial WebGL de sombras direccionales en cascadas. LevelForge ya cuenta con sombras direccionales configurables (`shadowDistance`, `shadowRes`), actualización en caché, baking separado y pipeline Forward+ con posprocesado. Insertar CSM en el mismo Gate modificaría sombreado, costes de GPU, materiales y actualización de cascadas, sin presupuesto medido. **PENDIENTE PLANIFICADO; NO IMPLEMENTADO.**
- La evaluación futura deberá medir varias cascadas, artefactos de transición, compatibilidad con el sol astronómico, modalidades de render y rendimiento N5030/UHD605. No extrapolar datos de otros GPUs.

## T03 — LightProbe: evaluación únicamente

- Three.js ofrece `THREE.LightProbe`, pero LevelForge ya dispone de sondas SH y lightmaps en `bake/runtime.js`, `bake/tracer.js` y `render/pbr.js`. Duplicar sondas crearía dos autoridades para irradiancia. **PENDIENTE PLANIFICADO; NO IMPLEMENTADO.**
- Solo considerar una adaptación si hay un caso de uso verificable que las sondas SH actuales no cubran; mantener compatibilidad y evitar un segundo sistema GI.

## Evidencia automatizada

- `node --test scripts/test-three-s02.mjs`: 8 PASS, 0 FAIL, 1 SKIP (pruebas dinámicas sin `three` instalado).
- Regresión ejecutable `node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' | sort)`: **786 PASS, 0 FAIL, 10 SKIP**. La suite `test-starcat.mjs` se excluyó porque depende de Three.js no instalado.
- `node --check` de los módulos JS modificados: PASS.
- `npm run build`: **NO VERIFICADO** (`vite: not found`). La resolución npm falló con `EAI_AGAIN` (sin acceso al registro). No se pudieron ejecutar la compilación Editor/Player, WebGL ni pruebas Three.js reales.

## QA en Linux del usuario (obligatorio)

1. Antes de extraer, comparar cada archivo de CHANGE contra los cambios locales actuales; no sobrescribir un archivo modificado sin resolver el conflicto.
2. Ejecutar `npm ci` solo si es necesario y las dependencias ya no están presentes; luego `node --test scripts/test-three-s02.mjs`, el resto de regresiones y `npm run build` (Editor **y** Player).
3. Abrir proyecto antiguo con PointLight, SpotLight y DirectionalLight y confirmar que conservan valores, sombras, animaciones y guardados.
4. Crear desde el menú de luces una **Luz rectangular**. En Inspector ajustar ancho/alto/color/energía y comprobar visualmente la iluminación sobre una primitiva `MeshStandardMaterial` y sobre `MeshPhysicalMaterial`.
5. Confirmar emisión hacia **-Z**, orientación conforme rota el nodo y que el marco del editor se oculta en Play Mode/Player.
6. Confirmar que no hay controles falsos de sombras, distancia, volumétrica ni baking para área. La nueva luz no proyecta sombras: **limitación de Three.js, no un bug que pueda marcarse FAIL**.
7. Probar ciclo Editor ↔ Play ↔ Player exportado, guardar/recargar proyecto, cambiar de tipo de luz y confirmar ausencia de errores WebGL y fugas evidentes.
8. Revisar rendimiento en el equipo objetivo y compararlo con la escena equivalente sin luces de área. Documentar número de luces y condiciones; no afirmar costes FPS sin medición.

**Evidencia del usuario:** salida de Node/Vite, captura de rectángulo iluminando superficies PBR, comportamiento tras guardado/reapertura y observaciones de rendimiento. **El Gate requiere QA local y aprobación expresa para considerarse cerrado.**

**Documentación oficial:** https://threejs.org/docs/pages/RectAreaLight.html ; https://threejs.org/docs/pages/CSM.html ; https://threejs.org/docs/pages/LightProbe.html
