# CF-CA-002 — Reemplazo de núcleo Rust por TypeScript

**Estado:** RATIFICADO EXPRESAMENTE POR EL USUARIO (2026-11-19). **Autoridad superior a los contratos S00 incompatibles.**

Ratificación: «Ratifico CF-CA-002-TYPESCRIPT-CORE-REPLACEMENT conforme a las seis decisiones declaradas.»

Autorización limitada al Gate S01: «Listo. CENTURY-FLUIDS-S01-G001-INTEGRAL-TYPESCRIPT-CORE-AND-API autoriza comenzar».

## Las seis decisiones ratificadas

1. **TypeScript sustituye a Rust como lenguaje del núcleo de Century Fluids.** Las obligaciones de Cargo, rustc, wasm-bindgen y compilación Rust/WASM del núcleo dejan de ser requisitos activos.
2. **Un único solver físico**, a desarrollar en S03; prohibido crear implementaciones paralelas para Jolt, Century, navegador o Node.
3. **JoltPhysics.js será dependencia exclusiva del adaptador S06**, no del núcleo TypeScript ni del API S01.
4. **Biblioteca independiente y agnóstica** de Century, cualquier renderizador y el ciclo de vida de un motor externo. S08 permanece en pausa.
5. **Playground de agua como requisito de validación antes de integrar Century**, previsto como instrumento de QA y aceptación S09. La apariencia no acredita física por sí sola.
6. **Se mantienen exactamente 11 Sprints integrales (S00–S10), un Gate principal G001 por Sprint**, con historia conservada; se sustituyen obligaciones y textos incompatibles, no se borran registros históricos.

## Efecto exacto sobre los contratos anteriores

- `CF-CA-001` y `CF-ARCH-001`: donde se describe core/solver **Rust**, léase **TypeScript**; los demás principios de independencia, estados, responsabilidad física y QA permanecen, salvo contradicción.
- `CF-INTEROP-001`: Rust WASM ↔ JavaScript ↔ Jolt queda **SUPERSEDIDO**. La nueva frontera: core TypeScript ↔ adaptador TypeScript que consume Jolt.js/WASM como dependencia opcional. No se comparten punteros Jolt ni se accede a memoria WASM interna arbitrariamente. S05 deja de construir Rust WASM y verificará distribución, API, contratos/transferencia de datos en JavaScript/Node/navegador.
- `CF-QA-001`: sustituidos Cargo, Clippy, rustfmt y paridad Rust/WASM por `tsc --noEmit`, build ESM/declarations, pruebas Node, QA de distribución/navegador y Jolt WASM real en S06. No se elimina QA físico, benchmark ni control de memoria.
- `S01-G001-INTEGRAL-RUST-CORE-AND-API`: **SUPERSEDIDO sin TEST PASS ni cierre**. Su código `.rs` y `Cargo.toml` se retiraron solo de la baseline ACTIVA; permanecen sin modificación en el ZIP Rust histórico. La nueva baseline no debe alojar un segundo núcleo Rust.
- `S01-G001-INTEGRAL-TYPESCRIPT-CORE-AND-API`: **AUTORIZADO**; cubre APIs fundamentales, validación, ciclo de vida, tests y toolchain, no solver S03, Jolt S06, visualización ni Century S08.

## Permanencia de pausas y decisiones no tomadas

- **S08 EN PAUSA**. La ratificación CF-CA-002 no elimina el objetivo de integrar Century ni acredita que se haya cumplido. La modificación del alcance de release v1.0 para omitir S08 sigue requiriendo resolución contractual independiente si se pretendiera liberar antes de integrar.
- DFSPH sigue siendo **candidato**, no solver implementado ni validado. Las tolerancias numéricas S00 siguen propuestas hasta ratificación y ensayos.
- No se establecen requisitos automáticos de migración de datos experimentales ni retrocompatibilidad de APIs Rust que nunca alcanzaron estabilidad.

## Política de preservación del trabajo

La baseline Rust S01 previa permanece inalterada como archivo de continuidad. El paquete incremental de sustitución incluye una **lista SHA-256 de rutas Rust retiradas** con instrucciones de eliminación condicional; nunca elimina archivos locales no coincidentes ni añade datos del usuario. El SOURCE_BASELINE de TypeScript presenta una única implementación activa.
