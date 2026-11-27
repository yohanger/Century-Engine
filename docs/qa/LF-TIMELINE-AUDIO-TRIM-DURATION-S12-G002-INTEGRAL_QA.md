# LevelForge — S12-G002 · QA y estado

## Fuente y autorización

- SOURCE_BASELINE de entrada: `LF_TIMELINE_PREVIEW_DIALOG_S12_G001_INTEGRAL_CORR002_SOURCE_BASELINE.zip`.
- Autorización literal: `Listo. LF-TIMELINE-AUDIO-TRIM-DURATION-S12-G002-INTEGRAL autoriza comenzar`.
- Alcance autorizado: inicialización de duración al asignar fuente a clave nueva, visualización de duración real en claves `duration: 0`, recorte integrado en el extremo derecho del audio, preservando Player y modelo existentes.
- `AGENTS.md` no es prerrequisito de este asistente por aclaración expresa del usuario; se conserva su propia organización de Codex.

## Estado y resultados

| Dimensión | Evidencia y estado |
|---|---|
| Implementación | IMPLEMENTADO en fuentes; sin apertura de Gate de efectos, zoom o menús |
| Test Node G002 | 18 PASS / 0 FAIL / 0 SKIP |
| Regresión Node compatible | 173 PASS / 6 SKIP / 0 FAIL, 179 pruebas |
| Fixture Electron embebido | Preparada, 20 comprobaciones; NO VERIFICADA. Abortó en generación por ausencia de Vite antes de arrancar fixture |
| Compilación Editor y Player | NO VERIFICADA en generación: `vite: not found`, exit 127 |
| QA local audiovisual | PENDIENTE; el usuario ejecuta |
| Gate G002 | IMPLEMENTADO, TEST NODE PASS, NO APROBADO, NO CERRADO |

Los seis SKIP pertenecen a pruebas que requieren dependencias ausentes en el entorno de generación. No se convierten en PASS. Conservar el log íntegro con las justificaciones.

La aprobación previa de `LF-TIMELINE-PREVIEW-DIALOG-S12-G001-INTEGRAL_CORR-002` se registra como **QA LOCAL PASS declarado por el usuario, APROBADO y cierre documental registrado**, sin atribuir un PASS Electron o build posterior no comunicado.

## Cobertura indispensable y pasos de QA local

Aplicar únicamente CHANGE sobre la carpeta existente del proyecto (raíz con `package.json`) después de comparar los archivos y respaldar cambios locales. No extraer SOURCE_BASELINE encima de una carpeta con modificaciones propias.

```bash
node --test scripts/test-timeline-audio-trim-duration-s12-g002.mjs
node --test scripts/test-timeline-audio-trim-duration-s12-g002-electron.mjs
npm run build
npm run electron
```

Esperado Node focal: 18 PASS. Esperado Electron: 1 PASS y 20 comprobaciones internas, WebGL activo; debe ejecutar realmente la fixture, sin `Vite not found`. Compilación: Editor y Player completos, sin errores.

QA manual en Electron embebido:

1. Crear una clave de pista Audio, seleccionar un Asset de 6 s y comprobar que la duración inicial del Inspector y la longitud visual son 6 s si caben en el Timeline.
2. Comprobar clave antigua con `duration: 0`: su audio sigue completo sin que se modifique el dato histórico. Al cargarse el análisis PCM, el dibujo ocupa la duración efectiva; cambiar offset/pitch cambia esa duración visual.
3. Recortar arrastrando el borde derecho: el inicio no cambia; Snap, pausa de audio/reloj, bloqueo y Undo/Redo funcionan. Probar teclado flechas y Home (`0 = fuente completa`). Un arrastre no debe transformar el valor en `0`, que reiniciaría la reproducción completa.
4. Fuente más larga que el Timeline: aviso contextual y recorte al espacio disponible, sin ampliar duración global de manera oculta. El archivo PCM permanece intacto.
5. Recorte visible en Inspector tras seleccionar el clip. Guardar/reabrir y comprobar duración. Preview reproduce y detiene en la duración indicada; Player real reproduce de igual forma.
6. Regresión: forma de onda, FX individuales, buses Mixer, comando Mostrar texto aprobado, Comandos/Naturaleza/Métodos sin duraciones nuevas.

Devolver salida de Node, Electron, build, captura del clip y resultado auditivo Preview/Player. No declarar QA LOCAL PASS ni CERRADO sin evidencia posterior del usuario.

## Evidencia conservada

- `docs/qa/evidence/LF_S12_G002_NODE_FOCAL.log`
- `docs/qa/evidence/LF_S12_G002_NODE_REGRESSION.log`
- `docs/qa/evidence/LF_S12_G002_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S12_G002_BUILD_ENV.log`

El historial de G003, G004, G005, G006 y S12-G001/CORR001/CORR002 sigue en la base y ledger. Los seis fallos de regresión histórica mencionados en S11 no están declarados corregidos.
