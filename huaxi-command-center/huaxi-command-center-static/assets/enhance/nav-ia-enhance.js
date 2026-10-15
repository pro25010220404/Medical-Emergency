/**
 * 医生视角：院前四页进 120 工作台 dispatch.html；会诊/转诊仍走 app.html。
 */
;(function () {
  const DISPATCH_KEEP = [
    '实时出警',
    '出警列表',
    '患者列表',
    '救护车列表',
    '患者登记',
    '远程会诊',
    '医院转诊',
    '基层远程监护',
  ]
  const DISPATCH_GO = {
    实时出警: '/dispatch.html#live',
    急救事件: '/dispatch.html#events',
    患者登记: '/dispatch.html#register',
    救护车列表: '/dispatch.html#ambulances',
  }
  const DISPATCH_HASH = {
    '/dispatch': '/dispatch.html#live',
    '/dispatch?hub=ambulances': '/dispatch.html#ambulances',
  }

  function links(nav) {
    return [...nav.querySelectorAll(':scope > a')].filter((a) => !a.dataset.iaExtra)
  }

  function text(el) {
    return (el.textContent || '').trim()
  }

  function setHidden(el, hide) {
    if (el.hidden !== hide) el.hidden = hide
    if (hide) el.style.setProperty('display', 'none', 'important')
    else el.style.removeProperty('display')
  }

  function hashPath() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function hashQuery() {
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    return new URLSearchParams(q)
  }

  function plateActive(labelPart) {
    const nav = document.querySelector('nav[aria-label="五个业务模块"]')
    if (!nav) return false
    const cur = nav.querySelector('a[aria-current="page"], a.active')
    return cur && (cur.textContent || '').includes(labelPart)
  }

  function blockGrassrootsOrgPage() {
    if (hashPath() !== '/organizations') return
    if (hashQuery().get('tier') !== 'grassroots') return
    if (!plateActive('智慧急救调度')) return
    location.replace(`${location.pathname}${location.search}#/dispatch`)
  }

  const DR_SUB = [
    ['#/dr?view=videos', '视频展示'],
    ['#/dr?view=saved', '我的收藏'],
  ]

  function clearDrSubnav(nav) {
    nav.querySelectorAll('a[data-ia-dr]').forEach((el) => el.remove())
    document.body.classList.remove('hx-plate-dr')
  }

  function mountDrSubnav(nav) {
    const path = hashPath()
    if (!path.startsWith('/dr')) {
      clearDrSubnav(nav)
      return false
    }
    document.body.classList.add('hx-plate-dr')
    links(nav)
      .slice(1)
      .forEach((a) => setHidden(a, true))
    const view = hashQuery().get('view') || 'videos'
    DR_SUB.forEach(([href, label]) => {
      let a = nav.querySelector(`a[data-ia-dr="${label}"]`)
      if (!a) {
        a = document.createElement('a')
        a.dataset.iaDr = label
        a.dataset.iaExtra = '1'
        nav.appendChild(a)
      }
      a.href = href
      a.textContent = label
      a.hidden = false
      const active =
        (label === '视频展示' && (view === 'videos' || view === 'sop' || view === 'drugs' || !view)) ||
        (label === '我的收藏' && view === 'saved')
      a.classList.toggle('active', active)
      a.setAttribute('aria-current', active ? 'page' : 'false')
    })
    return true
  }

  function tune(nav) {
    if (mountDrSubnav(nav)) return

    const items = links(nav).slice(1)
    if (!items.length) return
    const names = items.map(text)

    if (hashPath().startsWith('/medical-quality') || names.includes('质控整改看板')) {
      items.forEach((a) => {
        const label = text(a)
        setHidden(a, label !== '质控整改看板' && label !== '质控统计')
      })
      return
    }

    if (names.includes('实时出警') || names.includes('救护车列表') || names.includes('远程会诊')) {
      items.forEach((a) => {
        const label = text(a)
        setHidden(a, !DISPATCH_KEEP.includes(label))
      })
      return
    }

    if (names.includes('预警总览')) {
      items.forEach((a) => {
        const label = text(a)
        setHidden(a, label === '科室床位' || label === '下级医院科室监控' || label.includes('下级医院'))
      })
      return
    }

    if (names.includes('重症监护')) {
      items.forEach((a) => setHidden(a, false))
    }
  }

  document.addEventListener(
    'click',
    (event) => {
      if (window.hxIntegratedNav?.integratedSpa?.()) return
      const node = event.target
      if (!(node instanceof Element)) return
      const a = node.closest('nav.subnav > a')
      if (!a || a.dataset.iaExtra) return
      const label = text(a)
      if (label === '基层机构管理') {
        const sub = a.closest('nav.subnav')
        const names = sub ? [...sub.querySelectorAll(':scope > a')].map((x) => text(x)) : []
        if (names.includes('实时出警') || names.includes('远程会诊')) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
      }
      let dest = DISPATCH_GO[label]
      if (!dest) {
        const href = a.getAttribute('href') || ''
        const path = href.replace(/^#\/?/, '').split('?')[0]
        const qs = href.includes('?') ? href.slice(href.indexOf('?')) : ''
        dest = DISPATCH_HASH[`${path}${qs}`] || DISPATCH_HASH[path]
      }
      if (!dest) return
      event.preventDefault()
      event.stopPropagation()
      location.href = dest
    },
    true,
  )

  let lock = false
  function apply() {
    if (lock) return
    const nav = document.querySelector('nav.subnav')
    if (!nav) return
    lock = true
    try {
      tune(nav)
      blockGrassrootsOrgPage()
    } finally {
      lock = false
    }
  }

  window.hxEnhance(apply, { wait: 400, afterNav: 100 })
  window.addEventListener('hashchange', blockGrassrootsOrgPage)
})()
