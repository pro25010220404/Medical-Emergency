/**
 * 验收环境：不展示 plate-three 注入的 API 面板、GET 路径与「后端已连接」等调试文案。
 */
;(function () {
  const PANEL_IDS = [
    'hx-plate-api-orgs',
    'hx-plate-api-transfers',
    'hx-plate-api-consult',
    'hx-plate-api-qc-report',
    'hx-plate-api-qc-banner',
    'hx-plate-api-dr',
  ]

  const NOISE =
    /每级一家|业务协作为展示|村、镇、县、市、华西|GET\s+\/v1\/|后端已连接|演示数据 · 后端未达|基层机构管理 · API|· API\b/

  const GLOBAL_DEMO =
    /短信\s*\/\s*微信接口未连接|演示播放列表|基层医生 Dr\. · 演示|本地演示环境\s*[·•]\s*非实时医疗数据/

  function removePanels() {
    PANEL_IDS.forEach((id) => document.getElementById(id)?.remove())
    document.querySelectorAll('.hx-plate-api-wrap').forEach((el) => {
      if (el.querySelector('.hx-plate-api')) el.remove()
    })
  }

  function stripWorkspaceNoise() {
    const root = document.querySelector('main.workspace') || document.querySelector('.workspace')
    if (!root) return
    root.querySelectorAll('p, small, .muted, .api-muted, .hx-plate-api-meta').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (t && NOISE.test(t)) el.remove()
    })
    root.querySelectorAll('.hx-plate-api-badge').forEach((el) => el.remove())
    root.querySelectorAll('.hx-plate-api').forEach((el) => el.remove())
  }

  function stripGlobalDemoCopy() {
    document.querySelectorAll('.system-footer > span').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (/本地演示环境|非实时医疗数据/.test(t)) el.remove()
    })
    document.querySelectorAll('span, small, p, .muted').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (!t || t.length > 96) return
      if (GLOBAL_DEMO.test(t)) el.remove()
    })
    document.querySelectorAll('.hx-dr-video-label').forEach((el) => el.remove())
  }

  function cleanup() {
    removePanels()
    stripWorkspaceNoise()
    stripGlobalDemoCopy()
  }

  cleanup()
  window.addEventListener('hashchange', cleanup)
  if (typeof window.hxEnhance === 'function') {
    window.hxEnhance(cleanup, { wait: 450, afterNav: 100 })
  } else {
    document.addEventListener('DOMContentLoaded', cleanup)
  }
})()
