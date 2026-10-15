/**
 * 县域智慧重症 · 重症监护：用本地演示录像轮播填充床位视频区
 *
 * 目标：`.critical-grid > .critical-bed` 中处于占位态的 `.video-pane`
 * （存在 `.video-state`「视频设备未连接」且无 video 元素），
 * 按床位顺序循环分配 public/media/v01.mp4 … v11.mp4 模拟实时监控画面。
 * 有患者体征的床显示 `.bed-mini-monitor`（无 video-pane），不受影响。
 *
 * 只轮询填充。不要用 MutationObserver 盯整页：往 React 床位里插 video 会触发重渲染，再插一次，页面会卡死。
 */
;(function () {
  const VIDEO_COUNT = 11
  const pad = (n) => (n < 10 ? '0' : '') + n
  let filling = false

  function onCriticalBeds() {
    const raw = location.hash.replace(/^#/, '')
    const path = (raw.split('?')[0] || '/').replace(/\/$/, '') || '/'
    if (path !== '/critical') return false
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    const query = new URLSearchParams(q)
    if (query.get('view') === 'wards' || query.get('mode') === 'town') return false
    return true
  }

  function fillOnce() {
    if (filling || !onCriticalBeds()) return
    const grid = document.querySelector('.critical-grid')
    if (!grid) return
    filling = true
    try {
    grid.querySelectorAll('.critical-bed').forEach((bed, idx) => {
      const pane = bed.querySelector('.video-pane')
      if (!pane || pane.querySelector('video')) return
      const state = pane.querySelector('.video-state')
      if (!state) return

      const n = (idx % VIDEO_COUNT) + 1
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
    } finally {
      filling = false
    }
  }

  fillOnce()
  setInterval(fillOnce, 1500)
  window.addEventListener('hashchange', () => setTimeout(fillOnce, 200))
})()