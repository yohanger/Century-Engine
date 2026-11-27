#!/usr/bin/env python3
"""S09 CONT-001 checks beyond the existing S09 integral runner. No fake browser/WASM PASS."""
from __future__ import annotations
import argparse
from pathlib import Path
import subprocess
import sys
from verify_s09 import main as verify_s09_main
from verify_s01 import check_manifest,check_ledger,local_files

REQUIRED={
 'src/chunks.ts','src/surface/chunked.ts','tests/chunked_spatial_s09.test.mjs',
 'tests/benchmark_chunks.mjs','qa/S09_CONT001_RUN.log','qa/S09_CONT001_REVIEW.md',
 'docs/21_S09_CONT001_CHUNKED_VOXEL_ACTIVE_REGIONS.md','qa/verify_s09_cont001.py',
}
GATE='CENTURY-FLUIDS-S09-G001-CONT-001-CHUNKED-VOXEL-ACTIVE-REGIONS'
def run(cwd:Path,args:list[str])->None:
 print('CONT_QA_RUN',*args,flush=True)
 p=subprocess.run(args,cwd=cwd,check=False)
 if p.returncode:raise RuntimeError(f'QA failed exit={p.returncode}: {args}')
def main()->None:
 ap=argparse.ArgumentParser()
 ap.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--static-only',action='store_true')
 ap.add_argument('--jolt',action='store_true');ap.add_argument('--browser-build',action='store_true')
 a=ap.parse_args();root=a.project.resolve();files=local_files(root)
 if not REQUIRED<=set(files):raise RuntimeError(f'Missing CONT files: {sorted(REQUIRED-set(files))}')
 check_manifest(files);check_ledger(root)
 doc=files['docs/21_S09_CONT001_CHUNKED_VOXEL_ACTIVE_REGIONS.md'].decode()
 if GATE not in doc or 'NO ratific' not in doc or 'EN PAUSA' not in doc:raise RuntimeError('No gate authority or suspended integration documented')
 if not all(x in files['src/chunks.ts'].decode() for x in ('ChunkVoxelIndex','forEachNearby','forEachPair')):
  raise RuntimeError('No shared chunk index')
 if 'ChunkedSurfaceCache' not in files['playground/src/simulation.mjs'].decode():raise RuntimeError('Playground not consuming cache')
 if 'updateChunkSurfaces' not in files['playground/src/renderer.mjs'].decode():raise RuntimeError('Renderer not reusing chunks')
 print(f'S09_CONT001_STATIC_PASS files={len(files)} ledger_sheets=6 sprints=11 gates=11',flush=True)
 if a.static_only:return
 opts=['--project',str(root)]
 if a.jolt:opts.append('--jolt')
 if a.browser_build:opts.append('--browser-build')
 run(root,[sys.executable,'qa/verify_s09.py',*opts])
 run(root,['node','tests/benchmark_chunks.mjs'])
 print('S09_CONT001_AUTHOR_QA_PASS browser_GUI=NOT_VERIFIED solver_active_regions=NOT_IMPLEMENTED cf_ca005=RATIFIED_CONT002',flush=True)
if __name__=='__main__':
 try:main()
 except (RuntimeError,OSError,ValueError) as e:
  print('S09_CONT001_QA_FAIL',str(e),file=sys.stderr);sys.exit(1)
