# S01 Rust — historia SUPERSEDIDA

Anterior baseline: `CENTURY_FLUIDS_S01_G001_INTEGRAL_RUST_CORE_AND_API_SOURCE_BASELINE.zip`
SHA-256: `7109c34334c28e7bc4b00aec139c7c4cbf3877a6b01b8ea9d5a956fe99ca7aee`

**No se ha destruido esta baseline.** Está conservada como entrega separada y verificable. `CF-CA-002` ratificado sustituye su implementación activa en S01. `cargo fmt/test/clippy/build` no se ejecutaron; no se convierte este estado en aprobado. Se retiraron del nuevo SOURCE_BASELINE únicamente estos archivos Rust generados en el Gate antiguo (contenido intacto en el ZIP anterior):

- `CENTURY_FLUIDS/Cargo.toml` (`d340b9ead56ae25893f8e7b7bc7c567d752a964393a9d588313225f5a4576453`)
- `CENTURY_FLUIDS/src/config.rs` (`465c04b233991161a14cb523d1d107459ee73550857983aceef3f6250f13f71b`)
- `CENTURY_FLUIDS/src/error.rs` (`7ad62661e84983d596d395e28dc5edbec43a17e0077984edd7811a0a1bdc0402`)
- `CENTURY_FLUIDS/src/lib.rs` (`506b13de80814a2f575126f19cb292e58708d465149b21e5b61586415245fc43`)
- `CENTURY_FLUIDS/src/math.rs` (`86ecd4116615a72693c1e4d6da026520cdb2f34d3af3d1773f1781dc7a5429c7`)
- `CENTURY_FLUIDS/src/world.rs` (`cd5ef1b9713494663d7f77e5f79779e7bbf6766ace5f33fa40c4d2b352f54d00`)
- `CENTURY_FLUIDS/tests/errors.rs` (`faa6c736956def921a22325c423cbcc4c864de27277d7db083b880b32ec08294`)
- `CENTURY_FLUIDS/tests/public_api.rs` (`6f7399fc581068852b86362c631c7e6c8d900c275ecdc3d77b7dfc50508ad16b`)

El CHANGE incluye `CHANGE_REMOVALS.json` con hashes originales. No ejecutar borrados sin comparar con los archivos locales y proteger modificaciones divergentes. Aplicar el SOURCE_BASELINE íntegro es la opción segura para una carpeta nueva.
