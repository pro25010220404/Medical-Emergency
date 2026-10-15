/**
 * 详情页返回：按模块回到列表（仅无页内返回条时使用左下角链接，避免与 consult-context 重复闪烁）
 */
;(function () {
  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function query() {
    const raw = location.hash.replace(/^#/, '')
    return new URLSearchParams(raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '')
  }

  function hasInlineBack() {
    return !!(
      document.querySelector('.hx-strip .hx-back') ||
      document.getElementById('hx-consult-context') ||
      document.querySelector('.workspace-heading + .hx-care-dock')
    )
  }

  function rule() {
    const p = path()
    if (p === '/consultations') return null
    if (p.startsWith('/bed/')) return { href: '/#/beds', label: '返回科室床位' }
    if (p.startsWith('/patient/')) return { href: '/#/patients', label: '返回患者列表' }
    if (p === '/devices') return { href: '/#/critical', label: '返回重症监护' }
    if (p.startsWith('/room/') || p.startsWith('/join/')) return { href: '/#/consultations', label: '返回会诊列表' }
    if (p === '/transfers') {
      const q = query()
      if (q.get('task') || q.get('plate')) return { href: '/dispatch.html#live', label: '返回实时出警' }
      return null
    }
    if (p === '/coordination') return null
    if (p.startsWith('/medical-quality/rectify')) return { href: '/#/medical-quality', label: '返回质控看板' }
    if (p.startsWith('/episode/')) return { href: '/#/patients', label: '返回患者列表' }
    if (p.startsWith('/transport/')) return { href: '/dispatch.html#live', label: '返回实时出警' }
    return null
  }

  function absHref(href) {
    try {
      return new URL(href, location.origin).href
    } catch {
      return href
    }
  }

  function render() {
    const next = rule()
    const el = document.getElementById('hx-back-float')

    if (!next || hasInlineBack()) {
      el?.remove()
      return
    }

    const href = absHref(next.href)
    if (!el) {
      const a = document.createElement('a')
      a.id = 'hx-back-float'
      a.className = 'hx-back-float'
      a.href = href
      a.textContent = next.label
      document.body.appendChild(a)
      return
    }

    if (el.href !== href) el.href = href
    if (el.textContent !== next.label) el.textContent = next.label
  }

  window.hxEnhance(render, { wait: 300, observeRoot: true, afterNav: 80 })
})()
