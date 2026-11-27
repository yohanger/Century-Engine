# LF-EDITOR-DISTRIBUTION-CORR-001 — Contrato de iconos del Editor

La identidad base del Editor es el **rombo de LevelForge** (`scripts/make-icon.mjs`): mezcla azul RGB `#478cbf` y centro RGB `#0d0d0d`. Este código ya producía `electron/vendor/icon.png` como icono por defecto **del juego exportado**. La nueva opción `--distribution` usa exactamente la misma función de dibujo, pero escribe únicamente en `build/`; no cambia ese recurso de juegos.

## Recursos versionados en SOURCE_BASELINE

```text
build/
├── icon.png              # 512px RGBA para editor Linux
├── icon.ico              # Windows: PNG embebidos de 16,24,32,48,64,128,256
└── icons/
    ├── 16x16.png
    ├── 24x24.png
    ├── 32x32.png
    ├── 48x48.png
    ├── 64x64.png
    ├── 96x96.png
    ├── 128x128.png
    ├── 256x256.png
    └── 512x512.png
```

Estos binarios forman parte del código fuente entregado. `npm ci` no es requisito para volver a generar los iconos: `node scripts/make-icon.mjs --distribution` (alias `npm run icons:distribution`) ejecuta solo módulos estándar de Node. Generar los iconos no forma parte silenciosa de `npm run dist:linux`: si el baseline está corrupto, el validador debe fallar explícitamente.

`package.json.build.directories.buildResources = 'build'`, `build.linux.icon = 'build/icons'` y `build.win.icon = 'build/icon.ico'` mantienen el empaquetado convencional de electron-builder. El *preflight* valida imágenes completas (incluido contenido IDAT) y los assets de Vite. La verificación posterior revisa existencia, tamaño mínimo y cabeceras ELF/AR/PE; ninguna de esas comprobaciones certifica la ejecución GUI.

El workflow `.github/workflows/desktop-build.yml` vuelve a estar presente en el SOURCE_BASELINE. No se publica automáticamente ninguna aplicación ni se almacenan certificados.

## Política de continuidad

Cada nuevo `SOURCE_BASELINE` debe incluir `build/` y `.github/workflows/desktop-build.yml`. Ejecutar `npm run test:distribution` y `npm run dist:verify` **desde la carpeta recién extraída**, además de validar la igualdad entre archivos del CHANGE y del SOURCE_BASELINE. Mantener la generación única, sin duplicar logos, shaders o pipelines. Los recursos de VFX3D, FilmMaker y la arquitectura de nodos permanecen fuera de alcance.

## Revisión correctiva FIX-001 (2026-10-29): preparación automática

**Problema de continuidad:** La primera entrega incluía `build/icon.png`, `build/icon.ico` y los nueve tamaños PNG, pero los scripts `dist:linux:package` y `dist:win:package` invocaban directamente el preflight sin recuperar los iconos si el usuario había extraído un paquete antiguo, eliminado la carpeta `build/` o instalado parcialmente los archivos. El build de Vite podía pasar y el empaquetado abortar después.

**Corrección:** `npm run dist:prepare` ejecuta `scripts/prepare-editor-distribution.mjs`, que inspecciona los iconos y los regenera con el generador existente **solo si faltan o están dañados**, respetando recursos personalizados válidos. Vuelve a verificar todos los recursos obligatorios y conserva el preflight obligatorio antes de electron-builder. Esta preparación se incorpora a Linux, Windows y al empaquetado independiente de Filmmaker.

**Pruebas:** DIST-CORR-07..11 reproducen una carpeta `build/` inexistente, un PNG inválido, iconos válidos, errores no relacionados con iconos y el orden de los scripts. Se ejecutan en el mismo SOURCE_BASELINE sin depender de electron-builder.

**Limitación:** el éxito de `dist:prepare` **no demuestra** que AppImage, DEB, NSIS o Portable sean generados o ejecutables. Para cerrar el Gate se requieren `npm run dist:linux` en Linux, `npm run dist:win` en Windows y verificación de ejecución real. Un fallo posterior de `electron-builder` necesita su registro completo y se investigará separadamente.
