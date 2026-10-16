/**
 * #/patients：用 GET /patients 重绘表格；监听 React 重渲染以免被 scenario 盖回。
 */
;(function () {
  /** @type {Array<Record<string, unknown>>} */
  let apiRows = []
  let inflight = null
  let tableObserver = null
  let retryTimer = null

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function hashQuery() {
    const raw = location.hash.replace(/^#/, '')
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    return new URLSearchParams(q)
  }

  /** React  bundle 标题「患者与急救事件」→ 患者列表 */
  function updatePatientsPageTitle() {
    if (path() !== '/patients') return
    if (hashQuery().get('focus') === '1') return
    const h1 = document.querySelector('main.workspace .workspace-heading h1')
    if (!h1) return
    const t = (h1.textContent || '').trim()
    if (t === '患者与急救事件' || t === '急救事件') h1.textContent = '患者列表'
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
  }

  function stageBadgeColor(stage) {
    if (stage === 'local-closed' || stage === 'admitted') return 'teal'
    if (stage === 'transfer-requested') return 'amber'
    return 'cyan'
  }

  function sourceLabel(p) {
    if (p.sourceLabel) return String(p.sourceLabel)
    if (p.source === '120') return '120同步'
    return '现场登记'
  }

  function normalizeApiRow(p) {
    if (!p || typeof p !== 'object') return null
    const id = String(p.patientId ?? p.patient_id ?? p.id ?? '').trim()
    if (!id) return null
    const cc = p.chiefComplaint ?? p.chief_complaint
    return {
      id,
      name: String(p.name ?? p.real_name ?? '').trim() || '未命名患者',
      genderLabel: p.genderLabel ?? p.gender_label ?? '',
      gender: p.gender,
      age: p.age,
      stage: p.stage,
      stageLabel: p.stageLabel ?? p.stage_label ?? p.stage ?? '',
      institutionName: p.institutionName ?? p.institution_name ?? '',
      departmentName: p.departmentName ?? p.department_name ?? '',
      chiefComplaint: cc ? String(cc) : '',
      source: p.source,
      sourceLabel: sourceLabel(p),
    }
  }

  function showApiHint(msg) {
    const main = document.querySelector('main.workspace')
    if (!main) return
    let el = main.querySelector('.hx-patients-api-hint')
    if (!msg) {
      el?.remove()
      return
    }
    if (!el) {
      el = document.createElement('p')
      el.className = 'api-muted hx-patients-api-hint'
      el.style.margin = '8px 0 0'
      const bar = main.querySelector('.filter-bar')
      if (bar) bar.after(el)
      else main.querySelector('.workspace-heading')?.after(el)
    }
    el.textContent = msg
  }

  function sessionHint(session) {
    if (session?.reason === 'demo-only' || session?.reason === 'mock') {
      return '当前未使用后端 API（?api=mock 或本地 mock 开关）。请从 index.html 账号登录后刷新本页。'
    }
    if (session?.reason === 'login-failed') {
      const detail = session.error || window.__HX_AUTH_LAST_ERROR__ || ''
      if (/无法连接|CORS|Failed to fetch|NetworkError/i.test(detail)) {
        return '无法连接后端 API：请在服务器 Nginx 配置 location /backend-api/ 反代到 Laravel（见 DEPLOY-腾讯云.md），或清除 localStorage 项 huaxi-api-origin 后刷新'
      }
      return '自动登录失败：请从 index.html 用 admin/123456（或您的账号）登录。' + (detail ? ' ' + detail : '')
    }
    return '未建立 API 会话：请从 index.html 登录；生产环境需 Nginx /backend-api 反代'
  }

  async function loadPatients() {
    if (!window.hxBackend?.enabled?.()) {
      showApiHint('后端桥接未启用：请登录并确认未开启 ?api=mock')
      return
    }
    const session = window.hxBackend.ensureSession
      ? await window.hxBackend.ensureSession()
      : { ok: await window.hxBackend.ensureAuth(false) }
    if (!session.ok) {
      showApiHint(sessionHint(session))
      return
    }
    if (inflight) return inflight
    inflight = window.hxBackend
      .get('/patients', { pageNum: 1, pageSize: 100 })
      .then((data) => {
        const list = data?.list ?? (Array.isArray(data) ? data : [])
        apiRows = list.map(normalizeApiRow).filter(Boolean)
        if (!apiRows.length) showApiHint('患者列表接口返回空数据')
        else showApiHint('')
      })
      .catch((e) => {
        apiRows = []
        showApiHint('患者列表加载失败：' + (e?.message || '请检查 /backend-api 或 apiOrigin'))
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  function updateHeadingCount() {
    const main = document.querySelector('main.workspace')
    if (!main || !apiRows.length) return
    const span = main.querySelector('.workspace-heading span')
    if (span) span.textContent = `当前可见 ${apiRows.length} 人`
    const pag = main.querySelector('.pagination span')
    if (pag) pag.textContent = `共 ${apiRows.length} 条`
  }

  function renderTableBody() {
    const table = document.querySelector('main.workspace .business-table table')
    if (!table || !apiRows.length) return
    const tbody = table.querySelector('tbody')
    if (!tbody) return

    tbody.innerHTML = apiRows
      .map((p) => {
        const gender =
          p.genderLabel ||
          (p.gender === 'MALE' ? '男' : p.gender === 'FEMALE' ? '女' : p.gender || '未知')
        const age = p.age != null && p.age !== '' ? p.age : '未知'
        const chief = p.chiefComplaint || '未填写'
        const org = p.institutionName || '—'
        const dept = p.departmentName || '—'
        const stage = esc(p.stageLabel)
        const color = stageBadgeColor(p.stage)

        return (
          '<tr data-hx-patient-row="' +
          esc(p.id) +
          '">' +
          '<td><strong>' +
          esc(p.name) +
          '</strong><small>' +
          esc(p.id) +
          '</small></td>' +
          '<td>' +
          esc(org) +
          '<small>' +
          esc(dept) +
          '</small></td>' +
          '<td>' +
          esc(age) +
          ' / ' +
          esc(gender) +
          '</td>' +
          '<td>' +
          esc(chief) +
          '</td>' +
          '<td>' +
          esc(p.sourceLabel) +
          '</td>' +
          '<td></td>' +
          '<td><span class="badge ' +
          color +
          '">' +
          stage +
          '</span></td>' +
          '<td><a class="link-button" href="#/patient/' +
          encodeURIComponent(p.id) +
          '">查看详情</a></td>' +
          '</tr>'
        )
      })
      .join('')

    table.closest('.business-table')?.classList.add('hx-patients-api-bound')
  }

  function ensureTableObserver() {
    if (tableObserver || path() !== '/patients') return
    const wrap = document.querySelector('main.workspace .business-table')
    if (!wrap) return
    tableObserver = new MutationObserver(() => {
      updatePatientsPageTitle()
      if (apiRows.length) renderTableBody()
    })
    tableObserver.observe(wrap, { childList: true, subtree: true })
  }

  function stopTableObserver() {
    tableObserver?.disconnect()
    tableObserver = null
  }

  async function apply() {
    if (path() !== '/patients') {
      stopTableObserver()
      if (retryTimer) {
        clearInterval(retryTimer)
        retryTimer = null
      }
      return
    }
    try {
      localStorage.removeItem('huaxi-final-demo-v1')
    } catch {
      /* ignore */
    }
    if (typeof window.invalidateScenarioCache === 'function') {
      try {
        window.invalidateScenarioCache()
      } catch {
        /* ignore */
      }
    }
    updatePatientsPageTitle()
    await loadPatients()
    renderTableBody()
    updateHeadingCount()
    updatePatientsPageTitle()
    ensureTableObserver()
    if (!retryTimer && !apiRows.length) {
      let n = 0
      retryTimer = setInterval(() => {
        if (path() !== '/patients' || apiRows.length || n >= 8) {
          clearInterval(retryTimer)
          retryTimer = null
          return
        }
        n += 1
        void loadPatients().then(() => {
          renderTableBody()
          updateHeadingCount()
        })
      }, 2000)
    }
  }

  window.hxEnhance(apply, { wait: 200, afterNav: 120 })
})()
