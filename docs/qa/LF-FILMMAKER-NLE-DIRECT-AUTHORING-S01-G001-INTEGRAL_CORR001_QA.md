# Nether FilmMaker — S01-G001-INTEGRAL CORR-001

**Fecha:** 2026-11-06  
**Gate parent autorizado:** `LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL`  
**Amendment ratificado:** `LF-FILMMAKER-NLE-DIRECT-AUTHORING-CA-001`  
**Estado:** IMPLEMENTADO EN FUENTES; QA LOCAL PENDIENTE; GATE NO CERRADO.

## Incidencias reportadas por el usuario

Captura `image(20261106-121135).png`: propiedades de una clave de posición dentro de la propia Timeline; el usuario solicita propiedades de clips en el Inspector general. El botón `+ Nodo…` está deshabilitado y no permite añadir nodos, incluidos elementos de FilmMaker. El rediseño estético de Timeline queda fuera del alcance de esta corrección.

## Auditoría y causa raíz

- **OBSERVADO / causa raíz 1:** el SOURCE_BASELINE S01 entregado contiene `NleTimeline.vue` con `<aside class="props">` incrustado dentro de la Timeline. `FilmApp.vue` monta `<Inspector />` sin host para propiedades NLE. Seleccionar un clip tapa pistas en vez de mostrar su editor en el dock derecho.
- **OBSERVADO / causa raíz 2:** `+ Nodo…` está deshabilitado con `!activeNode`, aunque la acción tiene puntos de integración para crear pistas por ID. No existe un selector cuando el usuario no preselecciona nada en Jerarquía.
- **OBSERVADO:** las cámaras propias de FilmMaker están en `film.cameras`, no en `store.project.objects`, por lo que deben producir **planos editoriales** a través de `createFilmEditorialShot`, no pistas ficticias de nodo.
- **OBSERVADO:** una pista por nodo exige transform válido y writer de poses. Los nodos `node` sin Transform, el actor, las entidades de física y colisiones deben permanecer excluidos del escritor de poses. La elegibilidad del menú debe coincidir con la protección real de `FilmNodePose`.
- **OBSERVADO:** cuando el montaje está activo, la edición de pistas está protegida. Un clic de edición finaliza ese modo mediante `stopMontage`, sin ejecutar scripts arbitrarios ni duplicar controladores.

## Modificaciones realizadas

1. `FilmApp.vue`: en el dock original **Inspector**, host de clip y selector contextual; muestra el `Inspector` normal cuando no hay clip seleccionado. Con layouts compactos, abre el dock derecho al seleccionar un clip. No crea otro Inspector global.
2. `NleTimeline.vue`: Teleport reactivo de las mismas propiedades NLE al host del Inspector; fallback en la Timeline si el dock no está montado (modo ampliado o móvil). Al cerrar propiedades, deselecciona el clip y regresa el Inspector habitual.
3. `NleTimeline.vue`: botón `+ Nodo…` abre selector sin requerir selección previa; búsqueda por nombre/ID, nodo de Jerarquía ya seleccionado y nodos compatibles de escena. Las cámaras de FilmMaker aparecen en el mismo selector con acción «+ Plano», usando `createFilmEditorialShot` existente.
4. `NleTimeline.vue`: el arrastre de múltiples nodos sigue MIME `application/x-lf-node`; se deduplican IDs y se comprueba elegibilidad. Las cámaras usan su MIME editorial original.
5. `node-tracks.js`: una regla `filmNodeAnimationAllowed` reutilizada por menú y evaluador de pose. No se permite un writer paralelo para actor/física.
6. `film-ux.css`: estilos mínimos para el host y selector, **sin rediseño general**.
7. Se ajustaron exclusivamente las expectativas estáticas de cuatro suites existentes para verificar la integración real en vez de expresiones antiguas de `NleTimeline`; no se eliminaron casos.

## Evidencia automatizada

- `scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr001.mjs`: **8 PASS / 0 FAIL**.
- S01 parent y regresiones FilmMaker: **197 PASS / 2 SKIP / 0 FAIL** en 14 suites (incluye las 8 pruebas nuevas).
- NO VERIFICADO: compilación Vue/Vite, QA visual Electron, persistencia de una película real tras interacción. El entorno de entrega no dispone de dependencias locales para ejecutar Vite.

## QA local obligatorio

En la raíz de LevelForge (`package.json`), tras extraer CHANGE únicamente si el proyecto ya corresponde a S01 parent, y respaldar/contrastar modificaciones locales:

```bash
node --test scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr001.mjs scripts/test-filmmaker-nle-direct-authoring-s01-g001-integral.mjs
npm run filmmaker -- --build
```

**Pruebas de interfaz:**

1. Abrir Cinematic existente en FilmMaker, sin grabación. Abrir la Timeline y pulsar `+ Nodo…` **sin seleccionar nada en Jerarquía**: debe desplegar opciones.
2. Buscar por nombre. Crear una pista de nodo compatible, comprobar que aparece y conserva el ID. Seleccionar un nodo en Jerarquía y añadirlo desde el selector. Comprobar arrastre desde Jerarquía y acción «Animar Posición» del menú contextual.
3. En el selector, elegir una cámara propia de FilmMaker: debe generar un **plano editorial**, no una pista de transformaciones ficticia.
4. Seleccionar un clip de texto, un efecto, un plano, audio y una clave de nodo, uno por uno: **sus propiedades deben aparecer en el dock Inspector**; el Inspector original no debe duplicarse ni tapar la Timeline.
5. Cerrar propiedades del clip: debe volver el Inspector de escena. Verificar modo compacto y ampliar/restaurar Timeline.
6. Comprobar que no se deja animar el actor ni cuerpos Jolt mediante pistas de transformaciones que invalidarían sus controladores. Las cámaras de FilmMaker no deben figurar como nodos de escena.
7. Guardar el mismo Cinematic, cerrar y reabrir por ID. Verificar pistas, clips y claves, y que la grabación sigue opcional.

**Evidencia a devolver:** salida de ambas pruebas Node, salida del build y capturas del selector de nodos/cámara y del Inspector con propiedades de clip. No declarar QA LOCAL PASS sin revisión del usuario.

## Exclusión mantenida

La mejora estética y profesional de la Timeline se planificará **más adelante**, como pidió el usuario. No se han modificado FilmMaker móvil, Cinematics, motores de animación, modelo de pases, archivos de proyecto ni configuración de grabación.
