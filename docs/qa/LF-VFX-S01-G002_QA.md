# LF-VFX-S01-G002 — QA y trazabilidad

Fecha de entrega: 2026-10-28 (sesión). Gate autorizado exactamente mediante «Listo. LF-VFX-S01-G002 autoriza comenzar». Fuente: `LevelForge_VFX_S01_G001_SOURCE_BASELINE.zip` (1002 archivos, CRC verificado).

## Alcance aplicado

- Assets: crear, seleccionar, identificar, renombrar, mover, duplicar y eliminar recursos `.vfx`. No se abre un editor VFX incompleto al activarlo. Icono VFX integrado en `Icon.vue`.
- Importación de archivos `.vfx` individuales: JSON validado antes de mutar; ID nuevo y nombre único. Cuando requiere una textura no presente, rechaza y remite al paquete con dependencias.
- Eliminación de VFX o textura: buscar referencias exactas en la escena activa, escenas guardadas, prefabs, VFX y otras definiciones de recursos pertinentes; bloquear eliminaciones con usos encontrados. Se revisan usos antes del borrado de carpeta. No se modifica el sistema de eventos.
- `.levelpackage`: representar `.vfx` como contenido JSON canónico separado del índice; incluir referencias a texturas mediante cierre de dependencias sin duplicar archivos.
- Lectura y planificación de importación: admitir `vfx`, validar identidad entre manifiesto y cuerpo, remapear IDs/referencias, rechazar versión/valores inválidos y texturas ausentes. `state/project.js` incorpora el recurso `vfx` al resultado tras el commit atómico IndexedDB existente.
- Respeta Undo/Redo de las acciones individuales CRUD donde ya existía; la importación del paquete continúa deliberadamente excluida del historial de Undo.

## Evidencia automatizada

- `node --test scripts/test-vfx-assets-s01-g002.mjs`: **13/13 PASS**. Casos: VFX-P01..P07 (selección, empaquetado JSZip real, importación, colisiones, contenido corrupto, dependencias y rutas); VFX-C01..C05 (renombrar, mover, duplicar, referencias de prefab/escena guardada, borrado y retención de textura); VFX-I01 (API pública de commit IndexedDB simulado, incluido fallo con rollback de memoria).
- `node --test scripts/test-vfx-resource-s01-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs scripts/test-vfx-assets-s01-g002.mjs`: **63/63 PASS**, de los cuales 50 son regresión anterior (23 VFX G001 y 27 regresión general).
- Las funciones de serialización y planificación se ejecutan desde el código real y JSZip real. El host/editor/IndexedDB se aíslan mediante dobles exclusivamente durante el test.
- Fixture de textura `scripts/fixtures/vfx/white-original.png` de 1×1 px generado localmente para la prueba. Sin materiales descargados ni licencias de terceros.

## Estados (no confundir)

| Estado | Resultado |
|---|---|
| Gate autorizado | SÍ: autorización exacta del usuario |
| Código implementado | SÍ |
| Test automatizado | PASS, 63/63 incluidos regresión |
| Compilación de G002 | **NO VERIFICADA**: `npm ci` excedió límite y Vite no estaba disponible; `npm run build` terminó con `vite: not found`. El build local exitoso que entregó el usuario corresponde a G001. |
| QA local de G002 | **NO VERIFICADO** |
| Aprobación de G002 | PENDIENTE |
| Cierre de G002 / Sprint 01 | PENDIENTE |

G001: el usuario aprobó su entrega, envió 50/50 PASS, compilación Editor/Player PASS y confirmó que Electron abre. No se recibió evidencia de reabrir y guardar un proyecto existente, por lo que no se convierte en un QA completo retroactivo.

## QA obligatorio en máquina del usuario

1. Conservar fuente local y copia del ledger previos. Extraer CHANGE solo contra el baseline G001 coincidente; no sobreescribir personalizaciones locales sin comparar. `npm ci`, ejecutar batería combinada, `npm run build`, `npm run electron`.
2. En un proyecto de prueba: Assets → Crear → «Efecto VFX (.vfx)»; comprobar recurso visible con icono VFX. Renombrarlo y moverlo entre carpetas; duplicarlo y verificar que ambos tienen identidades distintas. Comprobar Undo/Redo de las operaciones.
3. Importar una textura propia a Assets y un `.vfx` de referencia con `textureId` válido, o usar el fixture del runner. Comprobar que un borrado de textura usada es rechazado y muestra el recurso VFX que la utiliza.
4. Exportar el VFX como `.levelpackage`; comprobar que incluye su textura una vez, previsualizar paquete, importar en otro proyecto de prueba. Confirmar reimportación con conflicto de nombre (renombrar y reutilizar textura), preservar ID remapeado y atributos VFX, guardar, cerrar y reabrir.
5. Provocar un paquete VFX inválido o referencia de textura no empaquetada en proyecto desechable; confirmar rechazo sin escribir parcialmente el proyecto.
6. Abrir proyecto previo sin VFX: escenas, prefabs, materiales, eventos y Player no deben sufrir cambios. No confundir compilar con QA de Editor/Player.

## Cambios/protecciones

No se tocaron `src/engine/runtime/events/`, SceneGraph, simulación, Player ni VFX editor. El nuevo icono se incorpora a Icon existente. La persistencia usa .lfproj + IndexedDB existentes, sin tablas ni administradores paralelos.

**Limitación documentada:** el test de `saveLevelPackageImport` llega al plan y a los datos previstos, pero no ejecuta una base IndexedDB real. Verificar el commit y la reapertura localmente. `npm ci` y compilación G002 deben ejecutarse en el entorno local del usuario.
