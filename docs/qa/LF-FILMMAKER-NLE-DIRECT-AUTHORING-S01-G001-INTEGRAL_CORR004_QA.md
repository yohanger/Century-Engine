# Nether FilmMaker · S01 G001 CORR-004 — Corrección de inserción visible

**Gate autorizado:** `LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL` (CA-001 ratificado).  
**Origen acumulado:** `LF_FILMMAKER_NLE_DIRECT_AUTHORING_S01_G001_INTEGRAL_CORR003_SOURCE_BASELINE.zip`.  
**Estado:** IMPLEMENTADO EN FUENTES · NODE TEST PASS · COMPILACIÓN NO VERIFICADA · QA ELECTRON FALLÓ PREVIAMENTE / REPRUEBA PENDIENTE · NO CERRADO.

## Evidencia del usuario

El usuario probó CORR-003 en una carpeta S01 CORR-002 sobre la que había aplicado el cambio. Ejecutó `node --test scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr003.mjs`: 10 PASS. Ejecutó `npm run electron -- --build`: Vite 837 módulos, compilación **PASS** de su carpeta, con avisos no bloqueantes. En la prueba visual: «no manda error, pero no veo nada cuando presiono Shift+A o le doy a + para agregar». **QA LOCAL de CORR-003 FALLÓ.** No inferir un popup visible por tests de texto.

## Auditoría (OBSERVADO / INFERENCIA / CAUSA RAÍZ)

- **OBSERVADO 1:** `src/core/editor/keys.js` ya no intenta llamar al comando inexistente `commands` cuando FilmMaker está activo. Este cambio quitó la excepción, pero la tecla Shift+A quedó sin acción de inserción en FilmMaker. **CAUSA RAÍZ 1:** el atajo era del Editor principal y FilmMaker no tenía enlace propio a su Timeline.
- **OBSERVADO 2:** en `NleTimeline.vue`, el control «＋ Pista» era un `<details>` nativo con menú `position:absolute`. El contenedor `.nle` tiene `overflow:hidden`; el menú se puede recortar al abrirlo, especialmente cuando la Timeline es baja. **CAUSA RAÍZ 2:** el contenido de inserción permanecía sujeto al recorte del panel. No hay evidencia de una excepción JavaScript.
- **OBSERVADO 3:** «+ Nodo…» conservaba `:disabled` durante reproducción/grabación, por lo que no podía informar al usuario por qué no respondía. **CAUSA RAÍZ 3:** condición de deshabilitado sin retroalimentación.
- **OBSERVADO 4:** el botón `+` independiente en la barra modifica `pps` (zoom), nunca crea nodos. **Problema de interpretación:** el mismo símbolo se usaba para funciones diferentes.
- **INFERENCIA NO CERTIFICADA:** la ausencia del selector específico «+ Nodo…» puede deberse a estado de FilmMaker, foco o geometría del popup; no hay DOM ni grabación que identifique por sí sola una causa única para ese botón. La corrección cubre rutas de acceso y retroalimentación sin inventar una causa adicional.

## Modificación acotada en originales

- `src/filmmaker/NleTimeline.vue`: único menú existente «+ Pista» expuesto mediante un botón y un portal Vue anclado al propio botón. El selector «+ Nodo…» sigue siendo el mismo `nodeChooser`, sin un segundo catálogo. «+ Pista» incluye «Nodo de escena o cámara» y conserva las acciones originales (`F.addFilmNode`, `F.createFilmEditorialShot`, `M.addLayer`, `M.addAudioTrack`, recursos de Assets). Abierto/cerrado por clic exterior y Escape. Comparten la función de posicionamiento, fuera del recorte de los docks.
- `src/filmmaker/FilmApp.vue`: `Shift+A` en el contexto de la película dirige a la Timeline y abre el menú existente, sin invocar `tool('commands')`. No intercepta texto, Ctrl+A ni la operación de la cámara del camarógrafo. En móvil abre la hoja Timeline.
- `src/filmmaker/film-ux.css`: estilos del menú portaleado con fondo y colores explícitos fuera del árbol `.fm` para que su presentación no dependa de la herencia de variables CSS del dock.
- El botón de zoom se etiqueta «Zoom +». «+ Nodo…» permanece accionable; cuando una actividad impide inserción, muestra un toast claro en lugar de un bloqueo silencioso.
- Actualizaciones de los harness existentes CORR-001 y UX para aceptar el `openAddMenu` expuesto y los handlers que ahora cierran el popup después de insertar; mantienen sus comprobaciones del Inspector y los métodos de montaje.

No se cambian `.nfm`, FilmMaker móvil, Cinematics, el Player, la grabación ni el sistema `commands` del editor.

## Evidencia técnica

- **Nuevo test:** `scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr004.mjs`: **11 PASS / 0 FAIL**. Incluye lógica ejecutada de `openAddMenu`, `onKey`, protección de grabación, posicionamiento con ventana reducida, click exterior y ruta de menú; además comprobaciones de configuración CSS y rutas de datos reales.
- **Regresión FilmMaker compatible:** **240 PASS / 2 SKIP / 0 FAIL**, incluyendo las pruebas anteriores de S01 y otras de FilmMaker.
- `scripts/test-filmmaker-frame-ui-s01-g001.mjs` no puede iniciarse sin Vite en este entorno y no se cuenta como PASS. `npm run build` devuelve `vite: not found` aquí; **compilación CORR-004 NO VERIFICADA**.
- **QA real de Electron/DOM:** PENDIENTE. La prueba de DOM de un portal Vue sobre la ventana real no puede certificarse con tests estáticos de fuentes.

## Instalación e instrucciones QA (usuario)

La carpeta local que ya recibió CORR-003 se conserva como punto de trabajo. Desde su raíz, con `package.json`, revisar y respaldar modificaciones locales; aplicar `LF_FILMMAKER_NLE_DIRECT_AUTHORING_S01_G001_INTEGRAL_CORR004_CHANGE.zip` únicamente después de comparar. No sobrescribir escenas, Cinematics, capturas, datos de FilmMaker ni `node_modules`.

Si hay divergencias locales o no se sabe si CORR-003 quedó aplicado de forma íntegra, usar `LF_FILMMAKER_NLE_DIRECT_AUTHORING_S01_G001_INTEGRAL_CORR004_SOURCE_BASELINE.zip` **en una carpeta independiente** para las pruebas, nunca encima del proyecto principal.

```bash
node --test scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr004.mjs
npm run electron -- --build
```

**QA:**

1. Desde LevelForge, abrir un Cinematic. Sin seleccionar nada, pulsar **Shift+A**: debe aparecer el menú **«Añadir al Cinematic»** con nodos, planos, texto, efectos y audio.
2. Pulsar **«+ Pista ▾»**: aparece el **mismo** menú sobre el NLE, sin recorte. Pulsar «+ Nodo de escena o cámara…»: debe aparecer el selector existente con búsqueda.
3. Pulsar **«+ Nodo…»** directamente: debe mostrar el selector. Elegir un nodo de escena compatible: debe crear su pista. Elegir cámara editorial: debe añadir un plano.
4. Pulsar **«Zoom +»**: solo cambia zoom, no añade recursos. Seleccionar clip y comprobar propiedades en Inspector derecho; guardar y reabrir la película.
5. Reproducción/grabación activas: pulsar «+ Nodo…» o «+ Pista»; debe aparecer un aviso informativo. **No** se modifica el estado ni se inserta contenido.
6. F12/Console si algo falla: adjuntar primer error rojo, una captura de la Timeline y si el menú aparece o no. La ausencia de errores no equivale a QA PASS.

**Salida esperada:** prueba focal 11 PASS y 0 FAIL; Vite build compilado sin errores; verificación visual en Electron.

**Estado final:** implementación entregable para QA; Gate S01 sigue abierto. Rediseño profesional visual futuro por separado, sin código de Unity importado.

## Inventario exacto respecto de S01 CORR-003

**Archivos nuevos (2)**

- `docs/qa/LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL_CORR004_QA.md`
- `scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr004.mjs`

**Archivos modificados (7)**

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr001.mjs`
- `scripts/test-filmmaker-nle-direct-authoring-s01-g001-corr003.mjs`
- `scripts/test-filmmaker-ux-s01-g002.mjs`
- `src/filmmaker/FilmApp.vue`
- `src/filmmaker/NleTimeline.vue`
- `src/filmmaker/film-ux.css`

**Eliminados:** ninguno. **Inesperados:** ninguno. Corrección exclusivamente de interfaz, manejadores y QA del mismo Gate.
