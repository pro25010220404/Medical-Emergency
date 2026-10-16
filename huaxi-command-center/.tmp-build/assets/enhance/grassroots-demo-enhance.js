/**
 * 验收环境不展示「基层调度链 / 演示链」顶栏与步骤条（原 grassroots-demo.json + 后端标题）。
 */
;(function () {
  function cleanup() {
    document.getElementById('hx-grassroots-story')?.remove()
    document.querySelectorAll('.hx-transfer-demo-row').forEach((r) => {
      r.classList.remove('hx-transfer-demo-row')
      r.querySelector('.hx-transfer-demo-badge')?.remove()
    })
    const heading = document.querySelector('main.workspace .workspace-heading')
    heading?.querySelectorAll('p, small').forEach((el) => {
      const t = el.textContent || ''
      if (/每级一家|业务协作为展示|村、镇、县、市、华西/.test(t)) el.remove()
    })
  }
  cleanup()
  window.addEventListener('hashchange', cleanup)
})()
