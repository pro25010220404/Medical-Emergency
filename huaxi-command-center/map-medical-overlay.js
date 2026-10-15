/**
 * 协作节点 — 默认收起，地图全宽；点击「节点」展开侧栏
 */
;(function () {
  const TIER = ['一级', '二级', '基层']

  const NODES = {
    weiyuan: [
      { name: '威远县人民医院', type: 0, er: 8, beds: 14, busy: false },
      { name: '连界镇卫生院', type: 1, er: 3, beds: 6, busy: true },
      { name: '船石村卫生室', type: 2, er: 1, beds: 2, busy: false },
    ],
    dafang: [
      { name: '大方县城', type: 0, er: 12, beds: 18, busy: true },
      { name: '凤山', type: 0, er: 5, beds: 9, busy: false },
      { name: '达溪', type: 0, er: 4, beds: 7, busy: false },
      { name: '鼎新', type: 1, er: 2, beds: 5, busy: false },
      { name: '核桃', type: 1, er: 2, beds: 4, busy: true },
      { name: '黄泥塘', type: 1, er: 3, beds: 4, busy: false },
      { name: '理化', type: 2, er: 1, beds: 3, busy: false },
      { name: '雨冲', type: 2, er: 1, beds: 2, busy: false },
    ],
  }

  let mountedKey = ''
  let open = false

  function region() {
    const btn = document.querySelector('.dashboard-center .region-switch.segmented button.selected')
    if (!btn) return 'dafang'
    return (btn.textContent || '').includes('威远') ? 'weiyuan' : 'dafang'
  }

  function row(node) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'map-med-row'
    el.innerHTML = `
      <span class="map-med-tier t${node.type}">${TIER[node.type]}</span>
      <span class="map-med-row-name" title="${node.name}">${node.name}</span>
      <span class="map-med-row-stat"><em>急诊</em><strong class="${node.er >= 5 ? 'warn' : ''}">${node.er}</strong></span>
      <span class="map-med-row-stat"><em>空床</em><strong>${node.beds}</strong></span>
      <span class="map-med-row-dot ${node.busy ? 'busy' : ''}"></span>`
    el.addEventListener('click', () => {
      el.parentElement?.querySelectorAll('.map-med-row').forEach((r) => r.classList.remove('active'))
      el.classList.add('active')
    })
    return el
  }

  function setOpen(mainMap, next) {
    open = next
    mainMap.classList.toggle('map-nodes-open', open)
    const tab = mainMap.querySelector('.map-med-tab')
    if (tab) tab.setAttribute('aria-expanded', open ? 'true' : 'false')
  }

  function mount(mainMap) {
    const r = region()
    if (r === mountedKey && mainMap.querySelector('.map-med-tab')) return
    mountedKey = r

    mainMap.querySelector('.map-med-sidepanel')?.remove()
    mainMap.querySelector('.map-med-tab')?.remove()
    mainMap.querySelector('.map-med-backdrop')?.remove()

    const nodes = [...(NODES[r] || NODES.dafang)].sort((a, b) => a.type - b.type || a.name.localeCompare(b.name, 'zh'))

    const tab = document.createElement('button')
    tab.type = 'button'
    tab.className = 'map-med-tab'
    tab.setAttribute('aria-expanded', 'false')
    tab.innerHTML = `<span class="map-med-tab-label">协作节点</span><span class="map-med-tab-count">${nodes.length}</span>`
    tab.addEventListener('click', (e) => {
      e.stopPropagation()
      setOpen(mainMap, !open)
    })

    const backdrop = document.createElement('div')
    backdrop.className = 'map-med-backdrop'
    backdrop.addEventListener('click', () => setOpen(mainMap, false))

    const panel = document.createElement('aside')
    panel.className = 'map-med-sidepanel'
    panel.setAttribute('aria-label', '协作节点一览')
    panel.innerHTML = `
      <header class="map-med-side-head">
        <strong>协作节点</strong>
        <button type="button" class="map-med-close" aria-label="收起">×</button>
      </header>
      <p class="map-med-side-tip">柱点颜色：蓝县级 · 绿乡镇 · 灰基层 · 点击地图柱点联动患者</p>
      <div class="map-med-side-list"></div>`

    panel.querySelector('.map-med-close')?.addEventListener('click', () => setOpen(mainMap, false))
    const list = panel.querySelector('.map-med-side-list')
    nodes.forEach((n) => list.appendChild(row(n)))

    mainMap.appendChild(backdrop)
    mainMap.appendChild(panel)
    mainMap.appendChild(tab)
    setOpen(mainMap, false)
  }

  function tick() {
    const mainMap = document.querySelector('.dashboard-center .main-map')
    if (mainMap) mount(mainMap)
  }

  const DEMO_LINKS_POS_KEY = 'huaxi-demo-links-pos'

  function clampDemoLinksPos(bar, x, y) {
    const pad = 8
    const w = bar.offsetWidth || 280
    const h = bar.offsetHeight || 36
    return {
      x: Math.min(Math.max(pad, x), window.innerWidth - w - pad),
      y: Math.min(Math.max(pad, y), window.innerHeight - h - pad),
    }
  }

  function applyDemoLinksPos(bar, x, y) {
    const c = clampDemoLinksPos(bar, x, y)
    bar.style.right = 'auto'
    bar.style.bottom = 'auto'
    bar.style.left = `${c.x}px`
    bar.style.top = `${c.y}px`
    return c
  }

  function loadDemoLinksPos(bar) {
    try {
      const raw = localStorage.getItem(DEMO_LINKS_POS_KEY)
      if (!raw) return
      const pos = JSON.parse(raw)
      if (Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        applyDemoLinksPos(bar, pos.x, pos.y)
      }
    } catch (_) {
      /* ignore */
    }
  }

  function enableDemoLinksDrag(bar) {
    bar.classList.add('huaxi-demo-links--draggable')
    let dragging = false
    let start = null
    let origin = null

    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      if (e.target instanceof Element && e.target.closest('a')) return
      e.preventDefault()
      const rect = bar.getBoundingClientRect()
      if (!bar.style.left) applyDemoLinksPos(bar, rect.left, rect.top)
      dragging = true
      bar.classList.add('is-dragging')
      start = { x: e.clientX, y: e.clientY }
      origin = { x: rect.left, y: rect.top }
      bar.setPointerCapture(e.pointerId)
    })

    bar.addEventListener('pointermove', (e) => {
      if (!dragging || !start || !origin) return
      applyDemoLinksPos(bar, origin.x + (e.clientX - start.x), origin.y + (e.clientY - start.y))
    })

    function endDrag(e) {
      if (!dragging) return
      dragging = false
      bar.classList.remove('is-dragging')
      try {
        bar.releasePointerCapture(e.pointerId)
      } catch (_) {
        /* ignore */
      }
      const rect = bar.getBoundingClientRect()
      localStorage.setItem(DEMO_LINKS_POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }))
    }

    bar.addEventListener('pointerup', endDrag)
    bar.addEventListener('pointercancel', endDrag)

    window.addEventListener('resize', () => {
      if (!bar.style.left) return
      const rect = bar.getBoundingClientRect()
      applyDemoLinksPos(bar, rect.left, rect.top)
    })
  }

  function demoLinks() {
    if (document.getElementById('huaxi-demo-links')) return
    const bar = document.createElement('nav')
    bar.id = 'huaxi-demo-links'
    bar.className = 'huaxi-demo-links'
    bar.setAttribute('aria-label', '演示入口')
    bar.title = '按住空白处拖动 · 点击文字进入页面'
    bar.innerHTML =
      '<a href="/dispatch.html#live">120 调度</a><a href="/gis-command.html">GIS 大屏</a>'
    document.body.appendChild(bar)
    requestAnimationFrame(() => {
      loadDemoLinksPos(bar)
      enableDemoLinksDrag(bar)
    })
  }

  function setup() {
    document.addEventListener(
      'click',
      (e) => {
        if (e.target instanceof HTMLElement && e.target.closest('.region-switch.segmented')) {
          mountedKey = ''
          open = false
          setTimeout(tick, 100)
        }
      },
      true,
    )
    window.addEventListener('hashchange', () => {
      mountedKey = ''
      open = false
      setTimeout(tick, 150)
    })
    setInterval(tick, 2000)
    tick()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup)
  else setup()
})()
