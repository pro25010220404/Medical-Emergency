/**
 * 重症监控 · Canvas 平面图：把本地演示录像覆盖到两张床的「视频画面」矩形上
 *
 * bundle 中 Ix 组件的绘制坐标（CSS 像素）：
 *   床宽 b = max(35, W*0.16)，床高 x = H*0.43
 *   视频画面矩形：left = W*P + 2，top = H*0.40，width = b-4，height = x*0.56
 *   P 依次为 0.23（左床）与 0.66（右床）
 *
 * 左床 /media/v01.mp4，右床 /media/v02.mp4，两路不同录像。
 * 采用 getBoundingClientRect 换算为页面绝对坐标，叠加到 document.body，
 * 避免面板 header/padding 造成的百分比偏移；持续轮询 + resize/scroll 校正。
 */
;(function () {
  const BEDS = [
    { p: 0.23, src: '/media/v01.mp4' },
    { p: 0.66, src: '/media/v02.mp4' },
  ]

  let videos = []

  function computeRects(canvas) {
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    if (!W || !H) return null
    const b = Math.max(35, W * 0.16)
    const bedH = H * 0.43 * 0.56
    const r = canvas.getBoundingClientRect()
    const ox = r.left + (window.scrollX || 0)
    const oy = r.top + (window.scrollY || 0)
    return BEDS.map((cfg) => ({
      left: ox + W * cfg.p + 2,
      top: oy + H * 0.4,
      width: b - 4,
      height: bedH,
    }))
  }

  function removeAll() {
    videos.forEach((v) => v.remove())
    videos = []
  }

  function mount() {
    const canvas = document.querySelector('canvas.ward-scene[aria-label="重症病区代码演示场景"]')
    if (!canvas) {
      removeAll()
      return
    }
    const rects = computeRects(canvas)
    if (!rects) {
      removeAll()
      return
    }

    if (videos.length !== BEDS.length) {
      removeAll()
      BEDS.forEach((cfg) => {
        const v = document.createElement('video')
        v.src = cfg.src
        v.autoplay = true
        v.muted = true
        v.loop = true
        v.playsInline = true
        v.setAttribute('playsinline', '')
        v.setAttribute('data-hx-ward', '1')
        v.style.cssText =
          'position:absolute;object-fit:cover;z-index:50;pointer-events:none;' +
          'background:#14333c;margin:0;padding:0;border-radius:1px;display:block;'
        document.body.appendChild(v)
        videos.push(v)
      })
    }

    videos.forEach((v, i) => {
      const r = rects[i]
      v.style.left = r.left + 'px'
      v.style.top = r.top + 'px'
      v.style.width = r.width + 'px'
      v.style.height = r.height + 'px'
    })
  }

  mount()
  setInterval(mount, 800)
  window.addEventListener('hashchange', () => setTimeout(mount, 200))
  window.addEventListener('resize', mount)
  window.addEventListener('scroll', mount)
})()