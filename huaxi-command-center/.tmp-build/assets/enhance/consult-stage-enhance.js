/**
 * 患者/会诊 stage 徽标：按中文标签附加 stage-* 类，便于区分配色
 */
;(function () {
  const LABEL_TO_STAGE = {
    已登记: 'registered',
    会诊中: 'consulting',
    当地处置结束: 'local-closed',
    待接收: 'transfer-requested',
    已接收: 'accepted',
    转运中: 'in-transit',
    已入院: 'admitted',
    已出院: 'discharged',
    服务已结束: 'service-closed',
  }

  function patchBadges() {
    document.querySelectorAll('span.badge').forEach((el) => {
      const label = (el.textContent || '').trim()
      const stage = LABEL_TO_STAGE[label]
      if (!stage) return
      el.dataset.stage = stage
      el.classList.remove(
        'stage-registered',
        'stage-consulting',
        'stage-local-closed',
        'stage-transfer-requested',
        'stage-accepted',
        'stage-in-transit',
        'stage-admitted',
        'stage-discharged',
        'stage-service-closed',
      )
      el.classList.add(`stage-${stage}`)
    })
  }

  function tick() {
    patchBadges()
  }

  window.hxEnhance(tick, { wait: 500, observeRoot: true, afterNav: 100 })
})()
