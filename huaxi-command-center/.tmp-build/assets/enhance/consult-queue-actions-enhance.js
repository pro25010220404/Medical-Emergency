/**
 * 远程会诊队列：补全接诊医生下拉（演示 store / scenario），避免「确认分配医生」长期 disabled。
 */
;(function () {
  const STORE_KEY = 'huaxi-final-demo-v1'

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function isDoctor(s) {
    return String(s?.profession || '').toLowerCase() === 'doctor'
  }

  function doctorsForTarget(state, institutionId, departmentId) {
    return (state.staff || []).filter(
      (s) =>
        isDoctor(s) &&
        (!institutionId || s.institutionId === institutionId) &&
        (!departmentId || s.departmentId === departmentId),
    )
  }

  function findPatientByArticle(state, art) {
    const name = art.querySelector('header strong')?.textContent?.trim()
    if (!name) return null
    return (state.patients || []).find((p) => p.name === name) || null
  }

  function findPendingRequest(state, patientId) {
    return (state.consultationRequests || []).find(
      (r) => r.patientId === patientId && r.status === 'pending',
    )
  }

  function ensureSelectOptions(sel, doctors) {
    if (!sel || !doctors.length) return false
    if (sel.options.length > 1) return true
    doctors.forEach((d) => {
      const opt = document.createElement('option')
      opt.value = d.id
      opt.textContent = d.name || d.id
      sel.appendChild(opt)
    })
    if (!sel.value && sel.options.length > 1) {
      sel.value = sel.options[1].value
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }
    return sel.options.length > 1
  }

  function syncArticle(art, state) {
    const sel = art.querySelector('select')
    const btn = art.querySelector('button.primary')
    if (!sel) return

    const patient = findPatientByArticle(state, art)
    const req = patient ? findPendingRequest(state, patient.id) : null
    const inst = req?.institutionId || patient?.institutionId
    const dept = req?.departmentId || patient?.departmentId
    let doctors = doctorsForTarget(state, inst, dept)
    if (!doctors.length) {
      doctors = doctorsForTarget(state, inst, '')
    }
    if (!doctors.length) {
      doctors = (state.staff || []).filter(isDoctor).slice(0, 8)
    }

    const ok = ensureSelectOptions(sel, doctors)
    if (ok && btn && btn.disabled) {
      btn.disabled = false
      btn.removeAttribute('disabled')
    }
  }

  function cleanupGrassrootsBlockers() {
    document.body.classList.remove('hx-consult-grassroots-page')
    document.querySelector('main.workspace')?.classList.remove('hx-gr-consult-workspace')
  }

  function tick() {
    if (path() !== '/consultations') return
    cleanupGrassrootsBlockers()

    const pack = loadStore()
    const state = pack?.state
    if (!state) return

    document.querySelectorAll('.consultation-queue article').forEach((art) => {
      syncArticle(art, state)
    })
  }

  window.hxEnhance(tick, { wait: 320, afterNav: 100 })
  window.addEventListener('hashchange', tick)
})()
