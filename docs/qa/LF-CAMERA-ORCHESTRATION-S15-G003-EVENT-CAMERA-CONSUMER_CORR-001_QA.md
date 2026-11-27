# S15-G003 CORR-001 · QA de vinculación de nodos

**Estado:** fuente implementada; QA LOCAL PENDIENTE. No confundir tests Node con revisión visual en Electron o VS Code Flatpak.

## 1. Comandos locales (raíz con `package.json`)

```bash
node --test scripts/test-node-reference-s15-g003-corr001.mjs
node --test scripts/test-node-reference-s15-g003-corr001.mjs scripts/test-camera-orchestration-s15-g003.mjs scripts/test-camera-orchestration-s15-g002.mjs scripts/test-node-reference-resolution-s01-g001.mjs scripts/test-vscode-local-bridge-s04-g001.mjs
npm run build
npm run vscode:prepare
npm run electron
```

**Esperado con las dependencias npm existentes del proyecto:** 9 PASS en el primer comando, 79 PASS en la batería seleccionada, compilación Editor/runtime exportable y empaquetado VSIX 0.1.5 sin errores. Estos resultados todavía deben comprobarse en Linux local. Las advertencias de chunk de Vite no prueban por sí solas fallo de implementación.

## 2. QA Electron · editor JavaScript de evento

1. Sobre un proyecto de prueba con nodo `Camera3D` y un nodo común (p. ej. `Node3D`), abre el comando **Script (JavaScript)** de un evento. Confirma que CodeMirror sigue mostrando el código anterior sin borrarlo.
2. Escribe texto, sitúa el cursor en una línea, despliega **Insertar nodo…**, elige Camera3D. Se debe insertar una expresión `game.node("<ID real>")` en el cursor; no un nombre editable ni valores `[x,y,z]`.
3. Comprueba que otra selección del desplegable inserta un segundo nodo sin borrar la primera referencia. En Play, `const cam = game.node("<ID>")` debe devolver `NodeHandle`; comprueba `cam?.is_valid()`, `cam?.position`, `cam?.rotation`, `cam?.visible`. Por ejemplo, `await game.say(String(cam?.position))` en un proyecto de prueba con el comando de diálogo disponible.
4. Si se puede arrastrar físicamente desde Jerarquía al CodeField (sin modal que cubra el árbol), verifica inserción en el punto de soltado. No se debe mover, duplicar o desemparentar el nodo.
5. Elimina el nodo o cambia de escena y vuelve a ejecutar: `game.node("<ID>")` no debe devolver un nodo distinto por coincidencia de nombre; una referencia antigua debe ser inválida. Se debe manejar explícitamente `undefined` en scripts del usuario.
6. Guardar, cerrar/reabrir el proyecto y comprobar que el código conserva los IDs y que el Editor no inserta objetos serializados adicionales.

## 3. QA VS Code Flatpak · Local Bridge

1. En Electron, abre un script real de `Assets/` mediante la integración existente de VS Code. Asegúrate de que la extensión instalada sea **LevelForge 0.1.5**. Si VS Code estaba abierto al actualizar, ejecuta **Developer: Reload Window** una vez (el Editor no debe reemplazar la ventana arbitrariamente).
2. Pon el cursor dentro del script abierto, en el lugar deseado. Vuelve a Jerarquía en Electron, clic derecho en un nodo y elige **Insertar referencia en VS Code**.
3. Debe aparecer `game.node("<ID estable>")` en la selección de VS Code y permanecer editable, con Ctrl+Z funcionando. No debe abrir ni alterar otro script.
4. Selecciona en VS Code un archivo ajeno al proyecto, un archivo de otro proyecto o un archivo que no sea JavaScript de `Assets/`. Repite la operación: debe rechazarla sin editarlo.
5. Abre otro proyecto de LevelForge o elimina el nodo seleccionado antes de enviar la referencia: no debe insertar identificadores cruzados.
6. Guarda el script, vuelve al Editor y comprueba sincronización con su recurso existente; no debe crearse script duplicado ni perderse cambios locales.
7. El arrastre **directo** desde Electron hasta VS Code es un requisito UX aún sin verificación y no se ofrece como completado por este Gate; evaluar la alternativa de menú por separado.

## 4. Regresiones y evidencia pendiente

- Comandos **Mundo → Controlar cámara** de G003: activar, cambiar, liberar keep y volver a base; no deben alterarse al insertar referencias en otros scripts.
- S15-G002: Timeline/Play Mode/FPS heredado y Camera3D continúan funcionando; un script puede usar `game.camera.acquire(cam.id)` a partir de un `NodeHandle` resuelto.
- No se modifican datos de Database ni formatos `.lfproj`.
- Entregar salida Node y `npm run build`, versión de la extensión, capturas o descripción de ambos flujos y errores de consola si aparecen. La prueba independiente del runtime exportado permanece como evidencia de integración del Sprint, no como requisito satisfecho por build.

**Criterio de aprobación:** funcionalidad real satisfactoria en Electron y VS Code, sin regresiones ni sobrescritura; aprobación expresa del usuario. Hasta entonces: IMPLEMENTADO, TEST NODE PASS limitado, COMPILADO/QA LOCAL NO VERIFICADO, NO APROBADO, NO CERRADO.
