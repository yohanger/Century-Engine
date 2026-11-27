# S03-G001 — Implementación y QA

**Gate:** `CENTURY-FLUIDS-S03-G001-INTEGRAL-3D-LIQUID-SOLVER` — autorizado literalmente 2026-11-19.

**Implementación:** solver de fluidos basado en partículas TS, densidad, presión iterativa, divergencia, gravedad, viscosidad, fuentes/sumideros, CFL, diagnóstico de convergencia y publicación atómica desde frame temporal. Sin dependencias de motor, renderizador o Jolt en runtime.

**Evidencia:** `qa/S03_RUN.log` incluye el resultado de TypeScript, todas las pruebas, benchmarks y versions del toolchain. `qa/verify_s03.py` valida manifest, 6 hojas del ledger/11 Sprints/Gates y delta contra S02 cuando se suministran los ZIP.

**Limitaciones:** no se acredita fidelidad DFSPH completa ni hidrostática con contornos; parámetros numéricos S00 no ratificados. No se incluyen límites S04, Jolt S06, superficie S07, playground S09 ni Century S08 EN PAUSA. No confundir benchmark numérico Node con FPS del juego.

**Estado:** IMPLEMENTADO; TypeScript TYPECHECK, BUILD, tests y benchmark de autoría PASS cuando están en log. QA LOCAL, APROBACIÓN y CIERRE pendientes de declaración del usuario.
