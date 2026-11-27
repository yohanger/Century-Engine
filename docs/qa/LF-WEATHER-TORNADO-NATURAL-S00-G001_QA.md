# QA de auditoría — LF-WEATHER-TORNADO-NATURAL-S00-G001

**Tipo:** auditoría y diagnóstico, no entrega de tornado nuevo. Baseline: `LevelForge_WEATHER_STORM_BLACK_ARTIFACT_CORR_G001_SOURCE_BASELINE.zip`.

## Evidencia en este entorno

- Integridad ZIP de entrada: 1.306 archivos y sin entradas corruptas.
- Dos vídeos inspeccionados por fotogramas muestreados. Hojas de contacto en `docs/qa/reference/`. No se miden vientos, distancias ni tasas de giro de esos vídeos.
- Contratos y rutas inspeccionadas en S00: `World.tornado`, `CloudField`, `Sky`, Viewport, Player, eventos, física y VFX.
- Prueba nueva: `scripts/test-weather-tornado-natural-audit-s00-g001.mjs`: **16/16 PASS**, 0 FAIL, 0 SKIP. Regresión ampliada de seis suites: **81/81 PASS**, 0 FAIL, 0 SKIP (ejecutada durante S00).
- WebGL Electron en este entorno **NO VERIFICADO**: no hay `node_modules`; no se ejecuta navegador externo. Electron previo del usuario en VFX S00 no acredita el nuevo diagnóstico ni la calidad natural del tornado.
- Jolt WASM real, Editor/Player QA visual y Compatibility sobre hardware objetivo: **NO VERIFICADOS**.

## Comandos requeridos desde el SOURCE_BASELINE actualizado

```bash
node --test scripts/test-weather-tornado-natural-audit-s00-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s00-g001.mjs
node --test scripts/test-weather-tornado-visual-cohesion-corr-g001.mjs
```

En carpeta nueva sin dependencias, `npm ci` antes de Electron; **no instalar Chromium ni Brave externos**. Los tests heredados tienen sus propios límites; revisar el log de cada uno. Se requiere `16 PASS` para la nueva auditoría Node y `1 PASS` para la wrapper Electron, según el resultado esperado, **no acreditado** hasta ejecución real.

## QA manual imprescindible antes del siguiente Sprint

1. Abrir Editor sin nodo tornádico y observar nubes clásicas y por celdas: mismo preset/cámara/hora.
2. Con permisos de tornado, forzar `development` y `organization` y comprobar si la nube madre realmente reacciona antes de `formation`.
3. En `formation`/`active`, inspeccionar desde 2–3 ángulos el límite de unión entre nube madre y embudo, contra los fotogramas de referencia. Capturar evidencia de cambios bruscos o falsas capas.
4. Probar cambios de centro/posición y el modo nubes celdas: ¿el embudo coincide con un cumulonimbo? Registrar caso contrario.
5. Repetir con `cloudSeed` fijo y con `0`, guardar/restaurar: detectar si cambia la nube al reabrir.
6. Comprobar condensación parcial sin contacto visual y distinguir contacto físico del polvo de superficie; no corregir aún S00.
7. En Play/Stop y Player, verificar desaparición tras `ended`, ausencia de nubes/VFX persistentes y perfil Compatibility sin errores GPU.
8. Registrar FPS p50/p95 de escena sin/con tornado, misma cámara, perfil, resolución y clima; evitar comparar el benchmark CPU aislado con FPS.

**Evidencia a devolver:** log Node/Electron, captura de nube madre antes/durante/después desde al menos 2 ángulos, perfil de render, prueba Save/Load, comparación de coste, evaluación de usuario. Distinguir resultado de pruebas de aceptación visual.

## Condiciones de S00

- Matriz de autoridad y contrato propuesto completos, sin modificar producción.
- Contradicción de semilla persistente y reemplazo del shader identificadas, **NO resueltas por el Gate S00**.
- S01/S02 solo implementables después de ratificación contractual y autorización exacta del Gate correspondiente.
- **ESTADO: IMPLEMENTADO (AUDITORÍA), NODE TEST PASS si el log lo acredita, QA LOCAL PENDIENTE, NO CERRADO**.
