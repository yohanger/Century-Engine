# QA CORR-001

- Causa: dos `:class` en el mismo elemento Vue.
- Corrección: un único `:class` con ambas claves.
- Ejecutar `node --test scripts/test-editor-assets-s03-corr001.mjs scripts/test-editor-assets-s03-g001.mjs` con `node_modules` instalados.
- Ejecutar `npm run build` y `npm run electron` localmente.
- QA visual Electron pendiente de usuario.
