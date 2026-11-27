# LF-WEATHER-TORNADO-NATURAL-S01-G001 — QA usuario

**Estado del Gate:** IMPLEMENTADO · TEST NODE PASS · ELECTRON/GPU/BUILD/PLAYER NO VERIFICADOS · NO CERRADO.

## Fuente de instalación

Aplicar CHANGE solo sobre `LevelForge_WEATHER_TORNADO_NATURAL_S00_G001_SOURCE_BASELINE.zip`, comparando archivos locales. Alternativamente extraer el nuevo SOURCE_BASELINE S01 en carpeta **independiente**. Conservar escenas, Assets, proyectos, `node_modules` local y baselines originales. No ejecutar navegadores externos.

## Comandos (raíz del proyecto actualizado)

```bash
npm ci
node --test scripts/test-weather-tornado-natural-s01-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s01-g001.mjs
node --test scripts/test-weather-tornado-visual-cohesion-corr-g001.mjs
node scripts/bench-weather-tornado-natural-s01-g001.mjs
npm run build
npm run electron
```

Los **18 tests TN1** nuevos deben pasar; la prueba Electron debe devolver **1 PASS** y `TN1_WEBGL`, con al menos 12 comprobaciones internas, diferencias de píxeles para `classic` y `cells` y ausencia de errores WebGL. Estos son resultados esperados, **no acreditados**.

## QA visual manual (Editor)

1. Crear una escena de referencia con cielo visible y clima controlado. Elegir modo de nubes `classic`, activar tormenta y permitir tornado. Mantener cámara y resolución constantes.
2. Observar `idle`, `development`, `organization`, `formation`, `active`, `weakening`, `dissipation` y `ended`. La base nubosa debe reaccionar antes del embudo; no debe existir un nuevo emisor VFX3D ni una segunda capa geométrica.
3. Repetir en modo `cells` con `cloudSeed` fija. Confirmar asociación de nube madre estable sin salto al cambiar la cámara; comparar acercamiento y desplazamiento del centro del tornado.
4. Repetir con `cloudSeed=0`; guardar una partida en Play durante organización, cerrar Play, cargar y comparar nube madre, mapa, dirección y episodio. Repetir con semilla fija.
5. Mover la posición del tornado por scripting y verificar que no aparece otra nube independiente, ni se mueve la cámara ni desaparecen las nubes ajenas al episodio.
6. Desactivar tornados y terminar la tormenta: la organización debe disiparse sin dejar geometría/residuos. Verificar nube sin tornado y cambio de clima.
7. Comprobar lluvia/bruma/nieve, absorción, viento, Jolt/CharacterBody3D y VFX3D genérico sin alteraciones.
8. Probar los perfiles Forward+, Mobile y Compatibility y el Player, conservando las mismas escenas.

## Evidencia a devolver

Salida íntegra de Node/Electron/build; capturas o vídeo de `development`, `organization` y `formation` en ambos modos, registro de Play/Save/Load, diferencias visuales, p50/p95 F3 y mensajes GPU. Comparar contra S00 usando idéntica cámara, escena, resolución y perfil. Los resultados Node no sustituyen QA visual.

## Criterio de aceptación

Una nube madre existente se organiza de forma visible y temporalmente coherente antes de que aparezca el embudo; el mismo episodio gobierna física y nube sin doble viento, renderer o escena. Guardado/restauración mantiene vínculo. QA visual aprobado por el usuario y ledger sincronizado. **S02 queda pendiente; no declarar que el tornado final parece natural por S01.**
