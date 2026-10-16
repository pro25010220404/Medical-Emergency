/**
 * 120 院前工作台：主站 #/dispatch → /dispatch.html#live；?hub=ambulances → #ambulances
 * 保留 ?legacy=1 或 localStorage huaxi-dispatch-legacy=1 可留在 app.html#/dispatch。
 */
;(function () {
  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function hashQuery() {
    const raw = location.hash.replace(/^#/, '')
    return new URLSearchParams(raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '')
  }

  function legacyMode() {
    if (hashQuery().get('legacy') === '1') return true
    try {
      return localStorage.getItem('huaxi-dispatch-legacy') === '1'
    } catch {
      return false
    }
  }

  function integratedSpa() {
    return window.hxIntegratedNav?.integratedSpa?.() === true
  }

  function redirectToHub() {
    if (legacyMode()) return
    if (integratedSpa()) {
      const q = hashQuery()
      if (path() === '/dispatch' && q.get('hub') === 'ambulances') {
        location.replace(`${location.pathname}${location.search}#/ambulances`)
      }
      return
    }
    const p = path()
    const isOldDispatch = p === '/dispatch'
    const isWrongHtmlHash = p === '/dispatch.html'
    if (!isOldDispatch && !isWrongHtmlHash) return

    const q = hashQuery()
    const hub = q.get('hub')
    if (hub === 'ambulances') {
      location.replace('/dispatch.html#ambulances')
      return
    }
    const qs = q.toString()
    location.replace(qs ? `/dispatch.html#live?${qs}` : '/dispatch.html#live')
  }

  function mount() {
    document.getElementById('huaxi-dispatch-subnav')?.remove()
    redirectToHub()
  }

  window.addEventListener('hashchange', mount)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
})()
