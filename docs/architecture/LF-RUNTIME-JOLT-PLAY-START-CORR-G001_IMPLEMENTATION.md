# LF-RUNTIME-JOLT-PLAY-START-CORR-G001 — Corrección de tipos WASM en ShapeSettings

**Autorización literal:** `Listo. LF-RUNTIME-JOLT-PLAY-START-CORR-G001 autoriza comenzar`.
**SOURCE_BASELINE:** `LevelForge_EDITOR_VIEWBAR_RENDER_SELECTOR_CORR_G001_SOURCE_BASELINE(1).zip` (ZIP suministrado, 1.230 archivos, integridad verificada).
**Estado:** IMPLEMENTADO · PRUEBAS CON DOBLES PASS · WASM REAL NO VERIFICADO · COMPILACIÓN/QA LOCAL PENDIENTES · NO CERRADO.

## Auditoría anterior a la intervención

**OBSERVADO:** la consola del usuario informa `RuntimeError: null function` al ejecutar `ShapeSettings.Create()` en la ruta `Play.start → _setupScene → _bodiesInit → NodeBodyRuntime.start`. Ocurre antes de `_tornadoInit`. Los tests históricos S03 usaban dobles de Jolt y no verificaban esta llamada WASM.

**OBSERVADO EN CÓDIGO:** `joltShapeForBody` pasaba un objeto `Shape` ya construido a `RotatedTranslatedShapeSettings` y a `StaticCompoundShapeSettings.AddShape`. En el IDL público de JoltPhysics.js estos métodos se tipan para `ShapeSettings`; son entidades nativas distintas. La fuente pública consultada es https://raw.githubusercontent.com/jrouwe/JoltPhysics.js/master/JoltJS.idl (la versión de la rama principal puede diferir de la 1.1.0 fijada en el proyecto).

**INFERENCIA FUNDADA:** dicha discrepancia de tipo puede explicar una llamada virtual WASM inválida; sin reproducción ejecutada contra el binario 1.1.0 NO se registra como causa raíz definitivamente demostrada.

## Cambios autorizados

1. `physics/node-bodies.js`: crea `ShapeSettings` del subtipo concreto para cada parte de las formas transformadas/compuestas. Primitivas Box/Sphere/Capsule conservan la caché de `Shape` del mundo; las formas compuestas consumen nuevos settings nativos y eliminan las dependencias entre punteros incompatibles. Las mallas TriMesh transformadas generan sus `MeshShapeSettings` a partir de la geometría real, sin cambiar sus datos persistidos.
2. Validación explícita del `ShapeResult` antes de `Get()`, y liberación equilibrada de los settings nativos, resultados y referencias propias a `Shape`, incluso con fallo de construcción. El registro de cuerpos estáticos tiene rollback local de los creados antes de una excepción; conserva el error nativo como `cause` e identifica el nodo propietario, su ID y los tipos Shape3D.
3. `physics/jolt.js`: comprueba el resultado de `BoxShapeSettings.Create()` y protege `CreateBody`/`BodyCreationSettings` frente a inicialización parcial. JoltWorld y BodySet permanecen los dueños de la física; no se añade un segundo mundo.
4. `scripts/test-node-physics-runtime-s03-g001.mjs`: modifica únicamente el doble necesario para que distinga `ShapeSettings` de `Shape`; añade verificación de rollback y forma desplazada. Se conservan las pruebas previas.
5. `scripts/test-runtime-jolt-wasm-real-corr-g001.mjs`: runner **real**, importa la dependencia instalada `jolt-physics/wasm-compat` a través de `loadJolt()` y Three.js sin mocks. Sus fixtures se construyen dentro del runner y comprueban formas primitivas, desplazadas, rotadas, compuestas, TriMesh, cuerpos dinámicos, Area3D, CharacterBody3D y reinicios/rollback. **Falla**, no se omite, cuando no puede cargar la dependencia.
6. `scripts/test-runtime-jolt-play-corr-g001.mjs` y scripts npm: comprobaciones de integración, orden de inicio del tornado y contrato visual VFX3D; permanecen separadas de las pruebas WASM.

## Condiciones fuera de alcance

- Sin cambio a la versión `jolt-physics` del `package-lock.json`; sin motor de física alternativo.
- Sin CSP, HUB, sombras Three.js, CSS `slider-vertical` ni iconos de distribución Linux.
- El tornado visual sigue requiriendo `tornadoVfxNodeId` enlazado a un recurso `.vfx` compatible. No se inventa un efecto visual tras el arranque.

## Bloqueo y siguiente acción real

Este entorno no puede acceder a `registry.npmjs.org`, y el ZIP fuente excluye `node_modules`. Intento de `npm ci` falló por resolución de DNS. Por ello el runner nativo NO se ejecutó y la corrección sigue **SIN VALIDACIÓN WASM REAL**. `npm run test:runtime-jolt-contract` pasó con 105 PASS, 1 SKIP (Three.js ausente). Los tests de tornado S12/S12A pasaron 101/101.

La compilación Editor/Player, reproducción Electron, física nativa del Player y aparición visual del tornado requieren QA en la máquina local. No se permite clasificar este Gate como FIXED, READY, PASS QA LOCAL, APROBADO ni CERRADO antes de obtener esa evidencia.

## Revisión por QA nativo fallido — 30 de octubre de 2026

**EVIDENCIA OBSERVADA:** runner Jolt WASM 1.1.0 real en máquina del usuario: 3 PASS y 9 FAIL, empezando por `JW-04` al crear un cuerpo con una forma desplazada. `JW-05` y siguientes muestran corrupción de memoria y tabla de funciones. Esto **invalida la hipótesis de que el primer cambio ya había corregido Play**; el Gate permanece ABIERTO.

**CAUSA RAÍZ candidata respaldada en código y documentación oficial:** el adaptador anterior creó `RotatedTranslatedShapeSettings` / `StaticCompoundShapeSettings` con `ShapeSettings` hijos, pero tras destruir el padre también destruía los hijos. Jolt es dueño del hijo tras aceptar la referencia; un `J.destroy` adicional constituye doble liberación y puede corromper su estado nativo. Ver ejemplo oficial: https://github.com/jrouwe/JoltPhysics.js/blob/main/Examples/proper_cleanup.html y documentación de memoria de jolt-physics.

**MECANISMO CORRECTIVO:** `joltShapeForBody` rastrea cuántos `ShapeSettings` fueron transferidos al padre. Solo destruye los que no se transfirieron. Los auxiliares `Vec3`/listas creados localmente se liberan de forma individual, mientras el padre libera los Settings hijos. Antes de liberar el resultado de `Create()` se toma la referencia propia del `Shape` y se hace `Clear()` del resultado. El código de pruebas con dobles marca y rechaza la segunda destrucción del mismo Settings.

**ESTADO:** corregido en código, **NO VERIFICADO mediante WASM real tras la revisión**. La suite mock/contrato pasa 106 y omite 1 por falta de dependencias; las 101 regresiones de tornado pasan. No hay compilación ni QA Play/Player posteriores a la revisión. No se ha cambiado el lockfile, la versión de Jolt, el motor de física, la escena ni los contratos de nodo.
