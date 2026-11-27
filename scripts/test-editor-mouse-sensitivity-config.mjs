import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
const config=createRequire(import.meta.url)('../electron/editor-config.cjs')
test('TOML conserva valores antiguos, valida límites y persiste sensibilidad al reabrir',t=>{
 const dir=mkdtempSync(join(tmpdir(),'ce-prefs-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'editor.toml');writeFileSync(file,'[mouse]\norbit = 1.5 # conservar\n\n[plugin]\nenabled = true\n')
 const old=config.loadEditorConfig(file);assert.equal(old.prefs.mouseSensitivity,1);assert.equal(old.prefs.mouseOrbit,1.5);assert.ok(old.missingPrefs.includes('mouseSensitivity'))
 const saved=config.saveEditorPreferences(file,{mouseSensitivity:.35});assert.equal(saved.prefs.mouseSensitivity,.35);assert.equal(config.loadEditorConfig(file).prefs.mouseSensitivity,.35);assert.equal(config.loadEditorConfig(file).prefs.mouseOrbit,1.5);assert.match(readFileSync(file,'utf8'),/orbit = 1.5 # conservar/);assert.match(readFileSync(file,'utf8'),/\[plugin\]\nenabled = true/);for(const v of [.09,3.01,NaN,Infinity])assert.throws(()=>config.saveEditorPreferences(file,{mouseSensitivity:v}),/mouse\.sensitivity/);assert.equal(config.loadEditorConfig(file).prefs.mouseSensitivity,.35)
})
