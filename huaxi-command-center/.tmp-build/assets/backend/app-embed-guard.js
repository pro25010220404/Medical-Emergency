/**
 * 防止 app.html 被嵌进 iframe 时再套一层指挥中枢（dispatch 嵌入误载主站时）
 */
;(function () {
  if (window.self === window.top) return
  const path = (location.pathname || '').replace(/\\/g, '/')
  const isAppEntry =
    path.endsWith('/app.html') || path.endsWith('/index.html') || path === '/' || path.endsWith('/')
  if (!isAppEntry || !document.getElementById('root')) return

  let nestedInIntegrated = false
  try {
    nestedInIntegrated = !!window.parent?.hxIntegratedNav
  } catch {
    return
  }
  if (!nestedInIntegrated) return

  document.documentElement.dataset.hxNestedBlock = '1'
  const stop = document.createElement('style')
  stop.textContent =
    'html[data-hx-nested-block] body{margin:0;background:#f8fafc;color:#64748b;font:14px/1.5 system-ui,sans-serif}' +
    'html[data-hx-nested-block] #root{display:none!important}'
  document.head.appendChild(stop)
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      if (!document.getElementById('hx-nested-block-msg')) {
        const p = document.createElement('p')
        p.id = 'hx-nested-block-msg'
        p.style.padding = '24px'
        p.textContent = '院前页加载异常：请确认站点已部署 dispatch.html（Vue 120），勿将 app.html 嵌套进自身。'
        document.body.appendChild(p)
      }
    },
    { once: true },
  )
})()
