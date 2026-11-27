#!/usr/bin/env python3
"""Pre-GitHub repository hygiene QA. No physics changes or false browser claims."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import subprocess
import sys
from verify_s01 import local_files, check_manifest, check_ledger

PUBLIC_SCRIPTS={'typecheck','build','prepack','test','qa','playground'}
OLD=('qa:s05','qa:s06:wasm','qa:s09:prepare','qa:s09:build','qa:vite:prepare',
     'qa:vite','qa:browser:legacy','benchmark:s02','benchmark:s03','benchmark:s04',
     'benchmark:s09:regional','benchmark:s09:integral','qa:s07:benchmark')

def run(root,cmd):
 print('REPOSITORY_CLEANUP_RUN',' '.join(cmd),flush=True)
 proc=subprocess.run(cmd,cwd=root,check=False)
 if proc.returncode:raise ValueError(f'QA command failed exit={proc.returncode}: {cmd}')

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
 parser.add_argument('--static-only',action='store_true')
 parser.add_argument('--jolt',action='store_true')
 parser.add_argument('--browser-build',action='store_true')
 args=parser.parse_args();root=args.project.resolve()
 files=local_files(root)
 check_manifest(files);check_ledger(root)
 for file in ('.gitignore','.gitattributes','docs/29_S09_CONT005_GITHUB_REPOSITORY_CLEANUP.md',
              'tests/repository_hygiene.test.mjs','qa/verify_repository_cleanup.py'):
  if file not in files:raise ValueError(f'missing repository file: {file}')
 pkg=json.loads(files['package.json']);lock=json.loads(files['package-lock.json'])
 if set(pkg['scripts'])!=PUBLIC_SCRIPTS:raise ValueError(f'wrong npm scripts: {sorted(pkg["scripts"])}')
 if any(name in pkg['scripts'] for name in OLD):raise ValueError('obsolete npm alias retained')
 if pkg.get('dependencies'):raise ValueError('runtime host dependency leaked into core')
 if not pkg.get('private') or pkg.get('license')!='UNLICENSED':raise ValueError('unapproved publication/licensing change')
 if lock['packages']['']['devDependencies']!=pkg['devDependencies']:raise ValueError('npm lock not synchronized')
 for fn in ['qa/verify_s02.py','qa/verify_s03.py','qa/verify_s04.py','qa/verify_s05.py',
            'qa/verify_s06.py','qa/verify_s07.py','qa/verify_s09.py']:
  content=files[fn].decode('utf8')
  if any(x in content for x in OLD):raise ValueError(f'deleted npm alias referenced: {fn}')
 for word in ('node_modules/','dist/','playground/.local/','*.tgz','*.zip'):
  if word not in files['.gitignore'].decode():raise ValueError(f'ignore missing: {word}')
 print(f'REPOSITORY_CLEANUP_STATIC_PASS files={len(files)} scripts={len(pkg["scripts"])} ledger=6 sprints=11 gates=11',flush=True)
 if args.static_only:return
 run(root,['npm','run','qa'])
 run(root,['node','tests/verify_distribution.mjs'])
 run(root,['node','tests/run_vite_qa.mjs','--prepare-only'])
 run(root,['node','tests/run_playground.mjs','--prepare-only'])
 if args.jolt:
  if not (root/'tests/jolt-real/node_modules/jolt-physics/package.json').is_file():
   raise ValueError('real Jolt WASM dependency missing: install tests/jolt-real separately')
  run(root,['node','--test','tests/jolt-real/real_jolt.test.mjs'])
 if args.browser_build:run(root,['node','tests/run_playground.mjs','--build'])
 print('REPOSITORY_CLEANUP_QA_PASS JOLT='+('PASS' if args.jolt else 'NOT_VERIFIED')+
       ' VITE='+('PASS' if args.browser_build else 'NOT_VERIFIED')+' GUI=NOT_VERIFIED',flush=True)

if __name__=='__main__':
 try:main()
 except (OSError,ValueError,KeyError) as error:
  print('REPOSITORY_CLEANUP_QA_FAIL:',error,file=sys.stderr);sys.exit(1)
