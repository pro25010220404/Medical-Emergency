/**
 * 基层医声 · 急救视频：本地无 /media/*.mp4 时嵌入 B 站
 */
;(function () {
  /** @type {Record<string, { bvid: string, title: string, topic: string }>} */
  const BILI_VIDEOS = {
    cpr: {
      bvid: 'BV1Sp4y1z7wN',
      title: '迈瑞AED动画急救演示',
      topic: '应急急救 · AED 操作演示',
    },
    earthquake: {
      bvid: 'BV1sA411J7WY',
      title: '地震时的正确求生法',
      topic: '避险自救 · 健康素养',
    },
    flu: {
      bvid: 'BV1BmCLBmE3D',
      title: '流感防控动画科普视频',
      topic: '疾病预防 · 流感防控',
    },
  }

  function embedSrc(bvid) {
    return `https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0&autoplay=0`
  }

  function videoIdFromEl(video) {
    const src = video.getAttribute('src') || video.src || ''
    const m = src.match(/\/media\/([^.?#]+)\.mp4/i)
    return m ? m[1] : ''
  }

  function panelOf(player) {
    return player.closest('.dr-player-panel')
  }

  function teardown(player) {
    player.classList.remove('dr-player--bili')
    panelOf(player)?.classList.remove('dr-player-panel--bili')
    player.querySelectorAll('.dr-bilibili-embed').forEach((el) => el.remove())
    const video = player.querySelector('video')
    if (video) {
      video.hidden = false
      video.style.display = ''
      delete video.dataset.hxBiliHidden
    }
    delete player.dataset.hxBiliVideoId
  }

  function mount(player, video, id, cfg) {
    if (player.dataset.hxBiliVideoId === id && player.querySelector('.dr-bilibili-embed')) return

    teardown(player)

    const iframe = document.createElement('iframe')
    iframe.className = 'dr-bilibili-embed'
    iframe.src = embedSrc(cfg.bvid)
    iframe.title = cfg.title
    iframe.loading = 'lazy'
    iframe.allow = 'fullscreen; encrypted-media'
    iframe.allowFullscreen = true
    iframe.setAttribute('frameborder', '0')
    iframe.setAttribute('scrolling', 'no')

    video.hidden = true
    video.style.display = 'none'
    video.dataset.hxBiliHidden = '1'
    player.insertBefore(iframe, video)
    player.classList.add('dr-player--bili')
    panelOf(player)?.classList.add('dr-player-panel--bili')
    player.dataset.hxBiliVideoId = id

    const cap = player.querySelector('.dr-caption h3')
    if (cap) cap.textContent = cfg.title
    const topic = player.querySelector('.dr-topic')
    if (topic) topic.textContent = cfg.topic
  }

  function sync() {
    const page = document.querySelector('.dr-page')
    if (!page) return

    const video = page.querySelector('.dr-player video')
    const player = video?.closest('.dr-player')
    if (!video || !player) return

    const id = videoIdFromEl(video)
    const cfg = BILI_VIDEOS[id]
    if (cfg) mount(player, video, id, cfg)
    else if (player.dataset.hxBiliVideoId) teardown(player)
  }

  window.hxEnhance(sync, { wait: 350, observeRoot: true, afterNav: 120 })
})()
