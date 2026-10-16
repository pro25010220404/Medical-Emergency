/**
 * 已下线：子页底栏 Laravel / 非实时 HIS 免责声明（验收 UI 不展示）。
 */
;(function () {
  function cleanup() {
    document.getElementById('hx-global-demo-foot')?.remove()
    document.body.classList.remove('hx-has-demo-foot')
    document.querySelectorAll('.hx-global-demo-foot, .demo-foot, .meeting-demo-foot').forEach((el) => el.remove())
  }
  cleanup()
  window.addEventListener('hashchange', cleanup)
})()
