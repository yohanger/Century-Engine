# LF-SCENE-INSPECTOR-OWNERSHIP-S02-G001 — Implementación

**Estado:** IMPLEMENTADO, NODE PASS, BUILD/ELECTRON/QA LOCAL NO VERIFICADOS, NO CERRADO.

## Baseline vinculante

`LevelForge_INSPECTOR_PRIMITIVES_UX_S01_G001_SOURCE_BASELINE.zip`.

## Auditoría de autoridad (código real)

| Autoría y persistencia | Fuente | Lectura / aplicación | Decisión S02 |
|---|---|---|---|
| GameManager de escena | `activeScene().gameManagerId` | `assignSceneGameManager()` | Agrupar en Escena; conservar referencia y UI. |
| Transiciones | `activeScene().transitions` | `normalizeSceneTransitions` | Agrupar en Escena; conservar valores e historial. |
| Ajustes de nivel | `project.environment.level` | `LEVEL_PARAMS` / World | Agrupar en Mundo, no cambiar ruta de persistencia. |
| Iluminación | `project.environment.lightingMode`, `time`, `sunLightId` | `lightingMode`, World, `selectedSun` | Señalizar Manual/Ciclo/Heredado; conservar selección. |
| Control meteorológico | `project.environment.weather.on` | World; pueden existir forzados desde scripts | Mostrar «configurado», **no** asegurar estado runtime real. |
| Nubes manuales | `project.environment.clouds*` | `normalizeSky`, `_effectiveEnv` | Conservar campos, señalar cuándo World puede sustituir cobertura/volumen. No bloquear `cloudsScale` ni viento. |
| Nubes de clima | `World.frame().clouds` | `_effectiveEnv` y shader de nubes único | Solo lectura informativa en Inspector; sin segunda configuración. |
| Niebla manual | `project.environment.fog*` | `normalizeFog`, World, `_effectiveEnv` | Conservar controles; World puede sobreescribir intensidad/activación/color efectivo. |
| Bake | `project.bake` + `environment.bake` | Bake y lightmaps | Agrupar en Recursos, preservar distinción config/resultado. |

**Importante:** `store.project.environment` es el entorno **de la escena activa** durante la edición, no una configuración universal de todas las escenas. `World` también puede activarse por scripts o quedar suspendido durante bake. Los indicadores muestran la configuración declarada y no se presentan como telemetría runtime.

## Cambios implementados

1. `ScenePanel.vue` se organiza en tres bloques delimitados: **Escena**, **Mundo y atmósfera** y **Recursos de iluminación**.
2. GameManager y Transiciones pertenecen visualmente al bloque Escena; Nivel/Iluminación/Clima/Cielo/Nubes/Niebla/Agua están bajo Mundo.
3. Bake aparece únicamente en Recursos de iluminación. No se duplica el formulario.
4. Los avisos de autoridad de clima, cielo, nubes y niebla derivan de `environment.weather.on`, `lightingMode()` y `environment.time.on`, sin estado paralelo ni propiedades guardadas.
5. Estilos locales de sección utilizan tokens existentes (`--g-800`, `--hair`, etc.) con anchos adaptables. No se modifica el tema global.
6. No se ha tocado `World`, shader, física, persistencia, exportación, scripts, Player ni estructuras de entorno.

## Límite explícito: reset heredado

`resetSection('weather')` **también incluye** campos de nube manual y niebla. Aunque el encabezado se ha clarificado como «Restablecer clima y atmósfera», **no se ha modificado la operación**: separar ese reset implicaría cambio contractual y requiere revisión/Amendment si contradice otros Gates. `resetSection('all')` conserva `environment.bake`.

## Dependencias futuras

- QA local del panel en Electron + Play/Player.
- S03 Groups API, separado del modelo meteorológico.
- Inspector Terrain y tema global en sus propios Gates.
- Investigación contractual independiente sobre granularidad de Restablecer.

No se ha eliminado ninguna propiedad porque los controles de nubes y clima no son equivalentes semánticamente.
