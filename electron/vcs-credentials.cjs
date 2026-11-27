// Almacén de credenciales fuera del proyecto, cifrado con el almacén del sistema.
// En Linux basic_text no se persiste ningún secreto: solo token temporal por operación.
const fs=require('node:fs')
const path=require('node:path')
function createCredentialStore(safeStorage,userData) {
  const file=path.join(userData,'vcs-credentials.json')
  const available=()=>Boolean(safeStorage?.isEncryptionAvailable?.() && safeStorage?.getSelectedStorageBackend?.()!=='basic_text')
  const key=url=>new URL(url).host.toLowerCase()
  const read=()=>{try {const v=JSON.parse(fs.readFileSync(file,'utf8'));return v && typeof v==='object'?v:{}} catch{return {}}}
  const write=entries=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(entries),{mode:0o600});try{fs.chmodSync(file,0o600)}catch{}}
  return {
    available,
    has(url) {return available() && typeof read()[key(url)]==='string'},
    get(url) {if(!available()) return '';try{const v=read()[key(url)];return v?safeStorage.decryptString(Buffer.from(v,'base64')):''}catch{return ''}},
    save(url,token) {if(!available()) throw new Error('No existe almacenamiento cifrado seguro. Usa un token temporal para esta operación.');const entries=read();entries[key(url)]=safeStorage.encryptString(token).toString('base64');write(entries)},
    remove(url) {const entries=read();delete entries[key(url)];write(entries)}
  }
}
module.exports={createCredentialStore}
