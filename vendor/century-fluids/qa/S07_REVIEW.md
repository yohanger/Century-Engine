# Revisión S07-G001 — CF-CA-003

- **Authority:** CF-CA-003 ratificado; S07-G001 autorizado literalmente por el usuario.
- **Baseline:** S06-G001 SOURCE_BASELINE (no reconstruido desde source.zip obsoleto); se preservan archivos originales, sin borrar historial. No se modificó Century.
- **Implemented:** módulo `fluids/water` con presets, fábrica y políticas; extractor `surface` genérico sobre snapshots, índice temporal en `spatial`; contrato neutral de acoplamiento y política Jolt inyectada.
- **API:** los consumidores actuales se auditaron y actualizaron. `FluidWorld` exige `FluidConfig` explícito; `LiquidSolverConfig` se configura explícitamente; no quedan presets de agua en núcleo. Sin redirectors pre-1.0.
- **Surface QA:** malla orientada, cerrada en casos de gotas separadas y partícula aislada, normales unitarias, presupuestos de grilla/triángulos, buffers desprendidos, determinismo, masa variable y temporalidad. No se equipara malla con simulación de agua ni volumen exacto para todas las distribuciones.
- **Benchmarks:** referencia 6×6×6 partículas registrada con tiempo de autoría, RSS y discrepancia de volumen; resultado no equivale a rendimiento 60 FPS de equipo objetivo.
- **Regression:** S01–S06 structural Node + consumidores npm/Vite. **WASM Jolt real requiere repetir el QA en el equipo usuario**: el entorno de autoría no puede descargar `jolt-physics@1.1.0` (`EAI_AGAIN`). La evidencia S06 real anterior se conserva como precedente, no revalida automáticamente S07.
- **Known:** `iteration_limit` del tanque S04; estimador WaterHydrodynamics sigue aproximado sin par hidrostático inventado; ninguna evaluación visual S09 implementada.
- **Status:** IMPLEMENTADO, COMPILADO, TEST PASS en autoría. QA Jolt WASM local, aprobación y cierre S07 PENDIENTES. S08 EN PAUSA.

## CORR-001 — Jolt REAL BUOYANCY TEST (2026-11-20)

- **Authorization:** `Listo. CENTURY-FLUIDS-S07-G001-CORR-001-JOLT-REAL-BUOYANCY-TEST autoriza comenzar` (usuario).
- **Observed local failure before correction:** user S07 QA `89/89` Node PASS; Jolt real `2/3` PASS; test `dynamic sphere receives buoyant impulse` failed at `JoltFluidBridge.register()` with `INVALID_ARGUMENT: hydrodynamic policy required for buoyancy/drag`. Other two Jolt real cases PASS.
- **Root cause (shown by source and stack):** `tests/jolt-real/real_jolt.test.mjs:55` used the legacy three-argument constructor despite new CF-CA-003 requirement; `WaterHydrodynamics` was already imported and used by the lifecycle test in the same file.
- **Authorized correction:** exactly one source line changed: inject `new WaterHydrodynamics()` into the buoyancy test's `JoltFluidBridge` constructor. No changes to solver, water specialization, Jolt bridge, package API or test assertions.
- **Author QA:** JavaScript syntax PASS; `npm run qa` 89/89 PASS; static/packaging QA PASS recorded in `qa/S07_RUN.log`. The author environment cannot fetch pinned `jolt-physics@1.1.0` from npm due DNS `EAI_AGAIN`; actual Jolt WASM **NOT VERIFIED after CORR-001**.
- **Acceptance pending:** user must execute `python3 qa/verify_s07.py --project . --jolt` with the previously installed isolated real Jolt 1.1.0 dependency and provide `S07_JOLT_WASM_QA_PASS`. S07 approval and close remain PENDING, S08 EN PAUSA.

## Cierre posterior a CORR-001 (20-11-2026)

El usuario aportó nuevo registro `qa/S07_LOCAL_USER_POST_CORR_QA.log`, confirmando 89/89 pruebas Node y 3/3 Jolt WASM real con `S07_JOLT_WASM_QA_PASS` después de la inyección explícita de `WaterHydrodynamics`. El usuario declaró **«Aprobado S07»**. Las referencias históricas anteriores a «WASM pendiente» describen el estado **pre-CORR-001**, quedan SUPERSEDIDAS por esta evidencia de cierre. El ledger de S09 registra S07 APROBADO/CERRADO; no se añadió un Sprint ni otro Gate principal.
