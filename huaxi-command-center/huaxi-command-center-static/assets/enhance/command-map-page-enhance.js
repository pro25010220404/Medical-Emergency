/**
 * 鍗忎綔涓夌淮鍦板浘锛氬叏灞?body.hx-page-map-only锛涙瑙堜笌鍏ㄥ睆鍏辩敤 #/
 */
;(function () {
  const FLAG = 'hx-page-map-only'
  let pendingMap = false

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function mapOnlyActive() {
    return document.body.classList.contains(FLAG)
  }

  function hasDashboard() {
    return !!document.querySelector('main.dashboard.screen, main.dashboard')
  }

  function goHomeHash() {
    const home = `${location.pathname}${location.search}#/`
    try {
      history.replaceState(history.state, '', home)
    } catch {
      location.hash = '#/'
    }
  }

  function syncSidebar() {
    window.dispatchEvent(new CustomEvent('hx-map-page', { detail: { active: mapOnlyActive() } }))
  }

  function setMapOnly(on) {
    document.body.classList.toggle(FLAG, !!on)
    window.dispatchEvent(new CustomEvent('hx-map-page', { detail: { active: !!on } }))
    syncSidebar()
    if (on) pulseMapLayout()
  }

  function leaveMapMode() {
    pendingMap = false
    document.body.classList.remove('hx-map-drawer-open')
    const bd = document.querySelector('.hx-map-drawer-backdrop')
    if (bd) bd.hidden = true
    document.querySelector('.hx-map-page-chrome')?.remove()
    clearMapBlockers()
    document.body.classList.remove(FLAG)
    document.body.classList.remove('hx-sidebar-map-view')
    window.dispatchEvent(new CustomEvent('hx-map-page', { detail: { active: false } }))
    if (path() === '/map') goHomeHash()
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }

  function clearMapBlockers() {
    document.querySelector('.dashboard-center .main-map')?.classList.remove('map-nodes-open')
    document.querySelectorAll('.dashboard-center .map-med-backdrop').forEach((el) => {
      el.remove()
    })
    const drawer = document.querySelector('.hx-map-drawer-backdrop')
    if (drawer) drawer.hidden = true
    document.body.classList.remove('hx-map-drawer-open')
  }

  function setMapDrawerOpen(open) {
    document.body.classList.toggle('hx-map-drawer-open', open)
    const bd = document.querySelector('.hx-map-drawer-backdrop')
    if (bd) bd.hidden = !open
  }

  function ensureMapPageChrome() {
    if (!mapOnlyActive()) {
      document.querySelector('.hx-map-page-chrome')?.remove()
      return
    }
    const mainMap = document.querySelector('.dashboard-center .main-map')
    if (!mainMap) return
    const host = mainMap.closest('.dashboard-center') || mainMap
    if (host.querySelector('.hx-map-page-chrome')) return

    if (!document.querySelector('.hx-map-drawer-backdrop')) {
      const backdrop = document.createElement('div')
      backdrop.className = 'hx-map-drawer-backdrop'
      backdrop.hidden = true
      backdrop.addEventListener('click', () => setMapDrawerOpen(false))
      document.body.appendChild(backdrop)
    }

    const chrome = document.createElement('div')
    chrome.className = 'hx-map-page-chrome'
    chrome.setAttribute('role', 'toolbar')
    chrome.innerHTML =
      '<div class="hx-map-chrome-left">' +
      '<button type="button" class="hx-map-chrome-btn" data-action="menu">鑿滃崟</button>' +
      '<button type="button" class="hx-map-chrome-btn" data-action="exit">杩斿洖姒傝</button>' +
      '</div>' +
      '<span class="hx-map-chrome-title">鍗忎綔涓夌淮鍦板浘</span>'
    host.appendChild(chrome)

    chrome.querySelector('[data-action="menu"]')?.addEventListener('click', () => {
      setMapDrawerOpen(!document.body.classList.contains('hx-map-drawer-open'))
    })
    chrome.querySelector('[data-action="exit"]')?.addEventListener('click', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      leaveMapMode()
    })
    document.querySelector('.hx-sidebar')?.addEventListener('click', (ev) => {
      if (ev.target instanceof Element && ev.target.closest('a')) setMapDrawerOpen(false)
    })
  }

  function pulseMapLayout() {
    ensureMapPageChrome()
    ;[0, 100, 250, 500, 900, 1400].forEach((ms) => {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
        window.dispatchEvent(new CustomEvent('hx-glb-map-layout'))
      }, ms)
    })
  }

  function enterMapChrome() {
    if (!hasDashboard()) {
      pendingMap = true
      if (path() === '/map') goHomeHash()
      else if (path() !== '/') location.hash = '#/'
      ensureHomeThenMap()
      return
    }
    pendingMap = false
    clearMapBlockers()

    /* 鍚屾鎵撲笂鍏ㄥ睆 class锛岄伩鍏?#/map 鈫?#/ 鏃?dashboard 琚晶鏍?CSS 璇殣钘?*/
    document.body.classList.add(FLAG)
    document.body.classList.add('hx-sidebar-home')
    document.body.classList.add('hx-sidebar-map-view')
    window.dispatchEvent(new CustomEvent('hx-map-page', { detail: { active: true } }))

    if (path() === '/map') goHomeHash()

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pulseMapLayout()
        window.dispatchEvent(new CustomEvent('hx-map-page', { detail: { active: true } }))
      })
    })
  }

  function ensureHomeThenMap() {
    if (!pendingMap) return
    if (hasDashboard()) {
      enterMapChrome()
      return
    }
    if (path() === '/map') goHomeHash()
    else if (path() !== '/') location.hash = '#/'

    window.hxEnhance?.(
      () => {
        if (!pendingMap) return
        if (hasDashboard()) enterMapChrome()
        else ensureHomeThenMap()
      },
      { wait: 200, afterNav: 250, observeRoot: true },
    )
  }

  function applyRoute() {
    const p = path()

    if (p === '/map') {
      pendingMap = true
      if (!hasDashboard()) {
        goHomeHash()
        ensureHomeThenMap()
        return
      }
      enterMapChrome()
      return
    }

    if (p === '/') {
      if (pendingMap) {
        ensureHomeThenMap()
        return
      }
      if (!mapOnlyActive()) {
        document.body.classList.remove(FLAG)
      }
      return
    }

    pendingMap = false
    if (mapOnlyActive()) leaveMapMode()
  }

  function isOverviewLink(a) {
    if (!a || a.tagName !== 'A') return false
    if (a.dataset?.navHref === '/map') return false
    if ((a.getAttribute('href') || '').includes('/map')) return false
    const nav = a.dataset?.navHref || ''
    if (nav === '/') return true
    const href = (a.getAttribute('href') || '').trim()
    return href === '#/' || href === '#'
  }

  function interceptMapNavClick(e) {
    const a =
      e.target &&
      e.target.closest &&
      e.target.closest('a[href="#/map"], a[href$="#/map"], a[data-nav-href="/map"]')
    if (!a) return
    e.preventDefault()
    e.stopPropagation()
    pendingMap = true
    if (path() === '/map') goHomeHash()
    if (hasDashboard() && (path() === '/' || path() === '')) {
      enterMapChrome()
      return
    }
    if (path() !== '/') location.hash = '#/'
    else ensureHomeThenMap()
  }

  function interceptOverviewNavClick(e) {
    const a = e.target && e.target.closest && e.target.closest('a')
    if (!a || !isOverviewLink(a)) return
    if (!mapOnlyActive()) return
    e.preventDefault()
    e.stopPropagation()
    leaveMapMode()
  }

  function interceptExitControl(e) {
    const btn =
      e.target &&
      e.target.closest &&
      e.target.closest('.hx-map-page-chrome [data-action="exit"]')
    if (!btn) return
    e.preventDefault()
    e.stopPropagation()
    leaveMapMode()
  }

  window.hxMapPage = {
    isActive: () => mapOnlyActive(),
    exit: leaveMapMode,
    enter: enterMapChrome,
  }

  document.addEventListener('click', interceptExitControl, true)
  document.addEventListener('click', interceptOverviewNavClick, true)
  document.addEventListener('click', interceptMapNavClick, true)
  window.addEventListener('hashchange', applyRoute)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyRoute)
  else applyRoute()
  window.hxEnhance?.(applyRoute, { wait: 320, observeRoot: true, afterNav: 150 })
})()
