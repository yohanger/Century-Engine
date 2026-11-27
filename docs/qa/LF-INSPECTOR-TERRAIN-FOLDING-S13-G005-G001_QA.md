# QA S13-G005-G001 · Inspector de Terreno

## Evidencia del entorno de preparación (no sustituye QA visual)

| Verificación | Resultado | Registro |
|---|---|---|
| Node focal nuevo | 17 PASS, 0 FAIL | `docs/qa/evidence/LF_S13_G005_G001_NODE_FOCAL.log` |
| Regresión Terrain/Folding | 144 PASS, 1 SKIP, 0 FAIL | `docs/qa/evidence/LF_S13_G005_G001_NODE_REGRESSION.log` |
| Regresión cruzada Escena/Primitivas/Terrain | 83 PASS, 1 SKIP, 0 FAIL | `docs/qa/evidence/LF_S13_G005_G001_NODE_CROSS.log` |
| Electron embebido | NO VERIFICADO: falta Vite | `docs/qa/evidence/LF_S13_G005_G001_ELECTRON_ENV.log` |
| Build Editor+Player | NO VERIFICADO: falta Vite | `docs/qa/evidence/LF_S13_G005_G001_BUILD_ENV.log` |
| QA visual y funcional del usuario | PENDIENTE | Usuario debe aportar resultado |

Los 2 SKIP son pruebas condicionadas al compilador Vue no instalado aquí. No son PASS. TER-INSP-12 requería una etiqueta `<h4>` supersedida por UX-03 y se adaptó sin quitar la aserción de montaje único.

## Comandos desde la raíz del proyecto (donde está `package.json`)

```bash
node --test scripts/test-inspector-terrain-folding-s13-g005-g001.mjs scripts/test-inspector-global-folding-s13-g002.mjs scripts/test-inspector-global-folding-s13-g002-corr001.mjs scripts/test-terrain-inspector-context-s04a-g001.mjs scripts/test-terrain-node-s01-g001.mjs scripts/test-terrain-node-s01-corr001.mjs scripts/test-terrain-transform-s02-g001.mjs scripts/test-terrain-extents-s03-g001.mjs scripts/test-inspector-node-spacing-s13-g011-g001.mjs
node --test scripts/test-inspector-terrain-folding-s13-g005-g001-electron.mjs
npm run build
npm run electron
```

**Esperado:** 144 PASS/1 SKIP de Node en entorno sin compilador; en entorno completo el SKIP puede pasar si la dependencia existe. Electron 1 PASS con **37/37 comprobaciones**, y build Editor/Player exitoso. No se acepta un recuento parcial como PASS.

## QA visual y funcional del usuario

1. Seleccionar un nodo Terrain desde el Editor, no la antigua pestaña; hay siete grupos y no se duplica el panel.
2. Contraer/abrir de forma independiente Piezas, Agua física, Pincel, Capas, Vegetación, Terrain Generator y Tamaño.
3. Usar Enter y Espacio sobre los encabezados; `aria-expanded` cambia. Escape no pliega.
4. Contraer Piezas oculta su contenido sin perder selección ni datos; al abrir recupera los mismos controles.
5. Alternar el ojo de Vegetación: cambia solo visibilidad, no abre/cierra el grupo.
6. Conservar la preferencia al seleccionar un cubo y regresar al nodo Terrain; las preferencias de otro tipo no se mezclan.
7. Mostrar aviso «Costa heredada» en Generador cuando corresponda y «Resolución alta» en Tamaño con más de 512 segmentos, incluso si sus cuerpos están cerrados.
8. Verificar pincel, pintura, agua, generador, tamaño y selección de piezas, sin pérdida de datos, bloqueo ni Undo/Redo espurio por plegado.
9. Probar panel estrecho/desacoplado, cerrar/reabrir Editor y confirmar persistencia de plegado.
10. Comprobar que los párrafos instructivos siguen presentes en este Gate; su retirada corresponde a G005-G002.

**Evidencia a devolver:** salidas completas de Node, Electron y build; evaluación de los diez criterios y capturas si se detecta solape. **Estado:** IMPLEMENTADO / NO APROBADO / NO CERRADO.
