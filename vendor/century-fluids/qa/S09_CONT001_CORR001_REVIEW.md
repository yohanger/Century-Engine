# S09 CONT-001 CORR-001 — QA y autoridad

- Gate `CENTURY-FLUIDS-S09-G001-CONT-001-CORR-001-PACKAGED-PLAYGROUND-REFRESH` **AUTORIZADO** por usuario el 2026-11-20.
- Desviación local confirmada: dependencias Vite del playground recibieron una versión instalada obsoleta de `@century/fluids` 0.1.0; el tarball ya incluía `ChunkedSurfaceCache`.
- Alcance: runner, comprobador selectivo de paquete instalado, pruebas y registro QA/ledger. Sin cambios a física, API pública o Century.
- QA de autoría: TypeScript, npm install/pack offline sobre fixture versión idéntica, suite Node y verificador S09. No afirmar QA GUI, GPU ni Jolt **en navegador** sin prueba local.
- S09 CONT-001: **NO APROBADO/NO CERRADO**. El solver de presión sigue global, CF-CA-005 NO RATIFICADO, S08 EN PAUSA.
- Evidencia local requerida: `python3 qa/verify_s09_cont001.py --project . --jolt --browser-build` y navegador Brave con las cuatro escenas.
