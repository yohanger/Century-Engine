#!/usr/bin/env python3
"""S07 single integral gate QA: SOLID separation, geometry, distributed consumers, optional *real* Jolt.

--jolt requires installed JoltPhysics.js WASM 1.1.0 and is not satisfied by fake ABI tests.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import subprocess
import shutil
import sys
import zipfile
from verify_s01 import local_files,check_manifest,check_ledger
from verify_s02 import check_delta
from verify_s06 import read_gate

GATE='CENTURY-FLUIDS-S07-G001-INTEGRAL-FLUID-SURFACE-EXTRACTION'
REQUIRED={
    'src/fluids/water/index.ts','src/fluids/water/surface.ts','src/fluids/water/hydrodynamics.ts',
    'src/surface/index.ts','src/surface/mesh.ts','src/coupling/hydrodynamics.ts',
    'tests/surface_s07.test.mjs','tests/benchmark_surface.mjs',
    'docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md',
    'docs/17_S07_SURFACE_EXTRACTION_AND_QA.md','qa/verify_s07.py',
    'qa/S07_REVIEW.md','qa/S07_RUN.log','qa/MANIFEST.sha256','ledger/CENTURY_FLUIDS_LEDGER.xlsx',
}
def require(condition:bool,message:str)->None:
    if not condition:raise ValueError(message)
def run(root:Path,args:list[str])->None:
    print('QA_RUN',' '.join(args),flush=True)
    result=subprocess.run(args,cwd=root,check=False)
    require(result.returncode==0,'command failed exit=%s: %s'%(result.returncode,' '.join(args)))

def main()->int:
    p=argparse.ArgumentParser()
    p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
    p.add_argument('--static-only',action='store_true')
    p.add_argument('--jolt',action='store_true',help='Run JoltPhysics.js 1.1.0 WASM real; mandatory for full S07 acceptance')
    p.add_argument('--previous-baseline',type=Path)
    p.add_argument('--baseline',type=Path)
    p.add_argument('--change',type=Path)
    a=p.parse_args();root=a.project.resolve();files=local_files(root)
    require(REQUIRED<=set(files),'S07 files missing: '+str(sorted(REQUIRED-set(files))))
    check_manifest(files);check_ledger(root)
    require(read_gate(root,12)==GATE,'wrong S07 gate name in ledger')
    require(read_gate(root,11)=='CENTURY-FLUIDS-S06-G001-INTEGRAL-JOLT-BIDIRECTIONAL-COUPLING','S06 gate history changed')
    package=json.loads(files['package.json']);lock=json.loads(files['package-lock.json'])
    require(not package.get('dependencies'),'runtime dependencies were added to independent core')
    require(lock['packages']['']['devDependencies']==package['devDependencies'],'npm dev lock out of sync')
    require(package['exports']['./water']['import']=='./dist/fluids/water/index.js','water export missing')
    require(package['exports']['./surface']['import']=='./dist/surface/index.js','surface export missing')
    require(package['exports']['./adapters/jolt']['import']=='./dist/adapters/jolt.js','Jolt optional export removed')
    require('tests/benchmark_surface.mjs' in files,'historical surface benchmark file missing')
    for filename in ('src/config.ts','src/world.ts','src/liquid.ts','src/index.ts'):
        source=files[filename].decode()
        require('referenceWater' not in source,'water preset contaminates '+filename)
        require("from './fluids/water" not in source,'generic core imports water '+filename)
    for filename in ('src/surface/index.ts','src/surface/mesh.ts','src/spatial.ts','src/coupling/hydrodynamics.ts'):
        source=files[filename].decode()
        require(not any(term in source for term in ('from \'../fluids/water',"from '../../fluids/water",'from \'jolt-physics','from \'three','from \'century')),
                'core or surface imports host/water '+filename)
    require("from '../fluids/water" not in files['src/adapters/jolt.ts'].decode(), 'Jolt bridge imports water')
    require('new WaterHydrodynamics()' in files['tests/jolt-real/real_jolt.test.mjs'].decode(), 'Jolt real test must use explicit water policy')
    require('RATIFICADO' in files['docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md'].decode().upper(),
      'CF-CA-003 authority not declared ratified')
    require('WaterHydrodynamics' in files['src/fluids/water/index.ts'].decode(),'water policy not exposed')
    if any((a.previous_baseline,a.baseline,a.change)):
        require(all((a.previous_baseline,a.baseline,a.change)),'all ZIP arguments must be supplied')
        check_delta(a.previous_baseline,a.baseline,a.change,files)
    print(f'S07_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11 project={root.name}',flush=True)
    if a.static_only:return 0
    require(all(shutil.which(x) for x in ('node','npm')),'Node/npm unavailable')
    if a.jolt:
        require((root/'tests/jolt-real/node_modules/jolt-physics/package.json').is_file(),
          'S07_JOLT_WASM_BLOCKED: install with npm install --prefix tests/jolt-real --no-save --package-lock=false --ignore-scripts --no-audit --no-fund')
    for cmd in [['npm','run','qa'],['node','tests/verify_distribution.mjs'],['node','tests/run_vite_qa.mjs','--prepare-only'],
                ['node','tests/benchmark_particles.mjs'],['node','tests/benchmark_liquid.mjs'],
                ['node','tests/benchmark_boundaries.mjs'],['node','tests/benchmark_surface.mjs']]:
        run(root,cmd)
    print('S07_CORE_QA_PASS geometry + SOLID + package JS/TS + benchmarks; Jolt WASM not included in this status',flush=True)
    if a.jolt:
        run(root,['node','--test','tests/jolt-real/real_jolt.test.mjs'])
        print('S07_JOLT_WASM_QA_PASS real Jolt 1.1.0 with water policy after S07 separation',flush=True)
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except (OSError,ValueError,KeyError,zipfile.BadZipFile,json.JSONDecodeError) as e:
        print('S07_QA_FAIL:',e,file=sys.stderr);sys.exit(1)
