# S09-G001 CONT-005 CORR-001 — Integral GitHub Repository Cleanup

**Autorización literal:** `Listo. CENTURY-FLUIDS-S09-G001-CONT-005-CORR-001-INTEGRAL-GITHUB-REPOSITORY-CLEANUP autoriza comenzar` (2026-11-20).

**Autoridad:** CF-CA-005 ratificado; S09-G001 CONT-005 continúa ABIERTO; S08 EN PAUSA; S10 NO AUTORIZADO. Sin nuevo Sprint ni integración con Century.

## OBJETIVO Y DIAGNÓSTICO

Limpiar la interfaz pública npm y el árbol fuente antes de publicar un repositorio GitHub independiente. El ZIP actual del usuario contenía archivos generados e instalados dentro de `playground/node_modules/`, `dist/` y `playground/.local/`, además de scripts históricos por Sprint. Estos artefactos no deben formar parte del repositorio fuente.

## MECANISMO Y ALCANCE AUTORIZADO

- Reducir `package.json` a `typecheck`, `build`, `prepack`, `test`, `qa` y `playground`. Retirar explícitamente `qa:s05`, `qa:s06:wasm`, `qa:s09:prepare`, `qa:s09:build`, `benchmark:s02`, `benchmark:s03`, `benchmark:s04`, todos los `benchmark:s09:*` y aliases duplicados/legacy de benchmark, Vite y navegador.
- Mantener los benchmarks, pruebas y runners históricos **como archivos**, sin comandos npm individuales; los verificadores Python S02–S09 usan ahora `node tests/...` directamente, conservando la capacidad de ejecutar Jolt real y compilación Vite por flags.
- Añadir `.gitignore` para impedir subida involuntaria de dependencias, builds, tarballs y secretos de entorno, además de `.gitattributes` para normalizar texto. **No** excluir los logs y las capturas QA históricas.
- Actualizar README y referencias operativas activas; conservar documentación histórica de las invocaciones anteriores como evidencia sin convertirla en instrucciones vigentes.
- Conservar `private: true` y `UNLICENSED`: visibilidad/licencia y publicación npm requieren decisión expresa del propietario. No se crea release ni pipeline CI no solicitado.
- Empaquetar CHANGE incremental sobre el ZIP fuente **actual proporcionado por el usuario**, y SOURCE_BASELINE completo del árbol fuente. El ZIP original aportado nunca se modifica; los archivos instalados se omiten **solo de los entregables de Git** y NO se eliminan de la copia de trabajo del usuario.

## PRERREQUISITOS Y MEDIOS

SOURCE_BASELINE CONT-005 previo + ZIP de trabajo actual proporcionado por el usuario; Node.js >=20, npm, TypeScript 5.8.3, Python 3, el runner `qa/verify_repository_cleanup.py`, utilidades históricas internas y ledger de seis hojas.

## QA, EVIDENCIA Y LÍMITES

- Compilación TypeScript, suite Node completa de las nuevas escenas físicas/visuales del ZIP actual, empaquetado local ESM y runners de preparación.
- Comprobación estática de seis scripts, imports sin dependencias de host, referencias actualizadas, los 11 Sprints y los 11 Gates principales.
- Comparación SHA-256 del CHANGE contra el ZIP actual y reconstrucción determinista del SOURCE_BASELINE.
- Jolt WASM real y Vite build posterior a esta limpieza solo se acreditan si se ejecutan en el entorno; Brave/QA visual es separado.
- Fuera de alcance: modificar solver/contactos/superficie/espuma/vaso, cambios de API, licencias, publicación a npm, integración Century, borrar historia de pruebas o registros.

## CONTRADICCIONES Y SIGUIENTE ACCIÓN

Una limpieza de scripts no acredita estabilidad física ni cierre S09; las obligaciones de CONT-005 y QA visual siguen abiertas. Esta corrección no puede utilizarse para ratificar cambios de licencia, activar S08 o cerrar S10. Revisar logs locales, verificar Git status sobre un clon limpio y presentar el Gate a aprobación expresa.

## Revisión editorial README dentro del mismo Gate

El README de Century fue aportado por el usuario como referencia de **presentación**, no como fuente de funciones de Century Fluids. La portada `README.md` se reorganizó en español profesional: producto y madurez → capacidades reales → arquitectura → primeros pasos → ejemplo ESM → playground → QA → límites → distribución/licencias. El ejemplo fue ejecutado con el paquete compilado (`README_EXAMPLE_QA_PASS`); los ocho enlaces relativos del documento fueron verificados contra el árbol fuente. No se añadió identidad gráfica ni se prometió integración con Century, API 1.0, publicación npm o aceptación visual inexistente.

Esta revisión se encuadra en el alcance README/metadata de **CORR-001** ya autorizado. No crea un Gate adicional, no modifica `src/` o `playground/src/` y no sustituye los reportes de QA existentes. Resultado editorial verificado en `qa/S09_CONT005_GITHUB_README_QA.log`; la aprobación del usuario para la revisión sigue pendiente.
