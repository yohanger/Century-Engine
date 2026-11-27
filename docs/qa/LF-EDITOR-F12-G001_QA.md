# LF-EDITOR-F12-G001 — DevTools solo en el editor

**Fecha:** 2026-10-24  
**Estado:** IMPLEMENTADO · COMPILACIÓN Y QA ELECTRON/APPIMAGE PENDIENTES  
**Baseline:** `LevelForge_EVENT_MATCH_G001_SOURCE_BASELINE.zip`

## Contrato

El atajo F12 abre o cierra las herramientas de desarrollo de la ventana **LevelForge** tanto en modo de desarrollo (`electron:dev`) como en el editor compilado (`npm run electron`, `npm start`, AppImage). Se registra directamente en `electron/main.cjs`, aprovechando el `webContents` actual, sin añadir menús nativos, IPC adicional ni `globalShortcut`.

La recarga Ctrl/Cmd+R sigue limitada a `VITE_DEV_URL`. El atajo F12 consume solo el evento `keyDown` correspondiente; una pulsación autorepetida no vuelve a alternar las DevTools. F5, F11 y los atajos existentes no se modifican.

Nether Film Maker mantiene el comportamiento previo: F12 y recarga en desarrollo; el cambio no habilita F12 en su edición compilada. Esto mantiene limitado el alcance del Gate.

El juego exportado ejecuta `electron/player/main.cjs`, no `electron/main.cjs`: `webPreferences.devTools: false` es fijo, incluso con `GAME_DEVTOOLS=1`, y el reproductor ya no permite peticiones con esquema `devtools:`. El Player no consume artificialmente las teclas F12 o Ctrl+Shift+I, por lo que no altera el InputMap de juegos; es la propia configuración de Chromium/Electron la que impide abrir DevTools. El comportamiento F11 (pantalla completa) permanece intacto.

Esta protección corresponde al funcionamiento ordinario de los juegos distribuidos. No pretende impedir depuración externa del ejecutable con herramientas del sistema operativo o flags deliberados del proceso.

## Pruebas automatizadas realizadas

Comando:

```bash
node --test scripts/test-db-contract.mjs
```

**408 PASS, 0 FAIL, 0 TODO** (396 heredadas + 12 nuevas F12).

Las doce pruebas ejecutan los procesos principales de Electron (`electron/main.cjs` y `electron/player/main.cjs`) en un contexto Node controlado, con `BrowserWindow`, `webContents`, eventos de teclado y sesiones simulados. Comprueban apertura/cierre, DEV_URL y producción, autorrepetición, keyUp, recarga dev, Film Maker, variable `GAME_DEVTOOLS=1`, F11 y redirecciones `devtools:`. No sustituyen una prueba visual con Electron real.

`node --check` de los dos scripts CommonJS: **PASS**.

**Compilación no verificada:** `npm run build` retorna `vite: not found` porque este entorno no contiene `node_modules`. No se declara que el editor o el Player exportado hayan compilado aquí.

## QA local — criterios de aceptación

| ID | Prueba | Resultado esperado |
|---|---|---|
| F12-LOCAL-01 | `npm run electron:dev`, presionar F12 | DevTools se abren en la ventana del editor |
| F12-LOCAL-02 | Presionar F12 nuevamente | DevTools se cierran |
| F12-LOCAL-03 | Mantener F12 presionado | No parpadean por autorepetición |
| F12-LOCAL-04 | Ctrl/Cmd+R en `electron:dev` | El editor se recarga |
| F12-LOCAL-05 | `npm run build` | Compilan `dist/` y `dist-player/` sin errores |
| F12-LOCAL-06 | `npm run electron`, presionar F12 dos veces | Alterna DevTools de LevelForge |
| F12-LOCAL-07 | Ctrl/Cmd+R en editor compilado | No fuerza una recarga por nuestro controlador |
| F12-LOCAL-08 | Compilar y abrir AppImage de LevelForge | F12 alterna DevTools |
| F12-LOCAL-09 | Exportar un juego AppImage y presionar F12 | No aparecen DevTools |
| F12-LOCAL-10 | Ctrl+Shift+I en juego exportado | No aparecen DevTools |
| F12-LOCAL-11 | Lanzar juego con `GAME_DEVTOOLS=1` | DevTools siguen inhabilitadas |
| F12-LOCAL-12 | F11 dentro del juego | Alterna pantalla completa correctamente |
| F12-LOCAL-13 | F5 dentro del editor | Se mantiene la prueba del juego |
| F12-LOCAL-14 | Abrir ventana Atajos | Documenta F12 solo para el editor |
| F12-LOCAL-15 | Nether Film Maker compilado | No tiene nuevo atajo F12 |
| F12-LOCAL-16 | Probar inputs personalizados del juego | No se modifican por la política DevTools del Player |

### Reproducción

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-db-contract.mjs
npm run build
npm run electron
```

El empaquetado AppImage y la ejecución de juegos exportados requieren QA en el equipo del usuario. El Gate anterior `LF-EVENT-MATCH-G001` no se considera aprobado automáticamente por esta entrega.

## Restricciones

- No modificar Match, reglas, Canvas, Database, Three.js ni Jolt.
- No registrar atajos globales del sistema operativo.
- No duplicar gestores de teclado ni alterar InputMap del jugador.
- Source Baseline completo y Change ZIP deben compararse directamente con el baseline MATCH sin eliminar archivos.
