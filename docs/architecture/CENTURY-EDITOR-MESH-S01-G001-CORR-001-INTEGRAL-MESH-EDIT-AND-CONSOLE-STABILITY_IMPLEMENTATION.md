# CENTURY-EDITOR-MESH-S01-G001-CORR-001-INTEGRAL-MESH-EDIT-AND-CONSOLE-STABILITY — Estado técnico

## Autoridad y punto de partida

- Autorización literal recibida para este Gate.
- Fuente: `CENTURY-EDITOR-MESH-S01-G001-PERSISTENT-PRIMITIVE-TOPOLOGY-CONTROLS_SOURCE_BASELINE.zip`.
- Nivel de madurez: pre-1.0; no se crean migraciones ni implementaciones alternativas.
- `setPointerCapture` excluido por decisión expresa; no se modifica ni se silencia.

## Cambios acreditados en código

1. `PolyMesh.fromJSON`, `toJSON` y `clone`: metadatos paramétricos primitivos copiados a objetos planos. Evita `DataCloneError` con `Proxy` de Vue, conservando firma y parámetros.
2. `EditSession` y `MeshPanel`: campos existentes para anillos/segmentos y operación numérica independiente para reducir polígonos. Solicita confirmación antes de una reducción destructiva y avisa si la geometría se comparte.
3. `ops-reduce.js`: simplifica aristas de caras coplanares o trianguladas con validación topológica, presupuesto de 2048 caras iniciales y máximo de 512 operaciones; devuelve fallo controlado si no existen operaciones seguras. Una malla arbitraria puede no alcanzar el objetivo solicitado.
4. `knifeTargetFaces` y modal Cuchillo: selección de caras, aristas o vértices determina el área de corte. Cuchillo requiere selección; Loop Cut conserva anillo global. Se conservan los vértices de unión sobre caras vecinas sin dividirlas arbitrariamente.
5. `_nodeReplacing`: desacopla `TransformControls` de cualquier descendiente del nodo sustituido, no solo hijos directos.
6. `PCFSoftShadowMap` se sustituye por `PCFShadowMap` en viewport y vista previa de shader. `slider-vertical` se sustituye por `appearance: none` manteniendo `writing-mode: vertical-lr` y `direction: rtl`.
7. Runner `mesh-editor-stability` integrado al catálogo `qa-suites.json`.

## Limitaciones

- No se puede acreditar la desaparición completa de `TransformControls` sin QA real en Electron.
- La política CSP de Electron no se cambia de forma insegura: `src/engine/runtime/host.js` y `src/engine/runtime/scene/node-scripts.js` crean funciones dinámicas mediante `new Function`. Prohibir `unsafe-eval` sin adaptar esos consumidores rompería scripts del motor; la sustitución por un aislamiento seguro requiere un contrato y validación propios. Advertencia CSP: **PENDIENTE / BLOQUEADA**.
- Los cambios de PCF y CSS requieren comprobación visual en Electron.
- No se han cambiado `setPointerCapture`, ni el sistema de captura del puntero.
- Reducción de polígonos distinta de reducir anillos paramétricos; no garantiza reducción arbitraria de mallas ni preservación íntegra de UV/pintura tras decimación. Toda aplicación solicita confirmación.

## Resultado

**IMPLEMENTADO PARCIAL — TEST DIRIGIDO PASS — BUILD BLOQUEADO — QA LOCAL NO VERIFICADO — NO APROBADO — NO CERRADO.**

El Gate no está cerrado: faltan la solución arquitectónica de CSP y las pruebas visuales/compilación en Electron.
