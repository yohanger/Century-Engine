# QA — LF-LIQUID-RAINFLOW-S07-G001

**Gate:** AUTORIZADO. **Implementación:** COMPLETADA.
**Pruebas nuevas:** 29/29 PASS. **Regresión WATER S01–S06 + render:** 136/136 PASS. **Total seleccionado:** 165 PASS, 0 FAIL, 0 SKIP.
**Compilación Editor/Player:** NO VERIFICADO en este entorno (falta Vite en `node_modules`).
**Generación documental:** NO VERIFICADA (falta `marked`).
**QA local, APROBADO y CERRADO:** PENDIENTES.

## Batería reproducible

`npm run test:liquid-rainflow`

Las pruebas incluyen: normalización/material compartido, activación optativa, límites de perfil, muestreo en celdas, lluvia no duplicada, cubiertas sin Jolt, cubiertas heredadas sin perfil, retención y caída por gravedad, mesetas/depresiones, salida al borde, material/objeto cambiado, dos regiones, redistribución tras eliminar superficies y relieve, snapshot v4, restauración v2, rechazo de snapshots corruptos, rollback forzado del solver y no regresión de S01–S06.

## QA local obligatorio (lo ejecuta el usuario)

1. Comparar CHANGE con la instalación y respaldar el ledger. Aplicar CHANGE solamente si no hay archivos locales en conflicto; conservar SOURCE_BASELINE como base de continuidad.
2. Ejecutar `npm ci`, `npm run test:liquid-rainflow`, `npm run docs:build`, `npm run docs:check`, `npm run build`, `npm run electron`.
3. En Terrain habilitar Agua física y **Escurrimiento sobre geometría 3D estática**. Crear región cubierta parcialmente por una primitiva/plano o malla estática; asignar material local o `.material` con escurrimiento habilitado. Activar lluvia.
4. Cambiar `Retención (mm)` y `Escurrimiento (m/s)`; observar agua recibida por la región y su comportamiento. Confirmar que el suelo bajo la cubierta no recibe además lluvia directa.
5. Probar una cubierta inclinada, una plana, una que alcance el borde físico y una superficie superior sin perfil hidráulico. Observar visualmente que no se duplican los charcos PBR/PSX.
6. Guardar/reabrir `.lfproj`; comprobar activación, propiedades y vínculo del material. Editar, mover o eliminar la cubierta y repetir; verificar que no se pierda agua sin balance.
7. Confirmar Undo/Redo del material y de Terrain. Probar Play/Stop, Film Maker si aplica y un proyecto anterior sin opt-in: su comportamiento debe ser idéntico.
8. Exportar y ejecutar Player; comprobar el mismo flujo físico. Medir FPS, tiempo de inicio y memoria en hardware objetivo con región 32×32 y varias cubiertas; comparar contra S06.

**Evidencia a devolver:** logs de tests, documentación/build, capturas del Inspector y Terrain con perfiles, vistas durante lluvia (PBR/PSX), guardado/recarga, Player, métricas de rendimiento y cualquier anomalía. Un test Node PASS no confirma QA visual PASS.

**Siguientes funciones planificadas:** S08 audio de impactos por material, S09 intercambio con cuerpos tradicionales, S10 líquidos contenidos, S11 rayos, S12 tornados, S13 integración. No crear gestores paralelos.
