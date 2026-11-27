# Corrección del fixture

- `scripts/fixtures/mesh/edit-session-integration-corr-g001.mjs`: sustituye el objeto de proyecto construido manualmente por `createProjectData('Malla QA','empty-project')`. Conserva la identidad del proyecto de prueba, sus objetos y recursos de malla, el terreno desactivado y los ajustes explícitos de Snap. Mantiene el resto de defaults nativos, incluida la escena activa, el registro `tagLayers`, recursos y audio. Se mantiene la sesión, el visor de prueba y la configuración del historial.
- `scripts/test-edit-mesh-inspector-ux.mjs`: añade una comprobación de contrato del fixture y una reproducción con `layerName` y `defaultTagLayers` reales, sin cambiar las 12 pruebas originales.
- `scripts/test-mesh-edit-integration-corr-g001.mjs`: añade una prueba de integración con el fixture real para validar el registro de capas, escena activa, recursos, audio, selección de mallas vinculadas y condiciones del escenario. No se alteran las assertions existentes.
- La página HTML de QA Electron y el runner de las 19 comprobaciones son idénticos al baseline. Los archivos bajo `src/` no cambian.
