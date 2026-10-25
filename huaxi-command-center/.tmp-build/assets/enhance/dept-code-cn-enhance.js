/**
 * 科室英文代码兜底：UI 把 departments.dept_code 直接渲染成标签时，
 * 把 EMERGENCY / ICU / CARDIO / ... 替换为对应中文 dept_name。
 * 与 backend/database/seeders/OrganizationSeeder.php 中的 dept_code 保持一致。
 *
 * 仅替换"纯英文 code"叶子节点；中文 / 混合文本不动；带 title / data-* 的不可见节点不动。
 * MutationObserver 监听 DOM 变化（React 重渲染时再跑一次）。
 */
;(function () {
  // dept_code -> 中文 dept_name（与 OrganizationSeeder 对齐；按需扩）
  var DEPT_LABELS = {
    EMERGENCY: '急诊科',
    ICU: '重症医学科',
    CARDIO: '心血管内科',
    NEURO: '神经内科',
    SURGERY: '普外科',
    GEN: '全科医学科',
    RESP: '呼吸内科',
    OB: '妇产科',
    PED: '儿科',
    ORTHO: '骨科',
    ONCOLOGY: '肿瘤科',
    NEPHRO: '肾内科',
    GASTRO: '消化内科',
    ENDO: '内分泌科',
    HEMA: '血液科',
    URO: '泌尿外科',
    ENT: '耳鼻喉科',
    DERM: '皮肤科',
    OPHTH: '眼科',
    TCM: '中医科',
    REHAB: '康复医学科',
    ANESTH: '麻醉科',
    PSYCH: '精神心理科',
    INFECT: '感染科',
    PHYS: '物理治疗科',
    PAIN: '疼痛科',
    DENT: '口腔科',
    PLASTIC: '整形外科',
    THORACIC: '胸外科',
    NEUROSURG: '神经外科',
    VASCULAR: '血管外科',
    BREAST: '乳腺外科',
    HEPATOBIL: '肝胆外科',
    TRAUMA: '创伤外科',
    PALLIATIVE: '安宁疗护科',
    OCCUPATIONAL: '职业病科',
    REHAB_THERAPY: '康复治疗科',
  }
  // 跳过含这些 class 的节点（避免破坏其它功能；这里只放"明显是 dept_code 标签"的容器）
  var SKIP_CLASS_PREFIX = ['hx-dept-keep-en', 'hx-i18n-skip', 'hx-debug']

  function isEnglishCode(s) {
    if (!s) return false
    var t = s.trim()
    if (!t) return false
    // 必须纯 ASCII 大写字母 + 数字 + 下划线，长度 2~24
    if (!/^[A-Z][A-Z0-9_]{1,23}$/.test(t)) return false
    return Object.prototype.hasOwnProperty.call(DEPT_LABELS, t)
  }

  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return false
    var cls = el.className || ''
    if (typeof cls === 'string') {
      for (var i = 0; i < SKIP_CLASS_PREFIX.length; i++) {
        if (cls.indexOf(SKIP_CLASS_PREFIX[i]) !== -1) return true
      }
    }
    if (el.closest && el.closest('script, style, textarea, input, [contenteditable="true"]')) return true
    return false
  }

  function replaceInNode(root) {
    if (!root) return
    if (root.nodeType === 3 /* text node */) {
      if (isEnglishCode(root.nodeValue)) {
        var k = root.nodeValue.trim()
        root.nodeValue = ' ' + DEPT_LABELS[k] + ' '
      }
      return
    }
    if (root.nodeType !== 1) return
    if (shouldSkip(root)) return
    // 先处理直接子文本节点（最常见：`<span>EMERGENCY</span>`）
    var children = root.childNodes
    for (var i = 0; i < children.length; i++) {
      var n = children[i]
      if (n.nodeType === 3 && isEnglishCode(n.nodeValue)) {
        var k = n.nodeValue.trim()
        n.nodeValue = ' ' + DEPT_LABELS[k] + ' '
        continue
      }
      if (n.nodeType === 1 && !shouldSkip(n)) {
        // 递归：限定层级避免过深
        replaceInNode(n)
      }
    }
  }

  function scan(root) {
    if (!root) return
    if (root.nodeType === 1) {
      replaceInNode(root)
    } else if (root.nodeType === 11 /* fragment */ || root.nodeType === 9 /* document */) {
      replaceInNode(root)
    }
  }

  function run() {
    scan(document.body)
  }

  // 暴露手动入口，便于排查
  window.__hxReplaceDeptCode = run

  // --- 额外：清理"空 chip / 标签"占位（在部门 chip 行中偶发残留） ---
  function cleanEmptyChips() {
    // 选择策略：定位到「全部可见科室」按钮所在容器，再删掉没有可见文本的 button / a 节点
    var allBtn = Array.prototype.find.call(
      document.querySelectorAll('button, a, [role="button"]'),
      function (b) { return (b.textContent || '').indexOf('全部可见科室') !== -1 }
    )
    if (!allBtn) return
    var row = allBtn.parentElement
    if (!row) return
    // 收集与 allBtn 同一行（在 row 内）的兄弟节点，过滤掉明显为空的
    var toRemove = []
    for (var i = 0; i < row.children.length; i++) {
      var sib = row.children[i]
      if (sib === allBtn) continue
      var txt = (sib.textContent || '').replace(/\s+/g, '')
      var hasIcon = !!sib.querySelector('svg, img')
      // 同时把"全英文且不命中映射"的也清掉（不留给用户看到没翻译的英文）
      var onlyEnglish = /^[A-Za-z0-9_\-·\s]+$/.test(txt) && txt.length > 0
      var emptyOrUntranslated = txt === '' || (onlyEnglish && !isEnglishCode(txt) && txt.length < 32)
      if (emptyOrUntranslated && !hasIcon) toRemove.push(sib)
    }
    for (var j = 0; j < toRemove.length; j++) {
      var n = toRemove[j]
      if (n && n.parentNode) n.parentNode.removeChild(n)
    }
  }

  function runAll() {
    run()
    cleanEmptyChips()
  }

  // 替换原本的 run() 启动路径：用 runAll 覆盖
  if (document.readyState === 'loading') {
    document.removeEventListener('DOMContentLoaded', run)
    document.addEventListener('DOMContentLoaded', runAll, { once: true })
  } else {
    // 已就绪：立刻跑一次
    runAll()
  }

  // 监听器回调也用 runAll
  if (window.__hxDeptObserver) {
    try { window.__hxDeptObserver.disconnect() } catch (e) {}
  }
  if (window.MutationObserver) {
    var mo2 = new MutationObserver(function () { runAll() })
    window.__hxDeptObserver = mo2
    var start2 = function () { mo2.observe(document.body, { childList: true, subtree: true, characterData: true }) }
    if (document.body) start2()
    else document.addEventListener('DOMContentLoaded', start2, { once: true })
  }
})()
