/**
 * 质控整改看板：整改台账表格数据来自 GET /qc-issues（严格模式下不依赖 scenario）
 */
;(function () {
  const STATUS = {
    QC_OPEN: '待整改',
    QC_RECTIFYING: '整改中',
    QC_CLOSED: '已销号',
  }
  const SEV = {
    SEVERITY_HIGH: '高',
    SEVERITY_MEDIUM: '中',
    SEVERITY_LOW: '低',
  }

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return iso
    }
  }

  async function loadIssues() {
    if (!window.hxBackend?.enabled?.()) return []
    await window.hxBackend.ensureAuth()
    return window.hxBackend.list('/qc-issues', { per_page: 50 })
  }

  function renderPanel(issues) {
    const host = document.querySelector('.quality-workspace') || document.querySelector('main.workspace')
    if (!host) return
    let box = document.getElementById('hx-qc-backend-table')
    if (!box) {
      box = document.createElement('div')
      box.id = 'hx-qc-backend-table'
      const dock = document.getElementById('hx-sla-dock')
      if (dock?.nextSibling) host.insertBefore(box, dock.nextSibling)
      else if (dock) dock.insertAdjacentElement('afterend', box)
      else host.appendChild(box)
    }
    const rows = issues.length
      ? issues
          .map(
            (i) => `<tr>
          <td>${esc(i.qc_code || i.id)}</td>
          <td>${esc(i.issue_title)}</td>
          <td>${esc(SEV[i.severity] || i.severity || '—')}</td>
          <td>${esc(STATUS[i.qc_status] || i.qc_status)}</td>
          <td>${esc(i.owner_name || '—')}</td>
          <td>${esc(i.supervise_target || '—')}</td>
          <td>${fmtDate(i.due_at)}</td>
        </tr>`,
          )
          .join('')
      : '<tr><td colspan="7">暂无整改单或后端未返回数据</td></tr>'

    const html = `<section class="hx-plate-api hx-qc-backend" aria-label="整改台账·后端">
      <header><strong>4.3 质控提醒 · 整改台账</strong>
        <span class="hx-plate-api-badge hx-plate-api-badge--live">${issues.length} 条</span></header>
      <div class="hx-plate-api-scroll"><table>
        <thead><tr><th>编号</th><th>标题</th><th>级别</th><th>状态</th><th>责任人</th><th>督查对象</th><th>整改期限</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>`
    if (box.dataset.html === html) return
    box.dataset.html = html
    box.innerHTML = html
  }

  let lastFetch = 0
  const FETCH_COOLDOWN_MS = 15000

  function render() {
    if (path() !== '/medical-quality') {
      document.getElementById('hx-qc-backend-table')?.remove()
      return
    }
    if (!window.hxBackend?.strict?.()) return
    const now = Date.now()
    if (now - lastFetch < FETCH_COOLDOWN_MS) return
    lastFetch = now
    loadIssues().then(renderPanel).catch(() => {
      lastFetch = 0
    })
  }

  function syncReportsTitle() {
    if (path() !== '/medical-quality/reports') return
    const h1 = document.querySelector('.quality-workspace .workspace-heading h1')
    const t = h1?.textContent.trim()
    if (h1 && (t === '业务统计' || t === '运行统计')) h1.textContent = '质控统计'
  }

  window.hxEnhance(render, { wait: 520, observeRoot: true, afterNav: 120 })
  window.hxEnhance(syncReportsTitle, { wait: 280, observeRoot: true, afterNav: 80 })
})()
