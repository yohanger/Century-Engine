# LF-WEATHER-TORNADO-NATURAL-S03-G001 — QA local

**Estado:** IMPLEMENTADO · NODE PASS · ELECTRON/BUILD/QA LOCAL NO VERIFICADOS · NO CERRADO.

## Instalación

Extraer `LevelForge_WEATHER_TORNADO_NATURAL_S03_G001_SOURCE_BASELINE.zip` en una carpeta **nueva**. Alternativa: aplicar `LevelForge_WEATHER_TORNADO_NATURAL_S03_G001_CHANGE.zip` exclusivamente sobre `LevelForge_WEATHER_TORNADO_NATURAL_S02_G001_CORR_002_SOURCE_BASELINE.zip`, comparando antes los cambios locales. Conservar original S02, `proyecto_8`, escenas, Assets y `node_modules` de la instalación operativa; no sobrescribirlos.

## Comandos desde la raíz del proyecto S03

```bash
npm ci
node --test scripts/test-weather-tornado-natural-s03-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s03-g001.mjs
node --test scripts/test-weather-tornado-natural-s02-corr002.mjs
node --test scripts/test-weather-tornado-natural-electron-s02-corr002.mjs
npm run build
npm run electron
```

**Resultado esperado (NO acreditado localmente):** 21/21 TD3, 1/1 Electron con al menos 13 comprobaciones (`TN3_WEBGL`), 11/11 TC2 y 1/1 Electron TC2. Build Editor y Player debe terminar satisfactoriamente. Si la fixture falla, entregar el error íntegro sin interpretar Node como GPU PASS.

## Escenas de prueba

1. En terreno, activar clima de **Tormenta**, tornado automático al 100 % y ubicarlo donde exista terreno real. Probar **Tierra (Auto)**, **Arena (Auto)** y **Grava (Auto)** en **Terreno → Capas → Superficie**; no se requiere ningún archivo `.vfx` ni nodo VFX3D.
2. Observar el polvo al iniciarse la circulación física. Durante `development/organization` no debe emitirse si `intensity=0`, aunque la nube madre se organice. La formación puede levantar polvo con embudo incompleto.
3. Pintar zonas **Hierba**, **Roca**, **Metal** y una capa sin nombre/superficie: no deben generar polvo automáticamente. Comprobar que otras zonas sin polvo conservan su aspecto.
4. Agregar agua física por encima del terreno: sin polvo terrestre dentro de la zona cubierta. Activar hidrología, lluvia fuerte y nieve para comprobar supresión por saturación.
5. Reducir intensidad y terminar el episodio: las partículas deben envejecer; **Stop** debe liberar el renderer temporal. Repetir Play/Stop sin memoria o meshes duplicados.
6. Comprobar visibilidad junto a PrecipFX y Fog existentes. No debe existir un segundo tornado de partículas. Verificar que agua suspendida y fuego siguen siendo emisores opcionales independientes.
7. Mirar desde varias distancias; comprobar profundidad ante edificios, sombras y ausencia de quads negros. Comparar el mismo estado con S02 para evaluar impacto visual y FPS/frame time.
8. Ejecutar prueba equivalente en el **Player exportado**, y en perfiles gráficos aplicables. El pulido cromático/parte superior queda para un Gate futuro, no es motivo para cambiar S03.

## Evidencia a devolver

Salida íntegra Node/Electron/build; vídeo o capturas de suelo seco, húmedo y cubierto por agua, fase de formación, actividad y disipación; Play/Stop sin residuos; Editor y Player independiente; FPS y frame time con/sin polvo y mismo perfil. No atribuir PASS visual al test estructural.

**Cierre:** solamente con QA local y aprobación del usuario. Registro de las seis hojas del ledger separado del estado real de compilación y visual.

### Limitación del entorno de construcción

Regresión VFX adicional: 35 casos PASS en el conjunto invocado; dos archivos de prueba (`test-vfx-player-s02-g002.mjs` y `test-vfx-resource-s01-g001.mjs`) no pudieron iniciarse aquí porque el entorno carece de `jszip`. No equivalen a FAIL del runtime ni a PASS de dichos casos. Repetirlos en tu instalación con `node_modules` como parte del QA. No se dispone de Electron ni de builds verificables en este entorno.
