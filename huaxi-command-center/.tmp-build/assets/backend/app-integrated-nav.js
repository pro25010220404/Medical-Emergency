/**
 * 主站 app.html SPA：院前四页走 hash 路由，不跳 dispatch.html（除非 legacy）
 */
;(function () {
  function legacyMode() {
    try {
      if (localStorage.getItem('huaxi-dispatch-legacy') === '1') return true
    } catch {
      /* ignore */
    }
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    return new URLSearchParams(q).get('legacy') === '1'
  }

  function integratedSpa() {
    if (legacyMode()) return false
    try {
      if (localStorage.getItem('huaxi-integrated-nav') === '1') return true
    } catch {
      /* ignore */
    }
    if (document.body.classList.contains('hx-sidebar-shell')) return true
    const path = (location.pathname || '').replace(/\\/g, '/')
    if (path.endsWith('/dispatch.html')) return false
    if (document.getElementById('root')) return true
    return false
  }

  function normalizeHash(href) {
    let h = String(href || '').trim()
    if (window.hxConsultEpisodeNav?.normalizeHash) {
      h = window.hxConsultEpisodeNav.normalizeHash(h) || h
    }
    if (h.indexOf('/#/') === 0) h = h.slice(1)
    if (!h.startsWith('#')) h = h.startsWith('/') ? `#${h}` : `#/${h}`
    return h
  }

  function hashPath() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function hashQuery() {
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    return new URLSearchParams(q)
  }

  function hrefMatchesTarget(aHref, targetHash) {
    const t = normalizeHash(targetHash)
    const raw = String(aHref || '').trim()
    if (!raw) return false
    const a = raw.indexOf('/#/') === 0 ? raw.slice(1) : raw.startsWith('#') ? raw : `#${raw.startsWith('/') ? raw : `/${raw}`}`
    if (a === t) return true
    const aPath = a.replace(/^#/, '').split('?')[0] || '/'
    const tPath = t.replace(/^#/, '').split('?')[0] || '/'
    if (aPath !== tPath) return false
    const tq = t.includes('?') ? t.slice(t.indexOf('?') + 1) : ''
    if (!tq) return true
    const want = new URLSearchParams(tq)
    const got = new URLSearchParams(a.includes('?') ? a.slice(a.indexOf('?') + 1) : '')
    for (const [k, v] of want.entries()) {
      if (got.get(k) !== v) return false
    }
    return true
  }

  function fireClick(el) {
    if (!el) return false
    el.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }),
    )
    return true
  }

  /** 触发 React HashRouter 内 subnav / 顶栏模块 的 Link */
  function clickReactHashLink(targetHash) {
    const t = normalizeHash(targetHash)
    const pathOnly = t.replace(/^#/, '').split('?')[0] || '/'
    const selectors = [
      'nav.subnav > a',
      'nav.filter-bar[aria-label="模块二级导航"] a',
      'header .main-nav[aria-label="五个业务模块"] a',
    ]
    for (const sel of selectors) {
      for (const a of document.querySelectorAll(sel)) {
        if (hrefMatchesTarget(a.getAttribute('href') || '', t)) {
          return fireClick(a)
        }
      }
    }
    if (pathOnly.startsWith('/critical')) {
      for (const a of document.querySelectorAll('header .main-nav[aria-label="五个业务模块"] a')) {
        if ((a.textContent || '').includes('重症')) {
          fireClick(a)
          return true
        }
      }
    }
    return false
  }

  function mainMatchesHash() {
    const p = hashPath()
    const q = hashQuery()
    if (p.startsWith('/critical')) return !!document.querySelector('main.critical-screen.screen')
    if (p === '/warning' && q.get('view') === 'departments') {
      return !!document.querySelector('main.department-overview.screen')
    }
    if (p === '/warning') return !!document.querySelector('main.warning-screen.screen')
    if (p === '/' || p === '') return !!document.querySelector('main.dashboard.screen')
    return true
  }

  function ensureMainForHash(targetHash) {
    const want = normalizeHash(targetHash)
    if (location.hash !== want) location.hash = want
    if (mainMatchesHash()) return
    clickReactHashLink(want)
    if (!mainMatchesHash()) {
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
  }

  /** 侧栏/顶栏改 hash 时同步 React HashRouter */
  function spaGo(href) {
    const h = normalizeHash(href)
    if (!h) return
    clickReactHashLink(h)
    ensureMainForHash(h)
    window.setTimeout(() => {
      if (location.hash !== h) location.hash = h
      if (!mainMatchesHash()) clickReactHashLink(h)
    }, 120)
  }

  window.hxIntegratedNav = { integratedSpa, legacyMode, spaGo, normalizeHash }

  if (document.getElementById('root') && !legacyMode()) {
    try {
      localStorage.setItem('huaxi-integrated-nav', '1')
    } catch {
      /* ignore */
    }
  }

  window.addEventListener('hashchange', () => {
    window.setTimeout(() => {
      if (!mainMatchesHash()) clickReactHashLink(location.hash || '#/')
    }, 80)
  })
})()
