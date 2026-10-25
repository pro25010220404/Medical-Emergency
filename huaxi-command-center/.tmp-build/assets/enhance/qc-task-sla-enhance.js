/**
 * 质控整改列表：增加「关联环节 / 时限标准」列（与上方环节时限块一致）
 */
;(function () {
  const DEFAULT_RULES = [
    { id: 'SLA-ALERT', name: '预警到床', limitMinutes: 10 },
    { id: 'SLA-DISPATCH', name: '出警到院', limitMinutes: 30 },
  ]

  const KEYWORD_RULES = [
    { re: /预警|NEWS|评分|危急值|体征|检验/i, kind: '预警到床', limit: '≤10 分钟', ruleId: 'SLA-ALERT' },
    { re: /120|出车|出警|急救|到院|调度|院前/i, kind: '出警到院', limit: '≤30 分钟', ruleId: 'SLA-DISPATCH' },
    { re: /绿色通道|胸痛|卒中|创伤|高危产妇|新生儿/i, kind: '五大中心路径', limit: '按路径标准', ruleId: null },
    { re: /闭环|销号|整改/i, kind: '整改工单', limit: '见截止时间', ruleId: null },
  ]

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function inferSla(cellsText, rules) {
    const text = cellsText.join(' ')
    for (const row of KEYWORD_RULES) {
      if (row.re.test(text)) {
        const fromJson = rules?.find((r) => r.id === row.ruleId)
        if (fromJson) {
          return { kind: fromJson.name, limit: `≤${fromJson.limitMinutes} 分钟` }
        }
        return { kind: row.kind, limit: row.limit }
      }
    }
    return { kind: '—', limit: '见整改截止时间' }
  }

  function findTaskTable() {
    const workspace = document.querySelector('.quality-workspace')
    if (!workspace) return null
    for (const table of workspace.querySelectorAll('.business-table table')) {
      const head = table.querySelector('thead tr')
      if (!head) continue
      const labels = [...head.querySelectorAll('th')].map((th) => (th.textContent || '').trim())
      if (labels.includes('整改编号') && labels.includes('截止时间')) return table
    }
    return null
  }

  function enhanceTable(table, rules) {
    const headRow = table.querySelector('thead tr')
    if (!headRow || headRow.dataset.hxTaskSla === '1') return
    const headers = [...headRow.querySelectorAll('th')]
    if (headers.some((th) => (th.textContent || '').includes('关联环节'))) return

    const sourceIdx = headers.findIndex((th) => (th.textContent || '').trim() === '来源')
    const insertAt = sourceIdx >= 0 ? sourceIdx + 1 : 3

    const thKind = document.createElement('th')
    thKind.textContent = '关联环节'
    const thLimit = document.createElement('th')
    thLimit.textContent = '时限标准'

    const ref = headers[insertAt] || null
    if (ref) {
      headRow.insertBefore(thKind, ref)
      headRow.insertBefore(thLimit, ref)
    } else {
      headRow.appendChild(thKind)
      headRow.appendChild(thLimit)
    }
    headRow.dataset.hxTaskSla = '1'

    for (const tr of table.querySelectorAll('tbody tr')) {
      if (tr.querySelector('td.hx-task-sla-kind')) continue
      const cells = [...tr.querySelectorAll('td')]
      if (cells.length < 4) continue
      const texts = cells.map((td) => (td.textContent || '').trim())
      const sla = inferSla(texts, rules)

      const tdKind = document.createElement('td')
      tdKind.className = 'hx-task-sla-kind'
      tdKind.innerHTML = sla.kind === '—' ? '—' : `<strong>${escapeHtml(sla.kind)}</strong>`

      const tdLimit = document.createElement('td')
      tdLimit.className = 'hx-task-sla-limit'
      tdLimit.innerHTML = `<span class="hx-task-sla-badge">${escapeHtml(sla.limit)}</span>`

      const anchor = cells[insertAt] || null
      if (anchor) {
        tr.insertBefore(tdKind, anchor)
        tr.insertBefore(tdLimit, anchor)
      } else {
        tr.appendChild(tdKind)
        tr.appendChild(tdLimit)
      }
    }
  }

  async function loadRules() {
    try {
      const res = await fetch('/api/qc-sla.json', { cache: 'no-store' })
      if (!res.ok) return DEFAULT_RULES
      const data = await res.json()
      return data.rules?.length ? data.rules : DEFAULT_RULES
    } catch {
      return DEFAULT_RULES
    }
  }

  function render() {
    if (path() !== '/medical-quality') return
    const table = findTaskTable()
    if (!table) return
    loadRules().then((rules) => enhanceTable(table, rules))
  }

  window.hxEnhance(render, { wait: 500, observeRoot: true, afterNav: 120 })
})()
