/**
 * P2 等院前页 → dispatch.html 子页 embed；P1 实时出警 #/dispatch 留 React 大地图，不嵌 iframe
 */
;(function () {
  /** @type {Record<string, string>} */
  /**
   * 仅 P2「出警列表」「事件列表」走 Vue；其余 L2 用 app 内原有 React 页（与顶栏 subnav 一致）
   * 120 四页 hash 对照：live / events / register / ambulances
   */
  const TAB_BY_PATH = {
    '/dispatch/list': 'live',
    '/dispatch/events': 'events',
  }

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function appQueryString() {
    const raw = location.hash.replace(/^#/, '')
    return raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
  }

  function integrated() {
    return window.hxIntegratedNav?.integratedSpa?.() === true
  }

  function iframeSrc(tab) {
    const params = new URLSearchParams(appQueryString())
    params.set('embed', '1')
    const qs = params.toString()
    return `${location.origin}/dispatch.html#${tab}?${qs}`
  }

  function cleanup() {
    document.body.classList.remove('hx-dispatch-vue-embed')
    document.getElementById('hx-dispatch-embed-wrap')?.remove()
  }

  function wireFrame(frame, tab) {
    if (!frame || frame.dataset.hxWired === '1') return
    frame.dataset.hxWired = '1'
    frame.addEventListener('load', () => {
      try {
        const doc = frame.contentDocument
        if (!doc) return
        if (doc.documentElement.dataset.hxNestedBlock === '1') return
        if (doc.getElementById('root')?.querySelector('.app-shell')) {
          frame.dataset.hxBadLoad = '1'
          console.warn('[hx] dispatch 嵌入误载 app.html，请检查 dispatch.html 是否已部署')
          cleanup()
          window.dispatchEvent(new HashChangeEvent('hashchange'))
        }
      } catch {
        /* ignore */
      }
    })
  }

  function apply() {
    if (!integrated()) {
      cleanup()
      return
    }

    const tab = TAB_BY_PATH[path()]
    if (!tab) {
      cleanup()
      return
    }

    const shell = document.querySelector('.app-shell')
    if (!shell) return

    document.body.classList.add('hx-dispatch-vue-embed')

    let wrap = document.getElementById('hx-dispatch-embed-wrap')
    const src = iframeSrc(tab)
    if (!wrap) {
      wrap = document.createElement('div')
      wrap.id = 'hx-dispatch-embed-wrap'
      wrap.className = 'hx-dispatch-embed-wrap'
      wrap.innerHTML =
        '<iframe class="hx-dispatch-embed-frame" title="120 院前调度" referrerpolicy="same-origin"></iframe>'
      shell.appendChild(wrap)
    }

    const frame = wrap.querySelector('iframe')
    wireFrame(frame, tab)
    if (frame) {
      const prev = frame.getAttribute('src') || ''
      if (prev !== src) frame.setAttribute('src', src)
    }
  }

  window.addEventListener('hashchange', apply)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply)
  else apply()
  window.hxEnhance?.(apply, { wait: 120, observeRoot: true, afterNav: 80 })

  /** 等 sidebar-shell-enhance.js 加完 hx-sidebar-ready，再用 MutationObserver 监听 .app-shell */
  let observed = false
  function observeShell() {
    if (observed) return
    const shell = document.querySelector('.app-shell')
    if (!shell) return
    observed = true
    const obs = new MutationObserver(() => {
      if (document.querySelector('.app-shell.hx-sidebar-ready')) {
        obs.disconnect()
        apply()
      }
    })
    obs.observe(shell, { attributes: true, attributeFilter: ['class'] })
    if (document.querySelector('.app-shell.hx-sidebar-ready')) {
      obs.disconnect()
      apply()
    }
  }

  const root = document.getElementById('root')
  if (root) {
    const obs = new MutationObserver(() => observeShell())
    obs.observe(root, { childList: true })
    observeShell()
  }
})()
