> **HISTÓRICO / SUPERSEDIDO** por `CF-CA-002-TYPESCRIPT-CORE-REPLACEMENT` ratificado 2026-11-19. Documento preservado como evidencia del Gate Rust S01 sin compilación acreditada; NO representa la API activa ni instrucciones actuales de desarrollo. La fuente Rust original permanece en el SOURCE_BASELINE histórico.

# CF-RUST-API-S01 — Núcleo Rust y contrato público inicial

**Estado:** IMPLEMENTACIÓN S01-G001 AUTORIZADA (19-11-2026), sujeta a compilación y QA. No declara aprobado S00 ni S01.

## Producto y límites

- Crate de biblioteca `century-fluids` / import de Rust `century_fluids`, versión de desarrollo `0.1.0`, `edition = 2021`, MSRV indicada 1.74 como compromiso a verificar en CI. Publicación en crates.io deshabilitada (`publish = false`); propiedad/licencia sin presumir.
- Cero dependencias externas de Rust. `#![forbid(unsafe_code)]` en el crate.
- Este Sprint NO implementa partículas, presión, densidad calculada, integración física, colisiones, WASM, Jolt, renderizado ni un playground. Son compromisos de S02–S09.
- Los valores de referencia **no** son valores medidos ni significan convergencia de un solver inexistente.

## API pública implementada

| Tipo / función | Contrato |
| --- | --- |
| `Vec3::new(x,y,z) -> Result<Vec3, FluidError>` | Vector 3D inmutable, finito; getters `x/y/z/as_array`, constante `ZERO`. No presupone un eje vertical. |
| `FluidConfig::new(rest_density, gravity, max_substep_seconds, max_substeps)` | SI; densidad y substep positivos, finitos; presupuesto de subpasos entero positivo. Retorna `Result`. |
| `FluidConfig::reference_water()` / `Default` | Referencia de agua (1000 kg/m³, [0, -9.81, 0] m/s², paso máximo 1/120 s, 16 subpasos). Sin pretensión de calibración o estabilidad física. |
| `FluidWorld::new(FluidConfig)` | Crea instancia lógica sin estado global mutable compartido ni solver. La configuración ya fue validada. |
| `FluidWorld::config`, `FluidWorld::set_config` | Obtienen/reemplazan configuración; fallan cuando el mundo está cerrado. La sustitución es completa, sin mutaciones parciales. |
| `FluidWorld::prepare_step(dt)` | Valida `dt > 0` finito y presupuesto de subpasos; devuelve `StepPlan`. **No ejecuta ni simula un frame**. |
| `StepPlan::{host_dt_seconds,substeps,substep_dt_seconds}` | Datos temporales de solo lectura. `substep_dt_seconds` es `f64` para evitar pérdida adicional por división. |
| `FluidWorld::shutdown` y `state` | Cierre idempotente. `config`, `set_config`, `prepare_step` posteriores devuelven `FluidError::Closed`. |
| `FluidError` | Errores tipados: `NonFinite`, `NonPositive`, `OutOfRange`, `StepBudgetExceeded`, `Closed`. Implementa `Display` y `std::error::Error`. |

## Autoridad y límites numéricos

La biblioteca no llama a `Date.now`, `requestAnimationFrame`, Jolt ni Three.js. El host controla `dt`; no existe reloj global ni sincronización oculta. El presupuesto máximo se calcula en `f64` a partir de datos finitos `f32` y se rechazan pasos que excedan los `max_substeps` configurados. **El presupuesto temporal NO sustituye CFL ni análisis de estabilidad del solver**, a definir y verificar en S03.

La construcción de `FluidConfig`/`Vec3` asegura que sus campos privados sean finitos al crearse. Los valores de configuración por defecto son orientativos y no sustituyen ratificación CF-PHYS-ACC-001. Las instancias independientes de `FluidWorld` no comparten estado global mutable.

No se fija aún la ABI WASM ni el formato del buffer de partículas o la serialización. La API Rust sigue en fase pre-1.0 y podrá evolucionar únicamente mediante su contrato y Gate compatibles.

## Comandos QA previstos

Desde `CENTURY_FLUIDS/` con Cargo y herramientas instaladas:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
cargo build --release
python3 qa/verify_s01.py --project .
```

El runner es `qa/verify_s01.py` (sin dependencias); exige ejecutar los cuatro comandos Cargo salvo cuando se solicita explícitamente `--static-only`. Nunca convierte la ausencia de Cargo en PASS de compilación. El baseline puede validarse por comparación ZIP con `--previous-baseline`, `--baseline` y `--change`.

## Criterio de aceptación S01-G001

Los cuatro comandos Cargo deben ser PASS en una plataforma verificada, además del runner estructural, la integridad del paquete y el ledger; después se requiere revisión y aprobación explícita del usuario. El presente contenedor de autoría carece de `cargo`, `rustc`, `rustfmt` y Clippy, por lo que **COMPILACIÓN, UNIT TEST PASS y CLIPPY permanecen NO VERIFICADOS** hasta ejecutar QA en un entorno con Rust.
