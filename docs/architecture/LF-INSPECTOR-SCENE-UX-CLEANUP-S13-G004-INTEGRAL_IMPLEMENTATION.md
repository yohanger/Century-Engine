# LevelForge · LF-INSPECTOR-SCENE-UX-CLEANUP-S13-G004-INTEGRAL

**Gate:** autorizado literalmente por el usuario, 2026-11-08.
**SOURCE_BASELINE:** `LF_INSPECTOR_GLOBAL_FOLDING_S13_G002_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.
**Contrato vigente:** UX-01..UX-08 (ratificados), Scene Inspector S02, Scene Fade S01, Scene S01, World/Bake precedentes.
**Estado:** IMPLEMENTADO; Node focal 20 PASS; compatible 88 PASS; Electron/build/QA visual NO VERIFICADOS; PENDIENTE APROBACIÓN.

## AUDITORÍA · código observado

- `src/components/ScenePanel.vue` mezcla tres `ownership-group`, dos secciones `gm-section`, tres `section-title` y diez `details` nativos; sus textos `lf-help` describen el uso del motor en vez de propiedades.
- `InspectorDock.vue` delega el plegado exclusivamente a `.sect > header`, con claves `fold:context:id` en `store.prefs.inspFold`. Las estructuras de ScenePanel no eran `.sect` y no participaban de ese delegado.
- La escena distingue tres autoridades: Escena, Mundo/World y recursos de iluminación. La autoridad de nubes, niebla y clima depende del estado efectivo World; al editar propiedades manuales no deben migrarse ni borrarse.
- El reset heredado de clima y atmósfera altera además nubes y niebla; el reset global mantiene `environment.bake`. Ambos permanecen **sin cambios**.

## Implementación

1. Se conservan **tres grupos originales** de Escena, Mundo y Recursos. Se convierten a `<details><summary>` nativos con plegado por ratón/teclado y estado en `store.prefs.inspFold` (`fold:scene:<id estable>`), sin crear un Inspector o gestor global paralelo.
2. Son **18 apartados plegables** identificados con `data-scene-fold` estable. Se conservan los estados por defecto: los grupos y bloques antiguos abiertos empiezan abiertos; los diez `details` nativos anteriores empiezan cerrados.
3. Se delega la captura de eventos `toggle` dentro del propio `ScenePanel` al contenedor, escribiendo **solo preferencias** cuando cambia realmente un apartado. No hay `commit`, `updateEnvironment`, mutación de escena o Undo al contraer.
4. Se retiran párrafos de documentación visible de transiciones, iluminación, Skybox, nubes y Bake, así como el encabezado redundante «Inspector de escena». La preferencia de tooltips no puede restaurar esos párrafos porque el DOM de la sección activa ya no los contiene.
5. Se mantienen y compactan avisos de autoridad World (`data-authority=weather|sky|clouds|fog`), ausencia de DirectionalLight, falta de panorama HDRI, Bake obsoleto/progreso, modo de iluminación legado y requisitos de calidad en volumétricas. Los indicadores de ausencia de luz, HDRI y Bake siguen disponibles en encabezados plegados.
6. Los botones «Restablecer» se mantienen **dentro del contenido expandido y fuera de `<summary>`** para evitar toggles accidentales. Se conservan todos los controles y acciones originales de escena, entorno y Bake.
7. El archivo de exportación antiguo bajo `v-if="false"` permanece intacto por contrato; no se amplía su funcionalidad.

**Límite:** no se modifican `src/components/InspectorDock.vue`, `src/components/Inspector.vue`, store, World, Renderer, física, Player, runtime, datos, Scene Fade, historial, parámetros, tooltips globales ni otras familias de Inspector.

## Contradicciones y deuda histórica

- Ningún Contract Amendment adicional identificado para los cambios autorizados de UI. El reset histórico de clima **no se divide**.
- `S02-16` y `SCENE-09` son aserciones Node antiguas que fallan por cambios anteriores del esquema de escena y Mesh Edit; reproducidas sobre el baseline anterior sin modificación. No se corrigen aquí.
- El resultado de Node no demuestra funcionamiento visual real ni build.

## Continuidad

El usuario descartó limpiar el Inspector de nodos en S13-G003 al considerarlo sin contaminación. Después de aprobar S13-G004: auditar/limpiar Terreno (G005), luego recursos, VFX, Timeline, Señales/Malla/Pintura e integración. **Tooltips globales pospuestos**.
