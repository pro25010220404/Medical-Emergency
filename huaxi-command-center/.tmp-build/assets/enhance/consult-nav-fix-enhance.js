/**

 * 远程会诊列表（p2）：「进入会诊室」→ 连续诊疗 #/episode（p3），再在 episode 点「进入视频会诊」→ #/room（p4）。

 * 归一 hash、修复 React 重绘后点击失效。

 */

;(function () {

  function hashPath() {

    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'

  }



  function hashQuery() {

    const raw = location.hash.replace(/^#/, '')

    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''

    return new URLSearchParams(q)

  }



  function isGrassrootsTab() {

    const q = hashQuery()

    return q.get('tab') === 'grassroots' || q.get('scope') === 'grassroots'

  }



  function pickEntryHash() {

    return isGrassrootsTab()

      ? '#/consultations/pick?tab=grassroots&hospital=weiyuan&dept=emergency'

      : '#/consultations/pick?hospital=weiyuan&dept=emergency'

  }



  function normalizeAppHash(href) {

    if (!href) return ''

    let h = String(href).trim()

    if (window.hxConsultEpisodeNav?.normalizeHash) {

      h = window.hxConsultEpisodeNav.normalizeHash(h)

    } else if (h.indexOf('/#/') === 0) {

      h = h.slice(1)

    }

    if (h.charAt(0) === '#') return h

    try {

      const u = new URL(h, location.origin)

      if (u.hash && u.hash.charAt(0) === '#') return u.hash

      const path = u.pathname || ''

      if (/\/room\/[^/]+/i.test(path)) {

        const tok = path.split('/room/')[1].split('/')[0]

        return tok ? '#/room/' + tok : ''

      }

      if (/\/episode\/[^/]+/i.test(path)) {

        const eid = path.split('/episode/')[1].split('/')[0]

        return eid ? '#/episode/' + eid : ''

      }

      if (/\/consultations\/pick/i.test(path)) {

        return '#/consultations/pick' + (u.search || '')

      }

    } catch {

      /* ignore */

    }

    if (h.includes('consultations/pick')) {

      const qi = h.indexOf('?')

      return '#/consultations/pick' + (qi >= 0 ? h.slice(qi) : '')

    }

    if (h.includes('/room/')) {

      const tok = h.split('/room/')[1].split(/[?#]/)[0]

      return tok ? '#/room/' + decodeURIComponent(tok) : ''

    }

    return ''

  }



  function assignHash(href) {

    const h = normalizeAppHash(href) || (href && href.charAt(0) === '#' ? href : '')

    if (!h || h.charAt(0) !== '#') return false

    if (location.hash !== h) location.hash = h

    else window.dispatchEvent(new HashChangeEvent('hashchange'))

    return true

  }



  /** 会诊列表页：先进 episode，无映射再进 room */

  function preferEpisodeFromList() {

    const p = hashPath()

    return p === '/consultations' || p.indexOf('/consultations/') === 0

  }



  function tokenFromRoomHash(roomHash) {

    if (!roomHash || roomHash.indexOf('#/room/') !== 0) return ''

    return decodeURIComponent(roomHash.slice('#/room/'.length).split('?')[0] || '')

  }



  function patientHintFromCard(card) {

    if (!card) return ''

    const tok = card.getAttribute('data-consultation-token')

    if (tok) return { token: tok, patientId: '' }

    const strong = card.querySelector('header strong')?.textContent?.trim() || ''

    return { token: '', patientId: '', name: strong }

  }



  function episodeHashForRoom(roomHash, card) {

    const nav = window.hxConsultEpisodeNav

    if (!nav || !nav.episodeHash) return ''

    const token = tokenFromRoomHash(roomHash)

    const hint = patientHintFromCard(card)

    const useToken = token || hint.token || ''

    return nav.episodeHash({ token: useToken, patientId: hint.patientId || '' }) || ''

  }



  function navigateConsultEntry(roomHash, card) {

    if (!roomHash) return false

    if (!preferEpisodeFromList()) return assignHash(roomHash)

    const nav = window.hxConsultEpisodeNav

    const run = () => {

      const ep = episodeHashForRoom(roomHash, card)

      if (ep) return assignHash(ep)

      return assignHash(roomHash)

    }

    if (nav && nav.loadScenarioIndex) {

      return nav.loadScenarioIndex().then(run).catch(run)

    }

    return run()

  }



  function roomHashFromCard(card) {

    if (!card) return ''

    const roomA = card.querySelector(

      'a[href*="room/"], a.consult-link[href], footer a[href*="room/"]',

    )

    if (roomA) {

      const nh = normalizeAppHash(roomA.getAttribute('href') || '')

      if (nh) return nh

    }

    const token = card.querySelector('[data-consultation-token]')?.getAttribute('data-consultation-token')

    if (token) return '#/room/' + encodeURIComponent(token)

    const mono = card.querySelector('.consult-link')?.textContent?.trim()

    if (mono && /^[\w.-]+$/.test(mono)) return '#/room/' + encodeURIComponent(mono)

    return ''

  }



  function onDocClick(e) {

    if (!/\/app\.html$/i.test(location.pathname)) return

    if (!(e.target instanceof Element)) return

    const inMain = e.target.closest('main.workspace')

    if (!inMain) return



    const pickCtl = e.target.closest('.workspace-heading a, .workspace-heading button')

    if (pickCtl && /选择患者/.test((pickCtl.textContent || '').replace(/\s+/g, ''))) {

      e.preventDefault()

      e.stopPropagation()

      assignHash(pickEntryHash())

      return

    }



    const card = e.target.closest('article') || undefined



    const a = e.target.closest('a[href]')

    if (a) {

      const nh = normalizeAppHash(a.getAttribute('href') || '')

      if (nh && nh.indexOf('#/room/') === 0 && preferEpisodeFromList()) {

        e.preventDefault()

        e.stopPropagation()

        navigateConsultEntry(nh, card || a.closest('article'))

        return

      }

      if (nh && /^#\/(room|episode|consultations\/pick|patient)/.test(nh)) {

        e.preventDefault()

        e.stopPropagation()

        assignHash(nh)

        return

      }

    }



    // data-act="join" 是会诊工作台队列的「进入会诊室」按钮：点击直接取入会链接跳远程会诊系统，
    // 不再中转 episode；其余同名文案按钮保持原有 episode 中转流。
    const btn = e.target.closest('button, a.button, a.primary')
    if (btn && btn.getAttribute('data-act') !== 'join' &&
        /进入会诊室|进入视频会诊/.test((btn.textContent || '').trim())) {

      const rh = roomHashFromCard(btn.closest('article'))

      if (rh) {

        e.preventDefault()

        e.stopPropagation()

        navigateConsultEntry(rh, btn.closest('article'))

      }

    }

  }



  document.addEventListener('click', onDocClick, true)

})()


