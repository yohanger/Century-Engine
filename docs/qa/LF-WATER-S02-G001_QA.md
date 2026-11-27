# LF-WATER-S02-G001 — Terrain, clima y acumulación de agua física

**Gate:** `LF-WATER-S02-G001`. **Autorizado por el usuario:** 2026-10-25.
**Base:** `LevelForge_WATER_S01_G001_SOURCE_BASELINE.zip` (694 entradas, verificación CRC correcta).
**Estado:** IMPLEMENTADO EN FUENTE; pruebas Node PASS; build Editor/Player y QA real PENDIENTES.

## 1. Alcance real W10–W18

- `water-terrain.js` conecta `WaterWorld` con `groundAtAll()` del terreno. No se usa `heightAtAll()` porque extrapola alturas fuera de piezas. Una celda sin altura real es inválida y no almacena agua.
- Configuración **optativa por escena** en `environment.waterSimulation`. Sin ella no hay regiones físicas y lagos/ríos anteriores mantienen su comportamiento.
- Las piezas adyacentes alimentan una misma rejilla: los huecos reales son paredes impermeables. No hay flujo entre regiones simuladas separadas en este Sprint.
- Los raycasts sólidos existentes (Jolt con backfaces o respaldo Three.js) detectan barreras estáticas entre celdas y cubiertas sobre las que no cae lluvia directamente. El resultado se precalcula al montar la escena y al cambiar el relieve; **no** se lanza un raycast por celda en cada paso.
- `water-solver.js` conserva la formulación HLL/hidrostática de S01 y admite **caras bloqueadas**. Las paredes reciben presión sin intercambiar masa.
- `World.precipitationAt(x,z,y)` entrega mm/h equivalentes de lluvia + nieve. Se aplica al agua únicamente la parte líquida deducida de `world.cur.rain`/`world.cur.snow`, con la misma función de precipitación de `atmosphere.js`. Si clima está apagado o solo nieva, la aportación líquida es cero.
- Conversión de lluvia: `volumen_m3 = precipitación_mm_h * dt_segundos * área_m2 / 3_600_000`. El aporte queda en la cola del solver y se aplica al principio del siguiente `WaterWorld.step(fdt)`.
- Se compara una firma de ID/versión, posición y visibilidad de las piezas de Terrain en cada paso; solo cuando cambia se remuestrean fondo, techos y barreras. Si una celda desaparece, se transfiere su profundidad al suelo válido más cercano; si no queda suelo en la región, el volumen se contabiliza como salida `ledger.exited`. Es un tratamiento conservativo preliminar de desplazamiento por edición, **no** una simulación de desplazamiento del agua por mallas dinámicas.
- Durante Play, `_simStep` invoca la conexión antes de `game.fixedUpdate` y el avance del jugador/Jolt. Sin partida activa no se da ese paso. Las colas generadas en `fixedUpdate` se aplicarán en el siguiente paso.
- `WaterWorld.changeVolume()` y la ruta de cuerpos heredados se mantienen. No hay nueva autoridad, segundo motor de agua ni integración de código FLOW/Unity.

## 2. Activación de desarrollo (sin controles de editor en S02)

Una escena ya persistida puede contener una configuración `waterSimulation` bajo su objeto `environment`:

```json
{
  "waterSimulation": {
    "enabled": true,
    "regions": [
      { "id": "zona-lluvia", "x": -8, "z": -8, "width": 16, "height": 16, "cellSize": 1, "initialDepth": 0 }
    ]
  }
}
```

El fragmento anterior representa **solo la propiedad nueva dentro de `environment`**, no un archivo de escena completo. Se guarda/reabre junto con `project.environment` sin modificar el formato antiguo; no es necesario añadir controles de edición falsamente completos. Las regiones se crean al montar la escena en Play y no se dibujan todavía: su representación e integración de UI pertenecen a S03. La activación requiere configuración explícita del proyecto, no se incorpora automáticamente a escenas antiguas.

**Contrato:** máximo preliminar 4096 celdas activas por escena; la rejilla y los límites del solver S01 siguen vigentes. La configuración puede declarar varias regiones no superpuestas. Los cuerpos de agua heredados conservan su comportamiento salvo que una región nueva, activada expresamente, cubra la misma superficie.

## 3. Pruebas ejecutadas

| Validación | Estado |
|---|---|
| `node --test scripts/test-water-s02.mjs` | **20 PASS / 0 FAIL / 0 SKIP** |
| `node --test scripts/test-water-s01.mjs` | **18 PASS / 0 FAIL / 0 SKIP** |
| Regresión completa (WATER, AUDIO, RENDER, DB, THREE) | **485 PASS / 0 FAIL / 9 SKIP** |
| `node --check` (JS de producción modificado) | **PASS** |
| `npm run build` (Editor + Player) | **NO VERIFICADO**, sin Vite instalado en entorno de elaboración |
| Pruebas con Jolt y Three.js instalados en escena real | **PENDIENTE** |
| QA visual/auditivo y ejecución del exportado | **PENDIENTE** |

Los nueve SKIP requieren paquetes Three.js ausentes en este entorno; no cuentan como PASS. Los tests de S02 prueban la lógica original del solver y del puente de conexión con un sustituto de la consulta `groundAtAll()` para no importar Three.js en Node; la integración real de raycasts WebGL/Jolt queda pendiente de QA de usuario. La comprobación del orden del bucle físico también inspecciona el código: no sustituye una prueba de integración Electron.

**Límites vigentes:** cambios de obstáculos móviles en tiempo de juego no se siguen automáticamente. No se trata drenaje por tejados, erosión, reflujo entre regiones distintas, guardado/restauración del agua dinámica, avance al hacer seek de Film Maker ni un solver volumétrico 3D. La entrada de lluvia para clima que cambia dentro del fotograma usa el último estado meteorológico disponible y su invarianza entre distintos FPS debe validarse más adelante. No se modificaron shaders, charcos visuales, natación ni configuración de cuerpos existentes.

## 4. QA local en Linux

Partir de una copia de seguridad de la instalación, comparar cambios locales y **aplicar únicamente CHANGE** en:
`$HOME/ENGINES/lf-0.26.13/lf`

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-water-s02.mjs
node --test scripts/test-water-s01.mjs
node --test scripts/test-render-pipe-s01.mjs scripts/test-audio-s01.mjs scripts/test-audio-s02.mjs scripts/test-audio-s02-corr001.mjs
node --test scripts/test-db-contract.mjs scripts/test-three-s01.mjs
npm run build
npm run electron
```

El build debe completar ambas etapas de Vite. En el editor comprobar que escenas antiguas con ríos, lagos y charcos PBR conservan apariencia y funcionamiento, que no hay errores de consola, y que el Player exportado arranca sin regresiones. Para probar realmente regiones S02 hay que disponer de una escena con `environment.waterSimulation` configurada y terreno válido; sin configuración, **no aparecerá ningún cambio visual**, por contrato. Verificar durante lluvia que el solver acumula volumen físico y que un techo o barrera impide el aporte/flujo en su zona. La QA final requiere evidencia del usuario.

## 5. Trazabilidad, entrega y cierre

Se actualizaron seis hojas de `docs/qa/LevelForge_DB_Ledger.xlsx`: `ROADMAP`, `BACKLOG`, `DEPENDENCIES`, `GATES`, `EVIDENCE` y `TRACEABILITY`, preservando los registros antiguos y la aprobación del usuario de Water S01. El detalle de las diferencias se entrega en el mensaje de cierre. Se entregan exactamente dos ZIP: `LF-WATER-S02-G001_CHANGE.zip` y `LevelForge_WATER_S02_G001_SOURCE_BASELINE.zip` (fuente íntegra acumulada, sin `node_modules` ni compilaciones). Sin SHA independiente ni scripts `.sh`.

**NO CERRADO:** falta `npm run build` en el equipo del usuario, pruebas reales Editor/Player y aceptación explícita de este Gate.
