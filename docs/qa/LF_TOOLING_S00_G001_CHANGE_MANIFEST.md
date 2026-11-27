# LF-TOOLING-S00-G001 — CHANGE ZIP manifest

Padre: `LF_WATER_RUNTIME_S00_G001_EDITOR_PLAY_RUNTIME_VISIBILITY_RECOVERY_SOURCE_BASELINE.zip`
Gate: `LF-TOOLING-S00-G001-ELECTRON-LAUNCH-AND-PACKAGE-SCRIPTS-HYGIENE`

**Reglas:** aplicar únicamente sobre el baseline indicado; no sobrescribir cambios locales sin comparar. No se borran archivos. Los scripts de QA no se eliminan; se trasladan recetas al catálogo.

### Evidencia
- 11/11 nuevos tests tooling PASS
- 25/25 con `npm test` PASS
- `test-editor-distribution-g001.mjs`: 15/35 PASS tanto padre como cambio; 20 fallos históricos
- `npm run build`: BLOQUEADO (`vite: not found`); compilación real y Electron NO VERIFICADOS

### Archivos modificados/nuevos (excepto manifiesto) SHA-256
- `README.md`: `3a3618c2059111e1ae54944cdad200e9678cc0b3fa9596bf034fc2bbc1ad757f`
- `docs/qa/LF_TOOLING_S00_G001_ELECTRON_LAUNCH_AND_PACKAGE_SCRIPTS_HYGIENE.md`: `c84c211fa4749f88edf7d51ebd233913bd2cd451e5419ddd4ff10aded6ef13f6`
- `docs/qa/LevelForge_DB_Ledger.xlsx`: `fc95a53ebb9abd1f51e159d5ee274632c418863c87662bdfd18e10a1f4811958`
- `docs/qa/evidence/LF-TOOLING-S00-G001/distro-current.log`: `f1c7fdc16495d4a460757e93555d78c831e18b1b8b2328261b40543026df24aa`
- `docs/qa/evidence/LF-TOOLING-S00-G001/distro-parent.log`: `4b8a75b6e9bc6e4fc931137fbb32d10f042e211580847ddb40416ab01e59c20d`
- `docs/qa/evidence/LF-TOOLING-S00-G001/node-focal.log`: `c870e477da06eab5c0621a200d625b62f3581f508c181e3d471a92bee568fa84`
- `docs/qa/evidence/LF-TOOLING-S00-G001/node-newtests.log`: `d3c41eb6934047600f20bfb0b68ed23b5c2456839f5b9afdcbe211b58e878942`
- `docs/qa/evidence/LF-TOOLING-S00-G001/npm-smoke.log`: `0038779cb6fb94d2d04343394ce1d6a95d750bb8e41a91ccf070b4b22c8f4b0c`
- `docs/qa/evidence/LF-TOOLING-S00-G001/qa-groups-list.log`: `fbe9882db20a6e7416b0d527e88e3b7f10441b8326cffe9ea1aa0c0a1a65d200`
- `docs/qa/evidence/LF-TOOLING-S00-G001/vite-build-blocked.log`: `4f1ad94331d0e35167ea085f364282c3225262ef47ac91a71455bbbea8399be7`
- `package.json`: `ec2c05fbce0860604e2a7f0eab46d60086f412e0335ba1e80592d9885160bcd1`
- `scripts/electron-dev.mjs`: `9afeb6b80b7836f42814241bd3f9a7c8fad80209a0411b36d34a0226d5f1b4d5`
- `scripts/electron-start.mjs`: `e37593e4cb7904b8819c038e8c68b574c22c1b4111b13e08d06dc0f646b8cc30`
- `scripts/qa-suite.mjs`: `fb122d6397457131cbdf0378a5724aae9af4b7592f27befa2b0dbafec130583e`
- `scripts/qa-suites.json`: `46ad7c0cbdac92b9d158762f9ccb7caaa01205e23a44119b2fdb6cd1ca174d07`
- `scripts/test-tooling-s00-g001-electron-and-scripts.mjs`: `5a01d0d19660c5ad1df7d6c6b14985511cf77e2f8c9ef89f696df9e812cd0e75`

