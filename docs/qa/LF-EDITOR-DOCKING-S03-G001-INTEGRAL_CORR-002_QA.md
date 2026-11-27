# S03 CORR-002 — QA de Jerarquía, Inspector y drop de paneles

**Gate:** `LF-EDITOR-DOCKING-S03-G001-INTEGRAL` (no se crea otro Gate). **Estado de entrega CORR-002 (histórico):** IMPLEMENTADO / QA LOCAL PENDIENTE / NO APROBADO. **Estado vigente tras QA usuario 2026-11-03:** APROBADO / CERRADO. Ver CLOSE.

## Observado por el usuario

Captura del 2026-11-03: Jerarquía en dock izquierdo sin árbol, Inspector arriba a la derecha vacío y Señales bajo él funcional. El usuario informa además que las propiedades de escena se muestran sin seleccionar Escena y que reacoplar al área del Inspector a veces es difícil. No atribuir pérdida de datos ni un fallo definitivo de Vue sin nueva evidencia runtime.

## Cambios CORR-002

- `DockPanelBank.vue`: reactividad específica de paneles activos; una instancia por panel; destinos Teleport resueltos a elementos DOM existentes tras `nextTick`, con host oculto de respaldo.
- `Inspector.vue`, `SceneTree.vue`, `core/state/objects.js`: escena solo con selección explícita, estado sin selección accesible y selección normal de nodos intacta.
- `DockTree.vue`: captura de drop de paneles antes de controles anidados; barra de pestañas conserva unión en el mismo espacio; Assets y recursos usan sus eventos originales.
- Suite S03 y fixture Electron ampliados. CA-003 y ledger actualizados.

## Comandos de prueba

```bash
node --test scripts/test-editor-docking-s03-g001-integral.mjs scripts/test-editor-windows-layout-corr-g001.mjs
node --test scripts/test-editor-docking-s03-g001-integral-electron.mjs
npm run build
npm run electron
```

**Node focal verificado aquí:** 88/88 PASS. **Regresión adicional seleccionada:** 136/136 PASS. **Electron CORR-002 y build CORR-002:** NO VERIFICADOS localmente en el entorno de entrega, por dependencias ausentes; no declarar PASS. Fixture Electron: **44** comprobaciones mínimas.

## QA manual obligatorio

1. Abrir un proyecto con al menos dos nodos. La pestaña Jerarquía muestra la raíz Escena y sus nodos. Cambiar a Proyecto, regresar y comprobar que el árbol sigue visible.
2. Arrastrar Jerarquía al encabezado de Inspector y volverla a su zona; ambos paneles deben conservar contenido, sin pestañas vacías ni contenido duplicado.
3. Crear una división en el dock derecho con Inspector y Señales. Alternarlos, mover Inspector entre ambos grupos y repetir con Play maximizado y vuelta al Editor.
4. Sin seleccionar objetos ni Escena, Inspector debe mostrar «Selecciona un nodo en la escena o en el árbol para editarlo», no el panel de ajustes de Escena.
5. Hacer clic explícitamente en la raíz Escena de Jerarquía: debe mostrarse su inspector. Seleccionar un Cubo: debe mostrarse Inspector de Cubo. Deseleccionar: vuelve al estado vacío.
6. Arrastrar una pestaña sobre el encabezado de Inspector y sobre el centro de su contenido, incluso donde hay un control de recursos. Debe acoplarse en la misma región con pestañas. Solo el borde estrecho divide.
7. Arrastrar un asset a un control de recursos del Inspector y verificar que su drop sigue funcionando; no debe provocar docking de paneles.
8. Desacoplar y reacoplar Inspector, Jerarquía y Señales. Reiniciar Electron; el layout y la selección de contenidos deben restaurarse sin cuadros superpuestos ni destinos invisibles.
9. Verificar Shift+A, gizmos S02, Signals y Project; el viewport sigue estructuralmente fijo. La advertencia de Git embebido visible en la captura es independiente de este Gate, no se corrige ni se considera PASS aquí.

**Evidencia a devolver:** salida de test Electron (44 verificaciones), cierre de build y confirmación visual o captura del caso fallido. Si algún caso falla, S03 sigue NO APROBADO.

**Regresión ampliada con Inspector:** 162/164 PASS en CORR-002, frente a 156/158 en CORR-001, con los mismos dos fallos históricos `S02-16` y `SCENE-09` (ambos preexistentes). No confundir con incidencia de S03.

## Resultado posterior del QA del usuario — 2026-11-03

Node S03+geometría 88/88 PASS; Electron DOM Vue 44/44 PASS (sin GPU); build Editor 826 y Player 414 módulos PASS, según `Texto pegado(20261103-132813).txt` aportado por el usuario. Después, el usuario declaró «Aprobado», lo que constituye QA LOCAL PASS declarado para este Gate. **Estado vigente: APROBADO y CERRADO**, preservando pruebas históricas que fallaron en versiones anteriores. No hay evidencia de AppImage/DEB ni test GPU.
