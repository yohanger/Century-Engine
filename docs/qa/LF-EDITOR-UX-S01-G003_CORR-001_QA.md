# LF-EDITOR-UX-S01-G003_CORR-001 — Escena/Entorno: una autoridad celestial

**Autorización exacta:** `Listo. LF-EDITOR-UX-S01-G003_CORR-001 autoriza comenzar` (2026-10-25).  
**Fuente de entrada:** `LevelForge_EDITOR_UX_S01_G003_SOURCE_BASELINE.zip`, Three.js **0.186.1** (736 archivos).  
**Referencia funcional:** paquete FrostEngine previamente inspeccionado en G003; reutilización de la infraestructura propia, **no se copian fuentes de Unity al motor**.  
**Resultado:** código implementado, regresión Node **931 PASS, 0 FAIL, 18 SKIP**; Electron, WebGL, Editor compilado, Player exportado y GPU no verificados en este entorno. La prueba de r186.1 en el equipo del usuario antecede al presente Gate y no certifica estos cambios.

## Problemas y solución

- **Autoridades múltiples:** `sunLink`, `time.on`, `time.celestialLights`, `time.astro` y `World.frame` se combinaban de forma poco legible. **Se introducen dos modos nuevos** (`environment.lightingMode`): `manual` y `cycle`; el valor ausente se interpreta como `legacy` **sin modificar datos anteriores**. Las escenas nuevas usan `manual`.
- **Manual:** dirección/color/energía vienen de la DirectionalLight elegida; meteorología puede producir nubes, lluvia y niebla, pero no reorienta ni modifica esa fuente de luz; el reloj no controla el cielo. Skybox y niebla física consumen el mismo vector de luz manual. La paleta, exposición y ambiente de la escena se preservan aunque haya clima activo.
- **Ciclo:** se derivan `time.on=true` y `time.celestialLights=true` en `normalizeWorld` y `World.frame`, sin obligar al usuario a coordinar dos interruptores. Una DirectionalLight solar más una luna direccional interna separada; sin sombras de luna ni nodo adicional. Fecha, lugar, astronomía, energía nocturna y animación del reloj conservan sus modelos ya existentes.
- **Sol principal:** `environment.sunLightId` permite elegir una DirectionalLight específica. Si se oculta o se elimina, se utiliza la primera visible, si existe. Se respeta el mundo de los grupos al resolver el vector en modo manual.
- **Legacy:** `lightingMode` ausente conserva la ruta anterior `keyDir/keyMul`, `sunLink`, `time.on` y el opt-in `celestialLights`; el panel permite ver esos ajustes bajo «Controles heredados». Al adoptar Manual o Ciclo, el usuario lo hace expresamente y puede revertir mediante Undo.
- **ScenePanel:** iluminación, clima y cielo con controles básicos; los parámetros astronómicos, físicos y la simulación permanecen en secciones plegables. Snap, horneado, niebla y agua se conservan en apartados avanzados; no se rediseñan en este Gate.
- **Restablecer:** acciones para Iluminación celestial, Cielo, Clima/atmósfera y «Restablecer todo», cada una con confirmación, una entrada de Undo/Redo y sincronización inmediata. No elimina objetos, terreno, archivos ni recursos de horneado; preserva `environment.bake`.
- **Lensflare:** permite Point, Spot, Directional y RectAreaLight, desactivado por defecto. El direccional se reposiciona desde la cámara a lo largo de su dirección mundial en cada frame, dentro de `camera.far`; el área utiliza el centro del emisor. Sigue el ciclo de vida oficial de Lensflare y la normalización previa de tamaño/intensidad.

## Fuentes de verdad y restricciones

| Propiedad | Manual | Ciclo | Legacy (sin campo nuevo) |
|---|---|---|---|
| Orientación solar | Direccional elegida, rotación mundial | `World.frame().sunDir` | Ruta anterior según reloj/skybox |
| Intensidad/color solar | Inspector de luz | World × energía base Inspector | `keyMul/keyColor` cuando corresponde |
| Luna | No se crea | Luz interna con `moonDir/moonMul` | Según `time.celestialLights` anterior |
| Clima | Nubes/niebla/precipitación, sin autoridad sobre luz manual | Atenúa iluminación por nubes | Compatibilidad anterior |
| Skybox y niebla física | Dirección de la misma luz manual | Vector solar de `World.frame` | Comportamiento anterior |
| Destellos | Ópticos, opt-in, no emiten luz | Ópticos, opt-in | Point/Spot anteriores se conservan |

**No se modifica** Three.js ni su pipeline, WATER, Jolt, geometría de luces, HDRI, fórmula de astronomía, shader PBR, SSR, Outline, LOD, el formato del Player ni `TransformControls`.

## Pruebas automatizadas

- `node --test scripts/test-editor-ux-s01-g003-corr-001.mjs`: **16 PASS**. Cobertura de modo, compatibilidad, selección de luz, cálculo real `World`, clima manual, actualización de estado del mixin de escena, cielo manual real y Lensflare.
- `scripts/test-three-s04.mjs`: dos expectativas antiguas (restricción Point/Spot) actualizadas a la ampliación autorizada a 4 tipos. La suite conserva las demás regresiones originales.
- `scripts/test-editor-ux-s01-g003.mjs`: actualizado el `new Function` de su harness para inyectar `lightingMode` y `selectedSun`, sin modificar los contratos anteriores de prueba.
- Regresión acumulada de los scripts Node (sin `test-starcat.mjs`, que requiere dependencia Three instalada): **931 PASS / 0 FAIL / 18 SKIP**.
- `node --check` de fuentes JS modificadas: PASS.
- `npm run build` en este entorno: **NO VERIFICADO** (`vite: not found`, dependencias npm ausentes). No equivale a error de compilación del proyecto. Se requiere validar Editor/Player sobre Linux con `npm ci`.

## QA manual en Linux — criterios de aceptación

1. Escena nueva: solo **Manual** o **Ciclo día/noche**, sin segundo checkbox de sol/luna. Crear una DirectionalLight y asignarla explícitamente.
2. Modo Manual: rotar/mover el nodo (también bajo un grupo rotado). La luz, el cielo físico y la niebla solar comparten orientación; cambiar hora o activar el clima no reorienta esa luz.
3. Modo Ciclo: fijar mediodía, anochecer, medianoche y amanecer; verificar direcciones, cambios graduales y sombra solar. Activar astronomía real para revisar sol/luna según fecha y ubicación. La luna no crea sombras.
4. Alternar Manual ↔ Ciclo sin pérdida de ajustes manuales. Desactivar el ciclo, volver a Manual y comprobar rotación/color/energía del Inspector.
5. Seleccionar otra DirectionalLight como sol. Ocultar/eliminar esa luz y comprobar fallback a otra visible. Selección desde Jerarquía y Play.
6. Escena heredada sin `lightingMode`: comprobar el comportamiento previo y la etiqueta **Heredado (compatibilidad)**; convertir a nuevo modo y usar Undo.
7. Usar cada restablecimiento individual y general; confirmar que no elimina nodos, modelos, datos de terreno ni lightmaps, y que un único Ctrl+Z lo deshace.
8. Activar Lensflare por separado para PointLight, SpotLight, DirectionalLight y RectAreaLight. Comprobar oclusión, dirección y centro; caminar con la cámara y probar distancias lejanas/cercanas.
9. Comprobar con **Clásico, Medio/Alto**, SSR, Outline, MSAA y Lensflare sin pantalla negra ni errores `GL_INVALID_OPERATION` / framebuffer multisample. Si aparece error, no aceptar el Gate.
10. Repetir en Play Mode, cambio de escena, salida a Edit Mode y Player exportado; comprobar que no quedan luces lunares ni destellos fantasma tras eliminar los nodos.
11. Comparar rendimiento (frame time P95 y draw calls) con modo viejo y nuevo; no atribuir una mejora de FPS sin medición.

**Instalación local (tras comparar archivos):**

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
unzip -o "$HOME/Downloads/LF-EDITOR-UX-S01-G003_CORR-001_CHANGE.zip" -d .
node --test scripts/test-editor-ux-s01-g003-corr-001.mjs
npm run build
npm run electron:dev
```

**Estado de cierre:** implementado y empaquetado; **aprobación visual / GPU / build real pendientes del usuario**. G004 no comienza automáticamente.
