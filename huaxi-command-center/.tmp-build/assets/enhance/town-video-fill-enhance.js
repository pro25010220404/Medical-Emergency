/**
 * 乡镇监护（critical?mode=town）· 远程监护终端：用本地演示录像填充视频区
 *
 * 目标：`.town-video-grid` 下每个 `.video-pane`（连界镇卫生院 / 新和村卫生室 等远程监护终端）
 * 内处于占位态的 `.video-state`（「视频设备未连接」），按终端顺序分配不同视频，
 * 避免重复使用同一路录像。
 *
 * 视频从 v03 起（v01/v02 已用于「重症监控」Canvas 平面图两张床），
 * 第 N 个终端对应 v(3+N)。若仅两个终端，则为 v03、v04。
 *
 * 只轮询填充，不监听整页变化，避免和 React 重渲染互相触发把页面卡死。
 */
;(function () {
  const START = 3
  const pad = (n) => (n < 10 ? '0' : '') + n

  function fillOnce() {
    const grid = document.querySelector('.town-video-grid')
    if (!grid) return
    grid.querySelectorAll('.video-pane').forEach((pane, idx) => {
      if (pane.querySelector('video[data-hx-town-cam]')) return
      const state = pane.querySelector('.video-state')
      if (!state) return

      const n = START + idx
      const v = document.createElement('video')
      v.src = `/media/v${pad(n)}.mp4`
      v.autoplay = true
      v.muted = true
      v.loop = true
      v.playsInline = true
      v.setAttribute('playsinline', '')
      v.dataset.hxTownCam = String(n)
      state.replaceWith(v)

      const sig = pane.querySelector('.signal')
      if (sig) {
        sig.textContent = '实时画面'
        sig.classList.add('online')
      }
    })
  }

  fillOnce()
  setInterval(fillOnce, 1500)
  window.addEventListener('hashchange', () => setTimeout(fillOnce, 200))
})()