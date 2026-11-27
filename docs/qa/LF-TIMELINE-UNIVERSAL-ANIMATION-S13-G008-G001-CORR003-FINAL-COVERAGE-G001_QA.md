# LevelForge — CORR-003 · FINAL-COVERAGE-G001 — Implementación, cobertura y QA de cierre

**Fecha de ejecución documental:** 2026-11-11.  
**Gate autorizado literalmente:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-FINAL-COVERAGE-G001`.  
**SOURCE_BASELINE de entrada, único:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_012_LIQUID_GEOMETRY_SOURCE_BASELINE.zip` (archivo recibido con sufijo `(2)`), **3.115 archivos**, CRC verificado.  
**Autoridades:** UPA-CA-002, **UPA-CA-003 y UPA-CA-004 ratificadas**; Camera Orchestration S15 y propietarios de sistemas siguen vinculantes.

## 1. Auditoría previa: observado, inferencia y causa raíz

- **OBSERVADO:** `nodes/light.js` ya exponía 10 canales especializados; el Inspector mostraba controles funcionales de color/temperatura, Lensflare, parámetros volumétricos, sombras y estilos sin todas sus llaves. `anim/model.js` retornaba inmediatamente para `light.*`, omitiendo la validación `available` de descriptores especializados. El color runtime de `play-light.js` no se recomponía con temperatura temporal. Esto hacía engañosa la disponibilidad de llaves en variantes incompatibles.
- **CAUSA RAÍZ verificada:** la condición anticipada `if (id.startsWith('light.')) return ...` evitaba ejecutar `spec.available` y `validatePropertyValue` para descriptores con propietario Luz. Había propiedades ópticas temporales sin aplicador/restaurador.
- **IMPLEMENTADO:** `anim/model.js` conserva el filtro exclusivo de tipo Luz y deja que los descriptores propietarios pasen por disponibilidad/validación normal. `nodes/light.js` conecta siete campos usando la misma metadata `registerNode`/`PROPS`, la luz Three.js de **cada instancia**, actualización/restauración de `root.userData.timelineLight` y funciones del dueño; `play-light.js` compone temperatura con el color runtime existente. `Inspector.vue` coloca cada `PropertyKey` junto a su control original.
- **INFERENCIA LIMITADA:** las pruebas Node con dobles ejercitan funciones reales, no demuestran GPU ni el Player empaquetado. Un cambio de `shadowRes` o de `mode` implicaría calidad de shadow map/baking, no se inventa un setter sin contrato ni presupuesto. Sombras on/off implica recompilación de materiales y todavía necesita contraste de ejecución real antes de prometer la pista. Las escaleras (`steps`, `turn`, `sides`, parapetos) recomponen geometría y pueden afectar colisión; no se ofrece una llave de reconstrucción no certificada.

## 2. Matriz final de alcance: 34 tipos

**Cómo leer:** `canales propios` indica que existe al menos un descriptor especializado acumulado; **no** implica 100 % de Inspector ni QA local. Los 34 tipos provienen del inventario contractual anterior; se reconcilian las continuaciones 002–012 y las exclusiones ratificadas. El campo `QA local` permanece **NO VERIFICADO** para todos.

| Tipo | Estado de la ruta especializada acumulada | Límite específico de FINAL-COVERAGE |
|---|---|---|
| node | Solo comunes; estructura excluida CA-004 | QA visual pendiente |
| node3d | Propietario líquido/combustión y comunes | CA-003/004 excluyen origen de masa/ignición |
| camera | Camera3D, FOV y cámara activa | Arbitraje Camera Orchestration, STOP/seek sin QA nativo |
| cameraShake | 16 canales propietarios | Film/Timeline/pose no reciben shake gameplay por diseño |
| light | Canales previos + **7 opciones temporales nuevas** | Sombras on/off, resolución y baking no certificados |
| trigger | Canales especializados previos | QA visual pendiente |
| atmovolume | Canales especializados previos | QA visual pendiente |
| postvolume | Canales del propietario previos | Postprocesamiento de cámara excluido del alcance |
| audio | 17 canales previos | QA audible y export pendiente |
| canvas | Canales del propietario previos | UI/overlay Editor/Player pendiente |
| decal | Canales especializados previos | QA visual pendiente |
| nature | Canales especializados previos | QA visual pendiente |
| sprite2d | Canales especializados previos | QA Player pendiente |
| sprite3d | Canales especializados previos | QA Player pendiente |
| text | Canales especializados previos | QA visual pendiente |
| vfx | Canales especializados previos | QA visual pendiente |
| characterbody3d | Canales Jolt previos | QA Jolt WASM pendiente |
| area3d | Canales Jolt previos | QA Jolt WASM pendiente |
| staticbody3d | Colisión/combustión previos | CA-004 excluye ignición inicial |
| rigidbody3d | Colisión, líquido y combustión previos | CA-003/004 excluyen configuración inicial de fuentes |
| collisionshape3d | Canales de formas físicos previos | QA Jolt real pendiente |
| primitive | Materiales por instancia, transformaciones | Escaleras: recomposición geométrica no autorizada sin contrato |
| mesh | Material PBR por instancia | Comprobar aislamiento con recursos compartidos |
| model | Canales del propietario/modelo previos | GI y generación editorial excluidas CA-004 |
| group | Solo comunes; estructura excluida CA-004 | QA visual pendiente |
| subtract | CSG y propiedades propias previas | QA Jolt/CSG real pendiente |
| road | Canales de carretera previos | QA Player pendiente |
| water | Canales del mundo acuático previos | QA Player pendiente |
| terrain | Posiciones y propiedades previas | Topología/pintura/generación excluidas CA-004 |
| spawn | Etiqueta específica previo registro | Tags comunes de metadatos excluidos CA-004 |
| event | Canales visuales previos | QA de ejecución de comandos pendiente |
| gameplayObject | Interacción/indicador previos | QA de scripts y Gameplay pendiente |
| critters | Campos de especie previos | QA rendimiento pendiente |
| navigation | Propiedades de región + NavGrid temporal | QA rutas de IA y CPU pendiente |

**Criterio objetivo:** 34 tipos inventariados, **32 con canales especializados informativos** según CONT009–012; `node` y `group` son estructurales con canales comunes. No es «100 % de propiedades» ni prueba integral de los 34.

## 3. Luz: siete canales nuevos, de una sola instancia

| Campo | ID | Efecto real / restauración |
|---|---|---|
| Temperatura K | `light.temperature` | Recomposición del color renderizado con el color base (incluido `rtColor`); STOP restituye el estado previo |
| Lensflare | `light.flareOn` | Crea/retira Lensflare oficial de esa instancia, liberando textura al desactivar |
| Tamaño flare | `light.flareSize` | Redimensiona elementos Lensflare existentes; no comparte texturas con otra luz |
| Volumétrica | `light.volumetric` | Cambia metadata que consume render volumétrico; no crea niebla de escena |
| Intensidad vol. | `light.volIntensity` | Actualiza `light.userData.rtVol` de la instancia |
| Distancia sombra direccional | `light.shadowDistance` | Actualiza cámara shadow/proyección y marca `needsUpdate` |
| Animación de la luz | `light.style` | Actualiza `fx.style` mediante `LIGHT_STYLES` original |

No se alteran `obj.light`, Material Assets ni la identidad de otras luces. Los descriptores conservan lectura autoral, validación de tipo y rangos, disponibilidad condicional, captura/restore y serialización de claves por nodo/escena. No se crean clocks ni otros evaluadores.

## 4. Autoridad de cámara y exclusiones

- **Camera Shake**: `_shakeFrame` omite intencionalmente `film`, `timeline`, `pose` para no duplicar offsets ya resueltos por el propietario cinematográfico. Camera3D/FOV/selección de fuente se mantienen dentro del contrato; la política no es un fallo detectado.
- **S15-G007 Camera Orchestration**: `cameraExit.interrupted` está normalizado pero no tiene emisor de preempción aceptada entre propietarios. Se mantiene **PENDIENTE**, no se agrega una prioridad oculta ni se declara PASS.
- **Líquido y combustión**: aplicar CA-003/004 de forma documental y en ledger sin quitar los canales físicos de continuidad 011/012.
- **Escaleras**: parametrización geométrica sin llave no certificada; no insertar recomposición cara por frame, ni declararla excluida mediante una CA no ratificada.

## 5. QA automatizado, compilación y QA local

**Resultados efectivamente ejecutados en este Gate (entorno de auditoría, sin `node_modules`):**

| Verificación | Resultado comprobado | Alcance / limitación |
|---|---|---|
| Regresión focal CORR-003 + Camera Orchestration S15-G007 | **248 PASS / 0 FAIL** | Tests Node seleccionados; no valida Electron o GPU |
| Nuevos tests Luz | **12 PASS / 0 FAIL** | Descriptores y funciones reales evaluados con dobles de Three.js |
| Harness Camera Shake S01-G004 actualizado | **16 PASS / 0 FAIL** | La corrección es del fixture antiguo; runtime de Shake no modificado |
| Regresión ampliada que incluye Camera Shake y cinco suites históricas | **139 PASS / 1 FAIL** | Un fallo por dependencia `jszip` ausente; no atribuir a defecto funcional sin reproducir con dependencias |
| `npm run build` | **NO EJECUTABLE, exit 127** | `vite: not found` por dependencias npm ausentes |
| Electron embebido y Player exportado independiente | **NO VERIFICADOS** | Requieren QA local de usuario |
| QA de integración de los 34 tipos | **NO VERIFICADO** | Matriz informativa, pendiente de prueba de extremo a extremo |

No trasladar la cifra histórica de 508 PASS de CONT012 al código modificado ni convertir un test con dobles en QA visual. Los **248 PASS** y los **16 PASS** se reportan por separado y podrían solaparse con tests de la batería ampliada; no se suman como cobertura única. `jszip` y Vite requieren instalar las dependencias declaradas por el proyecto con su lockfile antes de repetir las comprobaciones en el entorno local.

**Obligatorio del usuario tras aplicar el CHANGE:** 

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-final-light.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont012-liquid-geometry.mjs
node --test scripts/test-camera-shake-s01-g004.mjs
npm run build
npm run electron
```

Además ejecutar las pruebas Node de S15-G007 y de continuidad previas si están disponibles. Probar en Electron embebido: luz puntual, direccional y spot con temperatura 0→3000→6500, Lensflare off/on y tamaño, pulsos, luz volumétrica y STOP/restauración; dos luces que compartan color/material de Assets sin cambio cruzado. Probar que `light.energy` y `light.color` tradicionales continúan funcionando mientras se evalúa temperatura.

**Matriz de integración de cierre:** Camera3D y cambio de cámara activa, Preview automático, Shake no duplicado, FilmMaker/Cinematics, audio y automation, scripts/eventos/comandos, Jolt y CSG, Navigation Bake, FPS timeline, seek/pausa/loop/STOP, guardado/carga, aislamiento por escena, export Player **independiente** del Editor, consumo FPS/RAM local, y seis hojas del ledger. Reportar la salida completa de Node y Vite, errores y game.log, vídeo/capturas de controles y restore, resultados del Player independiente y aprobación expresa. Sin ello CORR-003 permanece **ABIERTO**.

## 6. Diff exacto contra SOURCE_BASELINE 012 y condiciones de entrega

**Comparación SHA-256 interna archivo por archivo**, sin distribuir hashes como artefacto independiente: 3.115 archivos originales, 3.119 archivos finales; **4 nuevos, 6 modificados, 0 eliminados, 3.109 sin cambios**. No se detectaron archivos inesperados. El paquete CHANGE contiene exclusivamente los 10 archivos listados; el SOURCE_BASELINE conserva los 3.109 archivos originales inalterados y agrega las correcciones acumulativas.

**Nuevos (4):**

- `docs/architecture/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-003_AMENDMENT.md`
- `docs/architecture/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-004_AMENDMENT.md`
- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-FINAL-COVERAGE-G001_QA.md`
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-final-light.mjs`

**Modificados (6):**

- `docs/qa/LevelForge_DB_Ledger.xlsx` (seis hojas sincronizadas sin borrar historia)
- `scripts/test-camera-shake-s01-g004.mjs` (fixture histórico compatible con S15; runtime de Shake no se toca)
- `src/components/Inspector.vue`
- `src/engine/runtime/anim/model.js`
- `src/engine/runtime/events/play-light.js`
- `src/engine/runtime/nodes/light.js`

**Eliminados:** ninguno. **Inesperados:** ninguno. No incluir `node_modules`, builds, `dist`, cachés o archivos temporales. Ambos ZIP se extraen desde la raíz que contiene `package.json`, sin crear carpetas `src` paralelas. Elegir **un solo método**: aplicar CHANGE sobre copia limpia de 012, o usar SOURCE_BASELINE completo como nueva copia de trabajo; **no aplicar ambos paquetes sobre el mismo árbol**. Comparar y respaldar cualquier cambio local antes de sobrescribir archivos. Conservar la copia previa para reversión y no reemplazar proyectos/Assets/escenas de trabajo del usuario sin auditoría.

**Secuencia posterior:** instalar dependencias con `npm ci` en la raíz, repetir pruebas y `npm run build`, ejecutar `npm run electron`, probar funciones descritas en §5 y exportar un Player independiente. Enviar resultados y evidencias; reconciliar defectos que aparezcan en el QA sin superar el alcance autorizado. **Este Gate no implica QA LOCAL PASS, aprobación de CORR-003 ni cierre de Timeline.**
