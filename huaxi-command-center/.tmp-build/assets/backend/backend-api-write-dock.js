/**
 * 已下线：右下角「写接口 · 模块 …」调试面板（验收大屏不需要）。
 */
;(function () {
  function clearDock() {
    document.getElementById('hx-api-write-dock')?.remove()
  }
  clearDock()
  window.addEventListener('hashchange', clearDock)
})()
