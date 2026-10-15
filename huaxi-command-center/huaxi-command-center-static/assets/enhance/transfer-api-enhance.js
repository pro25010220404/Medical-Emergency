/**
 * 转诊列表页 → 从 Laravel /api/v1/transfers 拉取真实数据，注入表格
 *
 * 字段映射（API → 表格列）：
 *   patientName          → 患者
 *   sourceInstitutionName → 转出机构
 *   targetInstitutionName → 接收机构·科室（科室字段暂无，留空）
 *   reason               → 转诊原因
 *   statusLabel          → 状态（直接显示中文）
 *   transferId           → 操作（查看按钮）
 *
 * 协同：
 *   - 等待 transfer-classify-enhance.js 完成 DOM 初始化后再注入
 *   - 注入后让 transfer-classify-enhance 重新执行过滤
 *   - 支持"外院转诊 / 本院转科室"双模式
 */
;(function () {
  /* ---------- 配置 ---------- */
  const TRANSFER_API = '/transfers'
  const PER_PAGE = 50

  /* ---------- 工具函数 ---------- */

  function transferPath() {
    const hash = location.hash.replace(/^#/, '')
    return (hash.split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function isTransferPage() {
    return transferPath() === '/transfers'
  }

  function isLoggedIn() {
    return !!(window.hxBackend?.enabled?.() && !window.hxBackend?.authBlocked?.())
  }

  /** 触发 transfer-classify-enhance 重新过滤（通过自定义事件） */
  function notifyClassify() {
    window.dispatchEvent(new CustomEvent('hx-transfers-loaded', { bubbles: true }))
  }

  /** 等待页面 main.workspace + table 出现 */
  function waitTable(timeout) {
    return new Promise((resolve) => {
      const deadline = Date.now() + (timeout || 12000)
      const tick = () => {
        const main = document.querySelector('main.workspace')
        const table = main?.querySelector('.business-table table')
        if (table) return resolve({ main, table })
        if (Date.now() > deadline) return resolve(null)
        setTimeout(tick, 200)
      }
      tick()
    })
  }

  /** 格式化日期为 YYYY-MM-DD HH:mm */
  function fmtDate(iso) {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch {
      return iso
    }
  }

  /** 根据 direction 返回"上转"或"下转"标签 */
  function directionTag(direction) {
    if (direction === 'UP') return '<span class="hx-tag hx-tag-up">上转</span>'
    if (direction === 'DOWN') return '<span class="hx-tag hx-tag-down">下转</span>'
    return ''
  }

  /** 状态徽章 */
  function statusBadge(label, status) {
    const cls =
      status === 'REJECTED' || status === 'CANCELLED'
        ? 'hx-badge-danger'
        : status === 'COMPLETED' || status === 'FINISHED'
          ? 'hx-badge-success'
          : status === 'ACCEPTED' || status === 'IN_PROGRESS'
            ? 'hx-badge-primary'
            : 'hx-badge-muted'
    return `<span class="hx-badge ${cls}">${label || status || '—'}</span>`
  }

  /** 构建单行 tr */
  function buildRow(rec) {
    const tr = document.createElement('tr')
    tr.dataset.transferId = rec.transferId || rec.id || ''
    tr.dataset.direction = rec.direction || ''
    tr.dataset.status = rec.status || ''

    const deptNote = rec.targetDeptName ? `<br><small class="muted">${rec.targetDeptName}</small>` : ''
    const actionBtn = `<button class="hx-btn-sm" onclick="window.hxViewTransfer?.('${rec.transferId || rec.id || ''}')">查看</button>`

    tr.innerHTML =
      `<td>${rec.patientName || '—'}</td>` +
      `<td>${rec.sourceInstitutionName || '—'}</td>` +
      `<td>${rec.targetInstitutionName || '—'}${deptNote}</td>` +
      `<td>${rec.reason || '—'}</td>` +
      `<td>${directionTag(rec.direction)} ${statusBadge(rec.statusLabel, rec.status)}</td>` +
      `<td class="actions">${actionBtn}</td>`

    return tr
  }

  /** 在 loading 行后追加数据行 */
  function injectRows(table, records) {
    // 缓存记录供弹窗使用
    window.__HX_TRANSFERS_CACHE__ = records || []

    // 移除空状态提示行
    const emptyRow = table.querySelector('tbody tr.empty-row, tbody tr[data-empty]')
    if (emptyRow) emptyRow.remove()

    const tbody = table.querySelector('tbody')
    if (!tbody) return

    // 清除 loading 行
    const loadingRow = tbody.querySelector('.hx-loading-row')
    if (loadingRow) loadingRow.remove()

    if (!records || records.length === 0) {
      const empty = document.createElement('tr')
      empty.dataset.empty = '1'
      empty.innerHTML = `<td colspan="6" style="text-align:center;color:#999;padding:24px">暂无转诊记录</td>`
      tbody.appendChild(empty)
      return
    }

    records.forEach((rec) => {
      tbody.appendChild(buildRow(rec))
    })

    // 隐藏原始空状态
    const main = table.closest('main.workspace')
    if (main) {
      const emptyEl = main.querySelector('.empty, .no-data, [class*="empty"]')
      if (emptyEl) emptyEl.style.display = 'none'
    }
  }

  /** 显示加载中行 */
  function showLoading(tbody) {
    if (!tbody) return
    const existing = tbody.querySelector('.hx-loading-row')
    if (existing) return
    const tr = document.createElement('tr')
    tr.className = 'hx-loading-row'
    tr.innerHTML = `<td colspan="6" style="text-align:center;color:#999;padding:24px">正在加载转诊记录…</td>`
    tbody.appendChild(tr)
  }

  /** 从 API 拉取并注入 */
  async function loadAndInject() {
    const { main, table } = (await waitTable(15000)) || {}
    if (!table) {
      console.warn('[hx-transfer-api] 未找到表格，放弃注入')
      return
    }

    const tbody = table.querySelector('tbody')
    showLoading(tbody)

    // 确保已登录
    if (!isLoggedIn()) {
      if (window.hxBackend?.ensureAuth) {
        await window.hxBackend.ensureAuth()
      }
    }

    let records = []
    try {
      records = await window.hxBackend.list(TRANSFER_API, { per_page: PER_PAGE })
    } catch (err) {
      console.error('[hx-transfer-api] 拉取转诊记录失败', err)
      // 网络失败时展示友好提示
      const loadingRow = tbody?.querySelector('.hx-loading-row')
      if (loadingRow) {
        loadingRow.innerHTML = `<td colspan="6" style="text-align:center;color:#e53;color:padding:24px">加载失败：${err.message || '网络错误'}（需先登录后端）</td>`
      }
      return
    }

    injectRows(table, records)
    notifyClassify()

    console.info(`[hx-transfer-api] 已注入 ${records.length} 条转诊记录`)
  }

  /* ---------- 全局查看详情处理器（点击"查看"时调用）---------- */
  // 缓存本次拉取的记录，方便弹窗直接读取
  window.__HX_TRANSFERS_CACHE__ = []
  function buildModalHTML(rec) {
    const row = (k, v) => `<tr><th>${k}</th><td>${v ?? '—'}</td></tr>`
    return (
      '<div class="hx-modal-mask" data-hx-transfer-modal>' +
      '<div class="hx-modal">' +
      '<header><h3>转诊详情 · ' + (rec.transferId || rec.id || '') + '</h3>' +
      '<button class="hx-modal-close" type="button">×</button></header>' +
      '<div class="hx-modal-body">' +
      '<table class="hx-detail-table">' +
      row('转诊编号', rec.transferId) +
      row('患者', rec.patientName + ' <small class="muted">(' + (rec.patientId || '') + ')</small>') +
      row('方向', (rec.direction === 'UP' ? '上转' : rec.direction === 'DOWN' ? '下转' : '—') + (rec.directionLabel ? ' · ' + rec.directionLabel : '')) +
      row('转出机构', rec.sourceInstitutionName + ' <small class="muted">(' + (rec.sourceInstitutionId || '') + ')</small>') +
      row('接收机构', rec.targetInstitutionName + ' <small class="muted">(' + (rec.targetInstitutionId || '') + ')</small>') +
      row('接收科室', rec.targetDeptName || '<span class="muted">未返回</span>') +
      row('转诊原因', rec.reason) +
      row('状态', rec.statusLabel + ' <small class="muted">(' + (rec.status || '') + ')</small>') +
      row('开始时间', fmtDate(rec.startedAt)) +
      row('绿色通道', rec.greenChannel ? '是' : '否') +
      row('渠道', rec.channelType || '—') +
      '</table>' +
      '</div>' +
      '<footer><button class="hx-modal-close-btn" type="button">关闭</button></footer>' +
      '</div>' +
      '</div>'
    )
  }

  function openTransferModal(transferId) {
    if (!transferId) return
    const rec = window.__HX_TRANSFERS_CACHE__.find(
      (r) => (r.transferId || r.id) === transferId,
    )
    if (!rec) {
      alert('未找到该转诊记录：' + transferId)
      return
    }
    // 先移除已有的
    document.querySelectorAll('[data-hx-transfer-modal]').forEach((el) => el.remove())
    const wrap = document.createElement('div')
    wrap.innerHTML = buildModalHTML(rec)
    document.body.appendChild(wrap.firstElementChild)

    const close = () => {
      document.querySelectorAll('[data-hx-transfer-modal]').forEach((el) => el.remove())
    }
    document
      .querySelectorAll('[data-hx-transfer-modal] .hx-modal-close, [data-hx-transfer-modal] .hx-modal-close-btn')
      .forEach((btn) => btn.addEventListener('click', close))
    document
      .querySelector('[data-hx-transfer-modal] .hx-modal-mask')
      ?.addEventListener('click', (e) => {
        if (e.target.classList.contains('hx-modal-mask')) close()
      })
  }

  window.hxViewTransfer = openTransferModal
  // 同时也暴露给 React 行内 onclick 使用
  window.hxCloseTransferModal = function () {
    document.querySelectorAll('[data-hx-transfer-modal]').forEach((el) => el.remove())
  }

  /* ---------- 主逻辑：监听路由变化 ---------- */
  let loaded = false
  let observer = null

  function stopObserver() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  function startObserver() {
    stopObserver()
    const root = document.querySelector('#root') || document.body
    observer = new MutationObserver(() => {
      if (isTransferPage() && !loaded) {
        loaded = false // 重置，每次切回来都刷新
      }
    })
    observer.observe(root, { childList: true, subtree: true })
  }

  function tick() {
    if (!isTransferPage()) {
      stopObserver()
      return
    }
    startObserver()
    if (loaded) return
    loaded = true
    loadAndInject()
  }

  /* ---------- 样式注入 ---------- */
  function injectStyle() {
    if (document.getElementById('hx-transfer-api-style')) return
    const s = document.createElement('style')
    s.id = 'hx-transfer-api-style'
    s.textContent =
      '.hx-tag{display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:500;margin-right:4px}' +
      '.hx-tag-up{background:#dbeafe;color:#1d4ed8}' +
      '.hx-tag-down{background:#dcfce7;color:#15803d}' +
      '.hx-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px}' +
      '.hx-badge-danger{background:#fee2e2;color:#b91c1c}' +
      '.hx-badge-success{background:#dcfce7;color:#15803d}' +
      '.hx-badge-primary{background:#dbeafe;color:#1d4ed8}' +
      '.hx-badge-muted{background:#f1f5f9;color:#64748b}' +
      '.hx-btn-sm{padding:3px 10px;border-radius:4px;border:1px solid #cbd5e1;background:#fff;color:#475569;cursor:pointer;font-size:12px}' +
      '.hx-btn-sm:hover{background:#f1f5f9}' +
      'table .actions{white-space:nowrap}' +
      // 弹窗
      '.hx-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:center;justify-content:center;animation:hxFadeIn .15s ease-out}' +
      '.hx-modal{background:#fff;border-radius:10px;width:560px;max-width:92vw;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.25);animation:hxSlideUp .2s ease-out}' +
      '.hx-modal header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #e2e8f0}' +
      '.hx-modal header h3{margin:0;font-size:16px;color:#0f172a}' +
      '.hx-modal-close{background:none;border:0;font-size:24px;line-height:1;color:#94a3b8;cursor:pointer;padding:0 6px}' +
      '.hx-modal-close:hover{color:#475569}' +
      '.hx-modal-body{padding:18px 20px;overflow:auto}' +
      '.hx-modal footer{padding:12px 20px;border-top:1px solid #e2e8f0;text-align:right}' +
      '.hx-modal-close-btn{padding:6px 16px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;color:#475569;cursor:pointer}' +
      '.hx-modal-close-btn:hover{background:#f1f5f9}' +
      '.hx-detail-table{width:100%;border-collapse:collapse;font-size:13px}' +
      '.hx-detail-table th,.hx-detail-table td{padding:8px 4px;border-bottom:1px solid #f1f5f9;text-align:left;vertical-align:top}' +
      '.hx-detail-table th{width:96px;color:#64748b;font-weight:500;white-space:nowrap}' +
      '.hx-detail-table td{color:#0f172a;word-break:break-all}' +
      '.hx-detail-table .muted{color:#94a3b8;font-size:12px}' +
      '@keyframes hxFadeIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes hxSlideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}'
    document.head.appendChild(s)
  }

  injectStyle()
  window.hxEnhance(tick, { wait: 400, afterNav: 200, observeRoot: true })
})()
