#!/usr/bin/env python3
"""CONT-004: verify evidence without claiming that boundary-pressure coupling is corrected."""
from __future__ import annotations
import argparse
from pathlib import Path
import subprocess
import sys
from verify_s01 import check_manifest,check_ledger,local_files
REQUIRED={
 'src/liquid.ts','tests/convergence_diagnostics_s09.test.mjs',
 'tests/characterize_convergence.mjs',
 'docs/26_S09_CONT004_SPH_CONVERGENCE_AND_BOUNDARY_COUPLING.md',
 'qa/S09_CONT004_REVIEW.md','qa/S09_CONT004_RUN.log','qa/verify_s09_cont004.py',
}
def run(root,command):
 print('S09_CONT004_QA_RUN',' '.join(command),flush=True)
 return_code=subprocess.run(command,cwd=root,check=False).returncode
 if return_code:raise RuntimeError(f'QA exit={return_code}: {command}')
def main():
 p=argparse.ArgumentParser()
 p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
 p.add_argument('--static-only',action='store_true')
 p.add_argument('--jolt',action='store_true')
 p.add_argument('--browser-build',action='store_true')
 a=p.parse_args();root=a.project.resolve();files=local_files(root)
 if not REQUIRED<=files.keys():raise RuntimeError(f'missing CONT004 files: {sorted(REQUIRED-files.keys())}')
 check_manifest(files);check_ledger(root)
 doc=files['docs/26_S09_CONT004_SPH_CONVERGENCE_AND_BOUNDARY_COUPLING.md'].decode('utf8')
 assert 'autoriza comenzar' in doc and 'EN PAUSA' in doc and 'NO IMPLEMENTADA' in doc
 assert 'onNumericalTrace' in files['src/liquid.ts'].decode('utf8')
 assert 'resolveContacts' in files['src/liquid.ts'].decode('utf8')
 print(f'S09_CONT004_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11',flush=True)
 if a.static_only:return
 flags=['--project',str(root)]
 if a.jolt:flags.append('--jolt')
 if a.browser_build:flags.append('--browser-build')
 run(root,[sys.executable,'qa/verify_s09_cont003.py',*flags])
 run(root,['node','tests/characterize_convergence.mjs'])
 print('S09_CONT004_DIAGNOSTIC_QA_PASS historical_diagnosis=PRESERVED current_coupling=SEE_CONT005 browser_GUI=NOT_VERIFIED',flush=True)
if __name__=='__main__':
 try:main()
 except (RuntimeError,AssertionError,OSError,ValueError) as error:
  print('S09_CONT004_QA_FAIL',error,file=sys.stderr);sys.exit(1)
