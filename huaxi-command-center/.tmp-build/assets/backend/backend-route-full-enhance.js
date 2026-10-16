/**
 * 已下线：全路由 GET 探测 +「后端 API · 已调用 x/y」面板（影响大屏布局与接口压力）。
 * 保留空脚本以便旧 index.html 引用不 404；若本地仍见该文字，请强刷并确认 index 未再引用本文件。
 */
;(function () {
  function clearDock() {
    document.getElementById('hx-api-route-dock')?.remove()
  }
  clearDock()
  window.addEventListener('hashchange', clearDock)
})()
