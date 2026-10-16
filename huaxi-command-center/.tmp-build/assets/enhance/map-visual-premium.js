/**
 * 首页 3D 地图 — Dribbble 风：玻璃容器 + 地图上方丁达尔光（叠在 canvas 上，非仅背景色）
 */
;(function () {
  function ensureLightfield(mainMap) {
    if (mainMap.querySelector('.hx-map-lightfield')) return
    const field = document.createElement('div')
    field.className = 'hx-map-lightfield'
    field.setAttribute('aria-hidden', 'true')
    field.innerHTML = `
      <div class="hx-map-glow-orb hx-map-glow-orb--a"></div>
      <div class="hx-map-glow-orb hx-map-glow-orb--b"></div>
      <div class="hx-map-vignette"></div>`
    const stage = mainMap.querySelector('.map-stage') || mainMap.querySelector('.county-map')
    if (stage) stage.insertAdjacentElement('beforebegin', field)
    else mainMap.insertBefore(field, mainMap.firstChild)
  }

  /** 丁达尔叠在 WebGL canvas 之上，用 mix-blend-mode 打在模型上 */
  function ensureTyndallFront(mainMap) {
    const stage = mainMap.querySelector('.map-stage') || mainMap.querySelector('.county-map')
    if (!stage) return
    if (!stage.style.position || stage.style.position === 'static') {
      stage.style.position = 'relative'
    }
    let front = stage.querySelector('.hx-map-tyndall-front')
    if (front) return
    front = document.createElement('div')
    front.className = 'hx-map-tyndall-front'
    front.setAttribute('aria-hidden', 'true')
    front.innerHTML = `
      <div class="hx-tyndall hx-tyndall--1"></div>
      <div class="hx-tyndall hx-tyndall--2"></div>
      <div class="hx-tyndall hx-tyndall--3"></div>
      <div class="hx-tyndall hx-tyndall--4"></div>`
    stage.appendChild(front)
  }

  function tick() {
    const hash = (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
    if (hash !== '/' && hash !== '') {
      document.querySelectorAll('.main-map.hx-map-premium').forEach((m) => m.classList.remove('hx-map-premium'))
      return
    }
    const mainMap = document.querySelector('.dashboard-center .main-map')
    if (!mainMap) return
    mainMap.classList.add('hx-map-premium')
    ensureLightfield(mainMap)
    ensureTyndallFront(mainMap)
  }

  window.addEventListener('hashchange', () => setTimeout(tick, 80))
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick)
  else tick()
})()
