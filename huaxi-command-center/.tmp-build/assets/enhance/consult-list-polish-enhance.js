/**
 * 远程会诊列表页：科室待接诊队列卡片化、接诊操作区结构化（不改 React 业务逻辑）
 */
;(function () {
  let uid = 0

  const GRASSROOTS_SOURCE_HINTS = [
    '船石',
    '连界',
    '神界',
    '村卫生',
    '镇卫生',
    '新场镇',
    'chuanshi',
    'lianjie',
  ]

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function consultScopeTab() {
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    const params = new URLSearchParams(q)
    if (params.get('scope') === 'grassroots' || params.get('tab') === 'grassroots') return 'grassroots'
    return 'all'
  }

  function isConsultList() {
    return path() === '/consultations'
  }

  function isGrassrootsCard(art) {
    const text = (art.textContent || '').replace(/\s+/g, ' ')
    return GRASSROOTS_SOURCE_HINTS.some((k) => text.includes(k))
  }

  function ensureScopeEmpty(main) {
    let el = document.getElementById('hx-consult-scope-empty')
    if (!el) {
      el = document.createElement('p')
      el.id = 'hx-consult-scope-empty'
      el.className = 'hx-consult-scope-empty'
      el.hidden = true
      const mode = document.getElementById('hx-consult-mode')
      if (mode && mode.parentElement === main) mode.insertAdjacentElement('afterend', el)
      else main.querySelector('.consultation-grid')?.insertAdjacentElement('afterbegin', el)
    }
    return el
  }

  function clearScopeFilterArtifacts() {
    document.getElementById('hx-consult-scope-empty')?.remove()
    document.querySelectorAll('.consultation-queue article.hx-consult-scope-hidden').forEach((a) => {
      a.classList.remove('hx-consult-scope-hidden')
    })
    document.querySelectorAll('.consultation-queue.hx-consult-scope-section-empty').forEach((s) => {
      s.classList.remove('hx-consult-scope-section-empty')
    })
  }

  function applyConsultScopeFilter() {
    if (!isConsultList() || document.body.classList.contains('hx-cw-active')) {
      clearScopeFilterArtifacts()
      return
    }
    // 远程会诊 p2：React 科室待接诊卡片，不做基层筛条
    if (consultScopeTab() !== 'grassroots') {
      clearScopeFilterArtifacts()
      document.body.classList.remove('hx-consult-scope-grassroots')
      document.body.classList.add('hx-consult-scope-all')
      return
    }

    const tab = consultScopeTab()
    document.body.classList.toggle('hx-consult-scope-grassroots', tab === 'grassroots')
    document.body.classList.toggle('hx-consult-scope-all', tab === 'all')

    const articles = document.querySelectorAll('.consultation-queue article')
    let visible = 0
    articles.forEach((art) => {
      const grass = isGrassrootsCard(art)
      const show = tab === 'grassroots' ? grass : !grass
      art.classList.toggle('hx-consult-scope-hidden', !show)
      if (show) visible += 1
    })

    document.querySelectorAll('.consultation-queue').forEach((section) => {
      const any = section.querySelector('article:not(.hx-consult-scope-hidden)')
      section.classList.toggle('hx-consult-scope-section-empty', !any)
    })

    const main = document.querySelector('main.workspace')
    const empty = main ? ensureScopeEmpty(main) : null
    if (empty) {
      const showEmpty = articles.length > 0 && visible === 0
      empty.hidden = !showEmpty
      empty.textContent =
        tab === 'grassroots'
          ? '当前没有乡镇/村卫生室发起的待办；可切换「全县会诊」查看院前与县域队列。'
          : '当前队列均为基层上转条目；请点「基层上转」查看。'
    }
  }

  window.__hxConsultApplyScope = applyConsultScopeFilter

  function wrapQueueList(section) {
    let list = section.querySelector('.hx-consult-queue-list')
    const loose = [...section.querySelectorAll(':scope > article')]
    if (!list) {
      if (!loose.length) return
      list = document.createElement('div')
      list.className = 'hx-consult-queue-list'
      loose[0].insertAdjacentElement('beforebegin', list)
      loose.forEach((a) => list.appendChild(a))
      return
    }
    loose.forEach((a) => list.appendChild(a))
  }

  function polishArticle(art) {
    art.classList.add('hx-consult-queue-card')
    if (art.querySelector('.hx-consult-admit-actions')) return

    const sel = art.querySelector('select')
    const btn = art.querySelector('button.primary')
    if (!sel && !btn) return

    const smalls = [...art.querySelectorAll(':scope > small')]
    const applicant = smalls[smalls.length - 1]
    if (applicant) applicant.classList.add('hx-consult-applicant')

    const wrap = document.createElement('div')
    wrap.className = 'hx-consult-admit-actions'

    const insertBeforeNode = sel || btn
    if (!insertBeforeNode || !insertBeforeNode.parentElement) return

    if (sel) {
      const label = document.createElement('label')
      label.className = 'hx-consult-admit-label'
      label.textContent = '接诊医生'
      if (!sel.id) {
        uid += 1
        sel.id = `hx-consult-doc-${uid}`
      }
      label.setAttribute('for', sel.id)
      wrap.appendChild(label)
    }

    // 先把 wrap 插进 article，再移入控件（原先先移 select 会导致 wrap 挂到 detached 子树，按钮点不动）
    art.insertBefore(wrap, insertBeforeNode)
    if (sel) wrap.appendChild(sel)
    if (btn) wrap.appendChild(btn)
  }

  function render() {
    const on = isConsultList()
    document.body.classList.toggle('hx-consult-page', on)
    if (!on) return

    const main = document.querySelector('main.workspace')
    main?.classList.toggle('hx-consult-workspace', true)

    document.querySelectorAll('.consultation-queue').forEach((section) => {
      section.querySelectorAll('article').forEach(polishArticle)
      wrapQueueList(section)
    })
    applyConsultScopeFilter()
  }

  window.hxEnhance(render, { wait: 280, observeRoot: true, afterNav: 80 })
  window.addEventListener('hashchange', applyConsultScopeFilter)
})()
