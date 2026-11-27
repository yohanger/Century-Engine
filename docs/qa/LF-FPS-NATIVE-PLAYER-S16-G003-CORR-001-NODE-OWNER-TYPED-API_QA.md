# LevelForge S16-G003 CORR-001 — Tipado contextual del propietario de Script de Nodo

Fecha: 2026-11-12. Gate autorizado literalmente. Baseline de entrada: `LF_FPS_NATIVE_PLAYER_S16_G003_CHARACTERBODY3D_JOLT_SCRIPT_API_SOURCE_BASELINE.zip`.

## Diagnóstico

**OBSERVADO:** el usuario comprobó que su `CharacterBody3D` se mueve en Editor al añadir un cuerpo de colisión. En VS Code aparece `TS2339: Property 'velocity' does not exist on type 'NodeScriptHandle'`.

**CAUSA RAÍZ CONFIRMADA:** G003 añadió `velocity`, `ground`, `onFloor`, `onWall` y `onCeiling` al handle físico dinámico (`play-nodes.js`), pero `src/core/events/game-api.d.ts`, su copia para VS Code y el VSIX entregado no recibieron la API. Además, la declaración global única `node: LF.NodeScriptHandle` no distingue los propietarios reales del recurso.

**CONEXIÓN OLVIDADA:** las capacidades del runtime no llegaron a la interfaz pública del editor de scripts. No es un fallo demostrado de Jolt ni una razón para crear otro sistema de física.

## Mecanismo dentro del Gate

- Añadida `LF.CharacterBody3DNodeScriptHandle` a la declaración maestra existente, sin introducir propiedades físicas en `LF.NodeHandle` ni `LF.NodeScriptHandle` general.
- El Editor usa la lista autoral `scriptIds` / compatibilidad `scriptId` y revisa **todas las escenas y Prefabs guardados**. Genera `.levelforge/script-owners.json` solo para archivos `Assets/**/*.js` de Scripts de Nodo con propietario físico inequívoco. Un recurso reutilizado en `CharacterBody3D` y otro tipo, no asignado o Global queda genérico.
- La extensión LevelForge 0.1.6 contribuye un plugin de servicio TypeScript integrado. Para el archivo conocido, añade al análisis **virtual** una declaración local con tipo específico al final del texto. Las posiciones del código original no se desplazan y el archivo JavaScript real no se reescribe. El runtime sigue recibiendo el `node` que ya entrega `NodeScriptRuntime`.
- La recarga de los proyectos TypeScript se solicita cuando cambia el mapa de asociaciones. No se generan scripts de usuario, controladores, estados físicos ni catálogos de nodos paralelos.
- La extensión conserva su mismo identificador `levelforge.levelforge`; el VSIX pasa de 0.1.5 a 0.1.6 y se mantiene el flujo existente de empaquetado.
- Sin modificación de Camera Orchestration, Jolt, Database, exportación ni `FpsPlayer`.

## Evidencia automatizada (entorno de trabajo)

- `NODE_PATH="$(npm root -g)" node --test scripts/test-fps-native-player-s16-g003-corr001-node-owner-types.mjs`: 8 PASS / 0 FAIL, incluido un servicio TypeScript real disponible globalmente para las comprobaciones de diagnósticos.
- `node --test scripts/test-fps-native-player-s16-g003-characterbody3d-api.mjs scripts/test-vscode-default-script-editor-s02-g001.mjs`: 15 PASS / 0 FAIL.
- El diagnóstico `TS2339` desaparece en el archivo con propietario inequívoco; permanece donde faltan propiedades realmente disponibles. No se suprimen diagnósticos arbitrariamente.
- Integridad de VSIX incluido: comprobación ZIP/CRC, versión y recursos de plugin. **Empaquetador oficial @vscode/vsce NO VERIFICADO** en este entorno por ausencia de `jszip`/dependencias npm; la extensión distribuida se materializó offline conservando la estructura VSIX de 0.1.5 y verificando el manifiesto. Debe reconstruirse/verificarse con `npm ci && npm run vscode:prepare` en el entorno local antes de dar PASS al flujo oficial.
- Build Vite / Electron / VS Code real / NGM Runtime: **NO VERIFICADOS**, por lo que el Gate sigue abierto hasta QA local.

## QA local requerido

1. En una copia limpia del SOURCE_BASELINE, ejecuta `npm ci`, `node --test scripts/test-fps-native-player-s16-g003-corr001-node-owner-types.mjs scripts/test-fps-native-player-s16-g003-characterbody3d-api.mjs scripts/test-vscode-default-script-editor-s02-g001.mjs`, `npm run vscode:prepare`, `npm run build` y `npm run electron`.
2. Abre tu proyecto con un Script de Nodo asociado a `CharacterBody3D`, guarda el proyecto y abre ese script desde LevelForge en VS Code (la extensión debe mostrar versión 0.1.6). Comprueba `node.velocity`, `ground`, `onFloor`, `onWall`, `onCeiling`, autocompletado y ausencia de TS2339.
3. Prueba un Script de Nodo sin asociación y otro compartido entre `CharacterBody3D` y un nodo de otro tipo. No deben ofrecer `velocity` como capacidad universal; acceder a ella sin comprobación debe generar diagnóstico.
4. Cambia las asociaciones, guarda y verifica la recarga de tipos. Comprueba que un prefab sin instancia también cuenta para la ambigüedad.
5. Ejecuta Play, confirma que los scripts originales no se reescribieron, que el personaje mueve con Jolt y que los demás nodos y scripts siguen funcionando. La paridad NGM Runtime y el empaquetado real VS Code quedan separados de las pruebas Node.
6. Devuelve resultados de terminal, versión de la extensión, errores `TS2339` si persisten y capturas del IntelliSense y la consola.

## Estado

**IMPLEMENTADO EN FUENTES; TEST AUTOMATIZADO SELECT PASS; VSIX ARCHIVO VERIFICADO; COMPILACIÓN Y QA VS CODE LOCAL NO VERIFICADOS; APROBACIÓN/CERRADO PENDIENTES.** El G004 de locomoción sigue sin autorización.

## Aplicación de CHANGE

CHANGE está destinado exclusivamente a una copia **intacta** del SOURCE_BASELINE G003. Tras extraer CHANGE en la raíz del proyecto, elimina únicamente `vendor/vscode-extension/levelforge-0.1.5.vsix` (la versión sustituida); la nueva `levelforge-0.1.6.vsix` y `manifest.json` quedan en la misma carpeta. Si prefieres SOURCE_BASELINE completo, extráelo en una carpeta nueva y **no** superpongas CHANGE. Preserva tus proyectos y modificaciones locales.
