# CF-REF-001 — Registro de fuentes técnicas consultadas

**Corte:** 2026-11-19. URLs upstream; sin pinning a commit por no existir aún versión Century auditada. Revalidar antes de congelar dependencias.

1. JoltPhysics.js README y licenciamiento MIT: https://github.com/jrouwe/JoltPhysics.js — evidencia de variantes de distribución WASM y manejo manual de memoria.
2. JoltPhysics.js IDL upstream: https://raw.githubusercontent.com/jrouwe/JoltPhysics.js/main/JoltJS.idl — evidencia de los nombres de funciones de cuerpo/BodyInterface. No confundir rama main con versión instalada.
3. Jolt C++ BodyInterface docs: https://jrouwe.github.io/JoltPhysics/class_body_interface.html — semántica de fuerzas, impulsos y flotación, revisar para versión fijada.
4. `wasm-bindgen` official guide: https://rustwasm.github.io/docs/wasm-bindgen/ — valores, TypedArrays, slices, límites de memoria y lifecycle.
5. Rust target platform support: https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html — restricciones del target y entorno host.
6. Jan Bender, Dan Koschier, *Divergence-Free SPH for Incompressible and Viscous Fluids*: https://pubmed.ncbi.nlm.nih.gov/27295676/ — fundamento matemático del candidato DFSPH.
7. JoltPhysics.js package metadata: https://www.npmjs.com/package/jolt-physics — distribución, no prueba de uso actual en Century.

**Licencia y cumplimiento:** la licencia MIT señalada para el repositorio JoltPhysics.js no autoriza suponer licencias de todas las dependencias futuras. No se descargó, vendorizó ni copió código de terceros al proyecto.

## Fuente primaria aportada por el usuario

- **Century ZIP (primaria, local):** `century(1).zip`, SHA-256 `deee62669c452c805fd96b8dc951bf0650a3510206f7af029c50ec9bc6c67822` (2026-11-19; CRC PASS; lectura estática de 3.994 entradas). Evidencia de versión exacta de dependencia lock, API interna real, runtime, loop, nodos y retirada de agua. No se redistribuye el ZIP ni código propietario dentro de Century Fluids.
- Ubicaciones: `package.json`, `package-lock.json`, `src/engine/runtime/physics/{jolt,bodies,node-bodies}.js`, `src/engine/runtime/events/{play,play-controls,play-bodies}.js`, `src/engine/runtime/templates/gameParams.js`, `src/engine/runtime/{scene-graph,package/game}.js`, `src/engine/runtime/fluids/liquid.js`, `src/engine/runtime/geometry/liquid-containers.js`, `src/engine/runtime/scene/{objects,node-lifecycle}.js`, `src/engine/runtime/render/viewport.js`, `scripts/test-runtime-jolt-wasm-real-corr-g001.mjs`.

## Referencias oficiales adicionales tras CF-CA-002

- TypeScript 5.8.3, registro npm oficial y checksum SHA-512 publicado: https://registry.npmjs.org/typescript/5.8.3
- Manual oficial TypeScript (tsconfig y compilación): https://www.typescriptlang.org/docs/handbook/tsconfig-json.html
- Node.js, módulo `node:test`: https://nodejs.org/api/test.html
- Node.js, paquetes ESM y exports: https://nodejs.org/api/packages.html

Las referencias anteriores a Rust, wasm-bindgen y Cargo se conservan únicamente como **historia de la tecnología anterior**, ya no especifican la implementación activa.
