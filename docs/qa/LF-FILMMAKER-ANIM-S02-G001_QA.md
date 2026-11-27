# QA — LF-FILMMAKER-ANIM-S02-G001

**Fecha:** 2026-10-29  
**Fuente:** `LevelForge_FILMMAKER_ANIM_S01_G002_SOURCE_BASELINE.zip`.  
**Estado del Gate:** IMPLEMENTADO, **QA REAL PENDIENTE; NO CERRADO**.

## Pruebas automatizadas disponibles

```bash
node --test scripts/test-filmmaker-anim-s02-g001.mjs scripts/test-filmmaker-anim-s02-g001-runtime.mjs
```

**18/18 PASS**: 14 tests de esquema, persistencia, invalidación, historial, integración y seguridad; cuatro tests de ejecución del scheduler con world/Three de prueba. En ejecución combinada con tests de Filmmaker/encuadre: **79/79 PASS** (18 nuevos + 61 regresión). Ampliando la regresión a las pruebas del sistema físico de nodos y gameplay: **212 PASS, 0 FAIL, 1 SKIP** de 213 casos (Three.js no instalado). Log de la ejecución: `lf_film_anim_s02_g001_regression.log`.

Los tests de física sustituyen el Jolt WASM por un doble de pruebas; demuestran aislamiento, muestreo absoluto, cancelación, limpieza y restauración del overlay, **NO DEMUESTRAN gravedad/colisión/rebote real**. La prueba adicional de ZIP `.nfm` con JSZip y el `npm run build` no pudieron verificarse al faltar las dependencias en el entorno de ejecución. El intento de build devolvió `vite: not found` (exit 127).

## Verificación de producto exigida al usuario

1. En la versión local de LevelForge con dependencias instaladas, ejecutar `npm ci`, `npm run build`, `npm run filmmaker` y abrir una escena de prueba **preparada por el usuario**, con un vaso/malla bajo `RigidBody3D`, su `CollisionShape3D`, y un suelo `StaticBody3D` con forma; no se entrega ningún preset.
2. Comprobar **gravedad, contacto, impactos y rebotes** con Jolt WASM real. Confirmar que la simulación NO actúa sobre mallas decorativas sin nodos físicos; terreno no se incluye automáticamente.
3. Abrir Filmmaker, activar **Animar**, desplegar **Física**, definir duración entre 1/60 s y 30 s; pulsar **Simular**, verificar progreso; comprobar que las poses originales de escena no cambian.
4. Antes de Hornear, mover el cabezal adelante/atrás y previsualizar el borrador. Pulsar **Hornear** y comprobar que aparece una pista contextual de Física; guardar la película y volverla a abrir en `.nfm v4`.
5. Buscar un instante específico, retroceder, volver al mismo instante; verificar que el resultado visual es idéntico y que la simulación no se recalcula durante seek. Detener para restaurar Transform base.
6. Comprobar **Undo/Redo** de Hornear y Quitar bake, y que las pistas previas de animación manual, cámara, voz, efectos, texto y audio permanecen válidas.
7. Cambiar la escala, posición o CollisionShape3D del vaso y verificar estado **Bake desactualizado**; rehornear. Renombrar el nodo y comprobar que NO se invalida por el nombre.
8. Probar un proyecto con varios nodos físicos y padres transformados; confirmar que las muestras están en coordenadas locales correctas y nunca se corrompen las poses base.
9. Cancelar una simulación de duración larga, comprobar que no quedan efectos físicos activos, que la interfaz vuelve a un estado estable y que puede simularse de nuevo.
10. Comprobar límites: sin RigidBody3D válido se produce un error claro; más de 16 cuerpos o más de 30 segundos se rechazan; tiempos no alineados a 60 Hz se rechazan.
11. Verificar el diseño a 1440×900, 1280×720 y 1024×768; no debe desplazar el timeline ni superponer los docks.
12. En el Player normal, comprobar que los objetos NO horneados siguen funcionando; durante montaje válido no debe haber doble control del cuerpo horneado. Si se intenta importar una película física a Timeline de juego, debe mostrarse la protección de S02-G002.

## Evidencia pendiente

- [ ] `npm run build` PASS de la versión local.
- [ ] Jolt WASM real (gravedad, contacto, rebote, varias formas y jerarquías) PASS.
- [ ] `.nfm` real guardado, leído y validado mediante JSZip PASS.
- [ ] QA Electron de flujo Simular → previsualizar → Hornear → Undo/Redo → reabrir PASS.
- [ ] Capturas y observaciones en 1440×900, 1280×720, 1024×768.
- [ ] Aprobación expresa del usuario y conciliación del ledger para cierre.

**No declarar PASS de build, WASM Jolt o QA visual antes de ejecutarlos.**
