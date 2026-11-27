# Cinematics S07 G001 Integral — CORR-002 · compilación bloqueada por plantilla

**Estado:** CORRECCIÓN APLICADA EN FUENTES; TEST AUTOMATIZADO PARCIAL PASS; COMPILACIÓN Y QA LOCAL NO VERIFICADOS. Se mantiene abierto el mismo Gate S07-G001-INTEGRAL. La ejecución del Gate S03 FilmMaker continúa pendiente de compilación y QA.

## Evidencia del usuario (5 de noviembre de 2026)

- En su carpeta LevelForge con CHANGE S03 aplicado: `node --test scripts/test-filmmaker-timeline-unification-s03-g001-integral.mjs` -> **13 PASS / 0 FAIL**.
- `npm run filmmaker -- --build` -> **FAIL** en la transformación Vue: `src/components/CinematicsPanel.vue:273:7 Invalid end tag` tras 299 módulos transformados.
- **Causa raíz demostrada:** después del cierre válido `</template>` del componente existe un bloque residual de interfaz del selector vacío y cierres duplicados que pertenecen a una versión anterior del mismo componente. El defecto ya estaba en S07 CORR-001 y pasó intacto a S03.

## Corrección de alcance mínimo

- `src/components/CinematicsPanel.vue`: suprimido exclusivamente el fragmento residual desde el segundo mensaje `player-empty` hasta el `</template>` duplicado. Se conserva el `player-empty` actual, la Timeline consultiva, los imports, estilos y lógica de reproducción.
- `scripts/test-cinematics-filmmaker-timeline-s07-g001-corr001.mjs`: dos regresiones añadidas dentro del test original, una de estructura de SFC y otra mediante el compilador oficial `@vue/compiler-sfc` cuando está instalado.
- Sin cambios en exportación, `project.timelines`, `.nfm`, Editor/Player, FilmMaker ni Android. No se ha abierto Gate nuevo.

## Pruebas ejecutadas en el entorno de preparación

Comando:

```bash
node --test scripts/test-filmmaker-timeline-unification-s03-g001-integral.mjs scripts/test-cinematics-filmmaker-timeline-s07-g001-corr001.mjs scripts/test-cinematics-filmmaker-timeline-s07-g001-integral.mjs scripts/test-cinematics-player-integration-s05-g004.mjs
```

**59 pruebas: 58 PASS / 1 SKIP / 0 FAIL.** El SKIP corresponde a la prueba con `@vue/compiler-sfc` no instalado en este entorno. **No se ha ejecutado Vite aquí.**

## Instrucciones de QA local

Desde la raíz **actual** de LevelForge (donde está `package.json`), comparar cambios locales en los tres archivos modificados y respaldarlos antes de extraer el ZIP CHANGE sobre esa misma carpeta. No instalar otro baseline ni eliminar `node_modules`.

```bash
node --test scripts/test-cinematics-filmmaker-timeline-s07-g001-corr001.mjs scripts/test-filmmaker-timeline-unification-s03-g001-integral.mjs
npm run filmmaker -- --build
```

**Esperado:** 0 FAIL y, con el compilador Vue instalado, 0 SKIP en la regresión de plantilla; Vite termina la compilación sin `Invalid end tag`. Después abrir FilmMaker en Electron y comprobar que la Timeline S03 y Cinematics S07 siguen accesibles, sin alteraciones de UI. Enviar el log completo del nuevo build, el resultado del QA visual y cualquier error nuevo.

No declarar COMPILADO, QA LOCAL PASS, APROBADO ni CERRADO hasta recibir evidencia.

## Inventario frente al SOURCE_BASELINE S03-G001

- **Modificados:** `src/components/CinematicsPanel.vue`; `scripts/test-cinematics-filmmaker-timeline-s07-g001-corr001.mjs`; `docs/qa/LevelForge_DB_Ledger.xlsx`.
- **Nuevos:** este documento y evidencia de Node de CORR-002.
- **Eliminados:** ninguno.
- **Inesperados:** ninguno.
