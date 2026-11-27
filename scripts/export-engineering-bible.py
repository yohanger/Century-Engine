#!/usr/bin/env python3
"""Render the engineering pages from the existing offline portal into a PDF."""
import argparse
import html
import json
import re
from pathlib import Path
from weasyprint import HTML

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'docs/biblia/Biblia_Tecnica_Century.pdf')
args = parser.parse_args()
raw = (ROOT / 'public/docs/content.js').read_text(encoding='utf-8')
data = json.loads(raw.split('window.LEVELFORGE_DOCS = ', 1)[1].strip().removesuffix(';'))
pages = [p for p in data['pages'] if p['group'] == 'Biblia Técnica']
ids = {p['id'] for p in pages}
assert pages and len(ids) == len(pages)
css = '''
@page { size: A4; margin: 19mm 17mm 18mm;
 @top-left { content: "CENTURY ENGINE  /  BIBLIA TÉCNICA"; color: #496174; font-size: 8pt; }
 @top-right { content: "0.26.13"; color: #496174; font-size: 8pt; }
 @bottom-left { content: "Referencia de ingeniería · 24.11.2026"; color: #496174; font-size: 8pt; }
 @bottom-right { content: counter(page) " / " counter(pages); color: #496174; font-size: 8pt; }
}
@page cover { @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
* { box-sizing: border-box; }
body { font-family: "DejaVu Sans", sans-serif; font-size: 9pt; line-height: 1.42; color: #202c37; }
.cover { page: cover; break-after: page; padding-top: 65mm; border-top: 5pt solid #167d89; }
.cover h1 { font-size: 35pt; color: #142d42; line-height: 1.1; margin: 10mm 0 5mm; }
.cover .sub { font-size: 15pt; color: #496174; }
.cover .meta { margin-top: 33mm; border-top: 1pt solid #a5bac5; padding-top: 5mm; font-size: 11pt; }
section { break-before: page; }
h1 { font-size: 20pt; line-height: 1.17; color: #142d42; margin: 0 0 5mm; border-bottom: 1pt solid #167d89; padding-bottom: 3mm; }
h2 { font-size: 12pt; color: #126a75; margin: 5mm 0 2mm; overflow-wrap: anywhere; }
h3 { font-size: 10pt; color: #244860; }
h1,h2,h3 { break-after: avoid; }
p { margin: 2mm 0; orphans: 2; widows: 2; overflow-wrap: anywhere; }
a { color: #126a75; text-decoration: none; }
code,pre { font-family: "DejaVu Sans Mono", monospace; font-size: 8pt; }
code { overflow-wrap: anywhere; }
pre { white-space: pre-wrap; background: #eff4f6; padding: 3mm; border-left: 2pt solid #167d89; break-inside: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8pt; margin: 3mm 0; }
th { background: #23465b; color: white; text-align: left; }
th,td { padding: 1.5mm; border-bottom: .4pt solid #c5d3dc; vertical-align: top; overflow-wrap: anywhere; }
tr:nth-child(even) { background: #f1f5f7; }
tr { break-inside: avoid; }
li { margin: .65mm 0; overflow-wrap: anywhere; }
nav ul { list-style: none; padding-left: 0; }
nav li { border-bottom: .4pt solid #d9e2e7; padding: 1mm 0; }
nav a::after { content: leader('.') target-counter(attr(href),page); }
.source-note { color: #496174; font-size: 8pt; }
'''

def render_page(p):
    content = p['html']
    # Heading IDs are scoped in the web portal, but global in a PDF.
    content = re.sub(r' id="([^"]+)"', lambda m: ' id="'+p['id']+'--'+m[1]+'"', content)
    def link(m):
        dest = m[1].split('?', 1)[0]
        if dest in ids:
            return 'href="#'+dest+'"'
        return 'title="Referencia del portal: #/'+html.escape(m[1], quote=True)+'"'
    content = re.sub(r'href="#/([^\"]+)"', link, content)
    # The complete portal index is included on the contents page instead.
    if p is pages[0]:
        content = re.split(r'<h2[^>]*>Índice completo</h2>', content, maxsplit=1)[0]
    return '<section id="'+p['id']+'">'+content+'</section>'

cover = '<div class="cover"><div class="sub">REFERENCIA DE INGENIERÍA</div><h1>Century Engine<br>Biblia Técnica</h1><p class="sub">Arquitectura · Código fuente · Dependencias · Mapas de modificación</p><div class="meta">Versión 0.26.13<br>24 de noviembre de 2026<br>Edición trazada al SOURCE_BASELINE de entrada<br>Auditoría estática; ejecución no certificada</div></div>'
contents = '<section><h1>Índice</h1><nav><ul>'+''.join('<li><a href="#'+p['id']+'">'+html.escape(p['title'])+'</a></li>' for p in pages)+'</ul></nav></section>'
body = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Century Engine — Biblia Técnica</title><style>'+css+'</style></head><body>'+cover+contents+''.join(map(render_page,pages))+'</body></html>'
args.output.parent.mkdir(parents=True, exist_ok=True)
HTML(string=body, base_url=str(ROOT/'public/docs')).write_pdf(args.output)
print(f'{len(pages)} capítulos y páginas de inventario: {args.output}')
