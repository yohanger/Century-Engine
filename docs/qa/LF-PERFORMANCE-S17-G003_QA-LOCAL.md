# S17-G003 — QA local obligatorio: F3, AppImage y AO

**Objetivo:** verificar opciones NGME de diagnóstico por Build, seguridad de exportaciones normales y mediciones comparables de Ambient Occlusion. **No usar ni reemplazar proyectos/productos publicados sin respaldo.** Conservar el SOURCE_BASELINE G002.

## Preparación
Extraer el SOURCE_BASELINE G003 en carpeta nueva con `package.json` en la raíz. Ejecutar en Linux:

```bash
npm ci
node --test scripts/test-performance-s17-g003-diagnostics.mjs
node --test --test-name-pattern='F12-0[7-9]|F12-1[0-2]' scripts/test-editor-f12.mjs
npm run build
npm run electron
```

**Esperado:** 11 PASS, 0 FAIL en G003; 6 PASS y 6 SKIP para los casos de seguridad F12 seleccionados. `npm run build` debe completar Editor + Player. Si falla, detener la exportación y adjuntar el log. Las suites generales que exigen recursos no presentes en el ZIP deben informarse por separado.

## Editor
1. Abrir un proyecto de QA. Pulsar F3 en el Editor: alterna el monitor de Rendimiento. Pulsar F3 durante Play: también lo alterna.
2. Un INPUT/TEXTAREA/SELECT con foco no debe perder su F3. Comprobar también el botón Stats existente.
3. Confirmar que el panel solo mide mientras está visible; al cerrarlo no mantiene GPU queries de forma permanente.

## Exportaciones AppImage: las cuatro combinaciones
Exportar **cuatro archivos distintos** desde Build. Volver a abrir Build entre cada exportación y comprobar que las opciones han vuelto a estar apagadas.

| Configuración Build | Ctrl+Shift+F12 | Ctrl+Shift+F3 | Esperado |
|---|---|---|---|
| Ninguna habilitada | NO | NO | Sin panel ni DevTools |
| Solo NGME-STATS | NO | SÍ | Mismo panel F3, sin DevTools |
| Solo NGME-DEVTOOLS | SÍ | NO | DevTools, sin monitor |
| Ambas | SÍ | SÍ | Ambas funciones independientes |

En cada AppImage probar F12 simple y Ctrl+Shift+I: no deben dar acceso NGME. El AppImage normal no debe permitir DevTools siquiera mediante `GAME_DEVTOOLS=1`. Revisar que no se haya alterado la configuración autoral del proyecto, permisos de navegación o la carga de game.rtpkg. Confirmar NGM Runtime: cámara, entrada, audio, ViewModel y salida. Capturar los logs con evidencia visual y nombre de cada binario.

## AO: comparación con misma cámara/escena/resolución
Realizar la prueba dentro del AppImage con **solo NGME-STATS**. Usar ventana 1280×720 y la misma escena, punto de vista, fuente de energía y ambiente. Mantener sombras, bloom, niebla y escala de resolución sin cambios.

- **A — AO normal:** Render Realista/Alto, `ao` actual (por ejemplo 0,9), sin cambiar el número de muestras. Tras calentamiento, registrar tres corridas de 60 s: FPS, p50, p95, GPU total, pasada AO, draw calls, capturas.
- **B — AO desactivado como diagnóstico:** misma escena y configuración, cambiando solo AO a 0. Registrar tres corridas idénticas. **No es la solución de producción**: permite estimar cuánto coste aporta el efecto.
- **C — Restaurar AO normal:** volver al valor original y comprobar que la imagen y el coste regresan, sin fuga de recursos.

En caso de fuente GPU timer no compatible, indicar `GPU NO DISPONIBLE`, nunca inventar medidas. Evitar comparar una captura de Editor con otra de AppImage como si fueran iguales. Anotar resolución física, escalado OS, perfil de render y si se ejecuta conectado a corriente.

## Evidencia que debes devolver
1. Salida literal Node y `npm run build`.
2. Capturas F3 Editor/Play y cuatro matrices de permisos AppImage.
3. Tres corridas A/B/C de AO, p50/p95, GPU AO y capturas visuales.
4. Resultado de NGM Runtime independiente, y `game.log` si hay errores.

**Estado de cierre:** Node PASS no equivale a compilación, calidad visual ni FPS mejorado. Hasta recibir evidencia, G003 permanece IMPLEMENTADO + QA LOCAL PENDIENTE.
