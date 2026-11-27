/* Century Docs. Portal autónomo: sin fetch, servidor, dependencias de red ni framework. */
(() => {
  'use strict'
  const data = window.LEVELFORGE_DOCS || { pages: [], groups: [] }
  const pages = data.pages
  const byId = new Map(pages.map(p => [p.id, p]))
  const $ = id => document.getElementById(id)
  const clean = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const route = (id, heading = '') => '#/' + encodeURIComponent(id) + (heading ? '?section=' + encodeURIComponent(heading) : '')
  function currentRoute () {
    const raw = (location.hash || '#/inicio').replace(/^#\//, '')
    const [id, qs] = raw.split('?')
    const section = new URLSearchParams(qs || '').get('section') || ''
    return { id: decodeURIComponent(id || 'inicio'), section }
  }
  function nav () {
    $('nav').innerHTML = data.groups.map(group => {
      const entries = pages.filter(p => p.group === group)
      if (!entries.length) return ''
      const core = ['Introducción','Editor y escenas','Scripting','Eventos','Sistemas del motor'].includes(group)
      return `<details class="nav-group" data-group="${esc(group)}" ${core?'open':''}><summary class="nav-group-title">${esc(group)} <span class="group-count">${entries.length}</span></summary><div class="nav-items">${entries.map(p=>`<a class="nav-link" href="${route(p.id)}" data-id="${esc(p.id)}">${esc(p.title)}</a>`).join('')}</div></details>`
    }).join('')
  }
  function closeNav () { $('sidebar').classList.remove('open'); $('scrim').hidden = true; $('toggleNav').setAttribute('aria-expanded','false') }
  function openNav () { $('sidebar').classList.add('open'); $('scrim').hidden = false; $('toggleNav').setAttribute('aria-expanded','true') }
  function show () {
    const r = currentRoute(), p = byId.get(r.id) || byId.get('inicio') || pages[0]
    if (!p) { $('article').textContent = 'No existe contenido publicado.'; return }
    document.title = p.title + ' — Century Docs'
    $('article').innerHTML = p.html
    $('crumbs').innerHTML = `<span>Documentación</span><span>${esc(p.group)}</span><span>${esc(p.title)}</span>`
    document.querySelectorAll('.nav-link').forEach(a => { a.classList.toggle('active', a.dataset.id === p.id); if (a.dataset.id === p.id) { a.setAttribute('aria-current','page'); a.closest('details')?.setAttribute('open','') } else a.removeAttribute('aria-current') })
    $('toc').innerHTML = p.toc.map(h => `<a class="level-${h.level}" href="${route(p.id,h.id)}">${esc(h.title)}</a>`).join('') || '<span style="font-size:12px;color:var(--muted)">Sin subsecciones</span>'
    const ix = pages.findIndex(x => x.id === p.id)
    $('pageFoot').innerHTML = `${ix>0?`<a href="${route(pages[ix-1].id)}">← ${esc(pages[ix-1].title)}</a>`:'<span></span>'}${ix<pages.length-1?`<a href="${route(pages[ix+1].id)}">${esc(pages[ix+1].title)} →</a>`:''}`
    document.querySelectorAll('#article pre').forEach(pre => {
      const holder = document.createElement('div'); holder.className = 'codewrap'; pre.parentNode.insertBefore(holder, pre); holder.append(pre)
      const btn = document.createElement('button'); btn.className = 'copycode'; btn.textContent='Copiar'; btn.setAttribute('aria-label','Copiar fragmento de código'); holder.append(btn)
      btn.addEventListener('click', async () => { const code = pre.innerText; try { await navigator.clipboard.writeText(code); btn.textContent = 'Copiado' } catch { const s=window.getSelection(),range=document.createRange();range.selectNodeContents(pre);s.removeAllRanges();s.addRange(range);btn.textContent='Seleccionado' } setTimeout(()=>btn.textContent='Copiar',1300) })
    })
    closeNav()
    requestAnimationFrame(() => {
      if (r.section) { const target = document.getElementById(r.section); if (target) { target.scrollIntoView({block:'start'}); return } }
      window.scrollTo(0,0); $('main').scrollTop=0
    })
  }
  let matches=[],active=0, lastFocus=null
  const searchOverlay=$('searchOverlay'), searchInput=$('searchInput')
  function find(q) {
    const terms = clean(q.trim()).split(/\s+/).filter(Boolean)
    if (!terms.length) return []
    return pages.map(p => {
      const title=clean(p.title), summary=clean(p.summary), body=clean(p.search)
      let score=0
      for (const term of terms) {
        if (!title.includes(term) && !summary.includes(term) && !body.includes(term) && !clean(p.group).includes(term)) return null
        score += title.includes(term)?45:0;score += summary.includes(term)?12:0;score += clean(p.group).includes(term)?5:0;score += Math.min(body.split(term).length-1,4)
      }
      return {p,score}
    }).filter(Boolean).sort((a,b)=>b.score-a.score||a.p.title.localeCompare(b.p.title)).slice(0,55)
  }
  function searchRender() {
    matches = find(searchInput.value); active=0
    $('searchMeta').textContent = searchInput.value.trim()? `${matches.length} resultado${matches.length===1?'':'s'}` : 'Escribe para buscar en toda la documentación.'
    $('searchResults').innerHTML = matches.map(({p},i) => `<button class="result ${i===0?'selected':''}" role="option" aria-selected="${i===0}" data-index="${i}"><span class="result-title">${esc(p.title)}</span><span class="result-meta">${esc(p.group)}</span><span class="result-description">${esc(p.summary||'Referencia de Century')}</span></button>`).join('') || (searchInput.value.trim()?'<p style="padding:16px;color:var(--muted)">Sin resultados. Prueba otro término o el nombre de una función.</p>':'')
  }
  function selectResult(delta) {
    if (!matches.length) return
    active=(active+delta+matches.length)%matches.length
    document.querySelectorAll('.result').forEach((b,i)=>{ b.classList.toggle('selected',i===active); b.setAttribute('aria-selected',String(i===active)) })
    $('searchResults').querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'})
  }
  function closeSearch() { searchOverlay.hidden=true; document.body.style.overflow='';lastFocus?.focus?.() }
  function openSearch() { lastFocus=document.activeElement;searchOverlay.hidden=false;document.body.style.overflow='hidden';searchInput.value='';searchRender();searchInput.focus() }
  $('openSearch').addEventListener('click',openSearch); $('closeSearch').addEventListener('click',closeSearch)
  searchOverlay.addEventListener('click',e=>{if(e.target===searchOverlay)closeSearch()})
  $('searchResults').addEventListener('click',e=>{const button=e.target.closest('[data-index]');if(!button)return;location.hash=route(matches[Number(button.dataset.index)].p.id);closeSearch();show()})
  searchInput.addEventListener('input',searchRender)
  searchInput.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();selectResult(1)}else if(e.key==='ArrowUp'){e.preventDefault();selectResult(-1)}else if(e.key==='Enter'&&matches[active]){location.hash=route(matches[active].p.id);closeSearch();show()}})
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'||(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName))){e.preventDefault();openSearch()}else if(e.key==='Escape'){if(!searchOverlay.hidden)closeSearch();else closeNav()}})
  const preferDark = matchMedia('(prefers-color-scheme: dark)').matches
  let savedTheme;try{savedTheme=localStorage.getItem('lf-docs-theme')}catch{}
  const setTheme=t=>{document.documentElement.dataset.theme=t;try{localStorage.setItem('lf-docs-theme',t)}catch{}}
  setTheme(savedTheme==='dark'||savedTheme==='light'?savedTheme:(preferDark?'dark':'light'))
  $('themeButton').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'))
  $('toggleNav').addEventListener('click',openNav);$('closeNav').addEventListener('click',closeNav);$('scrim').addEventListener('click',closeNav)
  window.addEventListener('hashchange',show)
  nav();show()
})()
