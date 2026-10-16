/**
 * 统一视频监控占位：床位 / 车内 / 会诊等（演示未接摄像头）
 */
;(function () {
  const COPY = {
    bed: { title: '床旁监护', hint: '演示环境未接入摄像头，正式环境将在此显示床旁实时画面。' },
    vehicle: { title: '车内监控', hint: '演示环境未接入摄像头，正式环境将显示救护车实时画面。' },
    default: { title: '视频监控', hint: '演示环境未接入摄像头，正式环境将在此显示实时画面。' },
  }

  function blockHtml(kind) {
    const c = COPY[kind] || COPY.default
    return `<div class="hx-video-placeholder" role="status" aria-live="polite">
      <span class="hx-video-placeholder__icon" aria-hidden="true"></span>
      <strong class="hx-video-placeholder__title">${c.title}</strong>
      <span class="hx-video-placeholder__hint">${c.hint}</span>
    </div>`
  }

  function chipHtml(kind) {
    return `<span class="hx-video-placeholder hx-video-placeholder--chip" role="status" title="演示环境未接摄像头">演示未接</span>`
  }

  function innerBlock(kind) {
    const c = COPY[kind] || COPY.default
    return `<span class="hx-video-placeholder__icon" aria-hidden="true"></span>
      <strong class="hx-video-placeholder__title">${c.title}</strong>
      <span class="hx-video-placeholder__hint">${c.hint}</span>`
  }

  function skipVideoEl(el) {
    return !!el?.closest('.bed-tile, .monitor-grid .bed-board, .bed-board')
  }

  function normalizeBlock(el, kind) {
    if (!el || skipVideoEl(el) || el.dataset.hxVideoNorm === '1') return
    if (el.querySelector('.hx-video-placeholder__title')) {
      el.dataset.hxVideoNorm = '1'
      return
    }
    el.classList.add('hx-video-placeholder', 'hx-video-placeholder--block')
    el.dataset.hxVideo = kind
    el.setAttribute('role', 'status')
    el.innerHTML = innerBlock(kind)
    el.dataset.hxVideoNorm = '1'
  }

  function bedTileChips() {
    document.querySelectorAll('.bed-tile, .bed-board.bed-tile').forEach((tile) => {
      if (tile.querySelector('.hx-video-chip-foot, video, iframe')) return
      const foot = document.createElement('div')
      foot.className = 'hx-video-chip-foot'
      foot.innerHTML = chipHtml('bed')
      tile.appendChild(foot)
    })
  }

  function criticalBedChips() {
    // 重症监护床位视频区由 bed-video-fill-enhance 用本地录像填充，不再叠加「演示未接」角标
    document.querySelectorAll('.critical-bed').forEach((el) => {
      if (el.querySelector('.free-bed')) return // 空床不加「演示未接」角标
      if (el.querySelector('.video-pane video, .hx-video-chip-foot, video, iframe')) return
      el.classList.add('hx-critical-bed-video')
      const foot = document.createElement('div')
      foot.className = 'hx-video-chip-foot'
      foot.innerHTML = chipHtml('bed')
      el.appendChild(foot)
    })
  }

  function attachDemoBedVideo() {
    const p = (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
    if (!p.startsWith('/bed/')) return
    const pane = document.querySelector(
      '.single-bed .video-pane.hx-video-placeholder--block, .single-bed .hx-video-placeholder--block, .single-bed .video-pane',
    )
    if (!pane || pane.querySelector('.hx-demo-video-play, video')) return
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'hx-demo-video-play'
    btn.textContent = '播放演示片'
    btn.addEventListener('click', () => {
      const v = document.createElement('video')
      v.className = 'hx-demo-video-el'
      v.controls = true
      v.playsInline = true
      v.src = '/assets/demo/bed-demo.mp4'
      v.onerror = () => {
        pane.innerHTML = innerBlock('bed')
        const hint = document.createElement('p')
        hint.className = 'hx-demo-video-miss'
        hint.textContent = '请将 MP4 放到 public/assets/demo/bed-demo.mp4 后刷新。'
        pane.appendChild(hint)
      }
      pane.replaceChildren(v)
      v.play().catch(() => {})
    })
    pane.appendChild(btn)
  }

  function ensureVehicleLiveBox() {
    // 实时出警 · 查看车内画面弹窗：单独一个「车内实时画面」盒子放本地录像；
    // 云台 / 网络 / 终端三路摄像头保持「未接」占位，不再逐个注入视频
    const mon = document.querySelector('.vehicle-monitor')
    if (!mon || mon.querySelector('.hx-vehicle-live')) return

    const box = document.createElement('section')
    box.className = 'hx-vehicle-live'
    box.style.cssText =
      'grid-column:1/-1;display:flex;flex-direction:column;gap:8px;' +
      'background:#fff;border:1px solid #e2e8f0;border-radius:10px;' +
      'padding:10px 12px 12px;box-sizing:border-box;'

    const head = document.createElement('div')
    head.style.cssText = 'font-size:13px;font-weight:600;color:#0f172a;line-height:1.35;'
    head.textContent = '车内实时画面'

    const wrap = document.createElement('div')
    wrap.style.cssText =
      'position:relative;height:min(48dvh,400px);min-height:220px;' +
      'background:#040c15;border:1px solid #204771;border-radius:8px;overflow:hidden;'

    const v = document.createElement('video')
    v.src = '/media/v09.mp4'
    v.autoplay = true
    v.muted = true
    v.loop = true
    v.playsInline = true
    v.setAttribute('playsinline', '')
    v.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;'
    v.dataset.hxVehicleLive = '1'

    wrap.appendChild(v)
    box.appendChild(head)
    box.appendChild(wrap)
    mon.insertBefore(box, mon.firstChild)
  }

  function scan() {
    bedTileChips()
    criticalBedChips()
    attachDemoBedVideo()
    document.querySelectorAll('.dh-video').forEach((el) => normalizeBlock(el, 'vehicle'))

    document.querySelectorAll('.video-pane, .video-state, .clinical-device-frame').forEach((el) => {
      if (el.closest('.critical-grid, .town-monitor, .vehicle-monitor')) return
      const t = (el.textContent || '').trim()
      if (!t && !el.querySelector('video, iframe, canvas')) normalizeBlock(el, 'bed')
      else if (/未接|占位|摄像头|画面/.test(t) && !el.querySelector('.hx-video-placeholder__title')) {
        normalizeBlock(el, el.closest('.dispatch-screen, .transport-monitor') ? 'vehicle' : 'bed')
      }
    })

    document.querySelectorAll('.hx-care-dock .hx-slot').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (!/画面|监控|摄像头|未接/.test(t)) return
      if (el.classList.contains('hx-video-placeholder')) return
      el.outerHTML = chipHtml('bed')
    })
  }

  function scanAndSyncStrip() {
    scan()
    if (typeof window.__hxCareLinkRender === 'function') window.__hxCareLinkRender()
  }

  window.hxVideoPlaceholder = { blockHtml, chipHtml, scan }
  window.hxEnhance(scanAndSyncStrip, { wait: 350, observeRoot: true, afterNav: 100 })

  // 车内画面弹窗由 React 状态切换（非 hashchange）打开，需独立轮询注入单视频盒
  ensureVehicleLiveBox()
  setInterval(ensureVehicleLiveBox, 1500)
  window.addEventListener('hashchange', () => setTimeout(ensureVehicleLiveBox, 200))
})()
