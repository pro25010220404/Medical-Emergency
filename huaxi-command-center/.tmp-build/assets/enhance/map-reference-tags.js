/**
 * 首页 3D 地图 — 参考图堆叠标签（本月新增 / 主体存量）
 */
;(function () {
  const PINS = {
    weiyuan: [
      { x: 0.67, y: 0.81, newMonth: 53, stock: 5346 },
      { x: 0.55, y: 0.31, newMonth: 12, stock: 2134 },
      { x: 0.4, y: 0.28, newMonth: 83, stock: 498 },
      { x: 0.52, y: 0.55, newMonth: 26, stock: 1820 },
      { x: 0.72, y: 0.62, newMonth: 41, stock: 967 },
    ],
    dafang: [
      { x: 0.6, y: 0.13, newMonth: 53, stock: 5346 },
      { x: 0.48, y: 0.22, newMonth: 12, stock: 2134 },
      { x: 0.37, y: 0.31, newMonth: 85, stock: 408 },
      { x: 0.56, y: 0.57, newMonth: 31, stock: 2890 },
      { x: 0.41, y: 0.67, newMonth: 67, stock: 6120 },
      { x: 0.58, y: 0.76, newMonth: 19, stock: 1544 },
      { x: 0.29, y: 0.8, newMonth: 44, stock: 876 },
      { x: 0.5, y: 0.88, newMonth: 22, stock: 1205 },
    ],
  }

  let mountedFor = ''

  function currentRegion() {
    const btn = document.querySelector('.region-switch.segmented button.selected')
    if (!btn) return 'weiyuan'
    const t = btn.textContent || ''
    return t.includes('大方') ? 'dafang' : 'weiyuan'
  }

  function renderPin(pin) {
    const el = document.createElement('div')
    el.className = 'map-ref-pin'
    el.style.left = `${pin.x * 100}%`
    el.style.top = `${pin.y * 100}%`
    el.innerHTML = `
      <div class="map-ref-tag map-ref-tag--gold">
        <span class="map-ref-icon" aria-hidden="true">☎</span>
        <span class="map-ref-label">本月新增</span>
        <strong>${pin.newMonth}</strong>
      </div>
      <div class="map-ref-tag map-ref-tag--blue">
        <span class="map-ref-icon" aria-hidden="true">⌂</span>
        <span class="map-ref-label">主体存量</span>
        <strong>${pin.stock}</strong>
      </div>`
    return el
  }

  function mountTags(mainMap) {
    const region = currentRegion()
    const key = region + ':' + mainMap.dataset.mapRegionKey
    if (mountedFor === key && mainMap.querySelector('.map-ref-overlay')) return

    let overlay = mainMap.querySelector('.map-ref-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.className = 'map-ref-overlay'
      overlay.setAttribute('aria-hidden', 'true')
      mainMap.appendChild(overlay)
    }
    overlay.replaceChildren()
    const list = PINS[region] || PINS.weiyuan
    for (const pin of list) {
      overlay.appendChild(renderPin(pin))
    }
    mountedFor = key
  }

  function tick() {
    const mainMap = document.querySelector('.dashboard-center .main-map')
    if (!mainMap) return
    const regionKey = mainMap.querySelector('.map-stage')?.getAttribute('data-region') || ''
    mainMap.dataset.mapRegionKey = regionKey || currentRegion()
    mountTags(mainMap)
  }

  function setup() {
    document.addEventListener(
      'click',
      (e) => {
        const t = e.target
        if (t instanceof HTMLElement && t.closest('.region-switch.segmented')) {
          mountedFor = ''
          setTimeout(tick, 80)
        }
      },
      true,
    )
    window.addEventListener('hashchange', () => {
      mountedFor = ''
      setTimeout(tick, 120)
    })
    tick()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup)
  } else {
    setup()
  }
})()
