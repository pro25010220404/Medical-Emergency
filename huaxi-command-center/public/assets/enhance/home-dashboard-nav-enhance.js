/**
 * 县域指挥概览：点击区块 → app 内 hash（不跳 dispatch.html）
 */
;(function () {
  function isHome() {
    const p = (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
    if (document.body.classList.contains('hx-page-map-only')) return false
    return p === '/' || p === ''
  }

  function panelTitleFrom(panel) {
    const h2 = panel?.querySelector('.panel-title h2')
    if (h2) return (h2.textContent || '').replace(/\s+/g, ' ').trim()
    const header = panel?.querySelector('.panel-title')
    if (!header) return ''
    const clone = header.cloneNode(true)
    clone.querySelector('.v-mark')?.remove()
    clone.querySelector('.panel-action')?.remove()
    return (clone.textContent || '').replace(/\s+/g, ' ').trim()
  }

  function panelHash(title) {
    if (title.includes('急救调度')) return '#/patients'
    if (title.includes('预警')) return '#/warning'
    if (title.includes('重症')) return '#/critical'
    return ''
  }

  function go(hash) {
    const next = hash.startsWith('#') ? hash : `#${hash}`
    if (location.hash !== next) location.hash = next
    else window.dispatchEvent(new HashChangeEvent('hashchange'))
  }

  function bindMapPanel() {
    const map = document.querySelector('.dashboard-center .main-map')
    if (!map || map.dataset.hxDashNav === '1') return
    map.dataset.hxDashNav = '1'
    map.addEventListener(
      'dblclick',
      () => {
        if (!isHome()) return
        go('#/map')
      },
      false,
    )
  }

  function bindVehiclePanel(panel) {
    if (!panel || panel.dataset.hxDashNav === '1') return
    panel.dataset.hxDashNav = '1'

    panel.addEventListener(
      'click',
      (event) => {
        if (!isHome()) return
        const target = event.target
        if (!(target instanceof Element)) return

        const titleBtn = target.closest('.panel-title a, .panel-title button')
        if (titleBtn && panel.contains(titleBtn)) {
          event.preventDefault()
          event.stopImmediatePropagation()
          go('#/dispatch')
          return
        }

        const totalBtn = target.closest('.vehicle-totals button')
        if (totalBtn) {
          event.preventDefault()
          event.stopImmediatePropagation()
          const label = totalBtn.textContent || ''
          if (label.includes('出警')) go('#/dispatch')
          else go('#/ambulances')
          return
        }

        const row = target.closest('.vehicle-table tbody tr')
        if (row) {
          event.preventDefault()
          event.stopImmediatePropagation()
          const idCell = row.querySelector('td:nth-child(3)')
          const vehicleId = (idCell?.textContent || '').trim()
          go(vehicleId ? `#/dispatch?vehicle=${encodeURIComponent(vehicleId)}` : '#/dispatch')
        }
      },
      true,
    )
  }

  function bindCurrentPanel(panel) {
    if (!panel || panel.dataset.hxDashNav === '1') return
    panel.dataset.hxDashNav = '1'

    panel.addEventListener(
      'click',
      (event) => {
        if (!isHome()) return
        const metric = event.target instanceof Element ? event.target.closest('.current-metrics .metric') : null
        if (!metric || !panel.contains(metric)) return
        event.preventDefault()
        event.stopImmediatePropagation()
        const text = metric.textContent || ''
        if (text.includes('重症')) {
          go(text.includes('剩余') ? '#/critical?view=wards' : '#/critical')
          return
        }
        if (text.includes('急诊')) {
          go(text.includes('剩余') || text.includes('床位') ? '#/warning?view=departments' : '#/patients')
        }
      },
      true,
    )
  }

  function bindRightColumn(right) {
    if (!right || right.dataset.hxDashNav === '1') return
    right.dataset.hxDashNav = '1'
    right.addEventListener(
      'click',
      (event) => {
        if (!isHome()) return
        const target = event.target
        if (!(target instanceof Element)) return

        const moreBtn = target.closest(
          '.panel-action .link-button, .panel-action a, .panel-action button, .panel-title .link-button, .panel-title a, .panel-title button',
        )
        if (moreBtn) {
          const label = (moreBtn.textContent || '').replace(/\s+/g, '').trim()
          const isMore =
            label.includes('更多') || label === '预警中心' || label === '重症监护'
          const panel = moreBtn.closest('.panel')
          const title = panelTitleFrom(panel)
          if (isMore && typeof window.__hxHomeMoreOpen === 'function') {
            const kind = title.includes('急救调度')
              ? 'dispatch'
              : title.includes('预警')
                ? 'warning'
                : title.includes('重症')
                  ? 'critical'
                  : null
            if (kind) {
              event.preventDefault()
              event.stopImmediatePropagation()
              window.__hxHomeMoreOpen(kind, title, panel)
              return
            }
          }
          const hash = panelHash(title)
          if (hash) {
            event.preventDefault()
            event.stopImmediatePropagation()
            go(hash)
          }
        }

        const feedBtn = target.closest('.event-feed button')
        if (feedBtn && !feedBtn.closest('.vehicle-panel')) {
          /* 单条事件 → 患者详情，保留 React 默认 /patient/:id */
          return
        }
      },
      true,
    )
  }

  function bindCenterMetrics() {
    const wrap = document.querySelector('.dashboard-center .center-metrics')
    if (!wrap || wrap.dataset.hxDashNav === '1') return
    wrap.dataset.hxDashNav = '1'
    wrap.addEventListener(
      'click',
      (event) => {
        if (!isHome()) return
        const metric = event.target instanceof Element ? event.target.closest('.metric') : null
        if (!metric) return
        event.preventDefault()
        event.stopImmediatePropagation()
        const text = metric.textContent || ''
        if (text.includes('医院') || text.includes('机构')) go('#/organizations')
        else if (text.includes('医护') || text.includes('人员')) go('#/coordination')
        else if (text.includes('床位')) go('#/critical?view=wards')
      },
      true,
    )
  }

  function apply() {
    // 车辆面板（含「出警中」卡片）统一走 app 内 #/dispatch，不随 legacy 模式跳 dispatch.html
    bindVehiclePanel(document.querySelector('.vehicle-panel'))
    if (!window.hxIntegratedNav?.integratedSpa?.()) return
    bindCurrentPanel(document.querySelector('.current-panel'))
    bindMapPanel()
    bindRightColumn(document.querySelector('.dashboard-right'))
    bindCenterMetrics()
  }

  window.hxEnhance(apply, { wait: 280, afterNav: 120 })
  window.addEventListener('hashchange', apply)
})()
