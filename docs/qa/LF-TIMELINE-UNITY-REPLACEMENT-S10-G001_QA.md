# QA de integración — LF-TIMELINE-UNITY-REPLACEMENT-S10-G001

## Estado de verificación (2026-11-06)

| Tipo de evidencia | Resultado |
| --- | --- |
| Pruebas del Gate (`scripts/test-timeline-unity-replacement-s10-g001.mjs`) | 12 PASS, 1 SKIP (compilador Vue no instalado) |
| Regresión compatible (S04/S07/S08/S09 + Gate S10) | 107 PASS, 4 SKIP, 0 FAIL |
| Regresión adicional S01 Assets/animaciones | NO EJECUTABLE: dependencia `jszip` ausente; no contabilizar como defecto nuevo ni PASS |
| `npm ci --offline` | FALLÓ: paquete `zip-stream@4.1.1` no disponible en caché local |
| Compilación Vite / Electron | NO VERIFICADA: dependencias no disponibles en este entorno |
| QA visual, docking, persistencia local, Player | PENDIENTE — usuario |

## Instrucciones para QA local del usuario

**Ubicación:** raíz del proyecto que contiene `package.json`. Usar el nuevo SOURCE_BASELINE en carpeta separada si existen modificaciones locales; no mezclar correcciones de otros Gates.

```bash
npm ci
node --test scripts/test-timeline-unity-replacement-s10-g001.mjs
node --test scripts/test-timeline-pro-ux-s07-g001-integral.mjs scripts/test-timeline-visual-preview-s08-g001-integral.mjs scripts/test-timeline-advanced-direction-s09-g001-integral.mjs
npm run electron -- --build
```

**Secuencia visual y funcional:**

1. Abrir la Timeline sin recurso abierto; debe mostrarse **Seleccionar Timeline** y **Nuevo Timeline**. Crear un recurso y abrirlo por ID desde Assets. Cerrar y reabrir sin pérdida de pistas.
2. Con la ventana acoplada y desacoplada, comprobar el encabezado compacto, los botones de transporte, el selector, la regla, zoom, el menú + Pista sobre cabeceras y el Inspector. Repetir en un panel estrecho.
3. Crear pista de nodo mediante Jerarquía y pista de cámara. Insertar dos claves, seleccionar el segmento que aparece entre ellas y confirmar que selecciona la clave inicial en Inspector. Arrastrar las claves y ajustar duración con el asa original S09; las claves no deben duplicarse.
4. Probar reproducción, pausa, detener, ir al inicio y retroceder/avanzar por intervalo Snap, incluidos los límites 0 y duración; verificar el cabezal y el overlay del viewport, reversibles al ocultar Timeline o entrar a Play.
5. Silenciar una pista mediante el icono nuevo y confirmar cambio `muted` y persistencia tras guardar/reabrir. Probar deshacer si la edición de pista lo admite en el historial del proyecto.
6. Abrir + Pista y verificar audio, comandos, métodos, cámara, nodo y las opciones de naturaleza (lluvia, relámpago, trueno); no deben ejecutarse durante scrubbing en Edit Mode.
7. Verificar arrastre de nodo, búsqueda/selector de recursos, menú contextual, audio, pista bake de solo lectura, Inspector de claves y guardado/reapertura del `.lfproj`.
8. Confirmar en PlayMode y Player que las escenas y recursos anteriores se reproducen. No tocar Nether FilmMaker durante este Gate.

**Salida esperada:** 12 PASS, 0 FAIL en el test específico, más 1 prueba de compilador que debe ejecutarse si `npm ci` instala `@vue/compiler-sfc` (13 PASS esperados). `npm run electron -- --build` debe compilar sin errores y abrir el Editor. Esto no implica aprobación visual automática.

**Evidencia a devolver:** log final del test y build, capturas de Timeline con dos pistas, pistas seleccionadas/segmento y ancho estrecho, observación de silencio y persistencia, incidencia concreta si falla.

**Cierre prohibido antes de QA local del usuario y aprobación explícita.**


## Cierre confirmado del Gate S10-G001 — 2026-11-07

El usuario aprobó la revisión `LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001` tras rechazar la primera corrección del desplazamiento horizontal. Node CORR001-QA2: 11 PASS / 0 FAIL / 0 SKIP. Vite: 837 módulos, `✓ built in 1m 28s`. QA visual del alcance estructural aprobado expresamente. **S10-G001 CERRADO**. No se ha demostrado la integración completa del Player ni la persistencia exhaustiva; quedan como guardarraíles de Sprint 10. Ver QA y evidencia de CORR-001 y el ledger.
