# Century

**Motor de videojuegos 3D y entorno de creación visual.**

Century reúne en una aplicación de escritorio las herramientas para construir escenas, programar interacciones, diseñar sistemas de juego y ejecutar proyectos con un runtime propio. Su enfoque combina un **editor basado en nodos**, **eventos visuales** y **scripting JavaScript**, con especial atención a los juegos 3D interactivos y narrativos.

> **Estado del proyecto:** base funcional destinada al desarrollo del primer videojuego. **Versión del código examinado:** `0.26.13`. Century continúa evolucionando; esta numeración no representa una versión 1.0 ni una certificación de compatibilidad general.

[Documentación](docs/index.md) · [Primeros pasos](docs/web-src/primeros-pasos.md) · [Arquitectura del runtime](src/engine/runtime/index.js)

## Estado del sistema de agua (CA-006)

Los nodos y la simulación de agua anteriores han sido **retirados**. Century no dispone todavía de una nueva simulación de fluidos: esa biblioteca y su futura integración con el agua requerirán investigación y autorización independientes. Los datos de agua y los recursos `.liquid` almacenados en proyectos existentes no se borran automáticamente, pero ya no se ejecutan ni ofrecen herramientas de autoría física.

Para la ejecución normal de Electron, primero se necesita una compilación local (`npm run build`), seguida de `npm run start` o `npm run electron`; no se inicia el servidor Vite salvo con `electron:dev`.

## Qué ofrece

### Editor 3D

- **Escenas y jerarquía de nodos:** organización de objetos, cámaras, luces, recursos y lógica de juego.
- **Viewport e Inspector:** selección, navegación, transformaciones y edición de propiedades, con paneles de trabajo acoplables.
- **Geometría y entornos:** primitivas, modelos 3D, herramientas de edición de mallas, terrenos y elementos de escena.
- **Materiales y renderizado:** materiales PBR, iluminación, sombras, postprocesado y editor visual **Shader Graph**, sobre Three.js.
- **Recursos del proyecto:** gestión de Assets, escenas, Prefabs, scripts, materiales e interfaces.

### Gameplay y programación

- **Física con Jolt Physics (WASM):** cuerpos estáticos y dinámicos, formas de colisión y `CharacterBody3D`.
- **Scripting JavaScript:** scripts globales y por nodo, ciclo de vida y API del motor.
- **Eventos visuales:** comandos, condiciones y secuencias mediante **Event Order Flow**.
- **Cámaras, entrada e interacción:** herramientas para organizar la experiencia del jugador y controlar elementos de la escena.
- **Database y guardado:** recursos y APIs para el estado del juego, variables y persistencia.
- **Interfaces de usuario:** Canvas, recursos `.ui`, editor visual y localización de textos.

### Animación, audio y herramientas complementarias

- **Timeline:** secuencias y animación de propiedades de nodos.
- **Audio:** recursos de sonido, reproducción espacial y herramientas de mezcla.
- **Cinematics:** integración con recursos de **Nether FilmMaker**.
- **VFX y entornos:** sistemas de efectos y fenómenos ambientales disponibles en el editor y el runtime.
- **Integración con VS Code:** edición externa de scripts mediante la integración local y las declaraciones de API de Century.
- **Control de versiones:** herramientas de Git integradas en el editor.

Las características dependen de la configuración de la escena y de los recursos utilizados. La presencia de una herramienta o API no garantiza por sí sola su validación en todas las plataformas y configuraciones de hardware.

## Arquitectura

Century separa la **autoría de contenido** de su **ejecución en el juego**. El editor y la aplicación exportada comparten el núcleo del runtime; el juego distribuido no necesita abrir el editor.

| Parte | Ubicación principal | Responsabilidad |
| --- | --- | --- |
| Editor visual | `src/App.vue`, `src/components/`, `src/core/` | Interfaz, flujo de edición y gestión de proyectos. |
| Runtime del motor | `src/engine/runtime/` | Escenas, ejecución, física, eventos, render y servicios de juego. |
| Aplicación del juego | `src/runtime-app/` | Entrada e interfaz de un juego exportado. |
| Host de escritorio | `electron/` | Ventanas, acceso a capacidades del sistema y empaquetado del editor. |
| Host del juego | `electron/runtime/` | Proceso de escritorio para la aplicación exportada. |
| Herramientas | `scripts/` | Compilación, preparación de distribuciones, pruebas y documentación. |
| Documentación | `docs/`, `public/docs/` | Manuales, referencias y portal de documentación sin conexión. |

El proyecto utiliza principalmente **Electron**, **Vue 3**, **Vite**, **Three.js** y **Jolt Physics**. Los scripts de juego se escriben en **JavaScript**.

## Empezar a desarrollar

### Requisitos

- **Node.js y npm**, con versiones compatibles con las dependencias declaradas en `package.json` y `package-lock.json`.
- **Linux o Windows** para trabajar con la aplicación de escritorio y sus distribuciones configuradas. El comportamiento concreto debe comprobarse en el sistema de destino.
- Dependencias y herramientas del proyecto necesarias para las funciones de desarrollo y empaquetado.

En la raíz del proyecto, instala las dependencias:

```bash
npm ci
```

Abre el editor de escritorio:

```bash
npm run electron
```

`npm run start` / `npm start` y `npm run electron` **abren directamente Electron con la interfaz local compilada en `dist/`**, sin iniciar el servidor Vite y sin compilar automáticamente. `npm run filmmaker` hace lo mismo con `dist/filmmaker.html`. Si falta la compilación o un recurso enlazado indispensable, el comando se detiene con un error en la terminal y solicita ejecutar `npm run build`.

Para preparar el Editor y el Runtime antes de ejecutarlos (por ejemplo, tras extraer el SOURCE_BASELINE):

```bash
npm run build
npm run start
```

Las compilaciones nuevas guardan `dist/build-source-manifest.json`, con la huella SHA-256 del árbol fuente relevante, para detectar cambios reales sin confiar en fechas de archivos. Si el código fuente ya no corresponde a la compilación se emite una **ADVERTENCIA · BUILD DESACTUALIZADA** en la terminal, pero se permite abrirla. Si la compilación es antigua y carece de manifiesto o no se puede verificar, se emite **ADVERTENCIA · BUILD NO VERIFICABLE**, sin asegurar falsamente su actualidad. La preparación de Git embebido y VS Code permanece en el inicio, pero no es una compilación del Editor.

Para trabajar en **desarrollo con Vite y HMR** utiliza exclusivamente:

```bash
npm run electron:dev
# o npm run filmmaker:dev
```

Para abrir una compilación previa **sin recompilar** (alias opcional, mismo comportamiento que `npm run electron`):

```bash
npm run electron -- --built
```

Para **compilar explícitamente solo la interfaz del Editor y abrirla**:

```bash
npm run electron -- --build
```

`--built` y el arranque normal requieren que `dist/` ya exista. Para compilar Editor y Runtime utiliza `npm run build`. Los comandos de distribución (`dist:linux`, `dist:win`, `dist:filmmaker`) siguen compilando antes de empaquetar.

En Linux, `npm run electron -- --webgpu` mantiene la selección experimental WebGPU. El servidor Vite también puede arrancarse con `npm run dev`, pero **no sustituye** las integraciones de escritorio disponibles en Electron.

### Compilar

```bash
npm run build
```

El script compila la interfaz del editor (`dist/`) y la interfaz del runtime autónomo (`dist-runtime/`). **Compilar el runtime no equivale a exportar un proyecto de juego.**

Los siguientes comandos preparan **distribuciones del editor**, no ejecutables de los juegos creados con él:

| Plataforma | Comando | Formatos configurados |
| --- | --- | --- |
| Linux x64 | `npm run dist:linux` | AppImage y DEB |
| Windows x64 | `npm run dist:win` | Instalador NSIS y versión portable |

La generación de paquetes requiere las herramientas y los recursos de distribución correspondientes. La existencia de un objetivo en `package.json` no acredita que se haya compilado y probado en todos los equipos.

### Crear y exportar un juego

1. Abre Century y crea o abre un proyecto desde el gestor de proyectos.
2. Construye la escena con nodos y Assets; configura cámara, interacción, física y lógica según las necesidades del juego.
3. Prueba el resultado con **Play** (`F5`) y revisa la consola.
4. Guarda el proyecto y utiliza **Archivo → Exportar juego** para preparar la aplicación independiente.

El flujo de exportación integrado documentado en este código contempla **Linux x86_64 mediante AppImage**. **No debe confundirse** con los destinos Linux/Windows de empaquetado del propio editor.

Para los detalles del flujo de trabajo, consulta la [guía de primeros pasos](docs/web-src/primeros-pasos.md) y el [manual de exportación](docs/web-src/exportacion.md).

## Documentación y comprobaciones

La documentación principal puede abrirse desde **Ayuda → Documentación** (`F1`) en el editor. Su portal está incluido en [`public/docs/index.html`](public/docs/index.html) y está diseñado para utilizarse sin conexión.

Para regenerar y verificar la documentación desde las fuentes del repositorio:

```bash
npm run docs:build
npm run docs:check
```

El repositorio también incluye pruebas específicas para diferentes subsistemas. Por ejemplo, la configuración define una comprobación de distribución del editor:

```bash
npm run test:distribution
```

Las pruebas de los Sprints históricos se conservan sin ocupar decenas de entradas de `package.json`:

```bash
npm test                             # QA focal de arranque, sin builds
npm run test:suite -- --list         # Listar suites por área
npm run test:suite -- liquid-hydrology
npm run test:suite -- vfx-inspector:full
```

El catálogo completo está en `scripts/qa-suites.json`; los archivos `scripts/test-*.mjs` originales permanecen intactos. Los antiguos comandos `npm run test:<área>` documentados en Gates previos se ejecutan ahora mediante `npm run test:suite -- <área>`. Se mantienen las entradas operativas `test:distribution`, `test:vscode-extension`, `test:runtime-jolt-wasm` y `vcs:test`.

Estos comandos se citan porque están declarados en el proyecto; **este README no implica que se hayan ejecutado o superado en todos los entornos**.

## Estado y alcance

Century se desarrolla como motor propio para crear videojuegos 3D. El código examinado contiene un editor funcional a nivel de arquitectura, un runtime separado del editor y herramientas de compilación y exportación. La preparación para el **primer juego** es el objetivo operativo del proyecto; sus requisitos concretos y su validación deben confirmarse durante ese desarrollo.

El motor conserva subsistemas en evolución. La compatibilidad de hardware, el rendimiento y las características de cada aplicación exportada dependen de las escenas, los recursos y las pruebas realizadas en la plataforma objetivo.

## Licencia y componentes de terceros

**Este repositorio no declara actualmente una licencia general para el código de Century.** Su disponibilidad pública, si se decide publicar, no debe interpretarse como una concesión de permisos de modificación, reutilización o redistribución. Cualquier licencia futura deberá establecerse expresamente por el titular del proyecto.

Las bibliotecas, herramientas, fuentes y demás materiales de terceros mantienen sus respectivos derechos y condiciones de licencia. Antes de publicar o redistribuir el código o los paquetes, es necesario revisar el inventario de componentes y excluir cualquier material para el que no exista autorización de distribución.
