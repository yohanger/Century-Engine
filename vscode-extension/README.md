# Century para VS Code

1. Guarda el proyecto en una **carpeta** desde Century de escritorio.
2. Usa **Juego → Abrir proyecto en VS Code** para abrir la carpeta que contiene `project.lfproj`. Para abrir y enfocar un archivo concreto, haz doble clic en el `.js` desde Assets. Usa el menú contextual **Ejecución** para elegir **Global** o **Nodo**.
3. Edita y guarda el `.js` bajo `Assets/`. Century incorpora la edición al proyecto abierto. Guarda también en Century para escribirla dentro de `project.lfproj`.

VS Code usa `jsconfig.json`, `.levelforge/api.d.ts` y `.levelforge/project.d.ts` para sugerir la API y los nombres del proyecto. Century conserva el `jsconfig.json` existente. Si mantienes uno propio, incluye `Assets/**/*.js` y `.levelforge/*.d.ts` para obtener esos tipos.

## Qué añade la extensión

- **Century: Nuevo script** crea el archivo bajo `Assets/` a partir de la plantilla. Century lo importa como Global. Para empezar con la plantilla de Nodo, créalo desde Assets en Century.
- **Century: Preparar proyecto** crea `jsconfig.json` y `.levelforge/api.d.ts` cuando faltan.
- **Century: Ver referencia de la API** consulta la API generada para la raíz activa, con la copia incluida como respaldo. Busca `game.*` o `node.*` para consultar métodos como `node.connect` y `node.expose`.
- Snippets con prefijo `lf-` e indicador de estado. En un Script de Nodo, usa `lf-node-signal`, `lf-node-emit` y `lf-node-expose` para declarar señales, emitirlas y publicar métodos. En un espacio de trabajo con varios proyectos, usa el Explorador de la raíz deseada o activa un archivo de esa raíz antes de ejecutar el comando.

## Instalar o actualizar

Century comprueba la extensión al abrir un proyecto o script en VS Code. Si falta o es anterior a la incluida, la instala o actualiza y verifica el resultado. Si es igual o más reciente, la conserva. No necesitas terminal, copiar carpetas ni descargar un VSIX.

Funciona con VS Code nativo y con `com.visualstudio.code` de Flathub. Century utiliza la misma instalación para comprobar, instalar y abrir; conserva la prioridad nativo → Insiders → VSCodium → Flathub. En Windows utiliza el ejecutable y CLI de la misma instalación.

Si falla, el diálogo de Century muestra el motivo y permite **Reintentar** o **Cancelar**. Si VS Code ya estaba abierto, puede ser necesario recargar su ventana para activar una actualización. No se cambia el perfil predeterminado del CLI ni se habilitan extensiones que hayas deshabilitado deliberadamente.

Para desarrollar o distribuir el motor: `npm run vscode:prepare` desde la raíz genera el VSIX con vsce y comprueba que los tipos coincidan. `npm run electron`, `npm run electron:dev` y el empaquetado Linux/Windows lo preparan automáticamente. La aplicación distribuida ya incluye el paquete y no necesita npm para instalarlo. No se publica en Marketplace.

## Comunicación local con Century

Desde 0.1.4, la extensión mantiene un canal local con la aplicación para abrir scripts en la ventana del proyecto correcto. Con la conexión activa, Century envía la apertura y espera confirmación sin invocar nuevamente el CLI ni consultar extensiones.

Sin conexión, el motor conserva su instalación y lanzamiento automáticos. Si VS Code estaba abierto con una versión anterior al actualizar, recarga su ventana una vez y reintenta desde Century. No necesitas instalar un servidor ni cambiar permisos de Flatpak. El archivo temporal `.levelforge/vscode-session.json` identifica la sesión; no debe copiarse a otros proyectos ni forma parte del juego exportado.

El canal solo atiende scripts `.js` dentro de Assets de su proyecto. La sincronización de contenido y sus reglas de conflicto siguen a cargo de Century. La conexión se retira al cerrar o cambiar de proyecto y se recupera al volver a abrirlo.

## Notas

- Con el proyecto sincronizado, escribe los callbacks en VS Code. Guarda el archivo y vuelve al panel **Signals** para elegir el método publicado.
- Century acepta `return` al nivel superior de un script. El analizador de VS Code puede señalarlo.
- La sincronización cubre `.js` bajo `Assets/`. El código de un comando «Script» de un evento se edita en Century.
- `node scripts/sync-extension.mjs` actualiza la copia de la API y su lector desde el código de Century.

### Tipos del propietario (CharacterBody3D)

Al abrir o guardar el proyecto, Century genera `.levelforge/script-owners.json` a partir de las asociaciones reales en todas las escenas y Prefabs. La extensión usa esa información mediante el servidor TypeScript para reconocer `node.velocity`, `node.ground`, `node.onFloor`, `node.onWall` y `node.onCeiling` en scripts asociados **solo** a CharacterBody3D. No modifica el JavaScript ni crea otro cuerpo físico.

Un script compartido con otros tipos de nodos, sin asociación, con escenas no leídas o con varias clases de propietario conserva `LF.NodeScriptHandle`, sin propiedades físicas engañosas. Si cambias asociaciones en Century, guarda el proyecto y vuelve a VS Code. Si las sugerencias no se actualizan, ejecuta «TypeScript: Restart TS Server». No cambia los tipos de `game.node()` ni de `node.get_node()` .

### Propiedades editables

Para recursos Nodo identificados en `script-owners.json`, el servicio TypeScript analiza las directivas `@editable`, `@header`, `@header_descripcion` y `@editable_description` (también la grafía anterior `@editable_descricption`) con la gramática compartida del runtime. Los archivos JS del usuario no se reescriben. Los diagnósticos de directivas inválidas se mantienen visibles.
