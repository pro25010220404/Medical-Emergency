/**
 * 床 / 患者 / 设备：医生一条工具栏互跳（读 care-bindings + scenario 占用床）
 */
;(function () {
  /** @type {{ list: object[], byBed: Map<string, object>, byPatient: Map<string, object>, byDevice: Map<string, object> } | null} */
  let index = null
  let loadPromise = null

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function hashQuery() {
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    return new URLSearchParams(q)
  }

  function normalize(row) {
    const bedLabel = row.bedLabel || row.label || '床位'
    return {
      scope: row.scope || '',
      hospital: row.hospital || '',
      ward: row.ward || '',
      bedId: row.bedId,
      bedLabel,
      patientId: row.patientId,
      patientName: row.patientName || row.patientId,
      deviceId: row.deviceId || (row.bedId ? `MON-${row.bedId}` : ''),
      deviceName: row.deviceName || '床旁设备',
    }
  }

  function mergeBindings(apiRows, state) {
    const byBed = new Map()
    for (const row of apiRows || []) {
      if (!row.bedId || !row.patientId) continue
      byBed.set(row.bedId, normalize(row))
    }
    const patients = state?.patients || []
    for (const bed of state?.beds || []) {
      if (bed.status !== 'occupied' || !bed.patientId) continue
      if (byBed.has(bed.id)) continue
      const pat = patients.find((p) => p.id === bed.patientId)
      byBed.set(bed.id, normalize({
        scope: '在院床位',
        bedId: bed.id,
        bedLabel: bed.label || bed.id,
        patientId: bed.patientId,
        patientName: pat?.name || bed.patientId,
        deviceId: `MON-${bed.id}`,
        deviceName: '监护仪',
      }))
    }
    const list = [...byBed.values()]
    const byPatient = new Map()
    const byDevice = new Map()
    for (const b of list) {
      byPatient.set(b.patientId, b)
      if (b.deviceId) byDevice.set(b.deviceId, b)
    }
    return { list, byBed, byPatient, byDevice }
  }

  function loadIndex() {
    if (index) return Promise.resolve(index)
    if (loadPromise) return loadPromise
    loadPromise = Promise.all([
      fetch('/api/care-bindings.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { bindings: [] })),
      fetch('/scenario.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { state: {} })),
    ])
      .then(([care, scen]) => {
        index = mergeBindings(care.bindings, scen.state || scen)
        return index
      })
      .catch(() => {
        index = mergeBindings([], {})
        return index
      })
    return loadPromise
  }

  function findBind() {
    if (!index) return null
    const p = path()
    const bed = p.match(/^\/bed\/([^/]+)/)
    if (bed) return index.byBed.get(decodeURIComponent(bed[1])) || null
    const pat = p.match(/^\/patient\/([^/]+)/)
    if (pat) return index.byPatient.get(decodeURIComponent(pat[1])) || null
    const qBed = hashQuery().get('bed')
    if (qBed) return index.byBed.get(qBed) || null
    return null
  }

  function hasMainBedVideo() {
    return !!document.querySelector(
      '.single-bed .video-pane, .single-bed .hospital-video, .single-bed .hx-video-placeholder--block',
    )
  }

  /** 列表/工具条用小标签；单床页右侧已有大占位时不重复 */
  function videoChipLine(mode) {
    if (mode === 'bed' && hasMainBedVideo()) return ''
    return `<span class="hx-video-placeholder hx-video-placeholder--chip" role="status" title="演示环境未接摄像头">演示未接</span>`
  }

  function stripHtml(bind, mode) {
    const bedHref = `/#/bed/${encodeURIComponent(bind.bedId)}`
    const patHref = `/#/patient/${encodeURIComponent(bind.patientId)}`
    const devHref = `/#/devices?bed=${encodeURIComponent(bind.bedId)}`
    const back =
      mode === 'bed'
        ? `<a class="hx-back" href="/#/beds">返回科室床位</a>`
        : mode === 'patient'
          ? `<a class="hx-back" href="${bedHref}">返回 ${bind.bedLabel}</a>`
          : mode === 'devices'
            ? `<a class="hx-back" href="${bedHref}">返回 ${bind.bedLabel}</a>`
            : `<a class="hx-back" href="/#/critical">返回重症监护</a>`
    const meta =
      bind.hospital || bind.scope
        ? `<span class="hx-care-meta">${bind.scope ? `${bind.scope} · ` : ''}${bind.hospital || bind.ward}</span>`
        : ''
    return `<div class="hx-strip">
      ${back}
      ${meta}
      <a href="${patHref}">${bind.patientName}</a>
      <a href="${bedHref}">${bind.bedLabel}</a>
      <a href="${devHref}">${bind.deviceName || '床旁设备'}</a>
      ${videoChipLine(mode)}
    </div>`
  }

  function devicesStrip(idx) {
    const qBed = hashQuery().get('bed')
    const bind = qBed ? idx.byBed.get(qBed) : null
    if (bind) {
      return `<div class="hx-strip hx-devices-strip">
        <a class="hx-back" href="/#/critical">返回重症监护</a>
        <span class="hx-care-meta">当前床位上下文：<strong>${bind.bedLabel}</strong> · ${bind.patientName}</span>
        <a href="/#/bed/${encodeURIComponent(bind.bedId)}">单床监护</a>
      </div>`
    }
    return `<div class="hx-strip hx-devices-strip">
      <a class="hx-back" href="/#/critical">返回重症监护</a>
      <span class="hx-slot">在设备列表每行点击 <strong>绑定床位</strong>，在弹窗内按 <strong>机构 → 科室 → 床位</strong> 完成绑定（无需先去科室页选床）</span>
    </div>`
  }

  function tagCriticalBedScopes(idx) {
    document.querySelectorAll('.critical-bed').forEach((el) => {
      const bind = resolveBedFromCard(el, idx)
      if (!bind) return
      const header = el.querySelector('header')
      if (!header || header.querySelector('.hx-bed-scope')) return
      const label = [bind.scope, bind.hospital || bind.ward].filter(Boolean).join(' · ')
      if (!label) return
      const span = document.createElement('span')
      span.className = 'hx-bed-scope'
      span.textContent = label
      header.appendChild(span)
    })
  }

  function resolveBedFromCard(el, idx) {
    const name = el.querySelector('.bed-summary b')?.textContent?.trim()
    if (name) {
      const byName = idx.list.find((b) => b.patientName === name)
      if (byName) return byName
    }
    const h2 = el.querySelector('header h2')?.textContent || ''
    const label = h2.replace(/^床位\s*/, '').trim()
    if (!label) return null
    const hits = idx.list.filter((b) => b.bedLabel === label || `${b.bedLabel}`.includes(label))
    return hits.length === 1 ? hits[0] : null
  }

  function wireCriticalBeds(idx) {
    const p = path()
    if (p !== '/critical' && !p.startsWith('/critical/')) return
    document.querySelectorAll('.critical-bed').forEach((el) => {
      if (el.dataset.hxBedWire === '1') return
      const bind = resolveBedFromCard(el, idx)
      if (!bind) return
      el.dataset.hxBedWire = '1'
      el.dataset.hxBedId = bind.bedId
      const go = () => {
        location.hash = `#/bed/${encodeURIComponent(bind.bedId)}`
      }
      el.addEventListener('click', (e) => {
        if (e.target.closest('button, a, .icon-button')) return
        go()
      })
      el.addEventListener('keydown', (e) => {
        if (e.target.closest('button, a')) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go()
        }
      })
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0
      el.setAttribute('role', 'link')
      el.setAttribute('aria-label', `进入 ${bind.bedLabel} 单床监护`)
    })
  }

  function mount(host, id, html, mode) {
    if (!host) return
    let box = document.getElementById(id)
    if (box && box.parentElement !== host) {
      box.remove()
      box = null
    }
    if (!box) {
      box = document.createElement('div')
      box.id = id
      box.className = 'hx-care-dock'
      if (mode === 'after') host.insertAdjacentElement('afterend', box)
      else host.insertBefore(box, host.firstChild)
    }
    if (box.dataset.html === html) return
    box.dataset.html = html
    box.innerHTML = html
  }

  function render() {
    const p = path()
    const onCare =
      p.startsWith('/bed/') || p.startsWith('/patient/') || p === '/devices' || p === '/beds' || p === '/critical' || p.startsWith('/critical')
    if (!onCare) {
      // 只清理本脚本自己的 dock。
      // 以前这里是 remove() 掉所有 .hx-care-dock，会把 consult-context-enhance 的
      // #hx-consult-context 一起删掉；对方随即重建 → 又被删 → 配合 hxEnhance 的
      // root 观察形成死循环（约每 350ms 一轮），页面持续闪动。
      for (const id of ['hx-dock-bed', 'hx-dock-patient', 'hx-dock-devices', 'hx-dock-critical']) {
        document.getElementById(id)?.remove()
      }
      return
    }

    loadIndex().then((idx) => {
      if (p.startsWith('/bed/') && document.querySelector('.single-bed')) {
        // 单床页已由后端接口直渲（vendor bundle hfe），不再注入 scenario 演示数据工具条
        document.getElementById('hx-dock-bed')?.remove()
        return
      }

      if (p.startsWith('/patient/') && document.querySelector('.patient-identity')) {
        // 患者详情页顶部面包屑条按需求移除
        document.getElementById('hx-dock-patient')?.remove()
        return
      }

      if (p === '/devices' && document.querySelector('.workspace')) {
        mount(document.querySelector('.workspace'), 'hx-dock-devices', devicesStrip(idx))
        return
      }

      if (p === '/critical' || p.startsWith('/critical/')) {
        wireCriticalBeds(idx)
        tagCriticalBedScopes(idx)
      }

      document.getElementById('hx-dock-critical')?.remove()

      document.querySelectorAll('.hx-care-dock').forEach((n) => {
        if (!['hx-dock-bed', 'hx-dock-patient', 'hx-dock-devices'].includes(n.id)) n.remove()
      })
    })
  }

  window.addEventListener('hashchange', () => {
    index = null
    loadPromise = null
    document.querySelectorAll('.hx-care-dock').forEach((n) => {
      n.dataset.html = ''
    })
  })

  window.__hxCareLinkRender = render
  window.hxEnhance(render, { wait: 350, observeRoot: true, afterNav: 60 })
})()
