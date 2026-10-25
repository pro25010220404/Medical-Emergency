/**
 * 下线独立「视频监控」页：侧栏已移除，旧链接重定向到重症监护。
 */
;(function () {
  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function redirectIfMonitoring() {
    if (path() !== '/monitoring') return
    const base = `${location.pathname}${location.search}`
    location.replace(`${base}#/critical`)
  }

  redirectIfMonitoring()
  window.addEventListener('hashchange', redirectIfMonitoring)

  document.addEventListener(
    'click',
    (e) => {
      const a = e.target.closest?.('a[href]')
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (!/\/monitoring(?:[?#]|$)/.test(href) && !href.includes('#/monitoring')) return
      e.preventDefault()
      e.stopPropagation()
      location.hash = '#/critical'
    },
    true,
  )
})()
