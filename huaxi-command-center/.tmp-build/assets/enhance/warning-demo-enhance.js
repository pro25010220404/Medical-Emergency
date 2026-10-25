/**
 * 已停用：不再注入「趋势预测 / 处置闭环」条块（避免 /warning 往返后顶栏重复出现）
 */
;(function () {
  function strip() {
    document.getElementById('hx-warning-demo-page')?.remove()
    document.getElementById('hx-warning-home')?.remove()
  }

  strip()
  window.addEventListener('hashchange', strip)
})()
