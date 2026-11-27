# PROPUESTA DE CONTRACT AMENDMENT — LF-FILMMAKER-CAMERA-DIRECTION-CA-001

**Estado:** RATIFICADO 2026-11-05; disposiciones de VERSIONADO/MIGRACIÓN SUPERSEDIDAS por `LF-FILMMAKER-CAMERA-DIRECTION-CA-002` (ratificado). Documento conservado como historial.  
**Vinculación prevista:** Gate `LF-FILMMAKER-CAMERA-DIRECTION-S02-G001-INTEGRAL`; modifica únicamente el mínimo indispensable de `MC-15` del contrato `LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001` y la representación de cámaras cinematográficas de FilmMaker.  
**Razón:** el modelo actual `.nfm` v4 tiene `operator` global, `passes` y `edit.shots`, pero carece de identidades/configuraciones de cámaras independientes y asocia el shake gameplay a otro runtime. Mantener v4 sin esquema nuevo impediría cumplir el Gate integral.

## CA-01. Autoría y separación estricta

1. Una cámara de producción **editorial** pertenece a `film.json` de Nether FilmMaker. No se crea ni se cambia automáticamente un nodo `camera` Gameplay en `scene.lfproj`.
2. FilmMaker es el único autor de sus cámaras, rigs, controles y enlaces a pasadas. Los datos de cámara de películas importadas por LevelForge son de **solo lectura**, sin prohibir la autoría independiente de cámaras Gameplay o Timeline que ya existe en LevelForge.
3. Cinematics permanece consumidor; no obtiene nuevas operaciones de autoría de cámara.
4. No añadir mensajes de propiedad editorial en la UI. Contratos y restricciones de escritura imponen este límite.

## CA-02. Evolución de `.nfm` y preservación

1. Autorizar una revisión versionada del esquema `.nfm` **v4 → v5** exclusivamente para cámaras de producción y sus referencias. Mantener compatibilidad de lectura de v1–v4; rechazar versiones futuras. No mutar los archivos fuente al leerlos.
2. La colección autoritativa será `film.cameras` con un ID persistente único, nombre, configuración de rig, parámetros de operación y estado de referencia de cámara. Una cámara contiene su propia configuración; evitar estados duplicados en paneles y sesiones.
3. Cada pasada nueva conservará `pass.id` y asociará opcionalmente `cameraId`; `edit.shots[].pass` continúa vinculando el pase por **ID**, sin cambiar el montaje ni sus cortes.
4. En películas heredadas v4, derivar una cámara editorial de migración con **ID estable y determinista** desde el identificador de película y `film.operator`, sin renombrar las pasadas ni alterar sus claves grabadas; asociar lo que corresponda durante normalización y conservar toda pasada legacy.
5. La selección de cámara operativa será una referencia a `cameraId` válido; ante cámara eliminada/referencia huérfana, reportar el estado y ofrecer reasignación explícita, sin enlazar por nombre.
6. Mantener `film.operator` únicamente como campo de **entrada legacy** durante migración; la nueva colección es la fuente de verdad. Prohibido sincronizar dos copias editables del mismo operador.
7. Conservar sin modificación semántica `takes`, `edit`, `overrides`, `scene`, `.lfproj`, exportación, audio, efectos, timeline y el monitor Android pausado.
8. `packNfm`/`unpackNfm`, normalización, duplicación, reemplazo de escena, guardado/reapertura, exportación e importadores deben validar y preservar las referencias nuevas. Probar round-trip real JSZip y archivos heredados.

## CA-03. Camera Shake Base sin duplicación

1. Reutilizar la receta y el **evaluador `sampleShake()` existente** de `src/engine/runtime/events/play-camera-shake.js` (sin segundo generador de shake).
2. La cámara editorial podrá referenciar por ID un nodo Camera Shake Base existente en el proyecto de entorno. La receta se consulta sin escribir al nodo Gameplay; si el recurso falta, emitir diagnóstico y conservar pose base.
3. Resolver los desplazamientos de shake como **offsets locales respecto de la pose base** en tiempo absoluto de una pasada o plano, sin acumularlos ni modificar la escena persistida. La fuente única de verdad del movimiento de operador seguirá siendo el rig; shake se suma exclusivamente en evaluación de render o en un bake explícito para exportación, nunca a ambos.
4. Conservar las capas NLE `kind='shake'` heredadas y su reproducción como datos legacy. La nueva operación de cámara no las duplicará ni las reinterpretará como recetas de nodos. Un único recorrido de composición deberá evitar doble aplicación en la misma toma.
5. Al exportar una película a LevelForge, generar claves finales de cámara (bake determinista) para consumo de solo lectura, sin requerir que el Player active de nuevo Camera Shake Base para esa cámara importada.

## CA-04. Mecanismos de los rigs

1. Los controles por cámara tendrán unidades y rangos validados: velocidad lineal en m/s, giro en grados/s, aceleración/desaceleración coherentes con pasos `dt`, suavizado e intensidad de shake. No se inventan valores que alteren silenciosamente películas legacy.
2. **Mano:** conserva pulso, permite parámetros de movimiento y estabilización sin doble oscilación.
3. **Trípode:** fija su origen; permite giro e inclinación con topes; reposicionar el trípode es operación de edición, no desplazamiento en una toma.
4. **Dolly:** se constriñe a una trayectoria configurable. Reutilizar clases geométricas o evaluadores de curvas existentes; guardar curva y progresión por ID/tiempo sin render alterno.
5. **Grúa:** cinemática de pivote, brazo y orientación de cámara; sin simulación física innecesaria.
6. Las rutas remota/AR existentes no cambian hasta que el usuario reactive su Sprint; no se promete soporte nuevo con teléfono bajo este Amendment.

## CA-05. Multicámara y tiempo

- Seleccionar cámara de trabajo y de previsualización sin ejecutar varios renderers simultáneos.
- Pasadas conservan sus claves de cámara grabadas; edición y cortes continúan usando `sequence`/`cameraAt` y relojes existentes.
- Solo una pose escribe el viewport en un instante (operación, previsualización de pase o reproducción del montaje), con restauración al salir.
- Un pase sigue siendo un recurso **grabado**, no se convertirá en nodo Camera. No duplicar un banco oculto de cámaras a partir de nombres de pases.
- El editor puede mostrar guías de riel/grúa únicamente durante autoría; no son objetos Gameplay serializados ni visores paralelos.

## CA-06. Compatibilidad, límites y QA

- Validar migración de una película v4 con operador persona/máquina, varias pasadas, tomas de actor, capas, audio y nodos animados.
- Validar v5 con distintas cámaras, rig por ID, shake referido por ID, cortes, duplicación/eliminación, referencias huérfanas, guardar/reabrir y exportar.
- QA Node, compilación Vite, Electron real, importación LevelForge/Cinematics y medición básica en N5030/4GB. No atribuir PASS hasta recibir evidencia.
- `MC-14` sigue vigente: una pose activa, nunca se fabrican posiciones 6DoF en ZTE.
- S01-G002 y sus evidencias de cierre no se cierran automáticamente por ratificar este Amendment.

## Autoridad y siguiente acción

**Nota histórica:** antes de la ratificación, MC-15 y el formato previo seguían vinculantes. **Hoy rige CA-002: formato `.nfm` único sin versiones ni migraciones.** Este documento no modifica contratos ni autoriza por sí solo implementar el nuevo esquema. Si el usuario aprueba sin modificaciones, el mismo Gate S02 ya autorizado podrá continuar dentro del alcance declarado y el ledger registrará la ratificación. Si el usuario modifica el Amendment, se debe comparar y resolver la versión antes de continuar.

**Fórmula propuesta de ratificación:** `Apruebo LF-FILMMAKER-CAMERA-DIRECTION-CA-001 sin modificaciones.`
