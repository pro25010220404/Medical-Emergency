/**
 * 保留 bundle 加载页，补充浅色文案（样式见 theme-light.css .startup）
 */
;(function () {
  function polish() {
    document.querySelectorAll('.startup').forEach((el) => {
      el.classList.add('hx-startup-shell')
      const h1 = el.querySelector('h1')
      if (h1 && !el.querySelector('.hx-startup-sub')) {
        const sub = document.createElement('p')
        sub.className = 'hx-startup-sub'
        sub.textContent = '正在加载指挥系统资源…'
        h1.insertAdjacentElement('afterend', sub)
      }
    })
  }
  polish()
  document.addEventListener('DOMContentLoaded', polish)
  const root = document.getElementById('root')
  if (root) new MutationObserver(polish).observe(root, { childList: true, subtree: true })
})()
