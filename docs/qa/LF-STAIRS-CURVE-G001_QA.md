# LF-STAIRS-CURVE-G001 — Escalera curva

## Alcance autorizado

Extiende la **primitiva Escalera existente** con `props.turn` (Giro °, −90 a +90). La geometría curvada se construye en `PolyMesh`, utilizando longitud de recorrido Z, ancho X y altura Y. `turn=0` utiliza exactamente el generador recto anterior, compatible con escenas y exportación legadas. La curva se dibuja como arco circular, no como deformación elíptica posterior al escalado.

Se conservan 2–64 escalones, Escalera original, Edit Mesh, CSG y materiales. No se incorporan laterales configurables ni otra primitiva. En dimensiones que dejarían radio interior no positivo, Inspector rechaza el giro y el generador cae a la forma recta sin romper escenas cargadas. Si una escena cambia las dimensiones después de guardar, el Inspector avisa de una curva incompatible mientras se muestra recta.

## Pruebas automatizadas

Desde la raíz del SOURCE_BASELINE y sin sobrescribir la instalación local:

```bash
node --test scripts/test-stairs-curve-g001.mjs
node --test scripts/test-stairs-param-g001.mjs
node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' | sort)
npm run build
npm run electron
```

`test-starcat.mjs` requiere Three.js (dependencia de npm), ausente en el entorno de ejecución del asistente. **No declarar que esta prueba pasó**: se ejecutará después de `npm ci` en el equipo del usuario. La compilación requiere Vite y debe comprobarse con dependencias instaladas.

## QA local — usuario

1. Crear Escalera; confirmar 8 escalones, dimensiones XYZ y Giro 0° (sin cambios respecto a versiones anteriores).
2. Probar Giro +45°, −45°, +90° y −90°; observar curva, huellas, contrahuellas y espesor; la orientación debe invertirse al cambiar el signo.
3. Cambiar escalones 2, 8 y 64; verificar que no hay huecos en laterales, tapas o base y que las normales se orientan correctamente.
4. Cambiar dimensiones X/Y/Z; Z controla longitud sobre el arco. Una escalera demasiado ancha para el radio debe rechazarse sin provocar geometría inválida ni errores del Player.
5. Convertir curva a Edit Mesh y editar vértices/caras. Verificar UV, Material Blockout, Undo/Redo y Snap.
6. Probar Escalera curvada como brush sólido y como cortador CSG; variar Giro y comprobar que los recortes se recalculan.
7. Guardar y reabrir escena con curva; verificar propiedades y resultado visual.
8. Ejecutar Player y comprobar que se renderiza; caminar por una escalera con colisión estática Jolt.
9. Exportar escena a Godot: Giro 0° mantiene BoxMesh/BoxShape3D por escalón, Giro distinto de cero exporta GLB y ConcavePolygonShape3D. Confirmar colisión estática y orientación visual en Godot.
10. Reabrir proyectos anteriores con Escalera sin `props.turn` y verificar que mantienen su forma.

## Evidencia y clasificación

- **TEST AUTOMATIZADO PASS**: pruebas Node con números reales del registro.
- **BUILD**: no verificado en entorno del asistente si falla por `vite: not found`.
- **QA LOCAL PASS**: solo con capturas/vídeo/logs del usuario.
- **APROBADO/CERRADO**: requiere decisión expresa y evidencia, sin cerrar por la mera existencia del código.

**Regresión del Gate (2026-10-27):** 22 CURVE PASS; regresión disponible 1521 PASS, 0 FAIL, 18 SKIP (excluido únicamente `test-starcat.mjs` por `ERR_MODULE_NOT_FOUND: three`). Intento global sin excluir: 1521 PASS, 1 FAIL de entorno, 18 SKIP. `npm run build` exit 127 (`vite: not found`). Editor/Player/GPU/Jolt/Godot **NO VERIFICADOS EN EJECUCIÓN**.

## Fuera de alcance

Laterales personalizados, barandas, variantes de escalera en espiral, escalado dinámico de geometría en Game Events y cambios de arquitectura general. La representación curvada exportada usa la ruta GLB y trimesh ya existentes; su funcionamiento final en Godot depende del QA local.
