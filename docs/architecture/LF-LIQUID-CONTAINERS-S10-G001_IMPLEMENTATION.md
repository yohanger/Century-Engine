# LF-LIQUID-CONTAINERS-S10-G001 — Implementación

**Base:** `LevelForge_LIQUID_WATERBODY_COUPLING_S09_G001_SOURCE_BASELINE.zip`.
**Amendment:** `LF-WATER-LIQUID-CA-003` aprobado dentro del Gate S10.
**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · BUILD/QA LOCAL NO VERIFICADOS · NO CERRADO.

## Integración real

- `geometry/liquid-containers.js`: perfil `normalizeLiquid`, dimensiones y capacidad (`containerSpec`), superficie libre y vertido (`freeSurface`, `containerOutflow`). Cuadratura determinista 8³, contenedor caja/cilindro, variables SI (metros, m³, kg/m³, segundos).
- `geometry/waterworld.js`: `containers` y balances por identidad, alta/pose/vertido/transferencia; destino región, otro recipiente abierto o salida contabilizada; snapshot v6 con rollback. No introduce otro solver.
- `geometry/water-solver.js`: cada región es homogénea, perfil explícito para sustancias distintas del agua; se aplica amortiguación dependiente de viscosidad al momento para perfiles alternativos; el solver de aguas someras heredado sigue siendo la fuente de profundidad/flujo.
- `geometry/water-terrain.js`: resolución del perfil de región mediante `liquidId`; la lluvia y la hidrología de Terrain se restringen a agua. No llueve café.
- `events/play-liquid.js` y `events/play*.js`: registra recipientes de `node3d` / `rigidbody3d` configurados y visibles, sincroniza pose con la jerarquía actual, actualiza una superficie libre y un chorro gráfico no físico; limpia recursos al salir. El inventario transitorio se guarda/restaura mediante los snapshots compartidos de Play.
- `core/project.js`, `core/lfproj.js`, `core/levelpackage*.js`, `core/state/{liquids,filesystem,project}.js`: recurso `.liquid` reconocido, validado, CRUD y paquete con dependencias. Perfil en archivo JSON; no es un binario IndexedDB. La autoría no se reescribe en cada frame.
- `ProjectPanel.vue`, `InspectorDock.vue`, `LiquidResourceEditor.vue`, `Inspector.vue`, `TerrainPanel.vue`: creación/importación y edición de perfiles, dimensiones y volumen inicial en nodos originales y selección de región física compatible.

## Modelo de vertido

1. Determina la altura libre horizontal del líquido en coordenadas mundiales del recipiente.
2. Detecta si supera el borde inferior bajo inclinación; un orificio macroscópico estima volumen por segundo, limitado por el volumen contenido.
3. La salida se dirige primero a un recipiente abierto y compatible situado bajo el borde, si lo hay; después a una celda de región física compatible; sin receptor, se contabiliza drenaje externo.
4. La transacción descuenta el origen y acredita el destino una sola vez. Una incompatibilidad de identidad/densidad impide transferir; no convierte café en agua.
5. El balance de sustancia (`liquidBalances`) incluye recipientes, regiones homogéneas, cola de transferencias y salidas explícitas. El método legacy `liquidBalance()` sigue destinado a escenarios antiguos de agua; **usar `liquidBalances()` en S10**.

## Limitaciones explícitas

- Interior paramétrico, no clipping exacto de líquido en una malla de taza arbitraria. El plano renderizado y el chorro son aproximaciones visuales, sin colisión.
- Recipientes sin escala mundial no uniforme; sus dimensiones interiores se especifican en metros por Inspector. La validación visual real queda pendiente.
- Receptor físico compatible significa región configurada sobre Terrain o recipiente abierto; no se prometen derrames sobre cualquier malla, ni mezcla de especies, ni rotura de recipientes.
- No se simula resistencia/masa de líquido aplicada a la dinámica Jolt del recipiente; Jolt determina la pose y la cinemática del objeto.
- Los puertos regionales heredados S05/S09 no se reconfiguran para transportar café sin contrato adicional. No se ha realizado prueba real de escena Electron, Player ni compilación Vite en el entorno de implementación.

## Continuidad

S09 APROBADO por usuario, con pruebas omitidas y QA local pendientes. S10 implementado; cierre sujeto a evidencia local y aprobación. S11–S13 PENDIENTE PLANIFICADO.
