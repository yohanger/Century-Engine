import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(new URL('../'+p,import.meta.url),'utf8')
const project=read('src/core/project.js'), panel=read('src/components/ProjectPanel.vue'), fs=read('src/core/state/filesystem.js'), prefs=read('src/core/state/state.js')
test('S03-01 · nuevas carpetas iniciales mínimas',()=>assert.match(project,/DEFAULT_FOLDERS = \['Assets', 'Assets\/Scenes'\]/))
test('S03-02 · proyectos antiguos conservan rutas',()=>{assert.match(project,/for \(const e of allEntries\(meta\)\)/);assert.match(project,/addFolderChain\(meta, e.folder\)/)})
test('S03-03 · importación respeta carpeta seleccionada',()=>assert.match(fs,/const dest = base\s*\n/))
test('S03-04 · importModels sin carpetas vacías forzadas',()=>assert.match(fs,/importModels = \(files\) => importFiles\(files, ROOT_FOLDER\)/))
test('S03-05 · vista lista predeterminada y cuadrícula opcional',()=>{assert.match(prefs,/projView: 'list'/);assert.match(panel,/viewMode === 'grid'/);assert.match(panel,/viewMode === 'list'/)})
test('S03-06 · ordenación por nombre y tipo',()=>{assert.match(prefs,/projSort: 'name'/);assert.match(panel,/sortMode\.value === 'type'/)})
test('S03-07 · selector, menú contextual y DnD conservados',()=>{for(const token of ['@dragstart="dragStart($event, it)"','@contextmenu="itemMenu($event, it)"','@dblclick.stop="dblOpen(it)"','@drop="drop($event, folder)"'])assert.ok(panel.includes(token),token)})
test('S03-08 · renombrado y scripts conservados',()=>{assert.match(panel,/startRename\(\{ kind: 'script'/);assert.match(panel,/scriptRenameId/)})
test('S03-09 · navegación de carpetas y búsqueda conservadas',()=>{assert.match(panel,/const crumbs = computed/);assert.match(panel,/function goto\(path\)/);assert.match(panel,/v-model="filter"/)})
test('S03-10 · vista compacta sin tarjetas de miniatura ficticia',()=>{assert.match(panel,/\.grid\.asset-list/);assert.match(panel,/\.asset-list \.tile/);assert.match(panel,/it\.kind === 'texture' && urls\[it\.id\]/)})
