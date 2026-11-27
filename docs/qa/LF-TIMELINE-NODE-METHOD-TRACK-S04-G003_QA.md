# QA · LF-TIMELINE-NODE-METHOD-TRACK-S04-G003

**Autorización exacta:** `Listo. LF-TIMELINE-NODE-METHOD-TRACK-S04-G003 autoriza comenzar`.

**BASELINE de entrada aprobado:** `LevelForge_TIMELINE_INTERPOLATION_S04_G002_SOURCE_BASELINE.zip`; G002 aprobado mediante QA local declarado por el usuario. El registro de cierre se encuentra en `LF-TIMELINE-INTERPOLATION-S04-G002_CLOSE.md`.

**Estado de entrega:** IMPLEMENTADO · 63/63 Node PASS (19 G003 + 44 regresiones S02/S03/S04-G001/G002). Electron embebido, compilación Editor/Player y QA local **NO VERIFICADOS**. `docs:check` no verificado por falta de `marked`. **NO CERRADO** hasta QA y aprobación del usuario.

## Auditoría y diagnóstico

- **OBSERVADO:** `src/core/timeline/model.js` tenía únicamente cámara, nodo/transformación, física horneada, audio y comandos. El runner `src/engine/runtime/timeline/player.js` despachaba claves audio/comandos sin pista de métodos de nodo.
- **OBSERVADO:** `src/engine/runtime/scene/node-scripts.js` implementa `discoverNodeMethods()` y `NodeScriptRuntime.callPublic()` con control de instancia, fase, ambigüedad, métodos dinámicos y scripts múltiples. `src/engine/runtime/events/play-nodes.js` ofrece `NodeHandle.call()`, que delega en ese runtime. En `play.js` los Scripts de Nodo se inician antes de los eventos `start` y `scene` que pueden lanzar timelines.
- **CAUSA RAÍZ:** ausencia de un tipo de pista temporal, interfaz contextual y puente de ejecución hacia los métodos de nodo existentes; no ausencia de un intérprete de scripts.
- **DECISIÓN:** extensión mínima de cinco archivos fuente existentes, sin nuevo bus, service locator, API alternativa de scripts, lógica duplicada ni migración de clips de Animación.

## Contrato implementado

1. **Modelo:** `method` en `TRACK_KINDS`. Pista `{node: id, byId: true, keys: [...]}` y clave `{id,t,method,args:[]}`. Normalización y serialización conservan ID y lista de argumentos JSON. No se resolverán nombres legacy como método sobre otro nodo.
2. **Autoría:** opción «Llamadas a métodos» al arrastrar un nodo de Jerarquía; `＋ Pista` permite pista vacía o vinculada al nodo seleccionado. Solo una pista de métodos por nodo creado con DnD; el Inspector permite elegir un receptor distinto. La cabecera y el menú contextual preexistentes siguen gestionando silenciar, insertar, duplicar y eliminar claves.
3. **Inspector:** pista por ID y clave en el mismo Inspector principal. Campo de método con sugerencias estáticas desde `discoverNodeMethods()`, sin ejecutar código durante el descubrimiento. Diagnóstico para métodos ausentes/condicionales o ambiguos. Los argumentos se introducen como arreglo JSON y se validan antes de modificar el modelo; se muestran errores si no son una lista JSON.
4. **Runtime:** `TimelineRunner` entrega las claves `method` a `host.method`, únicamente durante `update()` de reproducción. `play-timeline.js` verifica identidad por ID y ejecuta `NodeHandle.call(method, ...args)`, que valida ciclo de vida y método mediante el runtime Multiscript existente. Captura excepciones y rechazos de promesas y los informa al sistema de reportes.
5. **Semántica:** ni scrub/previsualización en Edit Mode, ni `seek()` invocan métodos. `from` no ejecuta claves anteriores; pausa no repite; cada loop permite un nuevo disparo; `skip()` y `stop()` no disparan claves de método pendientes. Una llamada asíncrona **ya iniciada** no se cancela automáticamente al detener; su rechazo sigue gestionado.
6. **Compatibilidad:** pista comando y `callFn` global existentes siguen intactos; Player usa el mismo runner. Sin cambios en Jolt, SceneGraph, API pública, proyectos de juego, formato de Animation ni cambio de nombre del panel.

## Pruebas ejecutadas

| Prueba | Resultado en esta entrega | Evidencia |
|---|---|---|
| Node G003 (modelo, runner, runtime y contrato UI) | **19/19 PASS** | `evidence/LF-TIMELINE-NODE-METHOD-TRACK-S04-G003/node-63-pass.log` |
| Regresión Node de Gates anteriores | **44/44 PASS** | Mismo log |
| Total Node | **63/63 PASS** | Mismo log |
| Sintaxis JS en componentes `.vue` | PASS (solo script setup) | Prueba y revisión focalizada; **no** compilación Vue |
| Electron embebido, fixture 27+ checks | NO VERIFICADO (Vite ausente) | `electron-not-verified.log` |
| Build Editor + Player | NO VERIFICADO (Vite ausente) | `build-not-verified.log` |
| `docs:check` | NO VERIFICADO (dependencia `marked` ausente) | `docs-not-verified.log` |
| QA local (visual y de juego) | PENDIENTE | Declaración posterior del usuario |

El runner preparado es `scripts/test-timeline-node-method-track-s04-g003-electron.mjs`, con fixture `scripts/fixtures/editor/timeline-node-method-track-s04-g003.html`. No se usó navegador externo para el QA.

## Extracción y ejecución local en Linux

Conservar sin cambios el SOURCE_BASELINE G002 aprobado y extraer el ZIP completo G003 `SOURCE_BASELINE` en una **carpeta independiente** del escritorio. No sustituir el proyecto de juego, `.lfproj`, scripts del usuario, escena, configuración de VS Code ni cambios locales. El CHANGE permite inspección/comparación, pero no se extrae a ciegas encima de proyectos modificados.

Desde la raíz del SOURCE_BASELINE G003:

```bash
npm ci
node --test scripts/test-timeline-node-method-track-s04-g003.mjs scripts/test-timeline-interpolation-s04-g002.mjs scripts/test-timeline-hierarchy-dnd-s04-g001.mjs scripts/test-temporal-context-menu-s03-g001.mjs scripts/test-temporal-inspector-s02-g001.mjs
node --test scripts/test-timeline-node-method-track-s04-g003-electron.mjs
npm run docs:check
npm run build
npm run electron
```

**Salida esperada con las dependencias disponibles:** 63/63 Node PASS; fixture Electron al menos 27 comprobaciones PASS; docs y build del Editor/Player sin errores. Esta expectativa no acredita resultados hasta ejecutarlos localmente.

## QA manual indispensable

1. En Scripts, adjuntar a un nodo dos scripts con métodos públicos definidos mediante `node.expose('abrir', function (grados) { ... })` y `node.expose('cerrar', ...)`. Verificar que ambos se descubren; no introducir métodos duplicados con el mismo nombre salvo para la prueba negativa.
2. En Assets, abrir una cinemática y arrastrar el nodo desde Jerarquía a Timeline. Elegir **Llamadas a métodos**. Repetir el drop para comprobar que selecciona la pista existente sin duplicar. Verificar ID y nombre visible en Inspector.
3. Añadir clave en `0.5 s`, abrir el Inspector y escoger `abrir`. Introducir argumentos `[45]`. Añadir clave en `1.5 s` para `cerrar` con `[]`. Comprobar que la edición y persistencia solo afectan al documento y nodo seleccionados. Probar argumentos malformados y objeto `{}`: el Inspector debe impedir guardar ambos.
4. Probar el cabezal, scrub y Play del preview dentro del Editor. **Ninguno** debe ejecutar el script en Edit Mode. En Play sí deben producirse exactamente las dos llamadas, en sus tiempos. Repetir con pausa, reanudación, seek, loop, stop, skip y comenzar desde `from > 0`.
5. Renombrar nodo y conservar la referencia; eliminarlo y confirmar error controlado, **sin** redirigir la ejecución a otro nodo con igual nombre. Cambiar o quitar el script: no deben dispararse métodos inactivos.
6. Dos scripts exponen `abrir`: el Inspector debe advertir ambigüedad y el runtime no debe elegir uno arbitrariamente. Para `node.expose` dinámico no detectado, el campo permite nombre manual, pero Player solo lo ejecutará si se registra realmente durante Play.
7. Ejecutar un método que lance excepción y otro que devuelva una promesa rechazada. Debe reportarse sin `UnhandledPromiseRejection` ni bloqueo de la cinemática.
8. Probar Deshacer/Rehacer, guardar/reabrir, cambiar documentos y selección, Inspector 260 px, panel acoplado y flotante; confirmar que el runtime exportado y las pistas anteriores siguen funcionando. Probar export con First Person y Jolt; mantener separada la incidencia histórica de plantilla sin controlador.

**Si falla:** entregar pasos concretos, tiempo/clave/nodo/método, captura o screencast y mensajes de consola pertinentes. **Si pasa:** basta la aprobación local declarada por el usuario. La próxima fase **G004 (UX)** está fuera de este Gate.

## Inventario del CHANGE

Comparación exacta con G002: **7 modificados, 10 nuevos, 0 eliminados y 0 inesperados**. Consultar `LF-TIMELINE-NODE-METHOD-TRACK-S04-G003_DIFF.md`. Se incluyen solamente archivos nuevos/modificados frente a G002. No se empaquetan `node_modules`, `dist*`, cachés ni temporales; no se genera SHA-256 separado ni `.sh` de verificación.
