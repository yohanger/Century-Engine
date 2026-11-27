/** S09: reconcile the disposable npm-installed consumer with freshly packed library contents. */
import {readFile,lstat,rm} from 'node:fs/promises';
import {join} from 'node:path';

async function sameFile(source,installed){
  try{
    const [a,b]=await Promise.all([readFile(source),readFile(installed)]);
    return a.equals(b);
  }catch(error){
    if(error?.code==='ENOENT')return false;
    throw error;
  }
}

export async function packageIsCurrent(sourceRoot,installedRoot,packedFiles){
  if(!Array.isArray(packedFiles)||!packedFiles.includes('package.json')||!packedFiles.some(f=>f.startsWith('dist/')))
    throw Error('S09 invalid packed-file inventory');
  for(const relative of packedFiles){
    if(relative!=='package.json'&&!/^dist\/[a-zA-Z0-9_./-]+$/.test(relative))
      throw Error(`S09 unexpected packed path: ${relative}`);
    if(relative.split('/').includes('..'))throw Error('S09 unsafe packed-file path');
    if(!await sameFile(join(sourceRoot,relative),join(installedRoot,relative)))return false;
  }
  return true;
}

/** Only remove an obsolete generated npm package directory; preserve all other dependencies. */
export async function refreshInstalledPackage({sourceRoot,installedRoot,packedFiles,install}){
  if(await packageIsCurrent(sourceRoot,installedRoot,packedFiles))return false;
  let state;
  try{state=await lstat(installedRoot);}catch(error){if(error?.code!=='ENOENT')throw error;}
  if(state){
    if(!state.isDirectory()||state.isSymbolicLink())
      throw Error('S09 refuses to replace a non-directory or linked package');
    await rm(installedRoot,{recursive:true,force:false});
  }
  await install();
  if(!await packageIsCurrent(sourceRoot,installedRoot,packedFiles))
    throw Error('S09 installed library differs from the freshly packed tarball after reinstall');
  return true;
}
