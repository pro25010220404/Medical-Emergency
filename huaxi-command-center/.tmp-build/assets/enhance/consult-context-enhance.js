/**
 * 远程会诊页上下文（React 演示退避时用）：
 * - 侧栏「远程会诊」=#/consultations（全县）；「基层会诊」=?tab=grassroots（同页基层视角）
 * - 正式环境由 consult-workbench-enhance 接管，本脚本仅补 dispatch 任务条 / 演示 Tab
 * - 「返回实时出警」在 nav.subnav 右侧
 */
;(function () {
  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function query() {
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    return new URLSearchParams(q)
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function consultTab() {
    const q = query()
    if (q.get('scope') === 'grassroots' || q.get('tab') === 'grassroots') return 'grassroots'
    return 'all'
  }

  function migrateLegacyGrassrootsUrl() {
    if (path() !== '/consultations') return
    const q = query()
    if (q.get('scope') !== 'grassroots') return
    const next = new URLSearchParams(q)
    next.delete('scope')
    next.set('tab', 'grassroots')
    const qs = next.toString()
    location.replace(`${location.pathname}${location.search}#/consultations${qs ? `?${qs}` : ''}`)
  }

  migrateLegacyGrassrootsUrl()

  /** 把返回按钮挂到子导航最右侧（margin-left:auto 由样式控制） */
  function ensureNavBack(label, href) {
    const subnav = document.querySelector('nav.subnav')
    if (!subnav) return
    let el = document.getElementById('hx-nav-back')
    if (!el) {
      el = document.createElement('a')
      el.id = 'hx-nav-back'
      el.className = 'hx-nav-back'
      subnav.appendChild(el)
    }
    const abs = (() => {
      try {
        return new URL(href, location.origin).href
      } catch {
        return href
      }
    })()
    if (el.getAttribute('href') !== abs) el.setAttribute('href', abs)
    if (el.textContent !== label) el.textContent = label
  }

  function removeNavBack() {
    document.getElementById('hx-nav-back')?.remove()
  }

  function isConsultModule() {
    var p = path()
    return p === '/consultations' || p.indexOf('/consultations/') === 0
  }

  function syncConsultHeading(tab) {
    const h1 = document.querySelector('main.workspace .workspace-heading h1')
    if (!h1) return
    const next = tab === 'grassroots' ? '基层会诊' : '远程会诊'
    if ((h1.textContent || '').trim() !== next) h1.textContent = next
  }

  function renderConsultTabs() {
    document.getElementById('hx-consult-mode')?.remove()
    if (!isConsultModule() || path() === '/consultations/pick') return
    const tab = consultTab()
    document.body.classList.toggle('hx-consult-scope-grassroots', tab === 'grassroots')
    document.body.classList.toggle('hx-consult-scope-all', tab !== 'grassroots')
    syncConsultHeading(tab)
    if (!document.body.classList.contains('hx-cw-active')) {
      window.__hxConsultApplyScope?.()
    }
  }

  function renderDispatchStrip() {
    if (!isConsultModule()) {
      document.getElementById('hx-consult-context')?.remove()
      removeNavBack()
      return
    }
    const q = query()
    const task = q.get('task') || ''
    const plate = q.get('plate') || ''
    const complaint = q.get('complaint') || ''

    if (!task && !plate) {
      document.getElementById('hx-consult-context')?.remove()
      removeNavBack()
      return
    }

    ensureNavBack('返回实时出警', '/dispatch.html#live')

    const host = document.querySelector('.workspace') || document.querySelector('main')
    if (!host) return
    let box = document.getElementById('hx-consult-context')
    if (!box) {
      box = document.createElement('div')
      box.id = 'hx-consult-context'
      box.className = 'hx-care-dock'
      const anchor = host.querySelector('.workspace-heading, h1')
      if (anchor && anchor.parentElement) anchor.parentElement.insertAdjacentElement('afterend', box)
      else host.insertBefore(box, host.firstChild)
    }
    const html = `<div class="hx-strip"><span class="hx-care-meta">任务 ${esc(task || '—')} · ${esc(plate)} · ${esc(complaint)}</span></div>`
    if (box.dataset.body === html) return
    box.dataset.body = html
    box.innerHTML = html
  }

  function render() {
    if (!isConsultModule()) {
      document.getElementById('hx-consult-context')?.remove()
      document.getElementById('hx-consult-mode')?.remove()
      removeNavBack()
      return
    }
    renderConsultTabs()
    renderDispatchStrip()
  }

  window.addEventListener('hashchange', migrateLegacyGrassrootsUrl)
  window.hxEnhance(render, { wait: 350, observeRoot: true, afterNav: 80 })
})()
