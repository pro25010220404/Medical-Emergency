/**
 * 转诊与到院交接页：拆分为「外院转诊」「本院转科室」两类
 *
 * 分类规则（纯前端，无需后端改动）：
 *   转出机构 === 接收机构 → 本院转科室
 *   转出机构 !== 接收机构 → 外院转诊
 *
 * 效果：
 *   1. 页面顶部新增一级切换（外院转诊 / 本院转科室），选择后过滤表格行
 *   2. 本院转科室的流程条去掉「到院交接」，由 6 步精简为 5 步
 *   3. 空状态文案随分类切换
 *   4. 患者详情页「申请转诊」表单增加转诊类型选择：
 *      - 本院转科室：接收机构锁定为当前医院，仅选科室
 *      - 外院转诊：可任选接收机构 + 科室
 */
;(function () {
  const STORAGE_KEY = 'hx-transfer-classify-mode'
  let mode = localStorage.getItem(STORAGE_KEY) || 'external' // 'external' | 'internal'

  function transferPath() {
    const hash = location.hash.replace(/^#/, '')
    return (hash.split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function isTransferPage() {
    return transferPath() === '/transfers'
  }

  function isPatientDetailPage() {
    return /^\/patient\/.+/.test(transferPath())
  }

  function getInstitutionName(cell) {
    // 接收机构单元格结构：<td>机构名<small>科室</small></td>
    const clone = cell.cloneNode(true)
    clone.querySelectorAll('small').forEach((s) => s.remove())
    return (clone.textContent || '').trim()
  }

  function classifyRow(tr) {
    const cells = tr.querySelectorAll('td')
    if (cells.length < 3) return null
    const fromInst = (cells[1].textContent || '').trim()
    const toInst = getInstitutionName(cells[2])
    if (!fromInst || !toInst) return null
    return fromInst === toInst ? 'internal' : 'external'
  }

  function ensureToggle(main) {
    let toggle = document.getElementById('hx-transfer-classify-toggle')
    if (toggle) {
      toggle.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('selected', b.dataset.mode === mode)
      })
      return toggle
    }
    toggle = document.createElement('div')
    toggle.id = 'hx-transfer-classify-toggle'
    toggle.className = 'segmented hx-transfer-classify-toggle'
    toggle.innerHTML =
      '<button data-mode="external" class="' +
      (mode === 'external' ? 'selected' : '') +
      '">外院转诊</button>' +
      '<button data-mode="internal" class="' +
      (mode === 'internal' ? 'selected' : '') +
      '">本院转科室</button>'
    toggle.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-mode]')
      if (!btn) return
      mode = btn.dataset.mode
      localStorage.setItem(STORAGE_KEY, mode)
      toggle.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('selected', b.dataset.mode === mode)
      })
      applyFilter()
      applyProcessBar()
    })
    const heading = main.querySelector('.workspace-heading')
    if (heading) heading.insertAdjacentElement('afterend', toggle)
    else main.insertBefore(toggle, main.firstChild)
    return toggle
  }

  function applyFilter() {
    const main = document.querySelector('main.workspace')
    if (!main) return
    const table = main.querySelector('.business-table table')
    if (!table) return

    // 判断当前激活的 Tab
    const tabBtns = main.querySelectorAll('.segmented:not(.hx-transfer-classify-toggle) button')
    let activeTab = 'incoming'
    tabBtns.forEach((b) => {
      if (b.classList.contains('selected')) {
        const text = b.textContent || ''
        if (text.includes('待接收')) activeTab = 'incoming'
        else if (text.includes('转出')) activeTab = 'outgoing'
        else if (text.includes('流转')) activeTab = 'history'
      }
    })

    const rows = table.querySelectorAll('tbody tr')
    let visibleCount = 0
    rows.forEach((tr) => {
      if (activeTab === 'history') {
        tr.style.display = ''
        visibleCount++
        return
      }
      // 优先用 transfer-api-enhance.js 注入的 direction（最准）
      // direction=DOWN → 本院转科室；direction=UP → 外院转诊
      // 兼容旧逻辑：按机构名相等判断本院
      const dir = tr.dataset.direction
      let cls = null
      if (dir === 'DOWN') cls = 'internal'
      else if (dir === 'UP') cls = 'external'
      else cls = classifyRow(tr) // 兜底：转出机构===接收机构 → internal
      if (!cls) {
        tr.style.display = ''
        visibleCount++
        return
      }
      if (cls === mode) {
        tr.style.display = ''
        visibleCount++
      } else {
        tr.style.display = 'none'
      }
    })

    // 空状态
    const empty = main.querySelector('.empty, .no-data, .business-table .empty')
    if (empty) {
      if (visibleCount > 0) {
        empty.style.display = 'none'
      } else {
        empty.style.display = ''
        const msg =
          mode === 'internal' ? '当前范围没有本院转科室记录' : '当前范围没有外院转诊记录'
        if ((empty.textContent || '').includes('待处理转诊') || empty.dataset.hxClsEmpty) {
          empty.textContent = msg
          empty.dataset.hxClsEmpty = '1'
        }
      }
    }
  }

  function applyProcessBar() {
    const main = document.querySelector('main.workspace')
    if (!main) return
    const processBar = main.querySelector('.transfer-process')
    if (!processBar) return

    const steps = processBar.querySelectorAll(':scope > span')
    if (steps.length !== 6) return

    if (mode === 'internal') {
      // 本院转科室：去掉「到院交接」(第 5 步)，剩余 5 步
      steps[4].style.display = 'none'
      const numEl = steps[5].querySelector('i')
      if (numEl) numEl.textContent = '5'
    } else {
      // 外院转诊：恢复 6 步
      steps[4].style.display = ''
      const numEl = steps[5].querySelector('i')
      if (numEl) numEl.textContent = '6'
    }
  }

  function tickTransferPage() {
    if (!isTransferPage()) return
    const main = document.querySelector('main.workspace')
    if (!main) return
    const h1 = main.querySelector('.workspace-heading h1')
    if (!h1 || !/转诊/.test(h1.textContent || '')) return

    ensureToggle(main)
    applyFilter()
    applyProcessBar()
  }

  // 监听 transfer-api-enhance.js 注入完成事件，重新执行过滤
  window.addEventListener('hx-transfers-loaded', () => {
    if (isTransferPage()) tickTransferPage()
  })

  /* ---------- 患者详情页：申请转诊表单增加类型选择 ---------- */

  function ensureTransferTypeSelector(form) {
    let wrap = document.getElementById('hx-transfer-type-selector')
    if (wrap) return wrap

    // 找到当前患者所属医院
    const dds = form.closest('main.workspace')?.querySelectorAll('.patient-identity dl dd')
    let currentInstitution = ''
    if (dds && dds.length >= 1) currentInstitution = (dds[0].textContent || '').trim()

    wrap = document.createElement('div')
    wrap.id = 'hx-transfer-type-selector'
    wrap.className = 'hx-transfer-type-wrap'
    wrap.innerHTML =
      '<label class="hx-transfer-type-label">转诊类型</label>' +
      '<div class="segmented hx-transfer-type-seg">' +
      '<button data-type="external" class="selected">外院转诊</button>' +
      '<button data-type="internal">本院转科室</button>' +
      '</div>'
    wrap.dataset.currentInstitution = currentInstitution

    const seg = wrap.querySelector('.hx-transfer-type-seg')
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-type]')
      if (!btn) return
      seg.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('selected', b === btn)
      })
      applyTransferType(form, btn.dataset.type, currentInstitution)
    })

    // 插入到 form-grid 之前
    const grid = form.querySelector('.form-grid')
    if (grid) grid.insertAdjacentElement('beforebegin', wrap)
    else form.insertBefore(wrap, form.firstChild)

    // 初始化为外院转诊（不锁定）
    return wrap
  }

  function applyTransferType(form, type, currentInstitution) {
    const grid = form.querySelector('.form-grid')
    if (!grid) return
    const selects = grid.querySelectorAll('select')
    if (selects.length < 2) return
    const instSelect = selects[0] // 接收机构
    const deptSelect = selects[1] // 接收科室

    if (type === 'internal') {
      // 本院转科室：锁定接收机构为当前医院
      // 遍历 option 找到名称匹配的，选中并禁用
      let matched = false
      for (const opt of instSelect.options) {
        if (opt.textContent.trim() === currentInstitution) {
          instSelect.value = opt.value
          matched = true
          break
        }
      }
      instSelect.disabled = true
      instSelect.style.opacity = '0.6'
      // 触发 React 的 onChange
      instSelect.dispatchEvent(new Event('change', { bubbles: true }))
      if (!matched) {
        // 找不到当前医院选项，提示
        instSelect.style.background = '#fef2f2'
      } else {
        instSelect.style.background = ''
      }
    } else {
      instSelect.disabled = false
      instSelect.style.opacity = ''
      instSelect.style.background = ''
    }
  }

  function tickPatientPage() {
    if (!isPatientDetailPage()) return
    const main = document.querySelector('main.workspace.patient-detail')
    if (!main) return
    // 只在「申请转诊」弹窗打开时处理
    const dialog = main.querySelector('[role="dialog"], .modal, .dialog')
    const form = dialog ? dialog.querySelector('form') : null
    if (!form) return
    const title = dialog.querySelector('h2, h3, .modal-title, [class*="title"]')
    if (title && !/转诊/.test(title.textContent || '')) return

    const wrap = ensureTransferTypeSelector(form)
    // 若弹窗重新渲染导致 form-grid 丢失，重建
    if (!form.querySelector('.form-grid')) return
  }

  /* ---------- 主循环 + MutationObserver ---------- */

  let observer = null
  let observerTimer = null

  function startObserver() {
    if (observer) return
    const root = document.querySelector('#root') || document.body
    observer = new MutationObserver(() => {
      clearTimeout(observerTimer)
      observerTimer = setTimeout(() => {
        tickTransferPage()
        tickPatientPage()
      }, 120)
    })
    observer.observe(root, { childList: true, subtree: true })
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    clearTimeout(observerTimer)
  }

  function tick() {
    const onTransfer = isTransferPage()
    const onPatient = isPatientDetailPage()
    if (!onTransfer && !onPatient) {
      stopObserver()
      return
    }
    startObserver()
    if (onTransfer) tickTransferPage()
    if (onPatient) tickPatientPage()
  }

  // 注入少量样式
  function injectStyle() {
    if (document.getElementById('hx-transfer-classify-style')) return
    const style = document.createElement('style')
    style.id = 'hx-transfer-classify-style'
    style.textContent =
      '.hx-transfer-classify-toggle{display:inline-flex;margin:0 0 12px 0}' +
      '.hx-transfer-type-wrap{margin-bottom:12px}' +
      '.hx-transfer-type-label{display:block;font-size:12px;color:#64748b;margin-bottom:6px}' +
      '.hx-transfer-type-seg{display:inline-flex}'
    document.head.appendChild(style)
  }

  injectStyle()
  window.hxEnhance(tick, { wait: 350, afterNav: 120 })
})()
