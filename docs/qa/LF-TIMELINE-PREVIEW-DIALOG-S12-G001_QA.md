# QA — LF-TIMELINE-PREVIEW-DIALOG-S12-G001-INTEGRAL

## Estados a 2026-11-07

- AUTORIZADO: usuario «Listo. LF-TIMELINE-PREVIEW-DIALOG-S12-G001-INTEGRAL autoriza comenzar».
- IMPLEMENTADO EN FUENTES: sí.
- Node específico: 10 PASS / 0 FAIL.
- Node compatible: 123 PASS / 4 SKIP / 0 FAIL.
- Node ampliado: 123 PASS / 4 SKIP / 1 FAIL de importación (`vue` no instalado).
- Electron embebido: NO VERIFICADO; falla por `Falta Vite` ANTES de iniciar la fixture.
- Compilación Editor y Player: NO VERIFICADA, `vite: not found`.
- QA LOCAL: PENDIENTE. APROBADO: NO. CERRADO: NO.

## Pruebas en entorno del usuario (en raíz `package.json`)

1. `node --test scripts/test-timeline-preview-dialog-s12-g001.mjs` → esperado 10 PASS.
2. `node --test scripts/test-timeline-preview-dialog-s12-g001-electron.mjs` → esperado 1 PASS y por lo menos 17 comprobaciones.
3. `npm run build` → se requieren compilación Editor y Player, salida de exit 0.
4. `npm run electron` → usar el Electron embebido.

## QA visual funcional

1. Abrir un proyecto con un Timeline y comando `Mostrar texto`, posición arriba/centro/abajo y animación; reproducir Preview. El diálogo debe dibujarse dentro del viewport, no en la parte inferior del Timeline.
2. Comprobar tema y Canvas propio del proyecto si existe y los códigos de color y formato del texto. Confirmar que la caja antigua `Vista previa · Mensaje` desapareció.
3. Pausar/continuar: la escritura se detiene/reanuda con el reloj. Cambiar entre pestañas y seleccionar clips: la sesión se conserva.
4. Seek y Stop eliminan el diálogo; volver a Play no deja mensajes residuales.
5. Un comando no aislable (script, saveGame, voice) sigue bloqueado con advertencia. El script de Canvas personalizado NO debe ejecutarse durante Preview.
6. Jugar de forma normal y comprobar que la interfaz de diálogos del Player no ha cambiado.
7. Confirmar tanto en modo PC como laptop, y enviar capturas del viewport y las salidas de Node, Electron, build.

No declarar PASS Electron/compilación/QA sin esos resultados. Si falla una de las pruebas, crear CORR con auditoría de evidencia.

## Evidencias

- `evidence/LF_S12_G001_NODE_FOCAL.log`
- `evidence/LF_S12_G001_NODE_REGRESSION.log`
- `evidence/LF_S12_G001_NODE_EXTENDED.log`
- `evidence/LF_S12_G001_ELECTRON_ENV.log`
- `evidence/LF_S12_G001_BUILD_ENV.log`

## Continuidad

S12-G002 Audio Trim/Duration, S12-G003 Zoom/Waveform, S12-G004 Menú/Iconos y S12-G005 Selector de recursos: solo planificados, no autorizados. S11-G007 y tooltips globales permanecen planificados por separado. FX de clip aprobado en G005 no se eliminó; retirada requiere decisión contractual explícita.
