/**
 * 远程会诊工作台
 *
 * 背景：默认入口 index.html 加载的是线上打包产物 index-BA_IO3dC.js，
 * 其 /#/consultations 页面用的是 scenario.json 的演示数据，按钮也没有绑定真实逻辑。
 *
 * 做法：在本路由下用真实后端接口渲染一个可用的会诊工作台，替换掉演示内容。
 *   - 页头：标题 + 刷新 / 发起会诊（收起表单）
 *   - 发起会诊表单（常驻展开：患者、主诉、目标医院科室、指定医生、定时开始）
 *   - 会诊队列（全量单表：改诊=确认接诊 / 进入远程会诊系统）
 *
 * 三个踩过的坑，改这里前先看：
 * 1) 宿主节点挂在 document.body 上，不插进 <main class="workspace">。
 *    插进 React 管理的容器时，React 重渲染会把节点连同表单输入一起抹掉，
 *    现场表现是「body 上标记生效了、节点却不见了」。
 * 2) 请求不走 window.hxBackend。桥接把所有 GET 串行串在一条全局队列上，
 *    而后端单请求就要 2~3 秒，页面加载五个请求排队要十几秒、按钮点下去也要等很久。
 *    这里直接 fetch(apiBase()+'/v1'+path)。开发态路径是 /backend-api/v1，
 *    不匹配桥接拦截的 /api/v1 前缀，所以会落到原生 fetch，JWT 自己带上。
 * 3) 定位方式：宿主是 position:fixed，每次 tick 用 .workspace 的 rect 重算位置，
 *    页面还在启动页（没有 .workspace）时先隐藏。
 */
;(function () {
  var ROUTE = '/consultations'
  var HOST_ID = 'hx-cw'
  var STYLE_ID = 'hx-cw-style'
  var BODY_FLAG = 'hx-cw-active'
  var state = {
    ready: false,
    loading: false,
    busy: false,
    queue: [],
    doctors: [],
    patients: [],
    orgs: [],
    depts: [],
    msg: '',
    msgKind: '',
    schedule: null, // Date|null 定时开始时间
    scopeTab: 'all', // 页内视图：grassroots（基层上转）| all（全县）
    statusFilter: 'ALL', // 队列状态筛选：ALL | WAITING | IN_CALL | SCHEDULED | FINISHED
    page: 1, // 队列表格当前页（1 起）
    pageSize: 10, // 队列表格每页条数
    queueTotal: 0, // 后端返回的队列总条数（本地条数少于它时提示只加载了前 N 条）
    dataSource: 'api', // api | demo
    dispatch: null, // {task,plate,complaint}|null 120 调度跳转带入的任务上下文
    scenarioBySession: {}, // sessionId -> scenario consultationRequest
    scenarioPatientByName: {}, // 姓名 -> patientId（API 队列缺 patientId 时补链）
    pendingAccept: null, // sessionId | null 接诊确认弹层
  }

  /** 基层上转来源识别（与 grassroots-consult-enhance 一致） */
  var GRASSROOTS_SOURCE_HINTS = [
    '船石', '连界', '神界', '威远', '村卫生', '镇卫生', '新场镇', 'chuanshi', 'lianjie',
  ]

  // ---------- 基础工具 ----------

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  /** hash 里的查询参数（120 调度跳转带 task/plate/vehicle/complaint） */
  function query() {
    var raw = location.hash
    var i = raw.indexOf('?')
    return new URLSearchParams(i >= 0 ? raw.slice(i + 1) : '')
  }

  function consultScopeTab() {
    var q = query()
    if (q.get('scope') === 'grassroots' || q.get('tab') === 'grassroots') return 'grassroots'
    if (q.get('tab') === 'county' || q.get('tab') === 'all') return 'all'
    return 'all'
  }

  /**
   * 挂载判定：
   * - 默认由本工作台接管 #/consultations（远程会诊全量视图，表格式）
   * - #/consultations?tab=grassroots（或 scope=grassroots）走基层会诊视图
   * - 显式开关：?workbench=0 / ?cw=0 交回 React 原生页；?workbench=1 / ?cw=1 强制工作台
   */
  function shouldUseConsultWorkbench() {
    var q = query()
    if (q.get('workbench') === '0' || q.get('cw') === '0') return false
    if (q.get('workbench') === '1' || q.get('cw') === '1') return true
    return true
  }

  /** 曾用三级路由 → 合回单页 #/consultations */
  function migrateSubpathsToSinglePage() {
    var p = path()
    var q = query()
    if (p === '/consultations/grassroots') {
      q.set('tab', 'grassroots')
      var qs1 = q.toString()
      location.replace(location.pathname + location.search + '#/consultations' + (qs1 ? '?' + qs1 : ''))
      return true
    }
    if (p === '/consultations/county') {
      q.delete('tab')
      q.delete('scope')
      var qs2 = q.toString()
      location.replace(location.pathname + location.search + '#/consultations' + (qs2 ? '?' + qs2 : ''))
      return true
    }
    if (p === '/consultations/new') {
      q.delete('tab')
      q.set('launch', '1')
      var qs3 = q.toString()
      location.replace(location.pathname + location.search + '#/consultations' + (qs3 ? '?' + qs3 : ''))
      return true
    }
    return false
  }

  function migrateLegacyGrassrootsUrl() {
    if (path() !== ROUTE) return
    var q = query()
    if (q.get('scope') !== 'grassroots') return
    var next = new URLSearchParams(q.toString())
    next.delete('scope')
    next.set('tab', 'grassroots')
    var qs = next.toString()
    location.replace(location.pathname + location.search + '#/consultations' + (qs ? '?' + qs : ''))
  }

  function isGrassrootsItem(it) {
    var src = [
      it.sourceHospital,
      it.sourceDepartment,
      it.sourceInstitutionId,
      it.source_hospital,
      it.source_department,
    ]
      .filter(Boolean)
      .join(' ')
    if (!src) return false
    return GRASSROOTS_SOURCE_HINTS.some(function (k) {
      return src.indexOf(k) >= 0
    })
  }

  /** 患者所属机构是否基层（乡镇/村室/卫生院），用于发起时自动判定发起方（不含县级医院） */
  var GRASSROOTS_ORG_HINTS = [
    '船石', '连界', '神界', '村卫生', '卫生室', '卫生院', '卫生站', '新场镇', 'chuanshi', 'lianjie',
  ]

  function isGrassrootsPatient(p) {
    var src = [p && p.institutionName, p && p.departmentName].filter(Boolean).join(' ')
    if (!src) return false
    return GRASSROOTS_ORG_HINTS.some(function (k) {
      return src.indexOf(k) >= 0
    })
  }

  function queueForScope() {
    if (state.scopeTab !== 'grassroots') return state.queue
    return state.queue.filter(isGrassrootsItem)
  }

  /**
   * 队列筛选维度：定时未到点的单虽然后端状态仍是 WAITING，但在列表里是独立的
   * "定时 · x月x日 HH:MM 开始" 形态，所以单列一档，医生可按此筛出未来场次。
   */
  var STATUS_FILTERS = [
    { key: 'ALL', label: '全部' },
    { key: 'WAITING', label: '待接诊' },
    { key: 'IN_CALL', label: '会诊中' },
    { key: 'SCHEDULED', label: '定时待开始' },
    { key: 'FINISHED', label: '已结束' },
  ]

  /**
   * 判定顺序必须和状态列渲染一致：queueHtml 里"定时未到点"优先级最高，
   * 会覆盖掉后端状态（真实数据里存在 status=IN_CALL + scheduledAt 未到点的单，
   * 界面上显示的是"定时 · … 开始"）。所以这里也先判定时，否则筛选结果和看到的标签对不上。
   */
  function statusKey(it) {
    if (it.scheduledAt && !startableNow(it)) return 'SCHEDULED'
    if (it.status === 'FINISHED') return 'FINISHED'
    if (it.status === 'IN_CALL') return 'IN_CALL'
    return 'WAITING'
  }

  /** 各状态条数（基于当前视图，不考虑状态筛选本身） */
  function statusCounts() {
    var counts = { ALL: 0, WAITING: 0, IN_CALL: 0, SCHEDULED: 0, FINISHED: 0 }
    queueForScope().forEach(function (it) {
      counts.ALL += 1
      counts[statusKey(it)] += 1
    })
    return counts
  }

  function queueFiltered() {
    if (state.statusFilter === 'ALL') return queueForScope()
    return queueForScope().filter(function (it) {
      return statusKey(it) === state.statusFilter
    })
  }

  /** 当前页数据；页码越界时收敛到最后一页（筛选/刷新后行数变少会走到这里） */
  function queuePage() {
    var rows = queueFiltered()
    var pages = Math.max(1, Math.ceil(rows.length / state.pageSize))
    if (state.page > pages) state.page = pages
    if (state.page < 1) state.page = 1
    var start = (state.page - 1) * state.pageSize
    return {
      rows: rows.slice(start, start + state.pageSize),
      total: rows.length,
      pages: pages,
      start: start,
    }
  }

  /** 翻页回顶：宿主自身是滚动容器，翻页后停留在底部会看不到新一页的表头 */
  function scrollQueueTop() {
    var head = document.querySelector('#' + HOST_ID + ' .' + HOST_ID + '-section-head')
    if (head && head.scrollIntoView) head.scrollIntoView({ block: 'start' })
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function $(id) {
    return document.getElementById(id)
  }

  /** 列表响应可能被包一层，做兼容 */
  function listOf(data) {
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.list)) return data.list
    if (data && Array.isArray(data.data)) return data.data
    return []
  }

  function uniqBy(rows, key) {
    var seen = {}
    return rows.filter(function (r) {
      var v = r[key]
      if (v == null || v === '' || seen[v]) return false
      seen[v] = 1
      return true
    })
  }

  function apiBase() {
    var cfg = window.HX_API_CONFIG
    if (cfg && cfg.base) return String(cfg.base).replace(/\/$/, '')
    return '/backend-api'
  }

  function jwt() {
    try {
      return sessionStorage.getItem('huaxi-jwt-token') || localStorage.getItem('huaxi-jwt-token') || ''
    } catch (e) {
      return ''
    }
  }

  /**
   * 直接请求 /api/v1，自带 JWT。
   *
   * 不走 window.hxBackend：桥接把所有 GET 串行串在一条队列上，本系统单请求就要 2~3 秒，
   * 页面加载时五个请求排队要十几秒，按钮点下去也要等很久。这里直接并发请求绕开队列。
   * 路径用 apiBase()+'/v1'，开发态是 /backend-api/v1，不匹配桥接的 /api/v1 拦截前缀，
   * 因而会走原生 fetch。
   */
  function request(method, pathname, query, body, retried) {
    var url = apiBase() + '/v1' + pathname
    if (query) {
      var qs = new URLSearchParams(query).toString()
      if (qs) url += '?' + qs
    }
    var headers = { Accept: 'application/json' }
    var token = jwt()
    if (token) headers.Authorization = 'Bearer ' + token
    var init = { method: method, headers: headers }
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    return fetch(url, init).then(function (res) {
      if (res.status === 401 && !retried) {
        var reauth = window.hxBackend && window.hxBackend.ensureAuth
          ? window.hxBackend.ensureAuth(true)
          : Promise.resolve(false)
        return Promise.resolve(reauth).then(function () {
          return request(method, pathname, query, body, true)
        })
      }
      return res.json().catch(function () {
        return {}
      }).then(function (json) {
        if (!res.ok || (json && json.code && json.code !== 200)) {
          throw new Error((json && json.message) || ('HTTP ' + res.status))
        }
        return json && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json
      })
    })
  }

  function isNetworkError(e) {
    return /failed to fetch|networkerror|load failed|network request failed/i.test(String((e && e.message) || e))
  }

  /**
   * 网络级错误自动重试（最多 2 次，间隔递增）。
   * 开发态后端是单进程 PHP dev server，请求严格串行，并发稍多偶尔会掉连接，
   * 表现为浏览器抛 TypeError: Failed to fetch。
   */
  function call(method, pathname, query, body) {
    var attempt = 0
    function run() {
      return request(method, pathname, query, body, false).catch(function (e) {
        if (!isNetworkError(e) || attempt >= 2) throw e
        attempt += 1
        return new Promise(function (resolve, reject) {
          setTimeout(function () {
            run().then(resolve, reject)
          }, attempt === 1 ? 500 : 1200)
        })
      })
    }
    return run()
  }

  // ---------- 样式 ----------

  function ensureStyle() {
    if ($(STYLE_ID)) return
    var P = '.' + HOST_ID
    var style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = [
      // 宿主挂在 body 下，用固定定位覆盖工作区；原演示内容整体隐藏。
      'body.' + BODY_FLAG + ' .workspace > *{display:none !important}',
      '#' + HOST_ID + '{position:fixed;z-index:30;overflow:auto;background:#fff;padding:8px 22px 26px;box-sizing:border-box;display:none;scrollbar-width:thin;scrollbar-color:#cbd5e1 #fff}',
      '#' + HOST_ID + '::-webkit-scrollbar{width:8px;height:8px}',
      '#' + HOST_ID + '::-webkit-scrollbar-thumb{background:#dbe3ec;border-radius:4px}',
      P + '-stack{display:flex;flex-direction:column;gap:16px;min-height:100%}',
      // ---------- 页头（平铺：标题 + 操作按钮） ----------
      P + '-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0 0}',
      P + '-hero h1{margin:0;font-size:19px;font-weight:600;color:#0f172a;letter-spacing:.01em}',
      P + '-actions{display:flex;flex-wrap:wrap;gap:8px;flex-shrink:0}',
      P + '-btn{border:1px solid #cdd7e1;background:#fff;color:#334155;border-radius:6px;padding:7px 16px;font-size:13px;cursor:pointer;font-family:inherit;line-height:1.4;font-weight:500}',
      P + '-btn:hover:not(:disabled){border-color:#94a3b8;background:#f8fafc}',
      P + '-btn:disabled{opacity:.5;cursor:not-allowed}',
      P + '-btn.sm{padding:4px 12px;font-size:12px;border-radius:5px}',
      P + '-btn.primary{background:#1e4b7b;border-color:#1e4b7b;color:#fff}',
      P + '-btn.primary:hover:not(:disabled){background:#163a60;border-color:#163a60}',
      P + '-btn.ghost{background:#fff;border-color:#cdd7e1;color:#334155}',
      P + '-btn.ghost:hover:not(:disabled){background:#f8fafc;border-color:#94a3b8}',
      P + '-btn.link{border:none;background:none;color:#0284c7;padding:4px 6px;text-decoration:none;font-weight:500}',
      P + '-btn.link:hover{text-decoration:underline;background:none;color:#0369a1}',
      P + '-btn-enter{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 12px;font-size:12px;font-weight:600;line-height:1.3;background:#1e4b7b;border:1px solid #1e4b7b;color:#fff!important;border-radius:5px;text-decoration:none!important;cursor:pointer;white-space:nowrap;box-sizing:border-box}',
      P + '-btn-enter:hover{background:#163a60;border-color:#163a60;color:#fff!important}',
      P + '-ops{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      // ---------- 120 调度带入的任务上下文条 ----------
      P + '-ctxstrip{display:flex;gap:8px;align-items:center;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:6px;padding:6px 10px;font-size:12px}',
      P + '-chain{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;color:#475569;margin-top:8px}',
      P + '-chain .label{font-weight:600;color:#334155;margin-right:4px}',
      P + '-chain .on{font-weight:600;color:#1d4ed8}',
      P + '-chain .meta{margin-left:auto;color:#64748b}',
      P + '-chain a{color:#0369a1;text-decoration:none;font-weight:500}',
      P + '-chain a:hover{text-decoration:underline}',
      // ---------- 提示条 ----------
      P + '-msg{font-size:12px}',
      P + '-msg:empty{display:none}',
      P + '-msg.err{color:#b91c1c}',
      P + '-msg.ok{color:#15803d}',
      P + '-msg.info{color:#0369a1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:8px 10px}',
      // ---------- 发起会诊表单（常驻展开，三列网格） ----------
      P + '-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 18px}',
      P + '-field{display:flex;flex-direction:column;gap:5px}',
      P + '-field label{font-size:12px;color:#64748b}',
      P + '-req{color:#dc2626;margin-left:3px;font-weight:600}',
      P + '-field input,' + P + '-field select,' + P + '-field textarea{font-family:inherit;font-size:13px;color:#1e293b;border:1px solid #cdd7e1;border-radius:6px;padding:7px 10px;background:#fff;width:100%;box-sizing:border-box;min-height:34px}',
      P + '-field input:focus,' + P + '-field select:focus{outline:none;border-color:#1d4ed8;box-shadow:0 0 0 2px rgba(29,78,216,.08)}',
      P + '-form-foot{grid-column:1/-1;display:flex;gap:8px;align-items:center}',
      // ---------- 定时选择器（自定义面板，替代原生 datetime-local） ----------
      P + '-dt{position:relative}',
      P + '-dt input{cursor:pointer;padding-right:52px}',
      P + '-dt input::placeholder{color:#94a3b8}',
      P + '-dt-clear{position:absolute;right:26px;top:50%;transform:translateY(-50%);width:16px;height:16px;line-height:14px;text-align:center;border-radius:50%;color:#94a3b8;font-size:13px;cursor:pointer;display:none}',
      P + '-dt-clear:hover{background:#f1f5f9;color:#475569}',
      P + '-dt-icon{position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#94a3b8;display:flex;pointer-events:none}',
      P + '-dp{position:fixed;z-index:60;width:272px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 12px 32px rgba(15,23,42,.16);padding:10px;font-size:13px;user-select:none}',
      P + '-dp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
      P + '-dp-title{font-weight:600;color:#1e293b;font-size:13px}',
      P + '-dp-nav{border:none;background:none;cursor:pointer;color:#475569;width:24px;height:24px;border-radius:4px;font-size:14px;line-height:1}',
      P + '-dp-nav:hover{background:#f1f5f9}',
      P + '-dp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}',
      P + '-wd{color:#94a3b8;font-size:11px;text-align:center;padding:2px 0}',
      P + '-day{border:none;background:none;cursor:pointer;height:26px;border-radius:4px;color:#1e293b;font-size:12px;font-family:inherit;padding:0}',
      P + '-day:hover{background:#f1f5f9}',
      P + '-day.dim{color:#cbd5e1}',
      P + '-day.today{box-shadow:inset 0 0 0 1px #94a3b8}',
      P + '-day.sel{background:#1d4ed8;color:#fff}',
      P + '-day.sel:hover{background:#1e40af}',
      P + '-day:disabled{color:#cbd5e1;cursor:not-allowed;background:none;box-shadow:none}',
      P + '-time{display:flex;gap:8px;align-items:center;margin-top:8px}',
      P + '-time b{font-size:12px;color:#64748b;font-weight:400;white-space:nowrap}',
      P + '-time select{flex:1;font-family:inherit;font-size:12px;color:#1e293b;border:1px solid #cdd7e1;border-radius:4px;padding:4px 6px;background:#fff;min-width:0}',
      P + '-foot{display:flex;gap:6px;align-items:center;margin-top:10px}',
      P + '-foot .sp{flex:1}',
      // ---------- 基层上转提示（基层会诊视图） ----------
      P + '-role{padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:13px;line-height:1.55;color:#334155}',
      P + '-role strong{display:block;font-size:13px;margin-bottom:2px;color:#0c4a6e}',
      // ---------- 会诊队列（全量单表） ----------
      P + '-section-head{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px;margin:0 0 10px}',
      P + '-section-head h3{margin:0;font-size:15px;font-weight:600;color:#0f172a;flex:0 0 auto}',
      P + '-qcount{font-size:12px;color:#94a3b8;margin-left:auto;white-space:nowrap}',
      // 状态筛选：胶囊按钮组，计数跟在标签后
      P + '-filters{display:flex;flex-wrap:wrap;gap:6px}',
      P + '-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #dfe6ee;background:#fff;color:#475569;border-radius:999px;padding:4px 11px;font-size:12px;font-family:inherit;line-height:1.5;cursor:pointer}',
      P + '-chip:hover{border-color:#b6c4d6;background:#f8fafc;color:#334155}',
      P + '-chip b{font-weight:600;font-size:11px;color:#a3aebd}',
      P + '-chip.on{background:#eef4fd;border-color:#b9cdf0;color:#1d4ed8;font-weight:600}',
      P + '-chip.on b{color:#1d4ed8}',
      // 分页条
      P + '-pager{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 14px;margin-top:10px;font-size:12px;color:#64748b}',
      P + '-pager-info{white-space:nowrap}',
      P + '-pager-ctl{display:flex;align-items:center;flex-wrap:wrap;gap:4px}',
      P + '-pg-btn{min-width:28px;height:28px;padding:0 9px;border:1px solid #dfe6ee;background:#fff;color:#475569;border-radius:5px;font-size:12px;font-family:inherit;line-height:1;cursor:pointer}',
      P + '-pg-btn:hover:not(:disabled){border-color:#94a3b8;background:#f8fafc;color:#1e293b}',
      P + '-pg-btn:disabled{opacity:.45;cursor:not-allowed}',
      P + '-pg-btn.on{background:#1e4b7b;border-color:#1e4b7b;color:#fff;font-weight:600}',
      P + '-pg-btn.on:hover{background:#1e4b7b;color:#fff}',
      P + '-pg-gap{color:#cbd5e1;padding:0 2px}',
      P + '-pg-size{display:inline-flex;align-items:center;gap:5px;margin-left:8px;color:#64748b;white-space:nowrap}',
      P + '-pg-size select{font-family:inherit;font-size:12px;color:#1e293b;border:1px solid #dfe6ee;border-radius:5px;padding:4px 6px;background:#fff;cursor:pointer}',
      P + ' .business-table{border:1px solid #e6ebf2;border-radius:10px;overflow:auto;background:#fff}',
      P + ' .business-table table{width:100%;border-collapse:collapse;font-size:13px;margin:0}',
      P + ' .business-table th{background:#f7f9fc;color:#64748b;font-weight:500;text-align:left;padding:9px 14px;border-bottom:1px solid #e6ebf2;white-space:nowrap;font-size:12px}',
      P + ' .business-table td{padding:11px 14px;border-bottom:1px solid #f1f4f8;color:#334155;vertical-align:middle}',
      P + ' .business-table tr:last-child td{border-bottom:none}',
      P + ' .business-table tbody tr:hover td{background:#fafcfe}',
      P + ' .business-table td small{display:block;color:#94a3b8;font-size:12px;margin-top:2px}',
      // 状态标签：待接诊蓝 / 会诊中绿 / 已结束灰 / 定时紫
      P + '-tag{display:inline-block;padding:2px 9px;border-radius:5px;font-size:12px;border:1px solid transparent;white-space:nowrap}',
      P + '-tag.waiting{background:#e9f1fe;color:#1d4ed8;border-color:#c8dbfd}',
      P + '-tag.calling{background:#e6f7f0;color:#047857;border-color:#a9efd2}',
      P + '-tag.finished{background:#f1f5f9;color:#64748b;border-color:#e2e8f0}',
      P + '-tag.sched{background:#ede9fe;color:#6d28d9;border-color:#ddd6fe}',
      P + '-kind{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid transparent}',
      P + '-kind.grass{background:#ecfdf5;color:#047857;border-color:#6ee7b7}',
      P + '-kind.county{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}',
      P + '-kind.pre{background:#fff7ed;color:#c2410c;border-color:#fed7aa}',
      P + '-intent{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid transparent}',
      P + '-intent.transfer{background:#fef3c7;color:#92400e;border-color:#fde68a}',
      P + '-intent.only{background:#f1f5f9;color:#475569;border-color:#e2e8f0}',
      P + '-empty{color:#94a3b8;font-size:13px;padding:14px 2px}',
      // ---------- 接诊确认弹层 ----------
      P + '-modal{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:16px}',
      P + '-modal[hidden]{display:none!important}',
      P + '-modal-back{position:absolute;inset:0;background:rgba(15,23,42,.45)}',
      P + '-modal-box{position:relative;width:min(440px,100%);background:#fff;border-radius:10px;border:1px solid #e2e8f0;box-shadow:0 20px 50px rgba(15,23,42,.2);padding:16px 18px}',
      P + '-modal-title{margin:0 0 10px;font-size:16px;font-weight:600;color:#1e293b}',
      P + '-modal-body{font-size:13px;line-height:1.55;color:#334155;margin-bottom:14px}',
      P + '-modal-body dl{margin:0;display:grid;grid-template-columns:72px 1fr;gap:4px 10px}',
      P + '-modal-body dt{color:#64748b;margin:0}',
      P + '-modal-body dd{margin:0;color:#0f172a}',
      P + '-modal-foot{display:flex;justify-content:flex-end;gap:8px}',
      '@media(max-width:900px){' + P + '-form{grid-template-columns:1fr}}',
    ].join('\n')
    document.head.appendChild(style)
  }

  // ---------- 模板 ----------

  function options(list, valueOf, labelOf, placeholder) {
    var html = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : ''
    html += list.map(function (it) {
      return '<option value="' + esc(valueOf(it)) + '">' + esc(labelOf(it)) + '</option>'
    }).join('')
    return html
  }

  function formHtml() {
    return (
      '<div class="' + HOST_ID + '-form">' +
      '<div class="' + HOST_ID + '-field"><label for="hx-cw-f-patient">患者选择</label><select id="hx-cw-f-patient"></select></div>' +
      '<div class="' + HOST_ID + '-field"><label for="hx-cw-f-complaint">主诉</label><input id="hx-cw-f-complaint" type="text" placeholder="如：胸痛2小时"></div>' +
      '<div class="' + HOST_ID + '-field"><label for="hx-cw-f-dept">目标科室</label><select id="hx-cw-f-dept"></select></div>' +
      '<div class="' + HOST_ID + '-field"><label for="hx-cw-f-doctor">指定接诊医生</label><select id="hx-cw-f-doctor"></select></div>' +
      '<div class="' + HOST_ID + '-field"><label for="hx-cw-f-note">备注<span class="' + HOST_ID + '-req">*</span></label><input id="hx-cw-f-note" type="text" placeholder="必填，请填写会诊说明"></div>' +
      '<div class="' + HOST_ID + '-field"><label for="hx-cw-f-schedule">定时开始（可选）</label>' +
      '<div class="' + HOST_ID + '-dt">' +
      '<input id="hx-cw-f-schedule" type="text" readonly placeholder="选填，到点立即可开始">' +
      '<span class="' + HOST_ID + '-dt-clear" id="hx-cw-f-dt-clear" data-act="dt-clear" title="清除定时">&times;</span>' +
      '<span class="' + HOST_ID + '-dt-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>' +
      '</div></div>' +
      '<div class="' + HOST_ID + '-form-foot">' +
      '<button type="button" class="' + HOST_ID + '-btn primary" data-act="submit">发起会诊</button>' +
      '<button type="button" class="' + HOST_ID + '-btn" data-act="toggle-form">取消</button>' +
      '<span class="' + HOST_ID + '-msg" id="hx-cw-form-msg"></span>' +
      '</div></div>'
    )
  }

  function acceptModalHtml() {
    return (
      '<div class="' + HOST_ID + '-modal" id="hx-cw-accept-modal" hidden role="dialog" aria-modal="true">' +
      '<div class="' + HOST_ID + '-modal-back" data-act="accept-cancel"></div>' +
      '<div class="' + HOST_ID + '-modal-box">' +
      '<h3 class="' + HOST_ID + '-modal-title">确认接诊</h3>' +
      '<div id="hx-cw-accept-body" class="' + HOST_ID + '-modal-body"></div>' +
      '<div class="' + HOST_ID + '-modal-foot">' +
      '<button type="button" class="' + HOST_ID + '-btn" data-act="accept-cancel">取消</button>' +
      '<button type="button" class="' + HOST_ID + '-btn primary" data-act="accept-confirm">确认接诊</button>' +
      '</div></div></div>'
    )
  }

  function shellHtml() {
    return (
      acceptModalHtml() +
      '<div class="' + HOST_ID + '-stack">' +
      '<header class="' + HOST_ID + '-hero">' +
      '<h1 id="hx-cw-title">' + (state.scopeTab === 'grassroots' ? '基层会诊' : '远程会诊') + '</h1>' +
      '<div class="' + HOST_ID + '-actions">' +
      '<button type="button" class="' + HOST_ID + '-btn ghost" data-act="refresh">刷新</button>' +
      '<button type="button" class="' + HOST_ID + '-btn primary" data-act="toggle-form">收起表单</button>' +
      '</div></header>' +
      '<div id="hx-cw-ctx"></div>' +
      '<div class="' + HOST_ID + '-msg" id="hx-cw-msg"></div>' +
      '<div id="hx-cw-form-wrap">' + formHtml() + '</div>' +
      '<div id="hx-cw-role" class="' + HOST_ID + '-role" hidden></div>' +
      '<section>' +
      '<div class="' + HOST_ID + '-section-head">' +
      '<h3>会诊队列</h3>' +
      '<div class="' + HOST_ID + '-filters" id="hx-cw-filter" role="group" aria-label="按状态筛选会诊队列"></div>' +
      '<span class="' + HOST_ID + '-qcount" id="hx-cw-qcount"></span>' +
      '</div>' +
      '<div id="hx-cw-queue"></div>' +
      '</section></div>'
    )
  }

  var STATUS_LABEL = { WAITING: '待接诊', IN_CALL: '会诊中', FINISHED: '已结束' }

  function statusTag(status, label) {
    var cls = status === 'WAITING' ? 'waiting' : status === 'IN_CALL' ? 'calling' : 'finished'
    return '<span class="' + HOST_ID + '-tag ' + cls + '">' + esc(label || STATUS_LABEL[status] || status || '') + '</span>'
  }

  /** ISO 时间 → 浏览器本地时区的 "M月D日 HH:MM" */
  function fmtLocal(iso) {
    var d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    function p(n) { return (n < 10 ? '0' : '') + n }
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes())
  }

  /** 定时会诊是否已到开始时间（按浏览器时钟算，到点即时翻转为可进入） */
  function startableNow(it) {
    return !it.scheduledAt || Date.now() >= new Date(it.scheduledAt).getTime()
  }

  // ---------- 定时选择器（自定义面板） ----------

  var dp = { open: false, view: null, sel: null, panel: null }

  function p2(n) {
    return (n < 10 ? '0' : '') + n
  }

  /** 同步输入框显示与清除按钮 */
  function updateDtInput() {
    var inp = $('hx-cw-f-schedule')
    if (inp) {
      var text = ''
      if (state.schedule) {
        var d = state.schedule
        var ymd = d.getFullYear() === new Date().getFullYear()
          ? (d.getMonth() + 1) + '月' + d.getDate() + '日'
          : d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
        text = ymd + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes())
      }
      inp.value = text
    }
    var clear = $('hx-cw-f-dt-clear')
    if (clear) clear.style.display = state.schedule ? 'block' : 'none'
  }

  function dpApply(d) {
    d.setSeconds(0, 0)
    state.schedule = new Date(d.getTime())
    updateDtInput()
    dpClose()
  }

  function dpClose() {
    // 防御性清理所有面板实例：dpBuild 重建时会先移除旧面板，
    // 但万一有历史残留（如异常路径未走 dpClose），一并清掉，杜绝僵尸面板
    var all = document.querySelectorAll('.' + HOST_ID + '-dp')
    for (var i = 0; i < all.length; i++) all[i].remove()
    dp.panel = null
    dp.open = false
  }

  /** 面板定位：贴到输入框下方，放不下则翻到上方；左右防出屏 */
  function dpPlace() {
    if (!dp.panel) return
    var inp = $('hx-cw-f-schedule')
    if (!inp) return dpClose()
    var r = inp.getBoundingClientRect()
    var pw = dp.panel.offsetWidth
    var ph = dp.panel.offsetHeight
    var left = Math.min(Math.max(8, r.left), window.innerWidth - pw - 8)
    var top = r.bottom + 6
    if (top + ph > window.innerHeight - 8 && r.top - ph - 6 > 8) top = r.top - ph - 6
    dp.panel.style.left = Math.round(left) + 'px'
    dp.panel.style.top = Math.round(top) + 'px'
  }

  function dpBuild() {
    // 先移除旧面板再重建：切月/选日都会走到这里，
    // 原来只 append 新面板不移除旧的，导致面板叠加、旧面板永远关不掉
    if (dp.panel) dp.panel.remove()
    var v = dp.view
    var y = v.getFullYear()
    var m = v.getMonth()
    var today = new Date()
    var today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

    var firstDow = new Date(y, m, 1).getDay()
    var days = new Date(y, m + 1, 0).getDate()
    var cells = ''
    for (var i = 0; i < firstDow; i++) cells += '<span></span>'
    for (var d = 1; d <= days; d++) {
      var dayEnd = new Date(y, m, d, 23, 59, 59).getTime()
      var dis = dayEnd < today0 ? ' disabled' : ''
      var cls = []
      var cur = new Date(y, m, d)
      if (today.getFullYear() === y && today.getMonth() === m && today.getDate() === d) cls.push('today')
      if (dp.sel && cur.getFullYear() === dp.sel.getFullYear() && cur.getMonth() === dp.sel.getMonth() && cur.getDate() === dp.sel.getDate()) cls.push('sel')
      cells += '<button type="button" class="' + HOST_ID + '-day' + (cls.length ? ' ' + cls.join(' ') : '') + '"' +
        dis + ' data-dp="day" data-d="' + d + '">' + d + '</button>'
    }

    var hh = dp.sel ? dp.sel.getHours() : Math.min(23, new Date().getHours())
    var mi = dp.sel ? dp.sel.getMinutes() : Math.ceil(new Date().getMinutes() / 5) * 5 % 60
    var hourOpts = ''
    for (var h = 0; h < 24; h++) hourOpts += '<option value="' + h + '"' + (h === hh ? ' selected' : '') + '>' + p2(h) + '时</option>'
    var minOpts = ''
    for (var mi2 = 0; mi2 < 60; mi2 += 5) {
      minOpts += '<option value="' + mi2 + '"' + (mi2 === (Math.round(mi / 5) * 5) % 60 ? ' selected' : '') + '>' + p2(mi2) + '分</option>'
    }

    var panel = document.createElement('div')
    panel.className = HOST_ID + '-dp'
    panel.innerHTML =
      '<div class="' + HOST_ID + '-dp-head">' +
      '<button type="button" class="' + HOST_ID + '-dp-nav" data-dp="prev">‹</button>' +
      '<span class="' + HOST_ID + '-dp-title">' + y + '年' + (m + 1) + '月</span>' +
      '<button type="button" class="' + HOST_ID + '-dp-nav" data-dp="next">›</button>' +
      '</div>' +
      '<div class="' + HOST_ID + '-dp-grid">' +
      ['日', '一', '二', '三', '四', '五', '六'].map(function (w) { return '<span class="' + HOST_ID + '-wd">' + w + '</span>' }).join('') +
      cells +
      '</div>' +
      '<div class="' + HOST_ID + '-time"><b>时间</b>' +
      '<select id="hx-cw-dp-h">' + hourOpts + '</select>' +
      '<select id="hx-cw-dp-m">' + minOpts + '</select>' +
      '</div>' +
      '<div class="' + HOST_ID + '-foot">' +
      '<button type="button" class="' + HOST_ID + '-btn" data-dp="p1h">1小时后</button>' +
      '<button type="button" class="' + HOST_ID + '-btn" data-dp="tom9">明天9:00</button>' +
      '<span class="sp"></span>' +
      '<button type="button" class="' + HOST_ID + '-btn" data-dp="clear">清除</button>' +
      '<button type="button" class="' + HOST_ID + '-btn primary" data-dp="ok">确定</button>' +
      '</div>'

    panel.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-dp]')
      if (!el || !panel.contains(el)) return
      var act = el.getAttribute('data-dp')
      if (act === 'prev' || act === 'next') {
        dp.view = new Date(y, m + (act === 'next' ? 1 : -1), 1)
        dpBuild()
        dpPlace()
      } else if (act === 'day') {
        var d = parseInt(el.getAttribute('data-d'), 10)
        var sh = parseInt(($('hx-cw-dp-h') || {}).value || '9', 10)
        var sm = parseInt(($('hx-cw-dp-m') || {}).value || '0', 10)
        dp.sel = new Date(y, m, d, sh, sm, 0, 0)
        dpBuild()
        dpPlace()
      } else if (act === 'p1h') {
        var t1 = new Date(Date.now() + 3600e3)
        dpApply(new Date(t1.getFullYear(), t1.getMonth(), t1.getDate(), t1.getHours(), t1.getMinutes(), 0, 0))
      } else if (act === 'tom9') {
        var t2 = new Date()
        dpApply(new Date(t2.getFullYear(), t2.getMonth(), t2.getDate() + 1, 9, 0, 0, 0))
      } else if (act === 'clear') {
        state.schedule = null
        updateDtInput()
        dpClose()
      } else if (act === 'ok') {
        if (dp.sel) dpApply(dp.sel)
        else dpClose()
      }
    })

    panel.addEventListener('change', function (ev) {
      var id = ev.target && ev.target.id
      if (id !== 'hx-cw-dp-h' && id !== 'hx-cw-dp-m') return
      var sh = parseInt(($('hx-cw-dp-h') || {}).value || '9', 10)
      var sm = parseInt(($('hx-cw-dp-m') || {}).value || '0', 10)
      if (dp.sel) dp.sel = new Date(dp.sel.getFullYear(), dp.sel.getMonth(), dp.sel.getDate(), sh, sm, 0, 0)
      else dp.sel = new Date(new Date().setHours(sh, sm, 0, 0))
    })

    dp.panel = panel
    document.body.appendChild(panel)
  }

  function dpOpen() {
    if (dp.open) return dpClose()
    dp.sel = state.schedule ? new Date(state.schedule.getTime()) : null
    dp.view = new Date()
    dp.view.setDate(1)
    dp.view.setHours(0, 0, 0, 0)
    dpBuild()
    dp.open = true
    dpPlace()
  }

  // 面板打开时的全局关闭与快捷键（只注册一次）
  if (!window.__hxCwDtBound) {
    window.__hxCwDtBound = true
    document.addEventListener('mousedown', function (ev) {
      if (!dp.open || !dp.panel) return
      var t = ev.target
      // 选择器面板在 body 上，触发框在宿主内：这两处都不要被外部 mousedown 关掉。
      // 原来写的是 '#hx-cw-f-dt'，但触发框是 class（hx-cw-dt）、输入框 id 是 hx-cw-f-schedule，
      // 这个选择器永远匹配不到，等于该保护没生效。
      if (dp.panel.contains(t) || (t.closest && t.closest('.' + HOST_ID + '-dt'))) return
      dpClose()
    })
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && dp.open) dpClose()
    })
  }

  function opBtn(act, id, text, primary) {
    var mod = primary ? ' primary' : act === 'accept' ? ' ghost' : ' link'
    return '<button type="button" class="' + HOST_ID + '-btn sm' + mod +
      '" data-act="' + act + '" data-id="' + esc(id) + '">' + esc(text) + '</button>'
  }

  function opLink(href, text, primary) {
    return '<a class="' + HOST_ID + '-btn sm' + (primary ? ' primary' : ' link') + '" href="' + esc(href) + '">' + esc(text) + '</a>'
  }

  /** 「进入会诊室」→ 直接取入会链接跳远程会诊系统会议室，不再经 episode/本地 room 中转 */
  function opEnterRoom(it) {
    var label = '进入会诊室'
    var cls = HOST_ID + '-btn ' + HOST_ID + '-btn-enter'
    return (
      '<button type="button" class="' + cls + '" data-act="join" data-id="' + esc(it.sessionId) + '">' +
      esc(label) +
      '</button>'
    )
  }

  function resolvePatientId(it) {
    if (!it) return ''
    var pid = it.patientId || (it.patient && (it.patient.patientId || it.patient.id)) || ''
    if (pid) return pid
    var name = (it.patient && it.patient.name) || it.patientName || ''
    if (name && state.scenarioPatientByName[name.trim()]) return state.scenarioPatientByName[name.trim()]
    if (!name || !state.patients.length) return ''
    var hit = state.patients.filter(function (p) { return p.name === name })[0]
    return (hit && hit.patientId) || ''
  }

  function consultToken(it) {
    if (!it) return ''
    var token =
      it.consultationToken ||
      it.token ||
      (it.room && it.room.token) ||
      it.rtcToken ||
      it.roomToken ||
      ''
    if (!token && it.sessionId && state.scenarioBySession[it.sessionId]) {
      token = state.scenarioBySession[it.sessionId].token || ''
    }
    return token || ''
  }

  function ingestScenarioPack(pack) {
    if (!pack) return
    var st = (pack && pack.state) || pack || {}
    window.hxConsultEpisodeNav?.indexFromScenario(st)
    state.scenarioBySession = {}
    state.scenarioPatientByName = {}
    ;(st.consultationRequests || []).forEach(function (cr) {
      if (cr && cr.id) state.scenarioBySession[cr.id] = cr
    })
    ;(st.patients || []).forEach(function (p) {
      if (p && p.name && p.id) state.scenarioPatientByName[String(p.name).trim()] = p.id
    })
    state.queue = state.queue.map(function (it) {
      var cr = state.scenarioBySession[it.sessionId]
      if (cr) {
        if (!it.consultationToken && cr.token) it.consultationToken = cr.token
        if (!it.patientId && cr.patientId) it.patientId = cr.patientId
      }
      if (!it.patientId) it.patientId = resolvePatientId(it)
      it.transferIntent = resolveTransferIntent(it)
      return it
    })
    enrichQueueMeta()
    if (!state.patients.length) {
      state.patients = (st.patients || []).map(function (p) {
        return {
          patientId: p.id,
          name: p.name,
          gender: p.gender,
          age: p.age,
          institutionName: orgLabel(p.institutionId),
          departmentName: p.departmentId || '',
          chiefComplaint: (p.symptoms || []).join('、'),
        }
      })
    }
    if (!state.doctors.length) {
      state.doctors = (st.staff || [])
        .filter(function (s) { return String(s.profession || '').toLowerCase() === 'doctor' })
        .map(function (s) {
          return {
            doctorId: s.id,
            name: s.name,
            institutionName: orgLabel(s.institutionId),
            departmentName: s.departmentId || '',
          }
        })
    }
  }

  function fetchScenarioPack() {
    return fetch('/scenario.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null })
      .catch(function () { return null })
  }

  function consultKind(it) {
    var role = it.originRole || it.launchRole
    if (role === 'grassroots' || isGrassrootsItem(it)) return { label: '基层上转', cls: 'grass' }
    if (role === 'prehospital') return { label: '院前', cls: 'pre' }
    var src = String(it.sourceHospital || '') + String(it.sourceDepartment || '')
    if (/120|出警|院前|急救/.test(src)) return { label: '院前', cls: 'pre' }
    return { label: '县域', cls: 'county' }
  }

  function resolveTransferIntent(it) {
    if (it.transferIntent === 'consult_transfer' || it.transferIntent === 'consult_only') return it.transferIntent
    if (it.intent === 'consult_transfer' || it.intent === 'consult_only') return it.intent
    if (isGrassrootsItem(it)) return 'consult_transfer'
    return 'consult_only'
  }

  function intentTag(it) {
    var code = resolveTransferIntent(it)
    var transfer = code === 'consult_transfer'
    return (
      '<span class="' + HOST_ID + '-intent ' + (transfer ? 'transfer' : 'only') + '">' +
      (transfer ? '会诊+转诊' : '仅会诊') +
      '</span>'
    )
  }

  function enrichQueueMeta() {
    state.queue.forEach(function (it) {
      it.transferIntent = resolveTransferIntent(it)
    })
  }

  function roleBannerHtml() {
    return (
      '<strong>县域接诊 · 基层上转待办</strong>' +
      '<span>仅乡镇/村室来源的上转会诊；混排院前队列请用顶栏「远程会诊」。上转意图在发起时已标注。</span>'
    )
  }

  /** 患者链路仅在 120 调度带入任务上下文时展示（院前链：出警 → 远程会诊 → 转诊 → 重症） */
  function chainHtml() {
    var dd = state.dispatch
    if (!dd || !dd.task) return ''
    return (
      '<nav class="' + HOST_ID + '-chain" aria-label="患者链路">' +
      '<span class="label">院前链</span>' +
      '<a href="/#/dispatch/list?task=' + encodeURIComponent(dd.task) + '">出警 ' + esc(dd.task) + '</a>' +
      '<span aria-hidden="true">→</span><span class="on">远程会诊</span>' +
      '<span aria-hidden="true">→</span>' +
      '<a href="/#/transfers?scope=grassroots">转诊协同</a>' +
      '<span aria-hidden="true">→</span>' +
      '<a href="/#/critical">重症/床位</a>' +
      (dd.complaint ? '<span class="meta">主诉 ' + esc(dd.complaint) + '</span>' : '') +
      '</nav>'
    )
  }

  var ORG_LABEL = {
    chuanshi: '船石村卫生室',
    lianjie: '连界镇卫生院',
    weiyuan: '威远县人民医院',
    huaxi: '四川大学华西医院',
    'neijiang-first': '内江市第一人民医院',
  }

  function orgLabel(id) {
    return ORG_LABEL[id] || id || '—'
  }

  function queueHtml() {
    var scoped = queueForScope()
    if (state.loading && !state.queue.length) return '<div class="' + HOST_ID + '-empty">加载中…</div>'
    if (!scoped.length) {
      if (state.scopeTab === 'grassroots' && state.queue.length) {
        return '<div class="' + HOST_ID + '-empty">当前筛选下暂无基层上转会诊单（全县共 ' + state.queue.length + ' 条）</div>'
      }
      return '<div class="' + HOST_ID + '-empty">暂无会诊单</div>'
    }
    var pg = queuePage()
    if (!pg.total) {
      var only = STATUS_FILTERS.filter(function (f) { return f.key === state.statusFilter })[0]
      return '<div class="' + HOST_ID + '-empty">当前状态下暂无会诊单（' +
        esc(only ? only.label : '') + '，本视图共 ' + scoped.length + ' 单）</div>' +
        pagerHtml(pg)
    }
    var rows = pg.rows.map(function (it) {
      var p = it.patient || {}
      var who = esc(p.name || '—')
      if (p.age) who += ' · ' + esc(p.age) + '岁'
      var ops = []
      var scheduledLater = it.scheduledAt && !startableNow(it)
      // 待接诊（含定时未到点）提供「改诊」：点击后走确认接诊流程，由当前账号认领会诊
      if (it.status === 'WAITING' && state.dataSource === 'api') {
        ops.push(opBtn('accept', it.sessionId, '改诊'))
      }
      // 定时未到点：状态列显示"定时·开始时间"，不出现"进入会诊室"
      if (!scheduledLater && (it.status === 'WAITING' || it.status === 'IN_CALL')) {
        ops.push(opEnterRoom(it))
      }
      var statusHtml = scheduledLater
        ? '<span class="' + HOST_ID + '-tag sched">定时 · ' + esc(fmtLocal(it.scheduledAt)) + ' 开始</span>'
        : statusTag(it.status, it.statusLabel)
      // 远程会诊（全量）默认视图：7 列布局
      if (state.scopeTab !== 'grassroots') {
        return (
          '<tr>' +
          '<td>' + esc(it.consultCode || it.sessionId) + '</td>' +
          '<td>' + who + '</td>' +
          '<td>' + esc(it.sourceHospital || '—') + (it.sourceDepartment ? '<small>' + esc(it.sourceDepartment) + '</small>' : '') + '</td>' +
          '<td>' + esc(it.targetHospital || '—') + (it.targetDepartment ? '<small>' + esc(it.targetDepartment) + '</small>' : '') + '</td>' +
          '<td>' + esc(it.nominatedDoctorName || '—') + '</td>' +
          '<td>' + statusHtml + '</td>' +
          '<td><div class="' + HOST_ID + '-ops">' + (ops.length ? ops.join('') : '<span style="color:#94a3b8">—</span>') + '</div></td>' +
          '</tr>'
        )
      }
      var kind = consultKind(it)
      var pid = resolvePatientId(it)
      var tok = it.consultationToken || it.token || ''
      if (pid || tok) {
        var epH =
          window.hxConsultEpisodeNav &&
          window.hxConsultEpisodeNav.episodeHash({ patientId: pid, token: tok })
        if (epH) ops.push(opLink(epH, '连续诊疗'))
      }
      if (pid) {
        ops.push(opLink('#/patient/' + encodeURIComponent(pid), '患者档案'))
        ops.push(opLink('#/transfers?scope=grassroots&patient=' + encodeURIComponent(pid), '转诊协同'))
      }
      var cc = it.chiefComplaint || (p.chiefComplaint || '') || '—'
      return (
        '<tr>' +
        '<td><span class="' + HOST_ID + '-kind ' + kind.cls + '">' + esc(kind.label) + '</span>' +
        '<small>' + esc(it.consultCode || it.sessionId) + '</small></td>' +
        '<td>' + who + '</td>' +
        '<td>' + esc(it.sourceHospital || '—') + (it.sourceDepartment ? '<small>' + esc(it.sourceDepartment) + '</small>' : '') + '</td>' +
        '<td>' + esc(it.targetHospital || '—') + (it.targetDepartment ? '<small>' + esc(it.targetDepartment) + '</small>' : '') + '</td>' +
        '<td style="max-width:140px">' + esc(cc) + '</td>' +
        '<td>' + intentTag(it) + '</td>' +
        '<td>' + statusHtml + '</td>' +
        '<td><div class="' + HOST_ID + '-ops">' + (ops.length ? ops.join('') : '<span style="color:#94a3b8">—</span>') + '</div></td>' +
        '</tr>'
      )
    }).join('')
    return (
      '<div class="business-table table-scroll"><table><thead><tr>' +
      (state.scopeTab === 'grassroots'
        ? '<th>类型 / 单号</th><th>患者</th><th>来源</th><th>目标</th><th>主诉</th><th>上转意图</th><th>状态</th><th>操作</th>'
        : '<th>会诊单号</th><th>患者</th><th>来源</th><th>目标</th><th>指定医生</th><th>状态</th><th>操作</th>') +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' + pagerHtml(pg)
    )
  }

  /** 状态筛选：胶囊按钮组（计数取当前视图内各状态条数） */
  function filterHtml() {
    var counts = statusCounts()
    return STATUS_FILTERS.map(function (f) {
      var on = state.statusFilter === f.key
      return (
        '<button type="button" class="' + HOST_ID + '-chip' + (on ? ' on' : '') + '"' +
        ' data-act="filter-status" data-status="' + f.key + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
        esc(f.label) + '<b>' + counts[f.key] + '</b></button>'
      )
    }).join('')
  }

  /** 页码序列：页数多时折叠成 1 … 4 5 6 … 20，避免按钮铺满一行 */
  function pageItems(pages, cur) {
    var out = []
    var i
    if (pages <= 7) {
      for (i = 1; i <= pages; i++) out.push(i)
      return out
    }
    out.push(1)
    var lo = Math.max(2, cur - 1)
    var hi = Math.min(pages - 1, cur + 1)
    if (lo > 2) out.push('…')
    for (i = lo; i <= hi; i++) out.push(i)
    if (hi < pages - 1) out.push('…')
    out.push(pages)
    return out
  }

  function pagerHtml(pg) {
    var total = pg.total || 0
    var from = total ? pg.start + 1 : 0
    var to = pg.start + (pg.rows ? pg.rows.length : 0)
    var nums = pageItems(pg.pages, state.page).map(function (n) {
      if (n === '…') return '<span class="' + HOST_ID + '-pg-gap">…</span>'
      var on = n === state.page
      return '<button type="button" class="' + HOST_ID + '-pg-btn' + (on ? ' on' : '') +
        '" data-act="goto-page" data-page="' + n + '"' + (on ? ' aria-current="page"' : '') + '>' + n + '</button>'
    }).join('')

    var sizes = [10, 20, 50, 100].map(function (n) {
      return '<option value="' + n + '"' + (n === state.pageSize ? ' selected' : '') + '>' + n + '</option>'
    }).join('')

    // 后端队列是"取前 N 条"：本地条数少于总条数时说明还有未加载的会诊单，明确提示避免误判
    var partial = state.queueTotal > state.queue.length
      ? '（已加载最近 ' + state.queue.length + ' / ' + state.queueTotal + ' 单）'
      : ''

    return (
      '<div class="' + HOST_ID + '-pager">' +
      '<span class="' + HOST_ID + '-pager-info">' +
      (total ? '第 ' + from + '–' + to + ' 条 / 共 ' + total + ' 条' : '共 0 条') + esc(partial) +
      '</span>' +
      '<span class="' + HOST_ID + '-pager-ctl">' +
      '<button type="button" class="' + HOST_ID + '-pg-btn" data-act="goto-page" data-page="' + (state.page - 1) + '"' +
      (state.page <= 1 ? ' disabled' : '') + '>上一页</button>' +
      nums +
      '<button type="button" class="' + HOST_ID + '-pg-btn" data-act="goto-page" data-page="' + (state.page + 1) + '"' +
      (state.page >= pg.pages ? ' disabled' : '') + '>下一页</button>' +
      '<label class="' + HOST_ID + '-pg-size">每页<select id="hx-cw-pagesize">' + sizes + '</select>条</label>' +
      '</span></div>'
    )
  }

  /** 同步 120 调度跳转带入的任务上下文（task/plate/complaint），变化才重绘 */
  function syncDispatchFromQuery() {
    var q = query()
    var task = q.get('task') || ''
    var plate = q.get('plate') || ''
    var complaint = q.get('complaint') || ''
    var next = (task || plate) ? { task: task, plate: plate, complaint: complaint } : null
    var prev = state.dispatch
    var changed = (!!prev !== !!next) ||
      (prev && next && (prev.task !== next.task || prev.plate !== next.plate || prev.complaint !== next.complaint))
    if (changed) {
      state.dispatch = next
      paint()
    }
  }

  /** 120 跳转带 launch=1：表单已常驻展开，只清理 URL 参数 */
  function maybeOpenLaunchForm() {
    var q = query()
    if (q.get('launch') !== '1') return
    q.delete('launch')
    var qs = q.toString()
    var target = '#/consultations' + (qs ? '?' + qs : '')
    if (location.hash !== target) history.replaceState(null, '', location.pathname + location.search + target)
  }

  function paint() {
    var q = $('hx-cw-queue')
    var ctx = $('hx-cw-ctx')
    var role = $('hx-cw-role')
    var count = $('hx-cw-qcount')
    var title = $('hx-cw-title')
    var grassroots = state.scopeTab === 'grassroots'
    var titleText = grassroots ? '基层会诊' : '远程会诊'
    if (title) title.textContent = titleText
    var reactH1 = document.querySelector('main.workspace .workspace-heading h1')
    if (reactH1 && document.body.classList.contains(BODY_FLAG)) reactH1.textContent = titleText
    if (role) {
      role.hidden = !grassroots
      role.innerHTML = grassroots ? roleBannerHtml() : ''
    }
    if (ctx) {
      var dd = state.dispatch
      ctx.innerHTML = dd
        ? '<div class="' + HOST_ID + '-ctxstrip">任务上下文：任务 ' + esc(dd.task || '—') +
          ' · ' + esc(dd.plate || '—') + (dd.complaint ? ' · 主诉 ' + esc(dd.complaint) : '') + '</div>' + chainHtml()
        : ''
    }
    if (count) {
      var total = queueForScope().length
      if (!total) count.textContent = ''
      else if (state.statusFilter === 'ALL') count.textContent = '共 ' + total + ' 单'
      else count.textContent = '筛选出 ' + queueFiltered().length + ' 单 / 共 ' + total + ' 单'
    }
    var filters = $('hx-cw-filter')
    if (filters) filters.innerHTML = queueForScope().length ? filterHtml() : ''
    if (q) q.innerHTML = queueHtml()
    maybeOpenLaunchForm()
    syncForm()
  }

  function fillSelect(el, html) {
    if (!el) return
    var keep = el.value
    el.innerHTML = html
    if (keep) {
      for (var i = 0; i < el.options.length; i++) {
        if (el.options[i].value === keep) {
          el.selectedIndex = i
          break
        }
      }
    }
  }

  function syncForm() {
    fillSelect($('hx-cw-f-patient'), options(state.patients, function (p) {
      return p.patientId
    }, function (p) {
      var who = (p.name || '—') + '（' + (p.genderLabel || '') + (p.age ? ' ' + p.age + '岁' : '')
      if (p.institutionName) who += ' · ' + p.institutionName
      return who + '）'
    }, '请选择患者'))

    fillSelect($('hx-cw-f-dept'), options(state.depts, function (d) {
      return d.dept_name
    }, function (d) {
      return d.dept_name
    }, '请选择目标科室'))

    fillSelect($('hx-cw-f-doctor'), options(state.doctors, function (d) {
      return d.doctorId
    }, function (d) {
      return d.name + (d.departmentName ? '（' + d.departmentName + '）' : '')
    }, '不指定'))
  }

  function setMsg(text, kind) {
    state.msg = text || ''
    state.msgKind = kind || ''
    var el = $('hx-cw-msg')
    if (!el) return
    var cls = HOST_ID + '-msg'
    if (kind === 'err') cls += ' err'
    else if (kind === 'ok') cls += ' ok'
    else if (kind === 'info') cls += ' info'
    el.className = cls
    el.textContent = state.msg
  }

  function setFormMsg(text, kind) {
    var el = $('hx-cw-form-msg')
    if (!el) return
    el.className = HOST_ID + '-msg ' + (kind || '')
    el.textContent = text || ''
  }

  // ---------- 数据 ----------

  function mapScenarioConsult(cr, pack) {
    var patients = pack.patients || []
    var staff = pack.staff || []
    var p = patients.filter(function (x) { return x.id === cr.patientId })[0] || {}
    var st = cr.status === 'completed' ? 'FINISHED' : cr.status === 'accepted' ? 'IN_CALL' : 'WAITING'
    var nom = staff.filter(function (s) { return s.id === cr.nominatedDoctorId })[0]
    return {
      sessionId: cr.id,
      consultCode: cr.id,
      consultationToken: cr.token,
      token: cr.token,
      patientId: cr.patientId,
      status: st,
      sourceHospital: orgLabel(cr.sourceInstitutionId),
      sourceDepartment: cr.sourceDepartmentId || '',
      targetHospital: orgLabel(cr.institutionId),
      targetDepartment: cr.departmentId || '',
      nominatedDoctorName: nom ? nom.name : '',
      chiefComplaint: (p.symptoms && p.symptoms.join && p.symptoms.join('、')) || '',
      patient: { name: p.name, age: p.age, patientId: p.id, chiefComplaint: (p.symptoms || []).join('、') },
    }
  }

  function loadDemoScenario() {
    return fetch('/scenario.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null })
      .then(function (pack) {
        var st = (pack && pack.state) || pack || {}
        var reqs = st.consultationRequests || []
        state.queue = reqs.map(function (cr) { return mapScenarioConsult(cr, st) })
        state.queueTotal = state.queue.length
        state.patients = (st.patients || []).map(function (p) {
          return {
            patientId: p.id,
            name: p.name,
            gender: p.gender,
            age: p.age,
            institutionName: orgLabel(p.institutionId),
            departmentName: p.departmentId || '',
            chiefComplaint: (p.symptoms || []).join('、'),
          }
        })
        state.doctors = (st.staff || [])
          .filter(function (s) { return String(s.profession || '').toLowerCase() === 'doctor' })
          .map(function (s) {
            return {
              doctorId: s.id,
              name: s.name,
              institutionName: orgLabel(s.institutionId),
              departmentName: s.departmentId || '',
            }
          })
        state.orgs = []
        state.depts = []
        state.dataSource = 'demo'
        ingestScenarioPack(pack)
        state.ready = true
        return state.queue.length > 0
      })
      .catch(function () {
        return false
      })
  }

  function loadAll() {
    if (state.loading) return Promise.resolve()
    state.loading = true
    paint()
    var t = Date.now()
    // 首屏只发一个聚合请求（队列+患者/机构/科室/医生）：
    // 本地 php -S 后端是单进程，HTTP 请求会串行排队，拆多个请求只会拿到总耗时之和
    // pageSize 取 100：状态筛选与分页都在本地做（"定时/待接诊"要按 scheduledAt + 本地时钟
    // 拆分，后端的 status 只有三态），一次多取一些才不会让分页总数对不上。
    return call('GET', '/consultations/workspace', {
      status: 'WAITING,IN_CALL,FINISHED', pageNum: 1, pageSize: 100, _t: t,
    }).catch(function () { return null }).then(function (ws) {
      if (ws && typeof ws === 'object') {
        var queueRaw = ws.queue
        state.queue = queueRaw ? listOf(queueRaw) : []
        state.queueTotal =
          queueRaw && queueRaw.total != null ? Number(queueRaw.total) : state.queue.length
        state.dataSource = 'api'
        if (ws.doctors) state.doctors = ws.doctors
        if (ws.patients) state.patients = listOf(ws.patients)
        if (ws.organizations) state.orgs = listOf(ws.organizations)
        if (ws.departments) state.depts = uniqBy(listOf(ws.departments), 'dept_name')
        state.ready = true
        setMsg('')
        return fetchScenarioPack().then(function (pack) {
          ingestScenarioPack(pack)
          enrichQueueMeta()
        })
      }
      return loadDemoScenario().then(function (ok) {
        if (ok) {
          setMsg('后端会诊接口未连接，当前为演示队列；接诊/发起会诊接后端后自动切换。', 'info')
        } else {
          setMsg('无法加载会诊数据，请检查网络或刷新页面。', 'err')
        }
      })
    }).catch(function () {
      return loadDemoScenario().then(function (ok) {
        if (ok) setMsg('后端会诊接口未连接，当前为演示队列。', 'info')
        else setMsg('无法加载会诊数据。', 'err')
      })
    }).then(function () {
      state.loading = false
      // P3 工作台：#/consultations 固定走表格工作台，加载失败也不退回 React P2 卡片页
      if (path() === ROUTE && shouldUseConsultWorkbench() && !state.ready) {
        state.ready = true
        if (!state.queue) state.queue = []
        if (!state.patients) state.patients = []
        if (!state.msg) {
          setMsg('会诊数据加载不完整，可点「刷新」重试；发起会诊表单仍可使用。', 'info')
        }
      }
      paint()
    })
  }

  /** 同步右上角按钮文案：表单展开时是"收起表单"，避免两个入口互相冲突 */
  function setHeadBtn(open) {
    var btn = document.querySelector('#' + HOST_ID + ' .' + HOST_ID + '-actions [data-act="toggle-form"]')
    if (btn) btn.textContent = open ? '收起表单' : '发起会诊'
  }

  function toggleForm() {
    var wrap = $('hx-cw-form-wrap')
    if (!wrap) return
    wrap.hidden = !wrap.hidden
    if (!wrap.hidden) {
      syncForm()
      // 120 调度带入的任务上下文预填：主诉、备注（不覆盖医生已输入的内容）
      var dd = state.dispatch
      if (dd) {
        var c = $('hx-cw-f-complaint')
        if (c && !c.value && dd.complaint) c.value = dd.complaint
        var n = $('hx-cw-f-note')
        if (n && !n.value && (dd.task || dd.plate)) {
          n.value = ('任务 ' + (dd.task || '—') + ' · ' + dd.plate).replace(/^任务 — · $/, '').trim()
        }
      }
      setFormMsg('')
    }
    setHeadBtn(!wrap.hidden)
  }

  function submitForm() {
    if (state.busy) return setFormMsg('上一步操作还在进行，请稍候', 'err')
    if (state.dataSource === 'demo') {
      return setFormMsg('演示队列：请从「患者登记/急救事件」发起会诊，或连接后端后在此提交。', 'err')
    }
    var pid = ($('hx-cw-f-patient') || {}).value || ''
    var dept = ($('hx-cw-f-dept') || {}).value || ''
    var noteVal = (($('hx-cw-f-note') || {}).value || '').trim()
    if (!pid) return setFormMsg('请选择患者', 'err')
    if (!dept) return setFormMsg('请选择目标科室', 'err')
    if (state.scopeTab === 'grassroots' && !noteVal) return setFormMsg('请填写备注（基层会诊必填）', 'err')

    var patient = state.patients.filter(function (p) {
      return p.patientId === pid
    })[0] || {}

    // 定时开始：选择器产出的本地时间转带时区 ISO 发给后端
    // （应用后端时区为 UTC，裸时间会被按 UTC 解释而偏差 8 小时）
    var scheduledAt = null
    if (state.schedule) {
      if (!(state.schedule instanceof Date) || isNaN(state.schedule.getTime())) {
        return setFormMsg('定时开始时间无效', 'err')
      }
      if (state.schedule.getTime() <= Date.now()) {
        return setFormMsg('定时开始时间必须晚于当前时间', 'err')
      }
      scheduledAt = state.schedule.toISOString()
    }

    state.busy = true
    setFormMsg('提交中…')
    // 发起方/上转意图不再做成表单项：由 120 任务上下文与患者所属机构自动判定
    var originRole = 'county'
    if (state.dispatch && state.dispatch.task) originRole = 'prehospital'
    else if (isGrassrootsPatient(patient)) originRole = 'grassroots'
    var transferIntent = originRole === 'grassroots' ? 'consult_transfer' : 'consult_only'
    var noteExtra = '[发起方:' + originRole + '][意图:' + transferIntent + ']'
    call('POST', '/consultations', null, {
      patientId: pid,
      patientName: patient.name || '',
      gender: patient.gender || '',
      age: patient.age || 0,
      chiefComplaint: ($('hx-cw-f-complaint') || {}).value || '',
      sourceHospital: patient.institutionName || '',
      sourceDepartment: patient.departmentName || '',
      targetHospital: '',
      targetDepartment: dept,
      nominatedDoctorId: ($('hx-cw-f-doctor') || {}).value || null,
      note: noteVal + (noteExtra ? ' ' + noteExtra : ''),
      originRole: originRole,
      transferIntent: transferIntent,
      scheduledAt: scheduledAt,
    }).then(function (data) {
      setFormMsg('')
      $('hx-cw-form-wrap').hidden = true
      setHeadBtn(false)
      state.schedule = null
      updateDtInput()
      dpClose()
      var code = (data && data.consultCode) || ''
      if (data && data.scheduledAt && !data.startable) {
        setMsg('会诊已定时：' + code + '，' + fmtLocal(data.scheduledAt) + ' 开始，到点后可在队列点击进入会诊室', 'ok')
      } else {
        setMsg('会诊已发起' + (code ? '：' + code : '') +
          (data && data.rtcReady ? '，已接入远程会诊系统' : '，音视频服务未就绪，已生成会诊单'), data && data.rtcReady ? 'ok' : '')
      }
      return loadAll()
    }).catch(function (e) {
      setFormMsg((e && e.message) || '发起失败', 'err')
    }).then(function () {
      state.busy = false
    })
  }

  function findQueueItem(sessionId) {
    return state.queue.filter(function (x) {
      return x.sessionId === sessionId
    })[0]
  }

  function openAcceptModal(sessionId) {
    if (state.dataSource === 'demo') {
      setMsg('演示队列：请点「进入会诊室」或「患者档案」；接后端后「接诊」将写入真实会诊单。', 'info')
      return
    }
    var it = findQueueItem(sessionId)
    if (!it) return setMsg('未找到该会诊单', 'err')
    state.pendingAccept = sessionId
    var p = it.patient || {}
    var nom = it.nominatedDoctorName || it.nominatedDoctorId || '—'
    var intent = intentTag(it)
    var body = $('hx-cw-accept-body')
    var modal = $('hx-cw-accept-modal')
    if (body) {
      body.innerHTML =
        '<p>确认后由<strong>当前登录账号</strong>认领该会诊，状态变为「会诊中」。</p>' +
        '<dl>' +
        '<dt>患者</dt><dd>' + esc(p.name || '—') + '</dd>' +
        '<dt>主诉</dt><dd>' + esc(it.chiefComplaint || p.chiefComplaint || '—') + '</dd>' +
        '<dt>来源</dt><dd>' + esc(it.sourceHospital || '—') + '</dd>' +
        '<dt>目标</dt><dd>' + esc(it.targetHospital || '—') + '</dd>' +
        '<dt>上转意图</dt><dd>' + intent + '</dd>' +
        '<dt>指定医生</dt><dd>' + esc(nom === '—' ? '未指定，任意值班医生可接' : nom) + '</dd>' +
        '</dl>'
    }
    if (modal) modal.hidden = false
  }

  function closeAcceptModal() {
    state.pendingAccept = null
    var modal = $('hx-cw-accept-modal')
    if (modal) modal.hidden = true
  }

  function confirmAccept() {
    var sessionId = state.pendingAccept
    if (!sessionId || state.busy) return
    state.busy = true
    closeAcceptModal()
    setMsg('接诊中…')
    call('POST', '/consultations/' + encodeURIComponent(sessionId) + '/accept', null, {})
      .then(function (data) {
        setMsg('已接诊：' + ((data && data.acceptedByName) || ''), 'ok')
        return loadAll()
      })
      .catch(function (e) {
        setMsg((e && e.message) || '接诊失败', 'err')
      })
      .then(function () {
        state.busy = false
      })
  }

  function accept(sessionId) {
    openAcceptModal(sessionId)
  }

  function enterRoom(sessionId) {
    if (state.busy) return setMsg('上一步操作还在进行，请稍候', 'err')
    state.busy = true
    setMsg('正在获取入会链接…')
    call('GET', '/consultations/' + encodeURIComponent(sessionId) + '/join-link', { _t: Date.now() })
      .then(function (link) {
        var url = link && link.joinUrl
        if (!url) throw new Error('未获取到入会链接')
        setMsg('')
        window.open(url, '_blank', 'noopener')
      })
      .catch(function () {
        // 外接 RTC 未就绪或接口失败：回退本系统会诊室占位页（演示队列也落到这里）
        var it = state.queue.filter(function (x) { return x.sessionId === sessionId })[0]
        var tok = consultToken(it) || sessionId
        location.hash = '#/room/' + encodeURIComponent(tok)
        setMsg('外接会诊系统暂不可用，已打开本系统会诊室。', 'info')
      })
      .then(function () {
        state.busy = false
      })
  }

  // ---------- 宿主节点 ----------

  function bind(root) {
    if (root.dataset.hxCwBound === '1') return
    root.dataset.hxCwBound = '1'
    root.addEventListener('click', function (ev) {
      if (ev.target && ev.target.id === 'hx-cw-f-schedule') {
        dpOpen()
        return
      }
      var btn = ev.target.closest('[data-act]')
      if (!btn || !root.contains(btn)) return
      var act = btn.getAttribute('data-act')
      var id = btn.getAttribute('data-id')
      if (act === 'refresh') {
        setMsg('')
        loadAll()
      } else if (act === 'toggle-form') toggleForm()
      else if (act === 'submit') submitForm()
      else if (act === 'accept') accept(id)
      else if (act === 'join') enterRoom(id)
      else if (act === 'accept-confirm') confirmAccept()
      else if (act === 'accept-cancel') closeAcceptModal()
      else if (act === 'filter-status') {
        var st = btn.getAttribute('data-status')
        if (st && st !== state.statusFilter) {
          state.statusFilter = st
          state.page = 1 // 换筛选维度后回到第一页
          paint()
        }
      } else if (act === 'goto-page') {
        var target = parseInt(btn.getAttribute('data-page'), 10)
        // 越界页码由 queuePage 收敛，这里只拦非数字
        if (!isNaN(target) && target !== state.page) {
          state.page = target
          paint()
          scrollQueueTop()
        }
      } else if (act === 'dt-clear') {
        state.schedule = null
        updateDtInput()
        dpClose()
      }
    })
    root.addEventListener('change', function (ev) {
      if (ev.target && ev.target.id === 'hx-cw-pagesize') {
        var size = parseInt(ev.target.value, 10)
        if (size > 0 && size !== state.pageSize) {
          state.pageSize = size
          state.page = 1 // 每页条数变化后原页码无意义
          paint()
        }
        return
      }
      if (ev.target && ev.target.id === 'hx-cw-f-patient') {
        var p = state.patients.filter(function (x) {
          return x.patientId === ev.target.value
        })[0]
        var box = $('hx-cw-f-complaint')
        if (p && box && !box.value) box.value = p.chiefComplaint || ''
      }
    })
  }

  /**
   * 让宿主节点贴在 .workspace 的位置上（固定定位，随窗口与布局变化重算）。
   * 高度钳制到视口内：超出部分靠宿主内部滚动（滚动条已隐藏），页面级不再出现滚动条。
   */
  function place(host) {
    var ws = document.querySelector('.workspace')
    if (!ws) {
      host.style.display = 'none'
      return
    }
    var r = ws.getBoundingClientRect()
    if (r.width < 40 || r.height < 40) {
      host.style.display = 'none'
      return
    }
    var top = Math.max(0, Math.round(r.top))
    var avail = window.innerHeight - top - 8
    host.style.display = 'block'
    host.style.top = top + 'px'
    host.style.left = Math.round(r.left) + 'px'
    host.style.width = Math.round(r.width) + 'px'
    host.style.height = Math.max(160, Math.min(Math.round(r.height), avail)) + 'px'
  }

  function unmount() {
    document.body.classList.remove(BODY_FLAG)
    var el = $(HOST_ID)
    if (el) el.remove()
    dpClose()
    state.ready = false
  }

  function tick() {
    if (path().indexOf('/consultations/pick') === 0) {
      if ($(HOST_ID) || document.body.classList.contains(BODY_FLAG)) unmount()
      return
    }
    if (migrateSubpathsToSinglePage()) return
    if (path() !== ROUTE) {
      if ($(HOST_ID) || document.body.classList.contains(BODY_FLAG)) unmount()
      return
    }
    if (!shouldUseConsultWorkbench()) {
      if ($(HOST_ID) || document.body.classList.contains(BODY_FLAG)) unmount()
      return
    }
    ensureStyle()
    if (!document.body.classList.contains(BODY_FLAG)) document.body.classList.add(BODY_FLAG)
    migrateLegacyGrassrootsUrl()
    // 切换「远程会诊 / 基层会诊」视图后行集变了，回到第一页（状态筛选保留）
    var nextScope = consultScopeTab()
    if (nextScope !== state.scopeTab) state.page = 1
    state.scopeTab = nextScope
    syncDispatchFromQuery()

    var host = $(HOST_ID)
    if (!host) {
      host = document.createElement('section')
      host.id = HOST_ID
      host.className = 'patient-detail'
      host.innerHTML = shellHtml()
      document.body.appendChild(host)
      bind(host)
      setMsg(state.msg, state.msgKind)
      paint()
    } else {
      if (!host.classList.contains('patient-detail')) host.classList.add('patient-detail')
      if (!host.querySelector('.' + HOST_ID + '-stack')) {
        host.innerHTML = shellHtml()
        delete host.dataset.hxCwBound
        bind(host)
        setMsg(state.msg, state.msgKind)
        paint()
      }
    }
    place(host)
    if (!state.ready && !state.loading) loadAll()
  }

  function onConsultHashChange() {
    migrateLegacyGrassrootsUrl()
    if (path() !== ROUTE || !shouldUseConsultWorkbench()) return
    var nextScope = consultScopeTab()
    if (nextScope !== state.scopeTab) state.page = 1
    state.scopeTab = nextScope
    syncDispatchFromQuery()
    tick()
  }

  window.addEventListener('hashchange', onConsultHashChange)
  window.hxEnhance(tick, { wait: 300, observeRoot: true, afterNav: 120 })
  window.addEventListener('resize', function () {
    if (shouldUseConsultWorkbench()) tick()
  })

  /**
   * 回到本系统页面时重新拉队列。
   *
   * 会诊室是用 window.open 在新标签页打开的（见 enterRoom），房主在那边的会诊室里点"结束"
   * 只会在会诊系统侧把房间置为 ENDED，本页不会自动重拉队列，于是主系统队列状态一直停在旧值。
   * 这里在页面重新获得焦点/重新可见时主动请求一次，触发后端探活对账把已结束的会诊单收口。
   */
  var AUTO_REFRESH_MIN_GAP = 5000 // ms：focus 与 visibilitychange 会连着触发，短时间内只刷一次
  var lastAutoRefreshAt = 0

  function refreshQueue() {
    if (path() !== ROUTE || !shouldUseConsultWorkbench()) return
    if (state.loading || state.busy) return
    var now = Date.now()
    if (now - lastAutoRefreshAt < AUTO_REFRESH_MIN_GAP) return
    lastAutoRefreshAt = now
    loadAll()
  }

  window.addEventListener('focus', refreshQueue)
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refreshQueue()
  })
  // 兜底轮询：会诊室在别的设备/浏览器结束、本页始终没切走时，也能在 30 秒内看到状态更新
  setInterval(function () {
    if (document.hidden) return
    refreshQueue()
  }, 30000)

  // 定时会诊到点自动翻转：本地时钟越过开始时间后，把"定时未开始"行刷成可进入
  // （只更新本地状态并重绘，不重新请求；改完 startable 计数归零即停）
  setInterval(function () {
    if (!state.ready || !state.queue.length) return
    var flipped = false
    state.queue.forEach(function (it) {
      if (it.scheduledAt && !it.startable && startableNow(it)) {
        it.startable = true
        flipped = true
      }
    })
    if (flipped) paint()
  }, 15000)
})()
