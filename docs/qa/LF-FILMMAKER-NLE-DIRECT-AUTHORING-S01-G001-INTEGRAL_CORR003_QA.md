# Nether FilmMaker — S01 G001 CORR-003 · Diagnóstico y QA

**Fecha:** 2026-11-06  
**Gate padre:** `LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL` (CA-001 aprobado)  
**Baseline de entrada:** `LF_FILMMAKER_NLE_DIRECT_AUTHORING_S01_G001_INTEGRAL_CORR002_SOURCE_BASELINE.zip`  
**Estado:** IMPLEMENTADO EN FUENTES · QA LOCAL PENDIENTE · NO CERRADO.

## Evidencia recibida

El usuario ejecutó `npm ci`, ocho pruebas CORR-002 (8 PASS) y `npm run electron -- --build` desde **el SOURCE_BASELINE S01 CORR-002 correcto**. Vite reportó `✓ built in 1m 51s`, con 837 módulos transformados, avisos de chunks e importaciones; esa evidencia acredita **COMPILADO del baseline CORR-002**, no la nueva CORR-003 ni el QA de la interacción. Después apareció `Downloading Electron binary...`; no declarar Electron QA PASS.

En DevTools de FilmMaker aparece repetidamente:

```text
Uncaught Error: La herramienta «commands» solo existe en el editor (no está registrada en esta aplicación)
    at ... film-Bq7coJWv.js
    at ... ColorGradePanel-ezz5gi6n.js
```

El usuario confirmó que **+ Nodo / Inspector no funcionaron**. Este Gate sigue abierto por QA local fallido.

## Auditoría: observado, inferencia y causa raíz

### ERROR 1 — acceso indebido a herramientas de otra aplicación

- **OBSERVADO:** `src/filmmaker/main.js` registra `registerCaptureFilm()`, sin `commands` ni `mesh`. Es correcto para no incorporar herramientas de editor al Player/FilmMaker.
- **OBSERVADO:** `src/core/editor/keys.js` llama a `tool('commands').openAddMenu()` al pulsar Shift+A, sin verificar si la herramienta está registrada. `src/core/editor/meshedit.js` hace lo mismo para el menú contextual de malla. `tool()` lanza exactamente el error reportado cuando no existe una herramienta.
- **CAUSA RAÍZ DEL ERROR:** un editor de escena reutilizado por FilmMaker conservaba rutas de comandos exclusivos del editor principal sin comprobar el registro de herramientas en el punto de uso.
- **CORRECCIÓN:** consultar `hasTool('commands')` antes de esas dos rutas. Mantener el registro original del editor, sin registrar `commands` en FilmMaker ni duplicar módulos. No se alteran gestos de la Timeline ni herramientas de grabación.

### ERROR 2 — selector de nodos ocultable por contenedores

- **OBSERVADO:** la lista `nodeChooser` era un descendiente del toolbar de `NleTimeline.vue`, mientras `.nle`, `.dock` y `.pane.flush` aplican `overflow: hidden`. El menú estaba posicionado como popup `absolute` dentro de esta jerarquía.
- **INFERENCIA:** podía quedar recortado o por debajo de otros paneles y **parecer que el botón no hacía nada**. No se dispone de una captura posterior a CORR-002 que pruebe qué parte estaba oculta en cada tamaño de ventana.
- **CORRECCIÓN:** reutilizar el mecanismo de portal Vue (`Teleport`) ya empleado por el Inspector. El mismo selector sigue leyendo `store.project.objects` y `film.cameras`; ahora su ventana se posiciona en coordenadas visibles del viewport, fuera del recorte de los docks, con búsqueda, Escape y cierre por clic externo. Se usa la misma `nodeChooser`, sin segunda UI ni estado duplicado de nodos.

### Inspector

- **OBSERVADO:** `FilmApp.vue` conecta el editor existente de propiedades de `NleTimeline.vue` a `filmInspectorHost` mediante `filmClipInspectorTarget`; no hay duplicación de componentes.
- **NO VERIFICADO:** el usuario todavía debe confirmar que las propiedades se mueven correctamente al Inspector derecho. No se atribuye automáticamente este fallo al error `commands`; la conexión no se modifica sin evidencia suficiente.

### Advertencias adicionales del registro (fuera de CORR-003)

- CSP inseguro de Electron: advertencia de seguridad, **no evidencia de que bloquee el botón**; requiere auditoría de política e implicaciones para el editor antes de modificarla.
- `BufferGeometry.toNonIndexed()` sobre una geometría ya no indexada: warning de Three.js, diferir a auditoría de render/performance.
- `PCFSoftShadowMap` eliminado y sustituido por `PCFShadowMap`: advertencia de compatibilidad visual, diferir a auditoría de renderer.
- CSS `appearance: slider-vertical`: deprecación; diferir a UX/compatibilidad.

No se modifica la física, el render, el Player, la aplicación móvil ni el CSP dentro de esta corrección.

## Referencia Unity Timeline aportada por el usuario

ZIP `com.unity.timeline-master.zip`, paquete `com.unity.timeline` **1.8.13** (Unity 6000). Se revisaron manifiesto y documentación de operaciones de **Trim** y **Inspector**: edición no destructiva, duración/entrada/final del clip y separación clara entre edición temporal y fuente. La licencia en el ZIP es **Unity Companion License para proyectos dependientes de Unity**. Se usa **únicamente como referencia de interacción**; no se traslada ni se copia código Unity a LevelForge/Nether FilmMaker. El rediseño visual profesional se aplaza al Sprint que defina el usuario.

## Evidencia automatizada

- `scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr003.mjs`: **10 PASS / 0 FAIL**; comprueba frontera de registro, atajos, rutas de malla, apertura/ubicación y cierre del selector, referencias de nodos y cámaras, Inspector original, continuidad de FilmMaker.
- Regresión seleccionada compatible: **238 PASS / 2 SKIP / 0 FAIL**, con S01 CORR-001/002, native Cinematic, Timeline, animación, móvil y UX.
- Regresión ampliada adicional con suites que no son ejecutables en este entorno: **252 PASS / 2 SKIP / 2 FAIL**; una suite exige `vite` ausente, otra prueba histórica S03 (`app is not defined`) falla por su propio harness. `scripts/test-filmmaker-mobile-monitor-s03-g001.mjs` y `electron/main.cjs` tienen hashes iguales al SOURCE_BASELINE de entrada. **NO presentar la ejecución de 252 como regresión total PASS.**
- `node --check` de los módulos JS modificados: PASS.
- Vue/Vite CORR-003: **NO VERIFICADO** (`node_modules` ausente en el entorno de implementación).
- Electron runtime y QA visual CORR-003: **NO VERIFICADOS**.

## QA local a ejecutar por el usuario

Para corregir **S01 CORR-002**, compara archivos y respalda los cambios de tu proyecto local, luego aplica el ZIP `CORR003_CHANGE` en la raíz donde se encuentra `package.json`. No aplicar sobre S07 ni sustituir recursos del usuario. El SOURCE_BASELINE CORR-003 completo es alternativa en carpeta separada.

```bash
node --test scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr003.mjs
npm run electron -- --build
```

**Secuencia visual:** crear/abrir Cinematic nativo en LevelForge → abrir FilmMaker → F12/Console → pulsar «+ Nodo…» → verificar selector visible sobre Timeline con búsqueda → seleccionar nodo elegible y confirmar pista en Timeline → añadir una cámara de FilmMaker y confirmar plano → seleccionar clave y plano y confirmar propiedades en Inspector derecho → probar Shift+A y comprobar que no aparece la excepción `commands` → guardar y reabrir el mismo Cinematic. Confirmar que ninguna cámara móvil/filmación está activada de forma obligatoria.

**Evidencia a devolver:** resultado de Node y del build; capturas con selector abierto e Inspector, y primer stack nuevo si la Console vuelve a mostrar errores rojos. Si falla, conservar el proyecto sin sobrescribirlo y enviar el error antes de intentar otras correcciones.

## Cierre

- IMPLEMENTADO EN FUENTES: atajos y selector protegidos, sin cambios en Player/FilmMaker móvil.
- TEST AUTOMATIZADO: 10 PASS focal + 238 PASS de regresión ejecutable, 2 SKIP.
- COMPILADO CORR-003: NO VERIFICADO.
- QA LOCAL PASS: NO; pendiente.
- APROBADO: NO.
- CERRADO: NO.
