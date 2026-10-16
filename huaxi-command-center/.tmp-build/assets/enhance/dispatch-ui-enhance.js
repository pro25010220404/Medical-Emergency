/**
 * 院前调度 /#/dispatch：底部会诊入口（车辆卡片内不再注入块）
 */
;(function () {
  function onDispatch() {
    return (location.hash.replace(/^#/, '') || '/').split('?')[0] === '/dispatch'
  }

  function syncDispatchOneScreenClass() {
    document.body.classList.toggle('hx-dispatch-one-screen', onDispatch())
  }

  function removeArticleBlocks() {
    document.querySelectorAll('.huaxi-consult-entry').forEach((el) => el.remove())
  }

  /** 整卡切换出警车辆（与 React 卡片 header 内按钮行为一致） */
  function wireVehicleArticleSelect() {
    if (document.documentElement.dataset.hxVehicleArticleSelect) return
    document.documentElement.dataset.hxVehicleArticleSelect = '1'
    document.addEventListener(
      'click',
      (e) => {
        if (!onDispatch()) return
        if (e.target.closest('.camera-button')) return
        const article = e.target.closest('.dispatch-active article')
        if (!article) return
        const selectBtn = article.querySelector('header > button:first-child')
        if (!selectBtn || selectBtn === e.target || selectBtn.contains(e.target)) return
        selectBtn.click()
      },
      false,
    )
  }

  function markVehicleNameButtons() {
    document.querySelectorAll('.dispatch-active article header > button:first-child').forEach((btn) => {
      btn.classList.add('hx-dispatch-vehicle-name')
    })
  }

  /** 出警车辆列表：栏高撑满，列表区内部滚动 */
  function wrapDispatchActiveScroll() {
    const aside = document.querySelector('.dispatch-active')
    if (!aside) return
    let wrap = aside.querySelector('.hx-dispatch-active-scroll')
    if (!wrap) {
      wrap = document.createElement('div')
      wrap.className = 'hx-dispatch-active-scroll'
      const h2 = aside.querySelector(':scope > h2')
      if (h2) h2.insertAdjacentElement('afterend', wrap)
      else aside.prepend(wrap)
    }
    aside.querySelectorAll(':scope > article, :scope > .empty').forEach((el) => {
      if (el.parentElement === aside) wrap.appendChild(el)
    })
  }

  function enhanceActions() {
    const actions = document.querySelector('.dispatch-actions')
    if (!actions || actions.querySelector('.huaxi-dispatch-consult')) return
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'primary huaxi-dispatch-consult'
    btn.textContent = '发起远程会诊'
    btn.addEventListener('click', () => {
      const ctx = {
        task120Id: new URLSearchParams(location.hash.split('?')[1] || '').get('task') || '',
        chiefComplaint: '',
        name: '',
      }
      const sel = document.querySelector('.dispatch-active article.on, .dispatch-active article.selected')
      const taskEl = sel?.querySelector('[class*="task"], small, .meta')
      if (!ctx.task120Id && taskEl) {
        const m = (taskEl.textContent || '').match(/120[-\w]+/i)
        if (m) ctx.task120Id = m[0]
      }
      if (window.__hxTryConsultLaunch) {
        if (!ctx.task120Id) {
          window.alert('请先在左侧选择出警任务，或在「出警列表 / 就地登记」中发起远程会诊。')
          return
        }
        ctx.chiefComplaint = (sel?.querySelector('p, .complaint')?.textContent || '').trim().slice(0, 120)
        void window.__hxTryConsultLaunch(ctx)
        return
      }
      location.hash = '#/consultations'
    })
    actions.prepend(btn)
  }

  function tick() {
    syncDispatchOneScreenClass()
    removeArticleBlocks()
    wireVehicleArticleSelect()
    if (!onDispatch()) return
    wrapDispatchActiveScroll()
    markVehicleNameButtons()
    enhanceActions()
  }

  window.hxEnhance(tick, { wait: 300, observeRoot: true, afterNav: 80 })
})()
