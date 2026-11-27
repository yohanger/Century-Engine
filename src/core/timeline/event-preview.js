// Sesión de eventos del Editor. Reutiliza TimelineRunner, Game y el motor de audio
// originales; no altera el recurso ni ejecuta scripts/acciones persistentes.
import { TimelineRunner } from '../../engine/runtime/timeline/player.js'
import { Game } from '../../engine/runtime/events/interpreter.js'
import { getAudio } from '../../engine/runtime/audio/engine.js'
import { resolveAudioClip, resolveAudioGroup } from '../../engine/runtime/audio/config.js'

// Ningún bloque desconocido se ejecuta parcialmente: el intérprete original
// solo recibe árboles inspeccionados, sin compilación de expresiones arbitrarias.
const SAFE_CODES = new Set(['text', 'comment', 'switch', 'variable', 'if', 'match', 'weather'])
export function timelinePreviewCommandBlock(list, worldAvailable = false, depth = 0) {
  if (!Array.isArray(list) || depth > 12 || list.length > 512) return 'Lista inválida o demasiado profunda'
  for (const command of list) {
    const code = command?.code, p = command?.p || {}
    if (!SAFE_CODES.has(code)) return `Comando «${code || '(sin tipo)'}» no aislable en Preview`
    if (code === 'weather' && (!worldAvailable || p.wait === true && +p.seconds > 0))
      return 'Clima: no hay mundo reversible o la acción requiere una espera no aislable'
    if (code === 'variable' && ['script','signal'].includes(p.src)) return 'Variable: expresión o señal no aislable'
    if (code === 'if' && !['switch','variable','self'].includes(p.kind)) return 'Condición con dependencias externas no aislable'
    if (code === 'match' && !['variable','number','text','bool'].includes(p.src)) return 'Match con fuente externa no aislable'
    if (code === 'text' && p.voice) return 'Texto con voz/avance interactivo no aislable'
    for (const branch of Object.values(command?.b || {})) {
      const reason = timelinePreviewCommandBlock(branch, worldAvailable, depth + 1)
      if (reason) return reason
    }
  }
  return null
}

/** Restaura exclusivamente las variables que setWeather modifica; nunca los assets del proyecto. */
function hasWeather(list) {
  return (list || []).some(command => command.code === 'weather' ||
    Object.values(command.b || {}).some(branch => hasWeather(branch)))
}
function saveWeather(world) {
  if (!world?.setWeather || !world?.dir || !world.cur) return null
  return {
    preset:world.preset, intensity:world.intensity, forceWeather:world.forceWeather,
    cur:world.cur, fade:world._fade,
    director:{current:world.dir.current, busy:world.dir.busy, dwell:world.dir.dwell},
  }
}
function restoreWeather(world, saved, editor) {
  if (!world || !saved) return
  world.preset=saved.preset;world.intensity=saved.intensity;world.forceWeather=saved.forceWeather
  world.cur=saved.cur;world._fade=saved.fade
  if (world.dir) Object.assign(world.dir,saved.director)
  editor?.applyWorld?.();editor?.vp?.requestRender?.()
}

/** Una sola sesión por TimelinePanel; el Player conserva intacto su comportamiento. */
export class TimelineEventPreview {
  constructor({ getProject, getEditor = () => null, audioEngine = getAudio, onCaption = () => {}, onDialog = () => {}, onWarning = () => {}, onEnd = () => {} }) {
    this.getProject=getProject;this.getEditor=getEditor;this.audioEngine=audioEngine
    this.onCaption=onCaption;this.onDialog=onDialog;this.onWarning=onWarning;this.onEnd=onEnd
    this.runner=null;this.game=null;this.voices=new Set();this.warnings=new Set()
    this.weatherSnapshot=null;this.weatherWorld=null;this.token=0;this.active=false
    this.audioEpoch=0;this.audioGroupEpoch=new Map()
    this.time=0;this.paused=false
  }
  _warn(message) {
    if (this.warnings.has(message)) return
    this.warnings.add(message);this.onWarning(message)
  }
  _clearDialog() { this.onDialog(null); this.onCaption('') }
  _audioGroup(reference) {
    return resolveAudioGroup(this.getProject()?.audio, reference)
  }
  _audioStop(group=null,fade=0) {
    if(group) this.audioGroupEpoch.set(group,(this.audioGroupEpoch.get(group)||0)+1)
    else this.audioEpoch++
    for (const voice of [...this.voices]) {
      if (group && voice.group!==group) continue
      voice.instance.stop?.(fade)
      if (fade>0) voice.stopping=true
      else this.voices.delete(voice)
    }
  }
  async _playAudio(key, fromOffset=0) {
    if (!this.active) return
    const destination=this._audioGroup(key.group)
    if (destination.missing) this._warn(`Timeline: bus de audio ausente «${destination.reference}»; reproducción en SFX`)
    if (key.action === 'stop') {
      // No detener SFX ni todas las voces a causa de una referencia huérfana.
      if (!destination.missing) this._audioStop(key.group === 'sfx' && !key.clip ? null : destination.id,Math.max(0,key.fade||0))
      return
    }
    const project=this.getProject(),id=resolveAudioClip(project,key.clip)
    if (!id) {this._warn(`Audio no encontrado: ${key.clip || '(vacío)'}`);return}
    const group=destination.id,token=this.token,epoch=this.audioEpoch
    const groupEpoch=this.audioGroupEpoch.get(group)||0
    const cancelled=()=>!this.active || this.token!==token || this.audioEpoch!==epoch || (this.audioGroupEpoch.get(group)||0)!==groupEpoch
    // Usa la hora actual del Runner, no el tiempo del fotograma anterior del componente.
    const now=this.runner?.time ?? this.time, pitch=Math.max(.05,key.pitch||1)
    const elapsed=Math.max(0,now-key.t)
    const actualOffset=fromOffset > 0 ? fromOffset : elapsed*pitch
    const eng=this.audioEngine()
    try {
      await eng.ensure()
      if (cancelled()) return
      // Usa el mismo mezclador configurado por el Editor; no detener otras voces.
      const instance=await eng.play(id,{group,mode:'ui',volume:key.fadeIn>0?0:key.volume,pitch:key.pitch,loop:key.loop,fx:key.fx,offset:Math.max(0,(+key.offset||0)+actualOffset),volumeAutomation:key.volumeAutomation,automationElapsed:actualOffset/pitch})
      if (!instance) {this._warn(`Audio no decodificable: ${key.clip}`);return}
      if (cancelled()) {instance.stop();return}
      const voice={instance,group,key,deadline:key.duration>0?key.t+Math.max(0,key.duration-(key.fadeOut||0)):Infinity}
      this.voices.add(voice)
      if(key.fadeIn>0)instance.ramp?.(key.volume,Math.max(0,key.fadeIn-actualOffset/pitch),0)
      if(this.paused)instance.pause?.()
      instance.done?.then(()=>this.voices.delete(voice)).catch(error=>{if(this.active)this._warn(error?.message||String(error))})
    } catch(error) { if(this.token===token)this._warn(`Audio: ${error?.message||error}`) }
  }
  _commands(list,{name}={}) {
    const world=this.getEditor()?.world
    const reason=timelinePreviewCommandBlock(list,!!saveWeather(world))
    if(reason){this._warn(`${name||'Comandos'}: ${reason}`);return null}
    if (hasWeather(list) && !this.weatherSnapshot) {
      this.weatherWorld=world;this.weatherSnapshot=saveWeather(world)
    }
    return this.game.run(list,{name:`Preview: ${name||'Comandos'}`})
  }
  start(timeline, from=0) {
    this.stop()
    if(!timeline)return false
    this.token++;this.active=true;this.time=Math.max(0,Math.min(timeline.duration,from));this.paused=false;this.warnings.clear()
    const project=this.getProject()
    // Preparar los buses del proyecto aunque aún no se haya abierto el Mixer.
    this.audioEngine()?.configure?.(project?.audio)
    this.game=new Game({database:project?.database||{},localization:project?.localization,host:{
      world:this.getEditor()?.world||null,
      say:async message=>{
        if(!this.active)return
        this.onDialog({ speaker:message.speaker||'', text:message.text||'', pos:message.pos||'bottom', anim:message.anim||null })
        // Se conserva el callback anterior para consumidores de la sesión S11.
        this.onCaption(`${message.speaker?message.speaker+': ':''}${message.text||''}`)
      },
      error:(message,error)=>this._warn(`${message||'Comandos'}: ${error?.message||error||''}`),
    }})
    this.runner=new TimelineRunner(timeline,{
      eventsOnly:true,
      audio:key=>this._playAudio(key),
      commands:(list,ctx)=>this._commands(list,ctx),
      method:(node,method)=>this._warn(`Método ${node}.${method}(): no aislable en Preview`),
      error:error=>this._warn(error?.message||String(error)),
      camera:()=>{},letterbox:()=>{},interrupt:()=>{},
    },{from:this.time,onEnd:()=>{this._release();this.onEnd()}})
    this.runner.update(0)
    if(from>0)this._syncAudioAt(from)
    return this.active
  }
  _syncAudioAt(time) {
    const groups=new Map()
    for(const tr of this.runner?.tl.tracks||[])if(tr.kind==='audio'&&!tr.muted)for(const key of tr.keys||[])if(key.t<=time){
      const group=this._audioGroup(key.group).id,previous=groups.get(group)
      if(!previous||previous.t<=key.t)groups.set(group,key)
    }
    for(const key of groups.values())if(key.action==='play') {
      const elapsed=time-key.t
      if(key.duration>0 && elapsed>=key.duration)continue
      this._playAudio(key,elapsed*Math.max(.05,key.pitch||1))
    }
  }
  update(dt) {
    if(!this.active || !this.runner)return false
    const previous=this.runner.time
    this.runner.update(dt)
    this.time=this.runner.time
    if(this.active && this.time+1e-6<previous) {this._audioStop();this._clearDialog()}
    for(const voice of [...this.voices])if(!voice.stopping && this.time>=voice.deadline){
      const left = Math.max(0,voice.key.t+(voice.key.duration||0)-this.time)
      const fade=Math.min(Math.max(0,voice.key.fadeOut||0),left)
      voice.instance.stop?.(fade);voice.stopping=true
      // Mantener la voz hasta done: Stop puede interrumpir incluso un fundido pendiente.
      if(fade===0)this.voices.delete(voice)
    }
    return this.active
  }
  pause() {if(!this.active)return;this.paused=true;this.runner?.pause();for(const v of this.voices)v.instance.pause?.()}
  resume() {if(!this.active)return;this.paused=false;this.runner?.resume();for(const v of this.voices)v.instance.resume?.()}
  seek(time) {
    if(!this.active)return
    this.token++;this._audioStop();this._clearDialog()
    this.runner.seek(time);this.time=this.runner.time
    this._syncAudioAt(this.time)
  }
  _release() {
    if(!this.active)return
    this.active=false;this.token++;this._audioStop();this.game?.cancelAll();this.game?.closeOutput()
    restoreWeather(this.weatherWorld,this.weatherSnapshot,this.getEditor())
    this.weatherSnapshot=null;this.weatherWorld=null;this._clearDialog()
  }
  stop() {
    const runner=this.runner
    this._release()
    this.runner=null;this.game=null;this.paused=false
    if(runner&&!runner.finished)runner.stop()
  }
}
