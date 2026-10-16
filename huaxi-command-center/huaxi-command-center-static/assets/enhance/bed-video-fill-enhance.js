/**
 * 县域智慧重症 · 重症监护：用本地演示录像轮播填充床位视频区
 *
 * 目标：`.critical-grid > .critical-bed` 中处于占位态的 `.video-pane`
 * （存在 `.video-state`「视频设备未连接」且无 video 元素），
 * 按床位顺序循环分配 public/media/v01.mp4 … v11.mp4 模拟实时监控画面。
 * 有患者体征的床显示 `.bed-mini-monitor`（无 video-pane），不受影响。
 *
 * 触发策略（不依赖 hxEnhance / hashchange，应对刷新直接进 #/critical）：
 *  - 立即执行一次 + 持续轮询 fillOnce（幂等，已注入则跳过）
 *  - MutationObserver 观察 document.body，捕获 React 异步渲染/重渲染
 */
;(function () {
  const VIDEO_COUNT = 11
  const pad = (n) => (n < 10 ? '0' : '') + n

  function fillOnce() {
    const grid = document.querySelector('.critical-grid')
    if (!grid) return
    let camIdx = 0
    grid.querySelectorAll('.critical-bed').forEach((bed) => {
      const bedVideo = bed.querySelector('.bed-video')
      // 空床/已预留床位：隐藏视频占位，只显示空床
      if (bed.querySelector('.free-bed')) {
        if (bedVideo) bedVideo.style.display = 'none'
        return
      }
      if (bedVideo) bedVideo.style.display = ''
      const pane = bed.querySelector('.video-pane')
      if (!pane || pane.querySelector('video')) return
      const state = pane.querySelector('.video-state')
      if (!state) return

      const n = (camIdx % VIDEO_COUNT) + 1
      camIdx += 1
      const v = document.createElement('video')
      v.src = `/media/v${pad(n)}.mp4`
      v.autoplay = true
      v.muted = true
      v.loop = true
      v.playsInline = true
      v.setAttribute('playsinline', '')
      v.dataset.hxBedCam = String(n)
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

  const mo = new MutationObserver(() => fillOnce())
  function observe() {
    mo.observe(document.body, { childList: true, subtree: true })
  }
  if (document.body) observe()
  else document.addEventListener('DOMContentLoaded', observe, { once: true })

  // 若存在 hxEnhance 也挂上，作为额外触发点；失败不影响主流程
  try {
    if (typeof window.hxEnhance === 'function') {
      window.hxEnhance(fillOnce, { wait: 250, afterNav: 100 })
    }
  } catch (e) {
    /* ignore */
  }
})()