/**
 * 审计清单：把 React 仍走演示态的页面，补上后端读面板 + 关键写操作
 */
;(function () {
  if (document.documentElement.dataset.hxSpaWire) return
  document.documentElement.dataset.hxSpaWire = '1'

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function fmt(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return iso
    }
  }

  async function apiReady() {
    return window.hxBackend?.strict?.() && (await window.hxBackend.ensureAuth())
  }

  function isCommandDashboard() {
    return !!document.querySelector('main.dashboard.screen')
  }

  function mountPanel(id, html) {
    if (isCommandDashboard()) return
    const host = document.querySelector('main.workspace')
    if (!host) return
    let box = document.getElementById(id)
    if (!box) {
      box = document.createElement('section')
      box.id = id
      box.className = 'hx-plate-api-wrap'
      host.insertBefore(box, host.firstChild)
    }
    if (box.dataset.html === html) return
    box.dataset.html = html
    box.innerHTML = html
  }

  function tableFromRows(cols, rows) {
    if (!rows.length) return '<p class="hx-plate-api-empty">暂无数据</p>'
    const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join('')
    const body = rows
      .map((r) => `<tr>${cols.map((c) => `<td>${esc(c.render(r))}</td>`).join('')}</tr>`)
      .join('')
    return `<div class="hx-plate-api-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
  }

  let transferByCode = new Map()

  async function refreshTransferMap() {
    if (!(await apiReady())) return
    transferByCode = new Map()
    const rows = await window.hxBackend.list('/transfers', { per_page: 100 })
    rows.forEach((t) => {
      const code = t.transfer_code || t.transferCode
      if (code) transferByCode.set(String(code), t.id)
    })
  }

  async function renderDispatch() {
    if (path() !== '/dispatch' || !(await apiReady())) return
    const [live, events, amb] = await Promise.all([
      window.hxBackend.get('/dispatch-live'),
      window.hxBackend.list('/dispatch/events', { per_page: 10 }),
      window.hxBackend.list('/ambulances', {}),
    ])
    if (path() !== '/dispatch') return
    mountPanel(
      'hx-wire-dispatch',
      `<section class="hx-plate-api"><header><strong>院前调度 · 后端</strong>
        <span class="hx-plate-api-badge hx-plate-api-badge--live">dispatch-live / events / ambulances</span></header>
        <p class="hx-plate-api-note">左侧 React 车辆仍读 scenario；下方为 Laravel 实时数据。</p>
        <p>出警中事件：${esc(live?.activeCount ?? live?.events?.length ?? '—')} · 更新时间 ${fmt(live?.updatedAt)}</p>
        ${tableFromRows(
          [
            { label: '事件', render: (e) => e.event_id || e.eventId || e.id },
            { label: '主诉', render: (e) => e.chief_complaint || e.chiefComplaint || '—' },
            { label: '状态', render: (e) => e.status || '—' },
          ],
          events,
        )}
        ${tableFromRows(
          [
            { label: '车辆', render: (v) => v.plate || v.vehicle_id || v.id },
            { label: '状态', render: (v) => v.status || '—' },
          ],
          amb.slice(0, 8),
        )}</section>`,
    )
  }

  async function renderMonitoring() {
    if (path() !== '/monitoring' || !(await apiReady())) return
    const streams = await window.hxBackend.list('/monitoring/streams', {})
    mountPanel(
      'hx-wire-monitoring',
      `<section class="hx-plate-api"><header><strong>监控流 · 后端</strong></header>
        ${tableFromRows(
          [
            { label: '流 ID', render: (s) => s.stream_id || s.streamId || s.id },
            { label: '名称', render: (s) => s.name || s.label || '—' },
            { label: '状态', render: (s) => s.status || '—' },
          ],
          streams,
        )}
        <p><button type="button" class="hx-api-write-btn" id="hx-wire-ptz-stop">试调 PTZ stop</button></p></section>`,
    )
    document.getElementById('hx-wire-ptz-stop')?.addEventListener('click', async () => {
      const sid = streams[0]?.stream_id || streams[0]?.streamId || '1'
      await window.hxBackend.post('/monitoring/ptz', { stream_id: sid, action: 'stop' })
    })
  }

  async function renderMessages() {
    if (path() !== '/messages' || !(await apiReady())) return
    const [msgs, notes, todos] = await Promise.all([
      window.hxBackend.get('/messages'),
      window.hxBackend.get('/messages/notifications'),
      window.hxBackend.get('/messages/todos'),
    ])
    const list = msgs?.list || msgs?.data || []
    mountPanel(
      'hx-wire-messages',
      `<section class="hx-plate-api"><header><strong>消息中心 · 后端</strong></header>
        <p>通知 ${(notes?.list || notes?.data || []).length} · 待办 ${(todos?.list || todos?.data || []).length}</p>
        ${tableFromRows(
          [
            { label: '标题', render: (m) => m.title || m.subject || '—' },
            { label: '时间', render: (m) => fmt(m.created_at || m.createdAt) },
          ],
          list.slice(0, 15),
        )}</section>`,
    )
  }

  async function renderCoordination() {
    if (path() !== '/coordination' || !(await apiReady())) return
    const [todos, tasks] = await Promise.all([
      window.hxBackend.get('/coordination/todos'),
      window.hxBackend.get('/coordination/tasks'),
    ])
    mountPanel(
      'hx-wire-coord',
      `<section class="hx-plate-api"><header><strong>协同待办 · 后端</strong></header>
        ${tableFromRows(
          [
            { label: '待办', render: (t) => t.title || t.summary || '—' },
            { label: '状态', render: (t) => t.status || '—' },
          ],
          (todos?.list || todos?.data || []).slice(0, 10),
        )}
        ${tableFromRows(
          [
            { label: '任务', render: (t) => t.title || t.name || '—' },
            { label: '截止', render: (t) => fmt(t.due_at || t.dueAt) },
          ],
          (tasks?.list || tasks?.data || []).slice(0, 10),
        )}</section>`,
    )
  }

  async function renderCenters() {
    if (path() !== '/centers' || !(await apiReady())) return
    const centers = await window.hxBackend.list('/centers', {})
    mountPanel(
      'hx-wire-centers',
      `<section class="hx-plate-api"><header><strong>救治中心 · 后端</strong></header>
        ${tableFromRows(
          [
            { label: '中心', render: (c) => c.name || c.center_name || c.id },
            { label: '类型', render: (c) => c.center_type || c.type || '—' },
          ],
          centers,
        )}</section>`,
    )
  }

  async function renderBeds() {
    if (path() !== '/beds' || !(await apiReady())) return
    const [ov, dist] = await Promise.all([
      window.hxBackend.get('/beds/overview'),
      window.hxBackend.get('/beds/distribution'),
    ])
    mountPanel(
      'hx-wire-beds',
      `<section class="hx-plate-api"><header><strong>床位 · 后端</strong></header>
        <p>总览：占用 ${ov?.occupied ?? '—'} / ${ov?.total ?? '—'}</p>
        ${tableFromRows(
          [
            { label: '机构', render: (h) => h.institutionName || h.institutionId },
            { label: '占用率', render: (h) => (h.occupancyRate != null ? `${Math.round(h.occupancyRate * 100)}%` : '—') },
          ],
          ov?.hospitals || [],
        )}
        <p>分布床位 ${(dist?.beds || dist?.list || []).length} 条（已写入 scenario 合并）</p></section>`,
    )
  }

  async function renderQuality() {
    if (path() !== '/quality' || !(await apiReady())) return
    const [sum, std] = await Promise.all([
      window.hxBackend.get('/qc-standards/summary'),
      window.hxBackend.list('/qc-standards', {}),
    ])
    mountPanel(
      'hx-wire-quality',
      `<section class="hx-plate-api"><header><strong>质量指标 · 后端 qc-standards</strong></header>
        <pre class="hx-plate-api-meta">${esc(JSON.stringify(sum || {}, null, 0).slice(0, 400))}</pre>
        ${tableFromRows(
          [
            { label: '标准', render: (s) => s.standard_name || s.name || s.id },
            { label: '编码', render: (s) => s.standard_code || s.code || '—' },
          ],
          std.slice(0, 12),
        )}</section>`,
    )
  }

  async function renderSettings() {
    if (path() !== '/settings' || !(await apiReady())) return
    const [pref, channels] = await Promise.all([
      window.hxBackend.get('/settings/preferences'),
      window.hxBackend.get('/settings/notification-channels'),
    ])
    mountPanel(
      'hx-wire-settings',
      `<section class="hx-plate-api"><header><strong>系统设置 · 后端</strong></header>
        <p>偏好：${esc(JSON.stringify(pref || {}).slice(0, 120))}</p>
        <p>通知渠道 ${(channels?.channels || channels?.list || []).length} 个</p>
        <button type="button" class="hx-api-write-btn" id="hx-wire-demo-reset">演示数据重置 (POST)</button></section>`,
    )
    document.getElementById('hx-wire-demo-reset')?.addEventListener('click', () =>
      window.hxBackend.post('/settings/demo-reset', {}),
    )
  }

  async function renderConsultations() {
    if (path() !== '/consultations' || !(await apiReady())) return
    try {
      const q = location.hash.replace(/^#/, '')
      const qs = q.includes('?') ? q.slice(q.indexOf('?') + 1) : ''
      if (new URLSearchParams(qs).get('scope') === 'grassroots') return
    } catch {
      /* ignore */
    }
    const listRaw = await window.hxBackend.get('/consultations', { pageNum: 1, pageSize: 20 })
    const list = listRaw?.list || listRaw?.data || []
    mountPanel(
      'hx-wire-consult',
      `<section class="hx-plate-api"><header><strong>会诊队列 · 后端</strong></header>
        ${tableFromRows(
          [
            { label: '会话', render: (c) => c.sessionId || c.session_id || '—' },
            { label: '患者', render: (c) => c.patient_name || c.patientName || '—' },
            { label: '状态', render: (c) => c.status || '—' },
          ],
          list,
        )}</section>`,
    )
  }

  async function renderCritical() {
    if (path() !== '/critical' || !(await apiReady())) return
    const [beds, wards, alerts] = await Promise.all([
      window.hxBackend.get('/critical/beds'),
      window.hxBackend.get('/critical/wards'),
      window.hxBackend.get('/critical/alerts'),
    ])
    mountPanel(
      'hx-wire-critical',
      `<section class="hx-plate-api"><header><strong>重症监护 · 后端</strong></header>
        <p>ICU 床 ${(beds?.list || beds?.beds || []).length} · 病区 ${(wards?.list || wards?.wards || []).length} · 预警 ${(alerts?.list || []).length}</p></section>`,
    )
  }

  function clearPanels() {
    ;[
      'hx-wire-dispatch',
      'hx-wire-monitoring',
      'hx-wire-messages',
      'hx-wire-coord',
      'hx-wire-centers',
      'hx-wire-beds',
      'hx-wire-quality',
      'hx-wire-settings',
      'hx-wire-consult',
      'hx-wire-critical',
    ].forEach((id) => document.getElementById(id)?.remove())
  }

  async function renderPage() {
    if (!window.hxBackend?.strict?.()) {
      clearPanels()
      return
    }
    clearPanels()
    if (isCommandDashboard()) return
    const p = path()
    const jobs = []
    if (p === '/dispatch') jobs.push(renderDispatch())
    if (p === '/monitoring') jobs.push(renderMonitoring())
    if (p === '/messages') jobs.push(renderMessages())
    if (p === '/coordination') jobs.push(renderCoordination())
    if (p === '/centers') jobs.push(renderCenters())
    if (p === '/beds') jobs.push(renderBeds())
    if (p === '/quality') jobs.push(renderQuality())
    if (p === '/settings') jobs.push(renderSettings())
    if (p === '/consultations') jobs.push(renderConsultations())
    if (p === '/critical') jobs.push(renderCritical())
    for (const j of jobs) await j
  }

  async function initAuthMe() {
    if (!(await apiReady())) return
    try {
      window.__HX_AUTH_ME__ = await window.hxBackend.get('/auth/me')
    } catch (e) {
      console.warn('[hx-spa-wire] auth/me', e)
    }
  }

  document.addEventListener(
    'click',
    async (e) => {
      if (!window.hxBackend?.strict?.()) return
      const btn = e.target.closest('button')
      if (!btn) return
      const label = (btn.textContent || '').trim()
      if (path() === '/transfers' && (label.includes('确认') || label.includes('驳回'))) {
        const tr = btn.closest('tr')
        const code = tr?.querySelector('td')?.textContent?.trim()
        if (!code) return
        await refreshTransferMap()
        const id = transferByCode.get(code) || code.replace(/\D/g, '')
        if (!id) return
        e.preventDefault()
        e.stopPropagation()
        try {
          if (label.includes('驳回')) {
            await window.hxBackend.post(`/transfers/${id}/reject`, { review_note: '前端驳回' })
          } else {
            await window.hxBackend.post(`/transfers/${id}/confirm`, { review_note: '前端确认' })
          }
          btn.textContent = '已提交后端'
        } catch (err) {
          btn.textContent = String(err.message || err).slice(0, 24)
        }
      }
    },
    true,
  )

  document.addEventListener(
    'change',
    async (e) => {
      if (!window.hxBackend?.strict?.() || path() !== '/devices') return
      const sel = e.target.closest('select')
      if (!sel) return
      const tr = sel.closest('tr')
      const devId = tr?.querySelector('td')?.textContent?.trim()
      if (!devId) return
      try {
        await window.hxBackend.ensureAuth()
        await window.hxBackend.put(`/devices/${encodeURIComponent(devId)}/binding`, {
          bedId: sel.value || null,
        })
      } catch (err) {
        console.warn('[hx-spa-wire] device binding', err)
      }
    },
    true,
  )

  document.addEventListener(
    'click',
    async (e) => {
      if (!window.hxBackend?.strict?.()) return
      const btn = e.target.closest('button')
      if (!btn || btn.textContent?.trim() !== '确认重置') return
      const modal = btn.closest('[class*="modal"], .modal, dialog')
      if (!modal) return
      try {
        await window.hxBackend.post('/settings/demo-reset', {})
      } catch (err) {
        console.warn('[hx-spa-wire] demo-reset', err)
      }
    },
    true,
  )

  document.addEventListener(
    'click',
    async (e) => {
      if (!window.hxBackend?.strict?.()) return
      const p = path()
      if (!p.startsWith('/room/') && !p.startsWith('/join/')) return
      const btn = e.target.closest('button')
      const t = btn?.textContent?.trim() || ''
      if (!btn || (!t.includes('保存') && !t.includes('提交'))) return
      const token = p.split('/')[2]
      const ta = document.querySelector('textarea')
      const text = ta?.value?.trim()
      if (!text || !token) return
      try {
        await window.hxBackend.post(`/rooms/${token}/opinions`, {
          opinion_text: text,
          author_name: '会诊医生',
        })
      } catch (err) {
        console.warn('[hx-spa-wire] room opinion', err)
      }
    },
    true,
  )

  window.hxBackend?.ensureAuth(false).then((ok) => {
    if (ok) initAuthMe()
  })

  window.addEventListener('hashchange', () => setTimeout(renderPage, 350))
  window.hxEnhance(renderPage, { wait: 700, observeRoot: false, afterNav: 200 })
})()
