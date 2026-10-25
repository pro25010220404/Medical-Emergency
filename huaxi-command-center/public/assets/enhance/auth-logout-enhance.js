/**
 * 顶栏「退出登录」
 */
;(function () {
  function hasSession() {
    try {
      return !!(localStorage.getItem('huaxi-jwt-token') || sessionStorage.getItem('huaxi-jwt-token'))
    } catch {
      return false
    }
  }

  function mountLogout() {
    if (!hasSession()) {
      document.getElementById('hx-logout-btn')?.remove()
      return
    }
    if (document.getElementById('hx-logout-btn')) return

    const header = document.querySelector('.command-header')
    if (!header) return

    let right = header.querySelector('.header-right')
    if (!right) {
      right = document.createElement('div')
      right.className = 'header-right hx-header-actions'
      header.appendChild(right)
    }

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.id = 'hx-logout-btn'
    btn.className = 'hx-logout-btn'
    btn.title = '退出并返回登录页'
    btn.textContent = '退出登录'
    btn.addEventListener('click', async () => {
      btn.disabled = true
      try {
        if (window.hxBackend?.logout) await window.hxBackend.logout()
        else location.replace('/index.html')
      } finally {
        btn.disabled = false
      }
    })
    right.appendChild(btn)
  }

  if (typeof window.hxEnhance === 'function') {
    window.hxEnhance(mountLogout, { wait: 280, observeRoot: true, afterNav: 80 })
  } else {
    mountLogout()
    window.addEventListener('hashchange', mountLogout)
  }
})()
