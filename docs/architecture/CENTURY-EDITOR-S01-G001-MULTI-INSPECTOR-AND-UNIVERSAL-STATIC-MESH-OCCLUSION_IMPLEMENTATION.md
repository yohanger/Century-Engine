# Implementación — Inspector multiselección y oclusión sobre geometría real

## Inspector

`src/core/state/multi-inspector.js` añade transacciones comunes de selección sin duplicar `updateObject()`. El componente `Inspector.vue` conserva el flujo individual intacto y sustituye su antigua rama de multiselección vacía por las propiedades compartidas, estados mixtos, transformaciones locales por eje, apariencia compatible, Escalones/Recibe cortes cuando todos admiten esas propiedades y acciones de grupo.

Una operación común valida todos los nodos y genera un único commit. No convierte los controles de referencia, animación, scripts o componentes especializados en ediciones masivas no seguras. Las propiedades especializadas que no compartan todos los tipos permanecen fuera de la edición conjunta.

## Oclusión

- `occlusion-static.js`: elimina el criterio de cubo unitario; verifica elegibilidad por malla, material y geometría fija. Se preserva el estado Estático previo (`props.batchStatic`).
- `occlusion-patches.js`: genera parches geométricos internos sobre triángulos y firmas de integridad; admite geometría indexada y no indexada, incluyendo Edit Mesh. Los parches no atraviesan huecos no triangulados.
- `occlusion-bake.js`: cambia la entrada de oclusores de cajas ficticias a superficies reales, itera por lotes de mallas y parches en GPU y admite bake sin candidatos sin lanzar el error de primitivas.
- `camera-occlusion.js`: verifica la geometría/matriz/material actual, utiliza AABB real para el plano cercano y falla abierto ante discrepancias.
- `core/state/occlusion.js`: no guarda un bake asíncrono si cambió la revisión del proyecto durante el cálculo.
- `EngineSettingsModal.vue`: actualiza la indicación de horneado sin exigir Cubo o Plano.

El coste y la eficacia del shader solo pueden acreditarse en un entorno real WebGL2: la versión de este Gate no contiene resultados GPU comprobados. Los parches interiores pueden generar menos descartes que superficies fusionadas más grandes. No se promete aceleración ni un porcentaje de reducción de polígonos.

## Evidencia

La batería `scripts/test-multi-inspector-universal-occlusion.mjs` contiene 20 comprobaciones de contratos con dobles de estado y matemática; `test-inspector-global-folding-s13-g002.mjs` contiene 17. El contrato del test histórico de secciones se actualizó de 36 a 40 por las cuatro secciones añadidas. `test-camera-occlusion-s17-g002.mjs` conserva las comprobaciones históricas y suma invalidación del horneado y mutación directa de geometría.

**Estado:** IMPLEMENTADO · QA NODE CONTRATOS PASS · COMPILACIÓN/WEBGL2/ELECTRON NO VERIFICADOS · PENDIENTE DE APROBACIÓN Y CIERRE.
