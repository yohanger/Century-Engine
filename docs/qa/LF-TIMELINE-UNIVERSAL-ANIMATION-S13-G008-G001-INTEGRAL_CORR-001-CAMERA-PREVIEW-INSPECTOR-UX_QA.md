# LevelForge · S13-G008-G001 CORR-001 — Camera Preview / Inspector UX

**Gate autorizado:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-001-CAMERA-PREVIEW-INSPECTOR-UX`

**Autorización literal recibida:** `Listo. LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-001-CAMERA-PREVIEW-INSPECTOR-UX autoriza comenzar`

**Baseline:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_INTEGRAL_SOURCE_BASELINE.zip` (el Gate G001 universal permanece implementado parcialmente, sin cierre ni QA universal).

## 1. Auditoría antes de modificar

| Clase | Hallazgo |
|---|---|
| OBSERVADO | `TimelinePreview.apply()` resolvía POV desde pistas `camera`; pistas `node` que animan una Camera3D no activaban la cámara de Preview. |
| CAUSA RAÍZ | La vía general de propiedades animadas se introdujo sin enlazar su Camera3D con el resolvedor de vista previa ya existente. |
| OBSERVADO | `.playhead` se dibujaba en primer plano con `z-index:24` efectivo, por encima de los rombos. |
| CAUSA RAÍZ | Prioridad CSS de capa superior a las pistas, no error del tiempo de las claves. |
| OBSERVADO | `PropertyKey` estaba como tercer hijo en filas `.field` de dos columnas; descendía debajo del valor. |
| CAUSA RAÍZ | Falta de columna CSS específica para llave en el Inspector; el botón ya era correcto. |
| INFERENCIA | La vista de Camera3D debe basarse en propietarios existentes, sin crear otra cámara del Editor o runtime de gameplay. |

## 2. Contrato implementado

- La toma explícita de cámara vigente conserva prioridad sobre la Camera3D inferida de pistas `node`. Una toma inválida no se sustituye silenciosamente.
- Si no existe toma explícita vigente: preferir la pista `node` Camera3D seleccionada; luego Camera3D de Jerarquía seleccionada con pista evaluable; finalmente una única Camera3D animada. Si hay varias sin desambiguar, conservar cámara del Editor.
- `resolveCamera3D` valida escena, actividad, jerarquía y nodos existentes; no hay nuevos escritores sobre la cámara del runtime ni sobre `obj.props`.
- Preview evalúa primero las propiedades temporales y después obtiene la pose, incluido FOV actualizado. Restaurar cámara y controles al detener, invalidar o perder fuente; transportar la selección por el `timelinePlayback` común.
- El cabezal conserva posición, regla y agarre, pero la guía vertical queda bajo clips, asas y claves.
- Cada fila de Inspector con `PropertyKey` tiene etiqueta, control y llave alineados horizontalmente. En docks muy estrechos la etiqueta puede ocupar la línea superior, manteniendo control y llave juntos.
- Compactar discretamente el espacio entre propiedades; no alterar `PropertyKey.vue` ni la composición general de Codex.
- No cambiar modelo, persistencia, reproducción de clips históricos, scripts, eventos, audio, Jolt, FilmMaker, Cinematics o Camera Orchestration.

## 3. Inventario de archivos del Gate

**Fuentes productivas:** `src/core/timeline/preview.js`, `src/core/timeline/playback-session.js`, `src/App.vue`, `src/components/TimelinePanel.vue`, `src/components/Inspector.vue`.

**QA nuevo:** `scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs`, `scripts/test-timeline-universal-animation-s13-g008-g001-corr001-electron.mjs`, `scripts/fixtures/editor/timeline-universal-animation-s13-g008-g001-corr001.html`.

**Contratos de aserciones existentes ajustados a la nueva capa visual:** `scripts/test-timeline-visual-ux-s13-g008-g001.mjs`, `scripts/test-timeline-visual-ux-s13-g008-g001-corr002.mjs`, `scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs`. No cambian la lógica productiva ni invalidan las pruebas de coordenadas.

## 4. Verificaciones automáticas y limitaciones

- Suite CORR-001 focal Node: **16/16 PASS**, sin Vite, Vue ni Three instalados; cubre prioridad, selección, ambigüedad, mute, ausencia de claves, invalidación, stop/restauración y composición estática.
- Lote de 7 suites seleccionadas: **130 PASS / 1 FAIL**. El FAIL es `VIS-CORR002-09` que exige el antiguo botón `.timeline-titlebar .title-preview` ya retirado por Codex antes de este Gate. No se restaura un control obsoleto por una prueba histórica. Este mismo error se reproduce en la base anterior.
- Lote heredado extendido: **5 fallos anteriores**, cuatro de `test-timeline-visual-preview-s08-g001-corr001.mjs` por harness que no dispone de `seekTime` y uno de `VIS-CORR002-09`. Confirmados en baseline anterior; registrar por separado y no declararlos PASS.
- `npm run build`: **NO COMPILADO** — `vite: not found` (`node_modules` no presente). No hay evidencia nueva de build Editor/Player.
- Test Electron CORR-001: **PREPARADO · NO EJECUTADO** por dependencias ausentes. No existe QA visual automatizado ni QA local de usuario de esta corrección.
- Universalidad de las propiedades fuera de la corrección: **INCOMPLETA**; G001 sigue abierto. No relacionar los 16 tests de CORR-001 con certificación universal.

## 5. Ejecución local de QA (raíz con `package.json`)

Ejecutar primero los tests estáticos Node sin conexión:

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-integral.mjs
node --test scripts/test-timeline-node-method-track-s04-g003.mjs
node --test scripts/test-timeline-property-animation-s13-g008-g008-ux-corr004.mjs
```

Con dependencias locales instaladas, ejecutar:

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr001-electron.mjs
npm run build
npm run electron
```

No ejecutar `npm ci` de forma destructiva en la carpeta activa si hay cambios locales o instalación que preservar. El runner Electron usa Electron embebido, no navegador externo.

### QA manual obligatorio — Editor Electron

1. Abrir una escena con Camera3D activa, Timeline editable y pistas de **Posición** de esa cámara, sin pista de toma. Crear claves en 0 s y 2 s; pulsar Play: debe verse POV de Camera3D mientras se anima, no perspectiva libre del Editor.
2. Arrastrar cabezal a 1 s: debe verse la misma cámara en pose interpolada. Comprobar FOV temporal si existe.
3. Añadir toma explícita de otra cámara: la toma activa conserva autoridad. Deshabilitar toma: vuelve Camera3D animada cuando no hay ambigüedad.
4. Crear pistas animadas de dos Camera3D. Sin selección no elegir arbitrariamente; al seleccionar una pista/cámara, usar esa cámara; al cambiar selección, ajustar Preview.
5. Silenciar pista, desactivar Camera3D o cambiar de escena: comprobar restauración y ausencia de selección forzada.
6. Stop (y salir de Timeline): restaurar cámara original y control del Editor. Verificar que la cámara del juego/Player nunca toma la cámara de edición.
7. En Timeline, la guía del cabezal no debe tapar los rombos ni interceptar su clic/arrastre. Verificar en clave coincidente, clip y diferentes zoom/snap.
8. Inspector a 1366×768 y dock estrecho: `Posición` / `Rotación` / `FOV` y propiedades Light muestran la llave **al lado del control**, no debajo; nombres no desbordan y el espaciado es discreto.
9. Verificar llaves en cabeza de pista, clic de clave, Scripts/métodos con argumentos, comandos de eventos, Audio/Mixer, Cinema/FilmMaker, creación no redundante de clips y proyectos históricos.
10. Probar PlayMode y Player: sin nuevos errores y sin disputa de autoridad entre cámara del juego y Preview del Editor.

**Evidencia requerida:** salida de tests Node y Electron, `npm run build`, capturas de Preview POV vs cámara Editor, capturas de Inspector horizontal y zoom/pista, consola de errores y observaciones de PlayMode/Player.

**Estados:** IMPLEMENTADO EN FUENTES; NODE CORR-001 PASS; Electron/Build/Player/QA LOCAL **NO VERIFICADOS**; APROBADO/CERRADO **NO DECLARADO**.

## 6. Incidencia de QA Electron reportada por el usuario (2026-11-10)

**Evidencia local aportada** — sobre G001 SOURCE_BASELINE + CORR-001 CHANGE:

- `node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs`: **16/16 PASS** (versión anterior al ajuste del fixture).
- `node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr001-electron.mjs`: **1 test FAIL**, al tercer check: «Propiedad Posición contiene etiqueta, valor y llave en un solo campo». Los dos anteriores pasaron: montaje de Timeline/Inspector y presencia de llaves contextuales.
- **No se ejecutaron** los checks posteriores de alineación, Camera Preview, prioridad o restauración: el harness interrumpe la batería en el primer check fallido.
- `npm run build` se interrumpió manualmente durante la transformación de módulos, y `npm run electron` se interrumpió sin evidencia de QA; **ni COMPILADO PASS ni COMPILADO FAIL**.

### Aislamiento y corrección dentro del QA del Gate aún abierto

- **OBSERVADO:** el fixture anterior elegía el primer `.field` cuyo primer `label` descendiente fuera «Posición» y asumía el segundo hijo como control. Esta búsqueda no expresa la identidad de la propiedad ni distingue las etiquetas anidadas de componentes numéricos.
- **OBSERVADO EN FUENTE:** el Inspector de Camera3D define la fila de Posición con etiqueta, `Vec3Field` y `PropertyKey` dentro del mismo `.field`. `getDef('camera')` mantiene base Node3D y `nodeAnimationProperty(position)` permite su canal.
- **INFERENCIA:** la búsqueda ambigua del fixture es candidata a explicar el fallo; el log original no contiene la instantánea del DOM necesaria para certificar su causa raíz. **No está demostrado** que Preview ni la producción tengan un defecto.
- **CORRECCIÓN QA:** ahora el fixture obtiene el botón por `aria-label="Insertar clave de Posición en Timeline"`, asciende a su `.field` y verifica **directamente** etiqueta «Posición», `Vec3Field` y llave en la misma fila. Conserva el cálculo de geometría real del botón respecto al control; NO se omiten verificaciones. Si falla, adjunta `inspectorNodeType`, llaves presentes y candidatos de fila con sus hijos para identificar el defecto concreto.
- **REGRESIÓN:** PV-17 valida que el fixture usa identidad semántica, comprueba la fila y mantiene la prueba de alineación sin volver a la búsqueda ambigua.
- **TEST AUTOMATIZADO en este entorno:** 17/17 focal PASS; batería seleccionada de cuatro suites **82/82 PASS**. Electron **NO VERIFICADO DESPUÉS DEL AJUSTE** porque faltan dependencias aquí. El usuario debe volver a ejecutar Electron localmente.
- **ALCANCE:** solo fixture original y suite Node original; no se modificaron Inspector, Timeline, Preview, Player, Jolt, recursos ni datos del proyecto.

### QA local requerido antes de cerrar CORR-001

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr001-electron.mjs
npm run build
npm run electron
```

Esperado: **17 pruebas focales PASS** y, en Electron, **al menos 12 checks PASS**. Si Electron sigue fallando, devolver **el JSON completo del fallo**, incluidos los diagnósticos nuevos. No se declara FIXED ni QA LOCAL PASS antes de esa ejecución y de la comprobación de cámara/Inspector por el usuario. El G001 universal original permanece abierto y con cobertura incompleta.
