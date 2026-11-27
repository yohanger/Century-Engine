# LF-OPENCODE-CONFIG-G001 — Configuración controlada de OpenCode

**Autorización exacta:** `Listo. LF-OPENCODE-CONFIG-G001 autoriza comenzar` (25/10/2026).

## Contrato y alcance

Adaptar la personalización mediante tres archivos funcionales: `~/.config/opencode/AGENTS.md` (global), `AGENTS.md` (LevelForge) y `opencode.json` (LevelForge). Se incorpora este QA y se actualiza el ledger. No se cambia ningún archivo de producción ni dependencias.

**Fuente:** `LevelForge_RENDER_CAMERA_G001_SOURCE_BASELINE.zip` (707 entradas). El defecto pendiente de cámara continúa pendiente: esta entrega no afirma haberlo corregido.

## Qué contiene cada ZIP

`LF-OPENCODE-CONFIG-G001_CHANGE.zip`:

```text
project/AGENTS.md
project/opencode.json
project/docs/qa/LF-OPENCODE-CONFIG-G001_QA.md
project/docs/qa/LevelForge_DB_Ledger.xlsx
global/AGENTS.md
```

`project/` representa la raíz `$HOME/ENGINES/lf-0.26.13/lf`. `global/AGENTS.md` va a `$HOME/.config/opencode/AGENTS.md`, **nunca al proyecto**.

`LevelForge_OPENCODE_CONFIG_G001_SOURCE_BASELINE.zip` contiene el código fuente **completo** con el `AGENTS.md`, `opencode.json`, QA y ledger nuevos en raíz (sin prefijo `project/`). La configuración global no forma parte del código de LevelForge; conservar CHANGE como copia de ella.

## Instalación conservadora en Linux

1. Cerrar OpenCode. Descargar ambos ZIP en `~/Downloads`.
2. Preparar una carpeta temporal, **sin extraer directamente sobre LevelForge**:

   ```bash
   mkdir -p "$HOME/Downloads/LF-OPENCODE-CONFIG-G001_stage"
   unzip -n "$HOME/Downloads/LF-OPENCODE-CONFIG-G001_CHANGE.zip" -d "$HOME/Downloads/LF-OPENCODE-CONFIG-G001_stage"
   P="$HOME/ENGINES/lf-0.26.13/lf"
   S="$HOME/Downloads/LF-OPENCODE-CONFIG-G001_stage"
   test -f "$P/package.json"
   ```

3. Antes de copiar, revisar `AGENTS.md`, `opencode.json` y `~/.config/opencode/AGENTS.md` existentes. Si alguno existe, comparar **cada par** con `diff -u` y preservar tus versiones propias. No realizar sobrescritura automática.
4. Cuando hayas conciliado los conflictos (o confirmado que las rutas no existían), instalar los archivos **sin reemplazar versiones existentes**:

   ```bash
   mkdir -p "$HOME/.config/opencode"
   cp -n "$S/global/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"
   cp -n "$S/project/AGENTS.md" "$P/AGENTS.md"
   cp -n "$S/project/opencode.json" "$P/opencode.json"
   cp -n "$S/project/docs/qa/LF-OPENCODE-CONFIG-G001_QA.md" "$P/docs/qa/LF-OPENCODE-CONFIG-G001_QA.md"
   ```

5. **Ledger:** comparar `docs/qa/LevelForge_DB_Ledger.xlsx` local con el baseline anterior. Copiar el libro actualizado de CHANGE **solo si no hay cambios locales adicionales**; si los hay, integrar las nuevas filas preservando el resto. No usar `cp -f` a ciegas.
6. Comprobar sintaxis de la configuración y abrir el proyecto:

   ```bash
   python3 -m json.tool "$P/opencode.json" > /dev/null
   cd "$P"
   opencode
   ```

7. Seleccionar **Plan** y solicitar una auditoría de solo lectura sin Gate. Debe bloquear modificaciones y comandos Bash. No usar `opencode --auto`.
8. Para un **futuro Gate autorizado exactamente**, el usuario puede cambiar temporalmente `permission.edit` en el archivo de `"deny"` a `"ask"`, cerrar y abrir OpenCode y trabajar con **Build**. `agent.plan.permission.edit` debe seguir en `"deny"`. Al finalizar, restaurar `"deny"`. OpenCode no debe modificar su propia barrera.
9. `permission.bash = "ask"`: un comando puede **modificar archivos si se aprueba**. Revisar cada permiso; no autorizar `always` a comandos de riesgo. El acceso externo (`Downloads`, etc.) queda `deny`; cambiar a `ask` solamente de manera temporal y explícita cuando el Gate lo requiera.

## QA exigido

- [ ] Dos `AGENTS.md` instalados en las ubicaciones correctas, sin sobrescribir personalizaciones.
- [ ] `opencode.json` válido según `python3 -m json.tool`.
- [ ] En Plan se puede leer y auditar, pero no editar ni ejecutar Bash.
- [ ] Antes de Gate exacto Build no puede editar (`edit: deny`).
- [ ] Comandos Bash requieren aprobación individual.
- [ ] Acceso fuera del proyecto bloqueado por defecto.
- [ ] Archivos `.env`, llaves privadas y credenciales no se leen automáticamente.
- [ ] Tras otro Gate, el usuario verifica autorización temporal `edit: ask` y restaura `deny` al finalizar.
- [ ] No hay cambios en runtime, Editor ni Player.
- [ ] El proyecto conserva todo el baseline y las seis hojas del ledger.

## Evidencias del Gate

- Archivos de configuración: **GENERADOS**.
- JSON: **SINTAXIS PASS**, validada con Python estándar.
- Correspondencia y ausencia de cambios de producción: **VERIFICACIÓN ESTÁTICA PASS** cuando se comparan los ZIP.
- OpenCode instalado en tu máquina / interpretación efectiva de permisos: **NO VERIFICADO**.
- Builds, Editor y Player: **NO EJECUTADOS** (no aplican cambios de producción).
- QA local: **PENDIENTE**. Gate no cerrado sin aprobación posterior.

Referencias oficiales: https://opencode.ai/docs/rules/ ; https://opencode.ai/docs/permissions/ ; https://opencode.ai/docs/config/ ; https://opencode.ai/docs/agents/ .
