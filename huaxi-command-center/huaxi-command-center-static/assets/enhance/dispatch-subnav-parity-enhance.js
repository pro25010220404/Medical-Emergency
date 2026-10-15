/**
 * 顶栏 subnav 与 bundle HP 一致，并补上「出警列表」；一体化模式下只走 app hash
 */
;(function () {
  const DISPATCH_LINKS = [
    ['/dispatch', '实时出警'],
    ['/dispatch/list', '出警列表'],
    ['/ambulances', '救护车列表'],
    ['/patients', '患者列表'],
    ['/register', '患者登记'],
    ['/consultations', '远程会诊'],
    ['/transfers?scope=grassroots', '医院转诊'],
    ['/critical?mode=grassroots-remote', '基层远程监护'],
  ]

  function hashPath() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function hashQuery() {
    const raw = location.hash.replace(/^#/, '')
    return new URLSearchParams(raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '')
  }

  function linkActive(link) {
    const [pathPart, queryPart] = link.split('?')
    if (hashPath() !== pathPart) return false
    if (!queryPart) return !hashQuery().toString()
    const want = new URLSearchParams(queryPart)
    for (const [k, v] of want.entries()) {
      if (hashQuery().get(k) !== v) return false
    }
    return true
  }

  function inDispatchPlate() {
    const main = document.querySelector('nav[aria-label="五个业务模块"]')
    const cur = main?.querySelector('a.active, a[aria-current="page"]')
    return cur && (cur.textContent || '').includes('智慧急救调度')
  }

  function syncSubnav() {
    if (document.body.classList.contains('hx-sidebar-shell')) return
    const nav = document.querySelector('nav.subnav')
    if (!nav || !inDispatchPlate()) return

    const home = nav.querySelector(':scope > a:first-child')
    DISPATCH_LINKS.forEach(([href, label]) => {
      let a = nav.querySelector(`a[data-hx-dispatch-parity="${label}"]`)
      if (!a) {
        a = document.createElement('a')
        a.dataset.hxDispatchParity = label
        a.dataset.iaExtra = '1'
        nav.appendChild(a)
      }
      a.href = `#${href.startsWith('/') ? href : `/${href}`}`
      a.textContent = label
      a.hidden = false
      a.style.removeProperty('display')
      const active = linkActive(href)
      a.classList.toggle('active', active)
      a.setAttribute('aria-current', active ? 'page' : 'false')
    })

    nav.querySelectorAll(':scope > a:not(:first-child)').forEach((a) => {
      if (a.dataset.hxDispatchParity) return
      const label = (a.textContent || '').trim()
      if (DISPATCH_LINKS.some(([, l]) => l === label)) {
        a.hidden = true
        a.style.setProperty('display', 'none', 'important')
      }
    })
  }

  document.addEventListener(
    'click',
    (e) => {
      if (!window.hxIntegratedNav?.integratedSpa?.()) return
      const a = e.target instanceof Element ? e.target.closest('nav.subnav > a') : null
      if (!a || !a.dataset.hxDispatchParity) return
      const href = a.getAttribute('href') || ''
      if (!href.startsWith('#')) return
      e.preventDefault()
      e.stopPropagation()
      if (location.hash !== href) location.hash = href
    },
    true,
  )

  window.addEventListener('hashchange', syncSubnav)
  window.hxEnhance?.(syncSubnav, { wait: 350, afterNav: 120 })
})()
