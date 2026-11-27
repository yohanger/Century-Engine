# LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001 — Continuación de propietarios especializados

**Estado:** IMPLEMENTACIÓN PARCIAL. Gate integral original G001 abierto; no se declara cobertura universal, QA LOCAL PASS ni cierre.

**Base acumulativa:** SOURCE_BASELINE `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR002_FPS_ACTIVE_ALL_NODES_SOURCE_BASELINE.zip` (3.083 archivos). El usuario aprobó CORR-002 y pidió continuar dentro del Gate integral autorizado, sin iniciar G009–G014.

## Evidencia de integración por propietario

| Familia / propietario | Canales añadidos | Lectura / aplicación efectiva | Restauración | Advertencia |
|---|---:|---|---|---|
| Camera Shake `cameraShake` | 16 | `camera-shake.js` → overrides por nodo → `shakeRuntimeProps()` → reproductor de sacudida | Sí, por canal | El compositor S15 excluye la sacudida con `_cameraActive.kind` `film`, `timeline` o `pose`. No certificar el efecto visual bajo esos dueños. |
| PostProcessVolume `postvolume` | 8 | `postvolume.js` → overrides por nodo → `volumeRender()`; forma y color también actualizan el gizmo | Sí, por canal | Perfil referenciado: comprobar recurso válido y render real en Electron/Player. |
| Volumen atmosférico `atmovolume` | 2 | `atmovolume.js` actualiza `atmoExchange` y material; `atmovolumes.js` consume el valor efectivo | Sí | Confirmar niebla física en dispositivo real. |
| Trigger `trigger` | 8 | `trigger.js` → estado transitorio → `play-look.js` / `play-level.js`; callbacks y alcance usan la configuración efectiva | Sí | `Mirada` y callbacks deben probarse en PlayMode con jugador y señal real. |

**Total nuevo en esta continuación: 34 canales tipados**. Se registran en `registerNode(def.animation)` y en `PROPS` compartido; no se crea un catálogo paralelo ni se escriben los `props` autorales del proyecto. Inspector usa el `PropertyKey` existente y su único `inspectorInsertKey()`.

Se conservan los canales base de CORR-002 (`active`, transformaciones permitidas, Camera FOV y Luz). No se modifica el modelo de recursos, el reloj FPS, la semántica de pistas, Audio ni los mecanismos `method`/`commands`.

## Pruebas ejecutadas

- `node --test scripts/test-timeline-universal-animation-s13-g008-g001-specialized-owners.mjs` → **12 PASS, 0 FAIL**. Verifica catálogo, llaves, valores tipados persistidos, aplicadores, `volumeRender`, Camera Shake, Trigger y restauración.
- Regresión seleccionada en conjunto con CORR-002, CORR-001, G001, scripts, geometría y UX → **126 PASS, 0 FAIL**.
- Regresión histórica de Camera Shake, Post y Atmósfera → **124 PASS, 46 FAIL**, exactamente el mismo resultado ejecutando los archivos originales del baseline sin cambios. Los fallos preexistentes no son PASS ni constituyen evidencia de nueva regresión.
- `node --check` sobre módulos JS productivos modificados → **PASS**.
- **Compilación:** NO VERIFICADA (entorno sin `node_modules`/Vite). **Electron, PlayMode y Player visual:** NO VERIFICADOS. **QA LOCAL:** PENDIENTE.

## Bloqueos que siguen impidiendo el 100 %

El Inspector distribuye controles en el principal y componentes especializados. Los contenedores `class="field"` no equivalen a propiedades únicas. Aún faltan lectores, aplicadores y restauración certificados para campos de:

- Jolt (RigidBody3D, CharacterBody3D, Area3D), estados de líquido/fuego y otros componentes físicos.
- Canvas `.ui`, Sprite2D/3D, texto 3D, materiales, primitivas, mallas, modelos, decal y VFX.
- AudioSource, sistemas de agua/terreno/vegetación/carreteras, eventos y objetos interactuables.
- Navigation (requiere definir si los parámetros afectan una malla ya horneada o solo futuros horneados), Spawn y referencias que gobiernan procesos estructurales.
- Otras propiedades base de Inspector (`DontDestroyOnLoad`, Layer, Groups, scriptIds) cuya autoridad temporal no está resuelta. Crear prefab, hornear navegación y operaciones equivalentes son acciones, no valores interpolables.

**G007:** permanece pendiente la certificación de escritores directos sobre `object3D`. No se debe atribuir a Timeline la autoridad de otros propietarios para completar una tabla.

**NO CERRAR G001:** las cuatro familias cubiertas no demuestran todos los nodos ni todas las propiedades. No avanzar a G009–G014 ni marcar “universal PASS” por estas pruebas.

## QA local requerido

1. Integrar CHANGE tras comparar las modificaciones locales con el SOURCE_BASELINE CORR-002.
2. Ejecutar la nueva suite Node y las regresiones seleccionadas; recopilar la salida sin editar fixtures para ocultar fallos.
3. `npm run build` para Editor y Player; si falla, informar comando y traza.
4. `npm run electron`: añadir Camera Shake Base, PostProcessVolume, Volumen atmosférico y Trigger; insertar desde las llaves, reproducir, hacer seek, stop y comprobar restauración.
5. Probar Trigger en PlayMode con `onEnter`/`onExit`, `lookDistance`, señales y callbacks; PostProcess y niebla con perfiles/recursos reales. Verificar Animation Clip independiente, Preview y Player si existen los fixtures correspondientes.
6. Confirmar que los recursos anteriores, escenas y scripts mantienen sus datos y que las tomas explícitas conservan autoridad cinematográfica.

**Este informe es evidencia de un avance parcial, no aceptación de la animación universal.**
