/**
 * 全后端模式：拦截常见写操作 → Laravel v1（与 React 本地存档并行时优先打 API）
 */
;(function () {
  if (document.documentElement.dataset.hxWriteProxy) return
  document.documentElement.dataset.hxWriteProxy = '1'

  function strict() {
    return window.hxBackend?.strict?.() && window.hxFullBackend?.()
  }

  document.addEventListener(
    'click',
    async (e) => {
      if (!strict()) return
      const btn = e.target.closest('button')
      if (!btn) return
      const t = (btn.textContent || '').trim()

      if (t.includes('处置') && t.includes('提交')) {
        const stageSel = document.querySelector('select[name], .modal select, dialog select')
        const note = document.querySelector('.modal textarea, dialog textarea')?.value?.trim()
        const alertId = window.__HX_API_SAMPLES__?.warningId
        if (!alertId) return
        try {
          await window.hxBackend.post(`/warnings/${alertId}/dispose`, {
            stage: stageSel?.value || '护士确认',
            note: note || '前端处置',
            nextStatus: 'acknowledged',
          })
        } catch (err) {
          console.warn('[hx-write-proxy] warning dispose', err)
        }
      }

      if (t === '保存' || t === '提交登记' || t === '完成登记') {
        const form = btn.closest('form') || btn.closest('main')
        if (!form) return
        const inputs = form.querySelectorAll('input, select, textarea')
        const data = {}
        inputs.forEach((el) => {
          const name = el.name || el.id
          if (name && el.value) data[name] = el.value
        })
        const name = data.name || data.patientName
        if (!name) return
        try {
          await window.hxBackend.post('/patients', {
            real_name: name,
            gender: data.gender === '女' ? 'FEMALE' : 'MALE',
            age: data.age ? Number(data.age) : undefined,
            phone: data.phone,
          })
          await window.hxBackend.post('/dispatch/patients', {
            name,
            gender: data.gender === '女' ? 'FEMALE' : 'MALE',
            age: data.age ? Number(data.age) : undefined,
            phone: data.phone,
            chiefComplaint: data.chiefComplaint || data.complaint || '登记',
            isDraft: 0,
          })
        } catch (err) {
          console.warn('[hx-write-proxy] register', err)
        }
      }
    },
    true,
  )

})()
