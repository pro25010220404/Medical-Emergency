/**
 * 院前发起远程会诊 · 替代原生 alert/confirm 的统一样式弹窗
 */
;(function () {
  const STYLE_ID = 'hx-consult-dialog-style'

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return
    const s = document.createElement('style')
    s.id = STYLE_ID
    s.textContent = `
.hx-consult-dialog {
  position: fixed;
  inset: 0;
  z-index: 50000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}
.hx-consult-dialog[hidden] { display: none !important; }
.hx-consult-dialog__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(3px);
}
.hx-consult-dialog__panel {
  position: relative;
  z-index: 1;
  width: min(420px, 100%);
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  font-family: "Noto Sans SC", system-ui, sans-serif;
}
.hx-consult-dialog__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 18px 20px 0;
}
.hx-consult-dialog__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
}
.hx-consult-dialog__icon--warn { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
.hx-consult-dialog__icon--info { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.hx-consult-dialog__titles { flex: 1; min-width: 0; }
.hx-consult-dialog__titles h2 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.35;
}
.hx-consult-dialog__body {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #475569;
}
.hx-consult-dialog__lead {
  margin: 12px 20px 0;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.55;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.hx-consult-dialog__foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 20px 20px;
}
.hx-consult-dialog__btn {
  min-height: 38px;
  padding: 8px 18px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
}
.hx-consult-dialog__btn:hover { background: #f8fafc; border-color: #94a3b8; }
.hx-consult-dialog__btn--primary {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #fff;
}
.hx-consult-dialog__btn--primary:hover { background: #1e40af; border-color: #1e40af; }
`
    document.head.appendChild(s)
  }

  function ensureRoot() {
    ensureStyle()
    let root = document.getElementById('hx-consult-dialog')
    if (root) return root
    root = document.createElement('div')
    root.id = 'hx-consult-dialog'
    root.className = 'hx-consult-dialog'
    root.hidden = true
    root.setAttribute('role', 'presentation')
    document.body.appendChild(root)
    return root
  }

  /**
   * @param {{ variant?: 'alert'|'confirm', title?: string, body?: string, lead?: string, confirmText?: string, cancelText?: string }} opts
   * @returns {Promise<boolean>}
   */
  function show(opts) {
    const o = opts || {}
    const variant = o.variant === 'alert' ? 'alert' : 'confirm'
    const title = o.title || (variant === 'alert' ? '提示' : '请确认')
    const body = o.body || ''
    const lead = o.lead || ''
    const confirmText = o.confirmText || (variant === 'alert' ? '知道了' : '仍要发起')
    const cancelText = o.cancelText || '返回填写'
    const iconClass = variant === 'alert' ? 'hx-consult-dialog__icon--info' : 'hx-consult-dialog__icon--warn'
    const icon = variant === 'alert' ? 'ℹ' : '!'

    const root = ensureRoot()
    root.hidden = false
    root.innerHTML =
      '<div class="hx-consult-dialog__backdrop" data-act="cancel"></div>' +
      '<div class="hx-consult-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="hx-consult-dialog-title">' +
      '<div class="hx-consult-dialog__head">' +
      `<div class="hx-consult-dialog__icon ${iconClass}" aria-hidden="true">${icon}</div>` +
      '<div class="hx-consult-dialog__titles">' +
      `<h2 id="hx-consult-dialog-title">${escapeHtml(title)}</h2>` +
      `<p class="hx-consult-dialog__body">${escapeHtml(body)}</p>` +
      '</div></div>' +
      (lead ? `<p class="hx-consult-dialog__lead">${escapeHtml(lead)}</p>` : '') +
      '<div class="hx-consult-dialog__foot">' +
      (variant === 'confirm'
        ? `<button type="button" class="hx-consult-dialog__btn" data-act="cancel">${escapeHtml(cancelText)}</button>`
        : '') +
      `<button type="button" class="hx-consult-dialog__btn hx-consult-dialog__btn--primary" data-act="ok">${escapeHtml(confirmText)}</button>` +
      '</div></div>'

    document.body.classList.add('hx-consult-dialog-open')

    return new Promise((resolve) => {
      function done(ok) {
        root.hidden = true
        document.body.classList.remove('hx-consult-dialog-open')
        root.innerHTML = ''
        document.removeEventListener('keydown', onKey)
        resolve(ok)
      }

      function onKey(ev) {
        if (ev.key === 'Escape') done(false)
      }

      document.addEventListener('keydown', onKey)

      root.onclick = (ev) => {
        const t = ev.target
        if (!(t instanceof Element)) return
        const act = t.closest('[data-act]')?.getAttribute('data-act')
        if (act === 'ok') done(true)
        else if (act === 'cancel') done(false)
      }
    })
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  window.__hxConsultDialog = show
})()
