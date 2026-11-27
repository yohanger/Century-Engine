# QA — Universal Animation S13-G008-G001 INTEGRAL

**Fecha:** 2026-11-10. **Estado:** AUTOMATIZACIÓN PARCIAL PASS; BUILD/ELECTRON/PLAYER/QA USUARIO NO VERIFICADOS; GATE NO CERRADO.

## Evidencia automatizada reproducible

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-integral.mjs
node --test scripts/test-timeline-node-method-track-s04-g003.mjs
node --test scripts/test-timeline-property-animation-s13-g008-g008-ux-corr004.mjs
```

- Suite nueva: **17/17 PASS**, no sustituye QA visual ni prueba real de emisores Three/Jolt.
- Scripts/eventos de nodo con fixture actualizado: **19/19 PASS** (incluye paso de argumentos, seek, loop, error, método no disponible y script inactivo).
- UX CORR-004 inicial: **24/24 PASS**.
- Combinación con otras suites (`universal`, `node-method`, `UX CORR-004`, `CORR-003`, `node-hierarchy CORR-002`, `camera-binding`, `audio-integration`, `audio-trim`, `G006`, `G007`): **197 casos contabilizados; 193 PASS, 2 FAIL de lanzamiento por dependencias ausentes, 2 SKIP**. Esos 2 errores son `ERR_MODULE_NOT_FOUND` de `vue` (camera-binding) y `three` (G007 runtime), no fallos funcionales demostrados.
- Suite heredada G008 original incluye tres aserciones de diseño antiguo que **prohíben explícitamente** `PropertyKey` en Inspector. Fueron registradas como expectativas **SUPERSEDIDAS** por UPA-03, no editadas ni declaradas PASS.
- `node --check` en JS productivo modificado y tests: PASS.
- `npm run build`: **NO COMPILADO**, salida `sh: 1: vite: not found` (falta `node_modules`). No hay evidencia de build Editor ni Player.
- QA gráfico Electron: **NO EJECUTADO**.

## QA de usuario requerido (aún sin evidencia)

1. En proyecto con Timeline seleccionado, abrir su pestaña; en Camera3D observar llave solo cuando hay contexto editable; comprobar que otros paneles no muestran claves incongruentes.
2. Crear claves de FOV 70→100 y reproducir: mismo Camera3D, sin sustituir fuente de cámara y sin reset a FOV autoral durante preview; detener y verificar restauración.
3. En Light (omni, spot, area), comprobar solo propiedades compatibles; animar energía/color/rango/spot/penumbra/sombras y comprobar valor render real y restauración, especialmente si Inspector se edita durante preview.
4. Arrastrar Camera3D desde Jerarquía y verificar toma explícita; confirmar que `+ Pista` no ofrece creación de clips Nodo/Cámara.
5. Cargar un proyecto actual que conserve clips históricos Nodo/Cámara; confirmar que se reproducen, se mantienen al guardar y funcionan en Player.
6. Confirmar pista de métodos, argumentos, scripts expuestos (`node.expose`), errores controlados, loop, seek, stop y skip en PlayMode/Player.
7. Confirmar pista de comandos/eventos y audio (Mixer, waveform, fades, volumen y recorte); verificar sin regresiones.
8. Comprobar integración física, Canvas, materiales y otros propietarios mediante una matriz completa antes de reclamar universalidad; estas familias no están implementadas en este Gate.
9. Ejecutar `npm run build` y `npm run electron` después de instalar las dependencias originales. Devolver salidas y capturas.

## Estados separados

- **Implementación parcial:** SÍ.
- **Tests nuevos PASS:** SÍ (17/17); **fixture métodos:** 19/19.
- **Compilado:** NO VERIFICADO (dependencias no instaladas).
- **QA LOCAL PASS:** NO.
- **APROBADO/CERRADO:** NO.
