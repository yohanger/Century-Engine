# QA — LF-NODE-MULTISCRIPT-S01-G001

**Estado:** IMPLEMENTADO · NODE 21/21 NUEVOS PASS · REGRESIÓN 205/205 PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

## Evidencia

| Batería | Resultado | Notas |
|---|---|---|
| Multiscript Node MS-01..MS-21 | **21/21 PASS** | Instancia por recurso, orden, visibilidad, aislamiento, limpieza, errores, Signals y ciclos |
| Regresión Node integrada | **205/205 PASS** | Incluye S02/S03/S04/S05/S06 y Lifecycle; 0 FAIL, 0 SKIP |
| `node --check` | PASS | Módulos `node-scripts.js` y `node-lifecycle.js` |
| `node scripts/gen-docs.mjs --check` | PASS | Referencia al día |
| Electron/WebGL2 con fixture multiscript | **NO VERIFICADO** | Runner preparado; requiere `npm ci`, Vite ausente aquí |
| `npm run build` | **NO VERIFICADO** | `vite: not found`; no se certificó compilación |
| QA local del usuario | **PENDIENTE** | El usuario ejecuta pruebas locales y comunica aprobación o defectos |

## Comandos para QA local

Desde el SOURCE_BASELINE nuevo extraído en una carpeta separada:

```bash
npm ci
node --test scripts/test-node-multiscript-s01-g001.mjs
node --test scripts/test-node-multiscript-electron-s01-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

El test Node debe mostrar **21 PASS, 0 FAIL**. El runner Electron necesita WebGL2 y el Electron incluido, sin navegadores externos. QA local: además de ejecutar pruebas, verificar que escenas existentes con `scriptId` funcionan igual, que scripts sin `_process` no agregan coste periódico y que Stop/Play no deja callbacks huérfanos. Para ensayar G001 multinstancia la fixture Electron carga temporalmente `scriptIds`; el Inspector todavía no ofrece selección múltiple (G002).

**Importante:** no se afirma que el Editor ya permita vincular varios scripts mediante UI ni que el Player exportado haya sido compilado aquí. La aprobación futura del usuario acreditará QA LOCAL PASS declarado por él, sin inventar resultados de automatización.

## Aprobación posterior del usuario — 2026-11-02

Tras la entrega G001, el usuario respondió «Aprobado» y solicitó continuar con G002. Conforme al criterio QA acordado, se registra **QA LOCAL PASS DECLARADO POR USUARIO y APROBADO G001**. La compilación y Electron del entorno implementador permanecen NO VERIFICADOS, sin inventar evidencia.
