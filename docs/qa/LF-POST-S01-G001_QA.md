# LF-POST-S01-G001 — Evolución de recursos Post Processing

**Autorización:** `Listo. LF-POST-S01-G001 autoriza comenzar` (2026-10-26).
**Baseline de entrada:** `LevelForge_RUNTIME_PERSIST_G001_SOURCE_BASELINE.zip` (778 entradas).
**Estado:** implementado; QA visual en Electron y Player exportado pendiente.

## Objetivo

Hacer que los perfiles de postprocesado sean recursos reutilizables `.post` en Assets, conservando íntegros los recursos antiguos `.profile`, mejorando su editor visual y definiendo una prioridad coherente entre Render, GameManager, Spawn, cámara y los eventos/scripts.

## Implementación y contrato

1. **Un solo sistema:** el registro `project.profiles`, la definición de efectos `render/profiles.js`, el `Look` y su `EffectComposer` existente siguen siendo las únicas fuentes de verdad. No se añade un compositor, renderer ni gestor paralelo.
2. **Formato:** los perfiles nuevos se crean como `Assets/Profiles/*.post`. El nombre y la extensión de cualquier recurso `.profile` guardado anteriormente permanecen inalterados. `normalizeProfiles()` acepta ambos tipos; `findProfile()` reconoce ID, nombre completo y nombre sin extensión. Si coexisten `Ejemplo.post` y `Ejemplo.profile`, la búsqueda por nombre completo evita la ambigüedad. El lookup por nombre sin extensión utiliza el primero de la lista.
3. **Assets:** crear, buscar, renombrar, mover, duplicar, eliminar e importar `.post` o `.profile` emplea el tipo existente `profile`; la importación directa de un JSON válido crea un nuevo ID y normaliza los efectos. `.lfproj` y `.levelpackage` reutilizan los serializadores existentes de recursos `profile` y remapeo de referencias. El formato del juego exportado ya incluye `project.profiles`; no se cambia.
4. **Editor de perfiles:** interfaz de efectos con búsqueda y controles por efecto, lista de activados, referencia del recurso y botón Antes/Después que muestra el resultado directamente en el visor actual con `editor.previewProfile()`. No genera otra cámara ni un segundo WebGLRenderer. Al cerrar restituye Render del proyecto. La vista previa se limita al visor del Editor, no es una captura renderizada ni una promesa de captura en tiempo real fuera de la aplicación.
5. **Asignación:** GameManager permite crear/editar un `.post`; Spawn y Cámara ofrecen selección, creación y edición en `ProfileSlot`. Los perfiles se guardan por ID; renombrar el archivo no deshace referencias.
6. **Prioridad en Play Mode y Player:** Render del proyecto → GameManager → Spawn → cámara activa (cámara principal asignada o Timeline) → override explícito por `game.profile.set()` o comando de evento. `game.profile.clear(seconds)` retira el override y restaura el valor efectivo siguiente, con interpolación. Un cambio de cámara no elimina un override temporal activo. Al cambiar de escena se limpian los overrides temporales de la escena anterior. Cambiar `game.graphics` preserva la prioridad.
7. **Compatibilidad:** proyectos antiguos y elementos `.profile` conservan sus rutas; no se realiza migración destructiva ni se reescriben los nombres. Empty sigue funcionando sin GameManager, Spawn ni cámara.

## Pruebas ejecutadas

- `node --test scripts/test-post-s01-g001.mjs`: **46 PASS / 0 FAIL / 0 SKIP**.
- Regresión acumulada, excluyendo los scripts de catálogo estelar y candidatos de Three.js previamente exceptuados: **1206 PASS / 0 FAIL / 18 SKIP**.
- `node --check` de los scripts modificados: **PASS**.
- `npm run build`: **no verificado**. `vite: not found`, sin `node_modules` en el contenedor.
- Electron, calidad de imagen GPU y Player exportado: **NO VERIFICADOS**.

## QA manual en Linux

- [ ] Crear `Assets/Profiles/Noche.post`; asignarlo a GameManager, Spawn y una Cámara.
- [ ] Abrir el editor; activar Bloom y color; comprobar que cambios afectan al visor sin modificar permanentemente Render.
- [ ] Conmutar Antes/Después repetidamente, cambiar un parámetro estando en Antes y volver a Después.
- [ ] Abrir un `.profile` antiguo, editarlo y guardar/reabrir; comprobar nombre y extensión intactos.
- [ ] Crear dos perfiles con el mismo stem y extensiones distintas; verificar lookup por nombre completo.
- [ ] Duplicar, renombrar, mover y eliminar un recurso; comprobar que las referencias permanecen coherentes o se limpian.
- [ ] Importar `.post` desde disco y mediante `.lfproj` y `.levelpackage` con sus referencias.
- [ ] Probar prioridad Render < GameManager < Spawn < Cámara < script/evento y `clear()` con transición.
- [ ] Cambiar cámara y escena con override temporal activo, comprobar restauración y ausencia de parpadeos.
- [ ] Confirmar Forward+, Mobile y Compatibility con compositor activo y desactivado en hardware real.
- [ ] Comprobar compilación `npm run build` y render en Editor y Player exportado.

## Fuera de alcance

No se implementa `PostProcessVolume`, trigger espacial, interpolación basada en distancia, efectos GLSL personalizados ni nuevos nodos de Shader Graph. Esos cambios se reservan para `LF-POST-S01-G002` y `LF-SHADER-GRAPH-S02-G001`. No se añade dependencia de terceros.
