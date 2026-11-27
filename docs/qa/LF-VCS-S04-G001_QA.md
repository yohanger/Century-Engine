# LF-VCS-S04-G001 — Evidencia y aceptación

**Estado:** IMPLEMENTADO · NO CERRADO (QA gráfico/Windows/AppImage pendiente).

## Ejecutado en este entorno (Linux, Node.js)

- `npm run vcs:test`: 35/35 PASS, 0 FAIL, 0 SKIP (8 pruebas nuevas, 27 heredadas).
- `node --test scripts/test-editor-distribution-g001.mjs`: 35/35 PASS.
- `npm run dist:verify`: PASS en modo SOURCE, sin inspeccionar ejecutables empaquetados.
- `node --check` de JS/CJS/MJS afectados: PASS.
- Git real local: repo inicial → Push → Clone → otro commit → Push → Fetch → preparar y aplicar Pull → restauración desde backup. PASS con binario Git incluido.
- Transporte HTTPS: servidor Git smart HTTP local bajo TLS, token temporal Basic, certificado CA de test; Fetch con Git y helper embebidos y PATH sin Git del sistema. PASS. Este servidor se ejecutó durante la prueba y no se distribuye.
- `npm run build`: NO EJECUTABLE (`vite: not found`, dependencias de desarrollo no instaladas en este contenedor). **No es PASS**.

## QA requerido para cierre contractual

1. `npm ci`, `npm run vcs:test` y `npm run build` en Linux y Windows.
2. Abrir Editor y Player: sin regresiones; panel «Versiones → Remoto» responsive a 1440x900, 1280x720, 1024x768.
3. AppImage/DEB sin Git del sistema: Init/Commit/Push/Fetch/Pull/Clone por HTTPS, usando auxiliares incluidos; comprobar bibliotecas dinámicas.
4. Windows Setup/Portable: MinGit empaquetado completo (incluidos helper HTTPS y CA) y operaciones funcionales sin Git instalado.
5. Configurar origin en repositorio real, guardar token cifrado solo con backend seguro; probar ausencia de almacén seguro y «Olvidar credencial».
6. Fetch nunca cambia archivos; Pull con árbol sucio o divergencia se bloquea; Pull fast-forward se confirma y vuelve a cargar `project.lfproj` e IndexedDB.
7. Provocar error de recarga y ejecutar recuperación desde copia respaldada; verificar escenas, scripts, assets y nodo seleccionado.
8. Clonar en carpeta vacía, impedir sobreescritura de archivos existentes y rechazar una fuente sin `project.lfproj`.
9. Red y seguridad: 401, 403, token revocado, certificado TLS inválido, DNS caído, enlace simbólico malicioso, repository path malformada, salida excesiva y timeout.
10. Revisión legal del binario Git, helper y bibliotecas dinámicas antes de publicación general.

La aceptación del Gate exige QA del usuario; las pruebas automatizadas no sustituyen el resultado de Electron y los instaladores.
