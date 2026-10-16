/**
 * 基层医声 Dr：连续播放并入播放列表标题栏
 */
;(function () {
  function enhanceContinuousPlayback() {
    if (!document.querySelector('.dr-page')) return

    const label = document.querySelector('.dr-page label.dr-continuous:not([data-dr-placed])')
    const head = document.querySelector('.dr-page .dr-playlist .dr-pl-head')
    if (!label || !head) return

    const wrap = label.parentElement
    head.appendChild(label)
    label.classList.add('dr-continuous--in-head')
    label.setAttribute('data-dr-placed', '1')

    if (wrap && wrap !== head && wrap.childElementCount === 0) wrap.remove()
  }

  function tick() {
    enhanceContinuousPlayback()
    document.querySelectorAll('.hx-dr-video-label').forEach((el) => el.remove())
  }

  window.hxEnhance(tick, { wait: 400, observeRoot: true, afterNav: 80 })
})()
