/**
 * 首页面板开关 + 演示汇报条（隐藏块 / 汇报布局预设 / GIS 入口）
 */
;(function () {
  const KEY = 'huaxi-home-panels'
  const DEFAULTS = { dispatch: true, warning: true, critical: true, map: true }
  const PRESETS = {
    report: { dispatch: true, warning: true, critical: false, map: true },
    full: { ...DEFAULTS },
  }
  const LABELS = { dispatch: '出警', warning: '预警', critical: '重症', map: '地图' }

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/') || '/'
  }

  function isHome() {
    const p = path()
    if (p === '/map' || document.body.classList.contains('hx-page-map-only')) return false
    return p === '/' || p === ''
  }

  function load() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
    } catch {
      return { ...DEFAULTS }
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state))
  }

  function findPanel(title) {
    return [...document.querySelectorAll('.dashboard .panel')].find((p) => {
      const t = p.querySelector('.panel-title, h2')
      return t && (t.textContent || '').includes(title)
    })
  }

  function panelNodes() {
    return {
      dispatch: [document.querySelector('.vehicle-panel'), findPanel('今日急救调度事件')],
      warning: [findPanel('24小时院内评分预警')],
      critical: [findPanel('24小时县域智慧重症事件')],
      map: [document.querySelector('.dashboard-center .main-map'), document.querySelector('.main-map')],
    }
  }

  function resetVisibility() {
    Object.values(panelNodes())
      .flat()
      .forEach((n) => {
        if (n) n.style.display = ''
      })
    const center = document.querySelector('.dashboard-center')
    if (center) center.style.display = ''
    const dash = document.querySelector('main.dashboard.screen, .dashboard')
    dash?.classList.remove(
      'hx-panels-no-map',
      'hx-panels-no-dispatch',
      'hx-panels-no-warning',
      'hx-panels-no-critical',
      'hx-panels-no-right',
    )
    const left = document.querySelector('.dashboard-left')
    left?.classList.remove('hx-panels-left-compact')
    const right = document.querySelector('.dashboard-right')
    if (right) {
      right.hidden = false
      right.style.removeProperty('grid-template-rows')
    }
  }

  function syncLayout(state) {
    const dash = document.querySelector('main.dashboard.screen, .dashboard')
    if (!dash) return
    dash.classList.toggle('hx-panels-no-map', !state.map)
    dash.classList.toggle('hx-panels-no-dispatch', !state.dispatch)
    dash.classList.toggle('hx-panels-no-warning', !state.warning)
    dash.classList.toggle('hx-panels-no-critical', !state.critical)

    const left = document.querySelector('.dashboard-left')
    if (left) left.classList.toggle('hx-panels-left-compact', !state.dispatch)

    const right = document.querySelector('.dashboard-right')
    const rightCount =
      (state.dispatch ? 1 : 0) + (state.warning ? 1 : 0) + (state.critical ? 1 : 0)
    if (right) {
      if (rightCount === 0) {
        right.hidden = true
        dash.classList.add('hx-panels-no-right')
      } else {
        right.hidden = false
        dash.classList.remove('hx-panels-no-right')
        right.style.gridTemplateRows = `repeat(${rightCount}, minmax(0, 1fr))`
      }
    }
  }

  function applyVisibility(state) {
    const map = panelNodes()
    Object.entries(map).forEach(([key, nodes]) => {
      const show = !!state[key]
      nodes.forEach((n) => {
        if (!n) return
        n.style.display = show ? '' : 'none'
      })
    })
    const center = document.querySelector('.dashboard-center')
    if (center && !state.map) center.style.display = 'none'
    else if (center) center.style.display = ''
    syncLayout(state)
  }

  function mountDemoLinks() {
    if (document.getElementById('huaxi-demo-links')) return
    const bar = document.createElement('nav')
    bar.id = 'huaxi-demo-links'
    bar.className = 'huaxi-demo-links'
    bar.setAttribute('aria-label', '演示快捷入口')
    bar.innerHTML =
      '<a href="/dispatch.html#live">120 调度</a><a href="/gis-command.html">GIS 大屏</a>'
    document.body.appendChild(bar)
  }

  function mountToolbar(state) {
    let bar = document.getElementById('hx-panel-toggles')
    const dash = document.querySelector('.dashboard')
    const shell = dash?.closest('.app-shell')
    if (!dash || !shell) return

    if (!bar) {
      bar = document.createElement('div')
      bar.id = 'hx-panel-toggles'
    }

    const sidebarShell = document.body.classList.contains('hx-sidebar-shell')
    bar.classList.toggle('hx-panel-toggles--strip', sidebarShell)

    if (bar.parentElement !== shell) {
      const header = shell.querySelector('header.command-header')
      if (sidebarShell && header) header.insertAdjacentElement('afterend', bar)
      else {
        const main = shell.querySelector('main.dashboard.screen, main.dashboard')
        shell.insertBefore(bar, main || dash)
      }
    }

    const checks = Object.keys(LABELS)
      .map(
        (key) =>
          `<label><input type="checkbox" data-panel="${key}" ${state[key] ? 'checked' : ''}/>${LABELS[key]}</label>`,
      )
      .join('')

    bar.innerHTML = sidebarShell
      ? `<div class="hx-panel-toggles-row"><span class="hx-panel-toggles-label">显示</span>${checks}</div>
      <div class="hx-panel-toggles-row hx-panel-toggles-row--sub">
        <button type="button" class="hx-preset-btn" data-preset="report">汇报布局</button>
        <button type="button" class="hx-preset-btn ghost" data-preset="full">全部显示</button>
        <a class="hx-preset-link" href="#/map">三维地图</a>
        <a class="hx-preset-link" href="#/dispatch">院前调度</a>
      </div>`
      : `<span class="hx-panel-toggles-label">面板</span>${checks}
      <span class="hx-panel-toggles-sep" aria-hidden="true"></span>
      <button type="button" class="hx-preset-btn" data-preset="report">汇报布局</button>
      <button type="button" class="hx-preset-btn ghost" data-preset="full">全部显示</button>
      <span class="hx-toolbar-links">
        <a class="hx-preset-link" href="#/map">三维地图 →</a>
        <a class="hx-preset-link" href="#/dispatch">院前调度 →</a>
      </span>`

    bar.querySelectorAll('input[data-panel]').forEach((input) => {
      input.onchange = () => {
        const next = load()
        next[input.dataset.panel] = input.checked
        save(next)
        applyVisibility(next)
        bar.querySelectorAll('input[data-panel]').forEach((el) => {
          if (el.dataset.panel) el.checked = !!next[el.dataset.panel]
        })
      }
    })

    bar.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-preset')
        const next = PRESETS[id] ? { ...PRESETS[id] } : { ...DEFAULTS }
        save(next)
        applyVisibility(next)
        bar.querySelectorAll('input[data-panel]').forEach((el) => {
          if (el.dataset.panel) el.checked = !!next[el.dataset.panel]
        })
      }
    })
  }

  function render() {
    document.querySelectorAll('.hx-gis-chip').forEach((el) => el.remove())
    if (!isHome() || !document.querySelector('.dashboard')) {
      document.getElementById('hx-panel-toggles')?.remove()
      document.getElementById('huaxi-demo-links')?.remove()
      resetVisibility()
      return
    }
    if (!document.body.classList.contains('hx-sidebar-shell')) mountDemoLinks()
    const state = load()
    mountToolbar(state)
    applyVisibility(state)
  }

  window.hxEnhance(render, { wait: 400, observeRoot: true, afterNav: 100 })
})()
