# QA — LF-LIQUID-HYDROLOGY-S06-G001

**Gate:** AUTORIZADO. **Implementación:** COMPLETADA.
**Automatizado:** 28/28 nuevas PASS + 108/108 S01–S05 y render heredados PASS = 136/136 PASS.
**Compilado Editor/Player:** NO VERIFICADO; `npm run build` falla por ausencia de `vite`.
**Documentación generada:** NO VERIFICADA; `npm run docs:build` falla por dependencia Node ausente (`marked`).
**QA LOCAL, APROBADO, CERRADO:** PENDIENTES.

## Evidencia reproducible

`node --test scripts/test-liquid-hydrology-s06-g001.mjs scripts/test-water-s01.mjs scripts/test-water-s02.mjs scripts/test-water-s03.mjs scripts/test-water-s03-corr001.mjs scripts/test-water-s04.mjs scripts/test-liquid-arch-s05-g001.mjs scripts/test-render-pipe-s01.mjs`

Resultado de la batería de fuentes: **136 PASS / 0 FAIL / 0 SKIP**. El test S02 reutiliza sus aserciones originales; se actualizó únicamente el enlazado de un módulo adicional en su harness `data:` por import absoluto, sin suprimir ni modificar criterios históricos.

## QA local obligatorio

1. Instalar CHANGE sobre el S05 correspondiente; comparar modificaciones locales y respaldar el ledger. Ejecutar `npm ci`, `npm run test:liquid-hydrology`, `npm run docs:build`, `npm run docs:check`, `npm run build` y `npm run electron`.
2. En una escena Terrain con Water Simulation habilitada, activar Hidrología. Configurar arena (infiltración alta, retención alta) y material impermeable (infiltración 0, retención 0). Pintar ambos; verificar diferencias del agua retenida y profundidad visible.
3. Lluvia sostenida: suelo inicialmente seco se humedece hasta saturación; el excedente aparece como agua física sin crear un segundo charco. Probar pendiente, depresión y borde cerrado.
4. Desactivar lluvia: sin aportes nuevos no debe aparecer masa; drenaje configurado deberá disminuir agua del suelo y aumentar saldo de salida externa.
5. Guardar/reabrir `.lfproj`; confirmar perfiles y estado optativo. Ejecutar Undo/Redo de perfil, reordenar/añadir/quitar capas y pintar; verificar sincronía de peso físico y UI.
6. Confirmar retrocompatibilidad de escenas sin marca `hydrology`, agua oceánica/heredada, Film Maker y Play/Stop.
7. Capturas PBR y PSX de terreno seco, húmedo, saturado y charcos; comprobar ausencia de charcos procedurales duplicados.
8. Medir FPS y memoria en hardware objetivo con región de 32×32 y varias capas; comparar S05 con S06. Ejecutar Player exportado para verificar integridad.
9. Repetir pruebas con al menos dos regiones y transferencias explícitas; validar balance físico. El solver conserva como máximo 4096 celdas físicas por escena.

**Evidencia a devolver:** logs completos Node, compilación, documentación y Electron, capturas de perfiles/render, operaciones de guardado/Undo y medición de rendimiento. No se declara QA visual ni Player PASS sin evidencia.

**Sprints posteriores — PENDIENTE PLANIFICADO:** S07 escorrentía sobre objetos, S08 audio por superficie, S09 ríos/océanos, S10 líquidos contenidos, S11–S13 clima/QA. No confundir con conexiones olvidadas.
