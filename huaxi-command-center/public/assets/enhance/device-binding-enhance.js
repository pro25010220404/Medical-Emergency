/**
 * 主站 /#/devices：说明「本地绑定已保存，设备连接状态未改变」为演示设计；标注已绑行
 *
 * 表格列（含「绑定科室」「关联医生」）与筛选、编辑弹窗由 index-BA_IO3dC.js 补丁渲染
 * （见 scripts/patch-devices-page.mjs），本脚本只做两件 DOM 层的事：
 *  - 页头插入演示说明（如何绑定 / 演示台账口径）
 *  - 已绑行在「采集状态」列追加「· 台账已绑（演示）」
 * 列一律按表头文字定位，不写死下标，兼容新旧版式。
 */
;(function () {
  const STORAGE_KEY = 'huaxi-demo-device-bindings'

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function loadMap() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch {
      return {}
    }
  }

  function columnIndex(headRow, label) {
    if (!headRow) return -1
    return [...headRow.children].findIndex((th) => (th.textContent || '').trim().startsWith(label))
  }

  function mountHint() {
    const main = document.querySelector('main.workspace')
    if (!main) return
    let box = document.getElementById('hx-device-bind-hint')
    if (!box) {
      box = document.createElement('div')
      box.id = 'hx-device-bind-hint'
      box.className = 'hx-device-bind-hint'
      const anchor = main.querySelector('.filter-bar') || main.querySelector('.business-table') || main.querySelector('h1')?.parentElement
      if (anchor) anchor.insertAdjacentElement('beforebegin', box)
      else main.insertBefore(box, main.firstChild)
    }
    box.innerHTML = `<p><strong>如何绑定</strong>：在表格「操作」列点 <strong>编辑</strong>，在弹窗内依次选择 <strong>机构 → 绑定科室 → 关联床位</strong>，再按需指定 <strong>关联医生 / 关联患者</strong>，点保存。保存后「绑定科室 / 关联床位 / 关联医生 / 关联患者」列同步更新。</p>
    <p class="hx-device-bind-hint__sub"><strong>演示说明</strong>：绑定只写入本机（<code>${STORAGE_KEY}</code>）；<strong>采集状态 · 未连接</strong>表示未接真实物联网，不会因绑定变在线。</p>`
  }

  function annotateRows(map) {
    const table = document.querySelector('main.workspace .business-table table')
    if (!table) return
    const headRow = table.querySelector('thead tr')
    const statusIdx = columnIndex(headRow, '采集状态')
    const doctorIdx = columnIndex(headRow, '关联医生')

    table.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = tr.children
      const devId = (cells[0]?.textContent || '').trim()
      const bound = !!map[devId]

      // 「采集状态」列：已绑行加演示台账标记（只在需要变化时改 DOM，避免观察器自激）
      const statusCell = statusIdx >= 0 ? cells[statusIdx] : null
      if (statusCell) {
        const mark = statusCell.querySelector('.hx-bind-saved')
        if (bound && !mark) {
          const span = document.createElement('span')
          span.className = 'hx-bind-saved'
          span.textContent = ' · 台账已绑（演示）'
          span.title = '已写入本地演示台账 ' + STORAGE_KEY
          statusCell.appendChild(span)
        } else if (!bound && mark) {
          mark.remove()
        }
      }

      const doctorCell = doctorIdx >= 0 ? cells[doctorIdx] : null
      if (doctorCell && bound && !doctorCell.title) {
        doctorCell.title = '关联医生：' + ((doctorCell.textContent || '').trim() || '未指定')
      }
    })
  }

  function render() {
    if (path() !== '/devices') {
      document.getElementById('hx-device-bind-hint')?.remove()
      document.querySelectorAll('.hx-bind-saved').forEach((n) => n.remove())
      return
    }
    if (!document.querySelector('main.workspace h1')?.textContent?.includes('床旁设备')) return
    mountHint()
    annotateRows(loadMap())
  }

  window.addEventListener('storage', () => render())

  // 页面由 React 重渲染（筛选、保存后）会重建表格，重建即丢失标记，这里补挂
  let timer = null
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(render, 80)
  }
  function observe() {
    const mo = new MutationObserver(schedule)
    mo.observe(document.body, { childList: true, subtree: true })
  }
  if (document.body) observe()
  else document.addEventListener('DOMContentLoaded', observe, { once: true })

  window.hxEnhance(schedule, { wait: 300, afterNav: 100 })
})()
