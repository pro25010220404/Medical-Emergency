/**
 * 科室待接诊：下拉无医生时提示；同步修复 profession 大小写导致的空列表
 */
;(function () {
  const STORE_KEY = 'huaxi-final-demo-v1'

  function isDoctor(s) {
    return String(s?.profession || '').toLowerCase() === 'doctor'
  }

  function repairStoreStaff() {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (!raw) return
      const pack = JSON.parse(raw)
      const staff = pack.state?.staff
      if (!Array.isArray(staff) || !staff.length) return
      let changed = false
      pack.state.staff = staff.map((s) => {
        if (!s.profession) return s
        const p = String(s.profession).toLowerCase()
        if (p !== s.profession) {
          changed = true
          return { ...s, profession: p }
        }
        return s
      })
      const docs = pack.state.staff.filter(isDoctor)
      if (docs.length === 0 && staff.length) {
        fetch('/scenario.json', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((sc) => {
            const seed = sc?.state?.staff
            if (!seed?.length) return
            pack.state.staff = seed
            localStorage.setItem(STORE_KEY, JSON.stringify(pack))
            location.reload()
          })
          .catch(() => {})
        return
      }
      if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(pack))
    } catch {
      /* ignore */
    }
  }

  function hintEmptySelects() {
    document.querySelectorAll('.consultation-queue select').forEach((sel) => {
      const art = sel.closest('article')
      if (!art) return
      let tip = art.querySelector('.hx-consult-admit-hint')
      if (sel.options.length > 1) {
        tip?.remove()
        return
      }
      if (!tip) {
        tip = document.createElement('p')
        tip.className = 'hx-consult-admit-hint'
        tip.style.cssText = 'color:#b45309;font-size:12px;margin:6px 0 0'
        sel.insertAdjacentElement('afterend', tip)
      }
      tip.textContent =
        '当前科室没有可选医生（演示数据未加载）。请用「演示模式」登录或 Ctrl+F5 刷新；管理员需先在上方下拉框指定医生。'
    })
  }

  repairStoreStaff()

  window.hxEnhance(
    () => {
      hintEmptySelects()
    },
    { wait: 350, observeRoot: true, afterNav: 80 },
  )
})()
