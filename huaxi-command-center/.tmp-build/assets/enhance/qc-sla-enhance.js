/**
 * 环节时限：读 qc-sla.json 规则，并用 scenario 预警 / 出车演示计算是否超时
 */
;(function () {
  const DEFAULT_RULES = [
    { id: 'SLA-ALERT', name: '预警后到床', limitMinutes: 10, audience: '医生看自己这条是否超时' },
    { id: 'SLA-DISPATCH', name: '出警后到院', limitMinutes: 30, audience: '护士长 / 院长看超时列表' },
  ]
  const MAX_ALERT_AGE_MS = 7 * 24 * 60 * 60 * 1000

  function limitForKind(kind, rules) {
    const list = rules?.length ? rules : DEFAULT_RULES
    if (kind === '预警到床') return list.find((r) => r.id === 'SLA-ALERT')?.limitMinutes ?? 10
    if (kind === '出警到院') return list.find((r) => r.id === 'SLA-DISPATCH')?.limitMinutes ?? 30
    return 10
  }

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function minutesBetween(a, b) {
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000))
  }

  function staffName(state, id) {
    if (!id) return '当班医生'
    const s = (state.staff || []).find((x) => x.id === id)
    return s?.name?.replace(/（演示）/, '') || id
  }

  function alertOwner(state, alert) {
    const rec = alert.records?.[alert.records.length - 1]
    if (rec?.actorId) return staffName(state, rec.actorId)
    const pat = (state.patients || []).find((p) => p.id === alert.patientId)
    if (pat?.assignedTo?.[0]) return staffName(state, pat.assignedTo[0])
    return '当班医生'
  }

  function alertSubject(state, alert) {
    const pat = (state.patients || []).find((p) => p.id === alert.patientId)
    const bed = (state.beds || []).find((b) => b.patientId === alert.patientId)
    const name = pat?.name || alert.patientId
    return bed ? `${name} · ${bed.label}` : name
  }

  function computeAlertRows(state, limitMin) {
    const rows = []
    const now = Date.now()
    for (const alert of state.alerts || []) {
      if (alert.status === 'resolved') continue
      const started = new Date(alert.createdAt)
      if (now - started.getTime() > MAX_ALERT_AGE_MS) continue
      let arrived = null
      if (alert.records?.length) arrived = new Date(alert.records[alert.records.length - 1].at)
      else if (alert.status !== 'new') arrived = new Date(alert.updatedAt)

      let usedMinutes
      let result
      let arrivedLabel = '—'
      if (arrived) {
        usedMinutes = minutesBetween(started, arrived)
        result = usedMinutes > limitMin ? '超时' : '达标'
        arrivedLabel = `${usedMinutes} 分钟`
      } else {
        usedMinutes = minutesBetween(started, new Date())
        result = usedMinutes > limitMin ? '超时' : '待到达'
        arrivedLabel = result === '待到达' ? `已 ${usedMinutes} 分钟` : `${usedMinutes} 分钟`
      }
      rows.push({
        kind: '预警到床',
        subject: alertSubject(state, alert),
        owner: alertOwner(state, alert),
        limitMinutes: limitMin,
        used: arrivedLabel,
        result,
        over: result === '超时',
        source: 'scenario',
        id: alert.id,
      })
    }
    return rows
  }

  function computeDispatchRows(state, live, limitMin) {
    const rows = []
    const liveEvents = live?.events || []
    for (const ev of liveEvents) {
      const started = new Date(ev.startedAt)
      let arrived = null
      if (ev.status && /到院|已完成|送达/.test(ev.status)) {
        arrived = new Date(started.getTime() + (ev.etaHospitalMinutes || 20) * 60000)
      }
      const disp = (state.dispatches || []).find((d) => d.vehicleId === ev.vehicleId)
      const atHospital = disp?.milestones?.find((m) => m.key === 'at-hospital' || m.key === 'hospital')
      if (atHospital?.at) arrived = new Date(atHospital.at)

      let usedMinutes
      let result
      if (arrived) {
        usedMinutes = minutesBetween(started, arrived)
        result = usedMinutes > limitMin ? '超时' : '达标'
      } else {
        usedMinutes = minutesBetween(started, new Date())
        result = usedMinutes > limitMin ? '超时' : '进行中'
      }
      rows.push({
        kind: '出警到院',
        subject: `${ev.vehiclePlate || ev.vehicleId} · ${ev.task120Id || ev.id}`,
        owner: '随车组',
        limitMinutes: limitMin,
        used: arrived ? `${usedMinutes} 分钟` : `已 ${usedMinutes} 分钟`,
        result,
        over: result === '超时',
        source: 'dispatch-live',
        id: ev.id,
      })
    }
    for (const disp of state.dispatches || []) {
      if (liveEvents.some((e) => e.vehicleId === disp.vehicleId)) continue
      const started = new Date(disp.startedAt)
      const atHospital = disp.milestones?.find((m) => m.key === 'at-hospital')
      const arrived = atHospital ? new Date(atHospital.at) : null
      if (!arrived && disp.status !== 'at-hospital' && disp.status !== 'completed') continue
      const usedMinutes = arrived ? minutesBetween(started, arrived) : minutesBetween(started, new Date())
      const result = !arrived ? '进行中' : usedMinutes > limitMin ? '超时' : '达标'
      rows.push({
        kind: '出警到院',
        subject: `${disp.id} · ${disp.vehicleId}`,
        owner: staffName(state, disp.doctorId),
        limitMinutes: limitMin,
        used: `${usedMinutes} 分钟`,
        result,
        over: result === '超时',
        source: 'scenario',
        id: disp.id,
      })
    }
    return rows
  }

  function rowsFromJsonRecords(records) {
    return (records || []).map((r) => ({
      kind: r.kind,
      subject: r.subject,
      owner: r.owner,
      limitMinutes: r.limitMinutes ?? limitForKind(r.kind),
      used: r.arrivedAt ? `${r.usedMinutes} 分钟` : r.usedMinutes ? `${r.usedMinutes} 分钟` : '—',
      result: r.overtime ? '超时' : r.arrivedAt ? '达标' : '进行中',
      over: !!r.overtime,
      source: 'qc-sla.json',
      id: r.id,
    }))
  }

  function mergeRows(computed, fromJson) {
    const seen = new Set()
    const out = []
    for (const r of fromJson) {
      const key = `${r.kind}|${r.subject}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(r)
    }
    for (const r of computed) {
      const key = `${r.kind}|${r.subject}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(r)
    }
    return out.slice(0, 24)
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function renderTable(rows) {
    if (!rows.length) {
      return '<thead><tr><th>环节</th><th>对象</th><th>责任人</th><th>时间限制</th><th>实际用时</th><th>结果</th></tr></thead><tbody><tr><td colspan="6">暂无环节记录（演示数据）</td></tr></tbody>'
    }
    const head =
      '<thead><tr><th>环节</th><th>对象</th><th>责任人</th><th>时间限制</th><th>实际用时</th><th>结果</th></tr></thead>'
    return `${head}<tbody>${rows
      .map((r) => {
        const lim = r.limitMinutes ?? limitForKind(r.kind)
        const resultCell = r.over
          ? `<strong class="hx-sla-over">${escapeHtml(r.result)}</strong>`
          : escapeHtml(r.result)
        return `<tr class="${r.over ? 'over' : ''}"><td>${escapeHtml(r.kind)}</td><td>${escapeHtml(r.subject)}</td><td>${escapeHtml(r.owner)}</td><td class="hx-sla-limit"><strong>≤${lim} 分钟</strong></td><td>${escapeHtml(r.used)}</td><td>${resultCell}</td></tr>`
      })
      .join('')}</tbody>`
  }

  function renderRules(rules) {
    return (rules || [])
      .map(
        (r) =>
          `<div><small>${escapeHtml(r.audience || '')}</small><b>${escapeHtml(r.name)} · ${r.limitMinutes} 分钟内</b></div>`,
      )
      .join('')
  }

  function buildHtml(payload, rows) {
    const overCount = rows.filter((r) => r.over).length
    return `<section class="hx-sla">
      <header>
        <div>
          <h2>环节时限 · 时间限制</h2>
          <p>${escapeHtml(payload.notice || '演示规则，非正式院内质控标准')}。下表「时间限制」列为各环节允许的最长用时。</p>
          <nav class="hx-sla-links" aria-label="关联模块">
            <a href="/#/warning">院内预警 →</a>
            <a href="/dispatch.html#live">120 院前 →</a>
          </nav>
        </div>
        ${overCount ? `<span class="hx-sla-over-badge">超时 ${overCount} 条 · 演示</span>` : '<span class="hx-sla-ok-badge">当前无超时 · 演示</span>'}
      </header>
      <div class="hx-sla-rules">${renderRules(payload.rules)}</div>
      <table>${renderTable(rows)}</table>
      <p class="hx-sla-footnote">说明：预警到床、出警到院为演示用时限标准；下方整改列表中「关联环节 / 时限标准」与之对应。正式标准以院感控科发布为准。</p>
    </section>`
  }

  let cacheKey = ''

  async function loadAndCompute() {
    const strict = window.hxBackend?.strict?.()
    const [slaRes, liveRes] = await Promise.all([
      fetch('/api/qc-sla.json', { cache: 'no-store' }),
      fetch('/api/dispatch-live.json', { cache: 'no-store' }),
    ])
    const sla = slaRes.ok
      ? await slaRes.json()
      : { rules: DEFAULT_RULES, records: [], notice: strict ? '后端 sla-records 不可用' : '未加载 qc-sla' }
    if (sla.error) {
      return {
        sla: { rules: DEFAULT_RULES, records: [], notice: sla.message || '后端不可用' },
        rows: [],
      }
    }
    if (!sla.rules?.length) sla.rules = DEFAULT_RULES
    const live = liveRes.ok ? await liveRes.json() : { events: [] }
    const alertLimit = sla.rules?.find((r) => r.id === 'SLA-ALERT')?.limitMinutes ?? 10
    const dispatchLimit = sla.rules?.find((r) => r.id === 'SLA-DISPATCH')?.limitMinutes ?? 30
    let computed = []
    if (!strict) {
      const scenRes = await fetch('/scenario.json', { cache: 'no-store' })
      const scenWrap = scenRes.ok ? await scenRes.json() : { state: {} }
      const state = scenWrap.state || scenWrap
      computed = [...computeAlertRows(state, alertLimit), ...computeDispatchRows(state, live, dispatchLimit)]
    } else {
      computed = computeDispatchRows({ events: [] }, live, dispatchLimit)
    }
    const rows = mergeRows(computed, rowsFromJsonRecords(sla.records))
    if (strict && sla.notice) sla.notice = `${sla.notice || ''} · 环节数据来自后端 sla-records`
    return { sla, rows }
  }

  function render() {
    if (path() !== '/medical-quality') {
      document.getElementById('hx-sla-dock')?.remove()
      return
    }
    const host = document.querySelector('.quality-workspace') || document.querySelector('main.workspace')
    if (!host) return
    let box = document.getElementById('hx-sla-dock')
    if (!box) {
      box = document.createElement('div')
      box.id = 'hx-sla-dock'
      const heading = host.querySelector('.workspace-heading')
      if (heading && heading.nextSibling) host.insertBefore(box, heading.nextSibling)
      else host.insertBefore(box, host.firstChild)
    }

    loadAndCompute().then(({ sla, rows }) => {
      const key = JSON.stringify(rows.map((r) => r.id + r.result))
      if (key === cacheKey && box.dataset.ready === '1') return
      cacheKey = key
      box.dataset.ready = '1'
      box.innerHTML = buildHtml(sla, rows)
    })
  }

  window.addEventListener('hashchange', () => {
    cacheKey = ''
    const box = document.getElementById('hx-sla-dock')
    if (box) {
      box.dataset.ready = ''
      box.innerHTML = '<section class="hx-sla"><p>加载环节时限…</p></section>'
    }
  })

  window.hxEnhance(render, { wait: 400, observeRoot: true, afterNav: 80 })
})()
