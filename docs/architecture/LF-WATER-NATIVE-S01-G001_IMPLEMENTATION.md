# LF-WATER-NATIVE-S01-G001 — Arquitectura implementada (pendiente de QA visual)

**Gate:** `LF-WATER-NATIVE-S01-G001-INTEGRAL-LAKE-RIVER-SIMULATION-AND-NODE-INTERACTION`
**Autoridad:** `LF-WATER-NATIVE-REPLACEMENT-CA-005` ratificado.
**Madurez:** Editor/Player preestable; no presumir formato estable, migraciones ni retrocompatibilidad obligatoria.

## Flujo y autoridad

```
Nodos de agua existentes (props/transform/visible/active)
    └─ collectWaterBodies → WaterWorld.fromObjects
        └─ nativeWaterConfiguration (sin activar una casilla)
            ├─ Lago/rect: rasterización de huella, suelo y nivel de reposo
            ├─ Río: huella de cauce, pendientes y corriente de autoría
            └─ región manual: asociación única sin perder volumen autoral
                └─ TerrainWaterConnection → WaterRegion (solver 2.5D)
                    ├─ water.at / game.water → inmersión, flujo y nivel físico
                    ├─ Jolt RigidBody → flotación/desplazamiento
                    ├─ Jolt CharacterBody → corriente/resistencia (paso existente)
                    ├─ clima + eventos → aportes de lluvia e impulsos
                    └─ WaterSurfaceView + material PBR único → altura, caudal, espuma
```

**No existe otro inventario:** la visualización lee directamente `region.bed`, `region.depth`, `region.qx/qz` y espuma derivada de su velocidad/pendiente. No se inserta otro renderer. `Ocean` y `circle` conservan temporalmente sus superficies anteriores, expresamente fuera del Gate.

## Semántica de montaje

1. La selección de regiones Lago/Río no depende de `environment.waterSimulation.enabled`; un nodo visible/activo genera una región física al crear el mundo.
2. Las regiones configuradas por el autor conservan geometría, profundidad y estado de inventario. Si una región solapa un solo Lago/Río se asocia a su identidad visual. Si hay varios candidatos, se rechaza por ambigüedad: **no se fusionan volúmenes ni se silencian solapamientos**.
3. Los dominios sintéticos usan IDs `native-water:<nodeId>`, disponibles en memoria. No reescriben `project.objects`.
4. La cuota compartida es 4096 celdas/escena y 32 regiones; se ajusta la resolución espacial, no se descarta silenciosamente un nodo. Si hay regiones solapadas incompatibles, la operación se bloquea con error explicativo.
5. La profundidad inicial proviene del espacio real entre terreno y nivel de reposo, con cota máxima física predeterminada (1.2 m si no hay propiedad explícita), sin agregar agua artificial mínima en la orilla. En ausencia de relieve se usa un fondo volumétrico provisional acotado.
6. `WaterWorld.restAt()` elimina el componente visual de olas para determinar la masa inicial. Las ondas posteriores provienen del solver mediante `disturb()`, que aplica impulso de momento sin fabricar volumen.
7. En Editor se monta una vista previa sin avanzar el solver; Play/Player crean su propio WaterWorld, usan la física y restauran la autoría al volver a Edit.

## Interacciones y límites conocidos

- **Jolt RigidBody:** conserva `ApplyBuoyancyImpulse`, lee `WaterWorld.at`; ocupación/desplazamiento se habilita en dominios simulados; nuevas entradas al agua generan perturbaciones físicas.
- **Jolt CharacterBody3D:** el paso existente usa agua para reducir velocidad horizontal un 20 % máximo y añadir 50 % de corriente según inmersión. No modifica InputMap, script ni la autoridad de locomoción. Se generan salpicaduras por contacto y desplazamiento.
- **Terrain:** altura/máscara y raycasts de cara se calculan al montar o actualizar relieve, no por gota. El agua no cruza celdas inválidas ni caras bloqueadas.
- **Clima:** lluvia añade volumen mediante `changeVolume` y mantiene el ledger de masa.
- **FX/eventos:** lluvia, `game.water.splash` y `game.water.ripple` alteran momento real en regiones físicas y mantienen efectos de partículas existentes.
- **Limitación de dominio:** no hay líquidos volumétricos 3D generales, colisiones SPH con mallas arbitrarias ni acoplamiento hidráulico automático entre dos nodos de agua superpuestos. El solver de Lago/Río es aguas someras 2.5D. Un cauce de longitud extrema requiere validar tiempos en el N5030.
- **Render:** efectos ópticos de Water Lab (reflexión/refracción de mayor fidelidad) no se consideran completamente trasladados: aquí se reutiliza PBR con normales de la geometría simulada y espuma vinculada al estado del solver.

## Continuidad y exclusiones

- No se incorporó SPlisHSPlasH, nuevo backend WebGL ni librería de física.
- No se cambió Electron ni el tooling; no se reconstruyeron ni eliminaron los proyectos actuales.
- El retiro general de las superficies heredadas se pospone hasta acreditar las demás clases de agua y pruebas visuales.
- Un solapamiento con Océano/círculo legado puede seguir siendo incompatible; esta corrección no encubre el conflicto.
