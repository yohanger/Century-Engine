# QA — LF-EDITOR-VIEWBAR-NAV-DEVICE-CORR-G001

**Estado:** IMPLEMENTADO · TEST NODE PASS · BUILD Y QA LOCAL PENDIENTES · NO CERRADO.
**Contrato:** `LF-EDITOR-VIEWBAR-UX-CA-002` (sustituye CA-001).

## Pruebas automatizadas

- Runner específico `node --test scripts/test-editor-viewbar-nav-device-corr-g001.mjs`: **15 pruebas** del botón de icono, ausencia de texto/selector, comandos, navegación, iconos originales, accesibilidad, estado único, Preferencias, menú Ver y persistencia.
- Regresiones: `test-editor-viewbar-ux-g001.mjs`, `test-editor-viewbar-render-selector-corr-g001.mjs` (ahora CA-002, sin borrar histórico), `test-editor-editmode-ux-s02-g002.mjs`, cámara/FOV, Scene, Snap y Assets.
- Invocar `npm run test:viewbar-nav-device` tras aplicar CHANGE. **Node PASS no demuestra gestos físicos**, sensibilidad ni compatibilidad del renderer en Electron.
- `npm run build`, `npm run electron`, QA real de ratón y trackpad: **NO VERIFICADOS** en este entorno si faltan dependencias.

## QA local obligatorio (usuario)

1. En Escena debe aparecer **un único icono de ratón**, sin texto ni lista de perfiles de render. Mantener el cursor encima muestra modo activo y acción de alternar.
2. Pulsarlo cambia icono a **trackpad**; pulsarlo otra vez vuelve a ratón. Comprobar foco con Tab y activación con Enter/Espacio, tooltip, `aria-label` y modo accesible.
3. Con ratón, comprobar rueda/órbita/desplazamiento según preferencias actuales. Con trackpad, probar gestos de dos dedos, pellizco y Shift + dos dedos. Cambiar sensibilidad/inversión en Preferencias y observar efecto.
4. Cambiar en Preferencias y desde **Ver → Navegación: ratón/trackpad**: el icono debe reflejar inmediatamente el valor, sin duplicar estado. Reiniciar Editor y verificar persistencia.
5. Abrir menú **Ver → Render del viewport**: métodos Forward+, Mobile, Compatibility y Del proyecto siguen ahí. ViewBar no presenta PC/Portátil/Compatibilidad. Asegurar que `project.render` y el Player siguen inalterados.
6. Entrar en Juego y Edit Mesh. Verificar que el icono no aparece en Juego, que el viewport soporta ventanas estrechas, y que FOV/gizmos no reaparecen como controles redundantes.
7. Ejecutar pruebas de regresión, compilación y arranque. No atribuir fallos Jolt WASM anteriores a este cambio de interfaz.

**Evidencia a devolver:** salida completa de Node y `npm run build`, captura de icono en cada estado, reporte de gestos de trackpad/ratón y resultado de Play/Player (si Jolt permite iniciar).
