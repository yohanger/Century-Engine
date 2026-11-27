# QA — LF-WEATHER-UNIFICATION-S04-G001

## Instalación

Base: `LevelForge_WEATHER_UNIFICATION_S03_G001_QA_CORR_001_SOURCE_BASELINE.zip`. Extraer CHANGE en la raíz donde está `package.json` tras comparar cualquier modificación local. Conservar SOURCE_BASELINE S04 completo en lugar separado.

## Node y benchmark

```bash
node --test scripts/test-weather-unification-s04-g001.mjs
node scripts/bench-weather-unification-s04-g001.mjs
```

14 PASS requeridos en la suite específica. El benchmark imprime **ms por lote de 3.000 actualizaciones de CloudField** para Despejado, Lluvia y Tormenta, no FPS. Repetir bajo condiciones similares; nunca interpretar un valor de Node como rendimiento del Player.

## Electron GPU y compilación

```bash
node --test scripts/test-vfx-webgl-s02-g001.mjs scripts/test-weather-tornado-visual-webgl-corr-g001.mjs scripts/test-weather-tornado-visual-cohesion-webgl-corr-g001.mjs
npm run build
npm run electron
```

No se requiere navegador externo. La evidencia anterior 3/3 Electron pertenece a S03; repetir con el SOURCE_BASELINE S04 y adjuntar salida. Si Electron o Vite no inician, consignar bloqueo del entorno.

## QA funcional y Performance (F3)

Con el mismo proyecto, misma cámara, resolución, calidad y hardware, ejecutar en S03 y S04:

1. Despejado: registrar FPS, p50/p95 de fotograma, RAM del proceso, geometrías, texturas y draw calls.
2. Lluvia, sin tornado: comprobar gotas y salpicaduras, agua, visibilidad y guardar las mismas métricas.
3. Tormenta con **Permitir tornados desactivado**: repetir métricas y **registrar cualquier rectángulo negro**. Esta incidencia no se cierra aquí.
4. Tormenta con tornado activo: documentar formación/disipación, viento efectivo, agua suspendida, vegetación, brasas y jugador. Comprobar no duplicación de fuerzas; separar cualquier bloqueo de Jolt.
5. Repetir Play/Stop y transición Despejado → Lluvia → Tormenta → Despejado cinco veces. Registrar si aumenta el conteo de recursos y si persisten efectos ocultos.
6. Repetir en Compatibility y, donde sea posible, Player exportado. Documentar el perfil de calidad elegido.

**Aceptación:** sin regresiones de determinismo, masas, eventos, efectos o recursos. Cualquier cambio de FPS debe medirse en comparación reproducible. La falta de evidencia local mantiene S04 NO CERRADO.

## Evidencia que debe devolver el usuario

Salida Node, tres tests Electron, compilación, capturas del panel F3 para cada condición y antes/después, salida de Jolt WASM real cuando esté disponible, y capturas/video de transiciones y Play/Stop. Registrar NO VERIFICADO si no se ejecutó.
