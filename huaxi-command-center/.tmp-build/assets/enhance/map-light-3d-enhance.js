/**
 * 首页 3D 地图：黑白灰主题容器（WebGL 配色见 index bundle + mapTheme light）
 */
;(function () {
  function onHome() {
    const hash = (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
    if (hash === '/map' || document.body.classList.contains('hx-page-map-only')) return true
    return hash === '/' || hash === ''
  }

  function layoutMap() {
    const mainMap = document.querySelector('.dashboard-center .main-map')
    const stage = mainMap?.querySelector('.map-stage')
    if (!mainMap || !stage) return
    window.dispatchEvent(new Event('resize'))
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }

  function tick() {
    const mainMap = document.querySelector('.dashboard-center .main-map')
    if (!mainMap) return
    const home = onHome()
    mainMap.classList.toggle('hx-map-light-3d', home)
    if (home) layoutMap()
  }

  window.addEventListener('hashchange', () => setTimeout(tick, 80))
  window.addEventListener('hx-map-page', () => setTimeout(tick, 50))
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick)
  else tick()
  window.hxEnhance?.(tick, { wait: 400, observeRoot: true, afterNav: 100 })
})()
