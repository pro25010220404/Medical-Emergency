/**
 * 启动卡住时：?reset=1 清除本地演示存档；超时提示
 */
;(function () {
  var params = new URLSearchParams(location.search)
  if (params.has('reset')) {
    try {
      localStorage.removeItem('huaxi-final-demo-v1')
      sessionStorage.removeItem('huaxi-desktop-session')
      localStorage.setItem('huaxi-full-backend', '0')
    } catch (e) {
      /* ignore */
    }
    params.delete('reset')
    var q = params.toString()
    location.replace(location.pathname + (q ? '?' + q : '') + location.hash)
    return
  }

  setTimeout(function () {
    var h = document.querySelector('.startup h1')
    if (!h || !/连接指挥中心/.test(h.textContent || '')) return
    if (document.querySelector('.startup .boot-hint')) return
    var tip = document.createElement('p')
    tip.className = 'boot-hint'
    tip.style.cssText =
      'color:#94a3b8;margin-top:1rem;font-size:14px;max-width:440px;text-align:center;line-height:1.65;padding:0 16px'
    tip.innerHTML =
      '加载过久？请先 <strong>Ctrl+F5</strong> 强刷。仍无效则在地址栏加上 <strong>?reset=1</strong> 后回车（会清除本机演示存档，不影响 scenario.json）。'
    h.parentElement && h.parentElement.appendChild(tip)
  }, 8000)
})()

/** 增强脚本共用：仅在进入页 / 路由切换时跑一遍（不挂 MutationObserver / 定时器，避免部署后接口风暴） */
;(function () {
  function debounce(fn, wait) {
    var timer = null
    return function () {
      clearTimeout(timer)
      var args = arguments
      timer = setTimeout(function () {
        fn.apply(null, args)
      }, wait)
    }
  }

  window.hxEnhance = function (fn, opts) {
    opts = opts || {}
    var wait = opts.wait == null ? 320 : opts.wait
    var run = debounce(fn, wait)
    window.addEventListener('hashchange', function () {
      setTimeout(run, opts.afterNav == null ? 80 : opts.afterNav)
    })
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run)
    else run()
    return run
  }
})()
