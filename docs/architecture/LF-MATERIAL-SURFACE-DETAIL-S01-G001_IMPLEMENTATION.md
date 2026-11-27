# LF-MATERIAL-SURFACE-DETAIL-S01-G001 — Contrato e implementación

**2026-10-29 · Autorizado. Implementado; QA gráfico, compilación Editor/Player y aprobación local pendientes.**

## Auditoría y fuente de verdad

Baseline: `LevelForge_EDITOR_ADD_MENU_CORR_G001_SOURCE_BASELINE.zip`.

- `render/pbr.js` ya es el sincronizador PBR; `shaderlib.js` contiene el shader `builtin:realista` con normal maps triplanares y microdetalle procedural.
- `MaterialSection.vue` es el Inspector del material y del recurso `.material`; `RoadPanel.vue` utiliza `MaterialShader.vue` para slots locales.
- `material-resource.js` contiene los datos serializables del recurso y `road-material.js` resuelve material local/compartido.

## Contrato de datos

Campo opcional `mat.surfaceDetail`:

```json
{"mode":"normal","texture":"id-asset","strength":1,"micro":0.35,"microScale":0.12}
```

- `mode`: `none`, `normal`, `height`, `procedural`.
- `texture`: ID de la textura existente en Assets; normal y altura se leen en espacio lineal.
- `strength`: 0..4 (normal/bump).
- `micro`: 0..1, `microScale`: 0.01..2 m; solo disponibles en `builtin:realista`.
- Campo ausente: comportamiento heredado intacto, incluidos `mat.params.uNormal`, `uNormalStrength`, `uMicro`, `uMicroScale`.
- El Inspector aplica `mat.surfaceDetail` sin cambiar el esquema de proyecto ni sustituir `mat.params` heredados hasta que el usuario edite el detalle. Los parámetros existentes continúan almacenados.

## Rutas de render

- **Material clásico / Blockout:** `MeshPhysicalMaterial.normalMap` o `bumpMap`, en modo mutuamente excluyente, mapeo UV nativo de Three.js y factor `normalScale`/`bumpScale`. No existe microdetalle procedural para estos shaders.
- **Realista (PBR):** `uNormal` o `uHeight` triplanar, además de microdetalle independiente. `uHeight_set && !uNormal_set` es exclusivo; el bump obtiene las derivadas de altura para alterar la normal de iluminación, **no la geometría**.
- **Shaders propios / otros builtins:** no se muestran controles globales que no están soportados. Se conservan las propiedades declaradas por cada shader.
- Los recursos `.material` se normalizan con `normalizeMaterial`; primitivas, mallas y los cuatro slots de carretera reutilizan `syncPbrMaterial`.
- Se mantiene `effectiveMaterialObject` y el historial existente de edición, no se crea gestor de assets, renderer ni pipeline paralelo.

## Alcance y límites

No hay desplazamiento de vértices, parallax, teselación, Nanite, colisiones modificadas ni pintura de carretera. Normal y bump no se aplican como dos fuentes contradictorias. Un mapa triplanar y uno UV pueden diferir en apariencia según la geometría/mapeo. Los mapas nativos de Three.js requieren UV.

El editor de recursos compartidos `MaterialResourceEditor` reutiliza `MaterialSection`; el Inspector de carreteras reutiliza `MaterialSurfaceDetail` con el slot local. Los materiales compartidos en carretera se editan desde Assets.

## QA requerido en Linux y Windows

1. Abrir primitiva, malla y carretera; elegir material local y `.material` compartido; comprobar edición, persistencia, Undo/Redo y actualización del viewport.
2. Normal map sRGB desactivado y bump desde altura: alternar en material clásico, Blockout y Realista. Comprobar que el canal Bump no es textura de color.
3. Realista: aumentar/disminuir microdetalle sin textura y combinarlo con normal map. Verificar que la conmutación desactiva la fuente contraria.
4. Abrir material anterior sin `surfaceDetail`; comprobar que la apariencia y `mat.params` no cambian.
5. Guardar/reabrir `.lfproj`, exportar Player; revisar shader en WebGL y materiales sin textura.
6. `npm run build`; ejecutar Editor y Player. Estas comprobaciones **no han sido ejecutadas** en este entorno (dependencias Vite/Three.js ausentes).

**Estado: implementado, no cerrado.**
