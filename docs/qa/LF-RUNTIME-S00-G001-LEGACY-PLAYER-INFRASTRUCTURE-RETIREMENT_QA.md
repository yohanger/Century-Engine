# LF-RUNTIME-S00-G001 — QA y evidencia de retirada de infraestructura heredada

**Fecha:** 2026-11-15  
**SOURCE_BASELINE de entrada:** `source_baseline.zip` suministrado por el usuario, LevelForge `0.26.13`.  
**Autorización literal:** `Listo. LF-RUNTIME-S00-G001-LEGACY-PLAYER-INFRASTRUCTURE-RETIREMENT autoriza comenzar`  
**Estado:** IMPLEMENTADO; TEST PASS en batería dirigida; COMPILADO **NO VERIFICADO**; QA LOCAL Electron y AppImage **NO VERIFICADO**; APROBACIÓN y CIERRE **PENDIENTES**.

## Alcance realizado

- Renombrada y reubicada la implementación autónoma *existente* en `src/player:deprecated/` a `src/runtime-app/`; se conserva `openGame`, el overlay inicial, el puente de almacenamiento y el panel de diagnóstico. No se ha recreado el motor ni la aplicación.
- Reubicado `electron/player/{main,preload,saves}.cjs` a `electron/runtime/`; puente expuesto ahora como `window.lfRuntime`, con canales `lf-runtime:*` uniformes. Se preservan restricciones de red/navegación, aislamiento, permiso de pointer lock, guardados atómicos y mecanismo de diagnóstico.
- `player.html` → `runtime.html`; `--mode player` → `--mode runtime`; salida `dist-player` → `dist-runtime`, con CSP de Runtime. `electron/appimage.cjs` carga los **tres** archivos desde `electron/runtime/`.
- Ajustados el empaquetado de editor (`package.json`), exportación AppImage, verificadores, tests dependientes y comentarios activos. Se retira `dist-player/` como artefacto **derivado** de la compilación anterior.
- Conservados `src/engine/runtime/player/`, `game.player`, `PlayerController`, `CharacterBody3D` y contratos de gameplay que tienen identidad distinta del ejecutable heredado. Históricos `docs/qa/`, registros y contratos no se reescriben ni se destruyen. El README contiene una advertencia de vigencia.

## Comprobaciones ejecutadas

| Prueba | Resultado | Alcance de la evidencia |
|---|---|---|
| `node --test scripts/test-runtime-infrastructure-retirement-s00-g001.mjs scripts/test-performance-s17-g003-diagnostics.mjs scripts/test-scene-fade-transitions-s01-g001.mjs scripts/test-fps-native-player-s16-g008-integral-legacy-removal.mjs scripts/test-performance-s17-g003-ao-g002-optimization.mjs scripts/test-performance-s17-g003-ao-g003-composite-scene-diagnosis.mjs` | **85/85 PASS, 0 FAIL** | Contratos, rutas, mock AppImage, restricciones y regresiones de gameplay/diagnóstico |
| `node --test --test-name-pattern='F12-0[7-9]\|F12-10\|F12-12' scripts/test-editor-f12.mjs` | **5/5 PASS**, pruebas restantes filtradas | Comportamiento del shell de juego en fixture Electron, no Electron real |
| `node --check` en JS/CJS de arranque y exportación | **PASS** | Sintaxis JavaScript, no enlace/resolución Vite |
| `npm ci --offline --ignore-scripts --no-audit --no-fund` | **BLOQUEADO** (`ENOTCACHED`: `zip-stream-4.1.1`) | No se instalaron dependencias para compilar; no implica error de código |
| `node scripts/verify-editor-distribution.mjs source` | **FAIL** | El ZIP original no contiene `build/icon.png`, `build/icon.ico` ni `build/icons/*.png`; no atribuir a este Gate |
| `node scripts/check-layers.mjs --check` | **FAIL** | 37 hallazgos; el mismo validador ya fallaba con 35 problemas sobre el ZIP original; `runtimeLines` histórico 28.715 no concuerda con 46.817 alcanzables actuales; subsistema `box-fit-editor.js` alcanzable requiere investigación independiente |

### Límites y riesgos

1. **No hay build ni AppImage real.** El entorno de QA no dispone de dependencias instaladas, la caché npm no contiene un paquete requerido y faltan recursos de icono en el SOURCE_BASELINE proporcionado. La prueba de AppImage usa un sustituto de SquashFS, **no** genera ejecutable binario.
2. El cambio de nombre de `window.rtPlayer` a `window.lfRuntime` es interno al adaptador de juego exportado. No se prometen migraciones de artefactos compilados anteriores, de acuerdo con el alcance preestable; el formato de datos de juego `game.rtpkg` y los guardados se conservan.
3. Las relaciones y presupuestos de `scripts/check-layers.mjs` estaban degradados antes del Gate; no se ha actualizado artificialmente la lista base para simular un PASS. Esta situación debe tener diagnóstico y decisión propios.
4. La comprobación de integridad incluye fuentes y tests. QA de Electron real, compilación y exportación con paquete de ejemplo quedan **PENDIENTES** del entorno local.

## Resultado de ingeniería

La infraestructura autónoma pasa a denominarse **Runtime exportable** y utiliza los fuentes reales existentes del motor. No hay rutas activas de compilación/exportación apuntando al shell `Player` descontinuado. **No declarar APROBADO/CERRADO antes de validación por el usuario**.

## Evidencias

`docs/qa/evidence/LF-RUNTIME-S00-G001/` contiene logs de la batería Node, los controles de distribución y arquitectura, la comparación con el baseline original y la instalación offline bloqueada.
