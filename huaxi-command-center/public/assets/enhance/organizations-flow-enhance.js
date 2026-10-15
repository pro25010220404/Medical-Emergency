/**
 * 协作机构 #/organizations：地市 → 区县 → 乡镇 → 机构层级 → 详情
 */
;(function () {
  var ROUTE = '/organizations'
  var HOST_ID = 'hx-org-flow'
  var DETAIL_ID = 'hx-org-detail-custom'
  var BODY = 'hx-org-flow-active'
  var PICK = 'hx-org-flow-pick'
  var CUSTOM = 'hx-org-custom-detail'

  var catalog = null
  var cache = { value: null, promise: null }
  var searchTimer = null

  var REACT_ORGS = {
    chuanshi: 1,
    lianjie: 1,
    weiyuan: 1,
    'neijiang-first': 1,
    huaxi: 1,
  }

  function path() {
    return (location.hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/'
  }

  function query() {
    var raw = location.hash
    var i = raw.indexOf('?')
    return new URLSearchParams(i >= 0 ? raw.slice(i + 1) : '')
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function loadCatalog() {
    if (cache.value) return Promise.resolve(cache.value)
    if (cache.promise) return cache.promise
    cache.promise = fetch('/api/org-directory.json', { cache: 'no-store' })
      .then(function (r) {
        return r.ok ? r.json() : null
      })
      .then(function (d) {
        cache.value = d
        catalog = d
        return d
      })
      .catch(function () {
        return null
      })
    return cache.promise
  }

  function migrateHash() {
    if (path() !== ROUTE) return false
    var q = query()
    var tier = q.get('tier') || ''
    var changed = false
    if (tier === 'grassroots' || tier === 'center' || tier === 'huaxi' || tier === 'metro') {
      q.delete('tier')
      if (tier === 'grassroots') q.set('tier', 'township')
      else if (tier === 'metro') {
        var metroCounty = q.get('county') || ''
        q.set('tier', metroCounty === 'chengdu' || metroCounty === 'chengdu-wuhou' ? 'province' : 'city')
      } else {
        q.set('tier', 'province')
        if (!q.get('org')) q.set('org', 'huaxi')
        if (!q.get('county')) q.set('county', 'chengdu-wuhou')
      }
      changed = true
    }
    if (!q.get('county') && catalog && catalog.defaults && catalog.defaults.county) {
      q.set('county', catalog.defaults.county)
      changed = true
    }
    if (changed) {
      location.replace(location.pathname + location.search + '#/organizations?' + q.toString())
      return true
    }
    return false
  }

  function applyDefaults() {
    if (path() !== ROUTE || !catalog) return false
    var q = query()
    if (q.get('tier') || q.get('org') || q.get('county')) return false
    var d = catalog.defaults || {}
    if (d.county) q.set('county', d.county)
    if (d.tier) q.set('tier', d.tier)
    if (d.org) q.set('org', d.org)
    location.replace(location.pathname + location.search + '#/organizations?' + q.toString())
    return true
  }

  function findOrg(orgId) {
    return (catalog.organizations || []).filter(function (o) {
      return o.id === orgId
    })[0]
  }

  function tierMeta(tierId) {
    return (catalog.tiers || []).filter(function (t) {
      return t.id === tierId
    })[0]
  }

  function countyMeta(countyId) {
    return (catalog.counties || []).filter(function (c) {
      return c.id === countyId
    })[0]
  }

  function townMeta(townId) {
    return (catalog.towns || []).filter(function (t) {
      return t.id === townId
    })[0]
  }

  function townsInCounty(countyId) {
    return (catalog.towns || []).filter(function (t) {
      return t.countyId === countyId
    })
  }

  function cities() {
    var seen = []
    ;(catalog.counties || []).forEach(function (c) {
      if (c.city && seen.indexOf(c.city) < 0) seen.push(c.city)
    })
    return seen
  }

  function countiesInCity(city) {
    return (catalog.counties || []).filter(function (c) {
      return c.city === city
    })
  }

  function filterOrgs(state) {
    var tierId = state.tier
    var countyId = state.county
    var townId = state.town
    var search = (state.q || '').trim().toLowerCase()
    return (catalog.organizations || []).filter(function (o) {
      if (o.tier !== tierId) return false
      if (countyId && o.countyId !== countyId) return false
      if (townId && o.townId !== townId) return false
      if (search) {
        var blob = (o.name + ' ' + (o.region || '') + ' ' + (o.collab || '')).toLowerCase()
        if (blob.indexOf(search) < 0) return false
      }
      return true
    })
  }

  function tierCount(tierId, countyId, townId) {
    return filterOrgs({ tier: tierId, county: countyId, town: townId, q: '' }).length
  }

  function readState() {
    var q = query()
    var countyId = q.get('county') || (catalog.defaults && catalog.defaults.county) || 'weiyuan'
    var tierId = q.get('tier') || (catalog.defaults && catalog.defaults.tier) || 'county'
    if (tierId === 'metro') {
      tierId = countyId === 'chengdu' || countyId === 'chengdu-wuhou' ? 'province' : 'city'
    }
    if (!tierMeta(tierId)) tierId = 'county'
    if (!countyMeta(countyId)) countyId = 'weiyuan'
    var townId = q.get('town') || ''
    var orgId = q.get('org') || ''
    var search = q.get('q') || ''
    var picked = orgId ? findOrg(orgId) : null
    if (picked) {
      countyId = picked.countyId || countyId
      tierId = picked.tier || tierId
    }
    var county = countyMeta(countyId)
    if (county && county.tierScope && county.tierScope.indexOf(tierId) < 0) {
      var altCounty = (catalog.counties || []).filter(function (c) {
        return c.tierScope && c.tierScope.indexOf(tierId) >= 0
      })[0]
      if (altCounty) countyId = altCounty.id
      else tierId = county.tierScope[0] || tierId
      county = countyMeta(countyId)
    }
    if (townId && !townMeta(townId)) townId = ''
    if (townId) {
      var townRec = townMeta(townId)
      if (townRec && townRec.countyId !== countyId) townId = ''
    }
    if (orgId && !picked) orgId = ''
    return { county: countyId, tier: tierId, town: townId, org: orgId, q: search }
  }

  function setHash(patch, replace) {
    var q = query()
    ;['county', 'town', 'tier', 'org', 'q'].forEach(function (k) {
      if (!(k in patch)) return
      if (patch[k]) q.set(k, patch[k])
      else q.delete(k)
    })
    q.delete('scope')
    var target = '#/organizations?' + q.toString()
    if (location.hash === target) return
    if (replace) location.replace(location.pathname + location.search + target)
    else location.hash = target
  }

  function syncReactSelection(org) {
    if (!org || !org.reactMatch || !REACT_ORGS[org.id]) return
    var buttons = document.querySelectorAll('.institution-chain > button')
    if (!buttons.length) return
    var btn = null
    buttons.forEach(function (b) {
      var strongEl = b.querySelector('strong')
      var strong = ((strongEl && strongEl.textContent) || '').trim()
      if (org.reactMatch && strong.indexOf(org.reactMatch) >= 0) btn = b
    })
    if (btn && !btn.classList.contains('selected')) btn.click()
  }

  function inferDeptDetail(d, org) {
    var name = d.name || ''
    var out = {
      intro: d.intro || '',
      hours: d.hours || '周一至周日 8:00–17:30',
      phone: d.phone || '见机构总机或公开名单',
      head: d.head || '负责人见公开名单',
      location: d.location || org.region || '',
      services: d.services ? d.services.slice() : [],
      equipment: d.equipment ? d.equipment.slice() : [],
    }
    if (!out.intro && /全科|门诊|急诊/.test(name)) {
      out.intro = '基层常见病、多发病诊疗与慢病管理；必要时发起远程会诊或上转。'
      if (!out.services.length) {
        out.services = ['门诊诊查', '慢病随访', '检验外送（医共体）', '远程会诊', '转诊协同']
      }
    }
    if (!out.intro && /公共卫生|公卫|签约/.test(name)) {
      out.intro = '国家基本公共卫生服务与家庭医生签约。'
      if (!out.services.length) {
        out.services = ['家庭医生签约', '重点人群随访', '健康档案', '传染病报卡']
      }
    }
    if (!out.intro && /重症|ICU/.test(name)) {
      out.intro = '危重症收治与多学科协作；接受县域上转。'
      if (!out.services.length) out.services = ['24h 监护', '机械通气', '血液净化（预约）', '远程会诊']
    }
    if (!out.intro) out.intro = '公开服务范围以机构填报及现场公示为准。'
    if (!out.services.length) out.services = ['门诊', '住院（如有）', '会诊协作']
    return out
  }

  function departmentPanelHtml(d, org, idx) {
    var meta = inferDeptDetail(d, org)
    var svc = meta.services
      .map(function (s) {
        return '<li>' + esc(s) + '</li>'
      })
      .join('')
    var equip = meta.equipment.length
      ? '<div class="hx-org-dept-block"><h5>设备 / 能力</h5><p class="hx-org-dept-tags">' +
        meta.equipment
          .map(function (e) {
            return '<span>' + esc(e) + '</span>'
          })
          .join('') +
        '</p></div>'
      : ''
    return (
      '<details class="hx-org-dept-panel"' +
      (idx === 0 ? ' open' : '') +
      '>' +
      '<summary><span class="hx-org-dept-ico" aria-hidden="true"></span>' +
      '<div class="hx-org-dept-sum-text"><strong>' +
      esc(d.name) +
      '</strong><span class="hx-org-dept-tag">' +
      esc(d.note || '公开') +
      '</span></div>' +
      '<span class="hx-org-dept-hint">点击展开服务明细</span></summary>' +
      '<div class="hx-org-dept-body">' +
      '<p class="hx-org-dept-intro">' +
      esc(meta.intro) +
      '</p>' +
      '<dl class="hx-org-dept-facts">' +
      '<dt>服务时间</dt><dd>' +
      esc(meta.hours) +
      '</dd>' +
      '<dt>联系电话</dt><dd>' +
      esc(meta.phone) +
      '</dd>' +
      '<dt>负责人</dt><dd>' +
      esc(meta.head) +
      '</dd>' +
      '<dt>位置</dt><dd>' +
      esc(meta.location) +
      '</dd></dl>' +
      '<div class="hx-org-dept-block"><h5>服务项目</h5><ul>' +
      svc +
      '</ul></div>' +
      equip +
      '</div></details>'
    )
  }

  function departmentPanelsHtml(org) {
    if (!org || !org.departments || !org.departments.length) {
      return '<p class="hx-org-empty">暂无公开科室资料</p>'
    }
    return (
      '<div class="hx-org-dept-grid">' +
      org.departments
        .map(function (d, i) {
          return departmentPanelHtml(d, org, i)
        })
        .join('') +
      '</div>'
    )
  }

  var ORG_TABS = [
    ['departments', '公开科室'],
    ['experts', '公开医护资料'],
    ['team', '本科室人员'],
    ['sources', '资料来源'],
  ]

  function expertsPanelHtml(org) {
    var staff = org.staff || []
    if (!staff.length) {
      return '<p class="hx-org-empty">暂无可核实的公开医护名单（演示数据见 org-directory）</p>'
    }
    return (
      '<div class="hx-org-expert-grid">' +
      staff
        .map(function (s) {
          return (
            '<article class="hx-org-expert-card">' +
            '<h3>' +
            esc(s.name) +
            '</h3>' +
            '<p>' +
            esc(s.role || s.title || '公开资料') +
            '</p>' +
            '<span class="hx-org-expert-tag">公开专业资料 · 非实时值班</span></article>'
          )
        })
        .join('') +
      '</div>'
    )
  }

  function teamPanelHtml(org) {
    var staff = org.staff || []
    if (!staff.length) {
      return '<p class="hx-org-empty">当前机构无演示用内部人员；正式环境对接 /organizations/{id}/members</p>'
    }
    var rows = staff
      .map(function (s, i) {
        return (
          '<tr><td>' +
          esc(s.name) +
          '</td><td>' +
          esc((org.departments && org.departments[0] && org.departments[0].name) || '—') +
          '</td><td>' +
          (i === 0 ? '在管随访 12' : '—') +
          '</td><td>机构科室成员（演示）</td></tr>'
        )
      })
      .join('')
    return (
      '<div class="business-table table-scroll hx-org-team-table">' +
      '<table><thead><tr><th>人员</th><th>科室</th><th>负责患者</th><th>身份范围</th></tr></thead>' +
      '<tbody>' +
      rows +
      '</tbody></table></div>'
    )
  }

  function sourcesPanelHtml(org) {
    var sources = org.sources || []
    if (!sources.length) {
      return (
        '<p class="hx-org-empty">公开来源以机构填报为准。村室类机构可标注历史报道链接，不补造未核实资料。</p>'
      )
    }
    return (
      '<div class="hx-org-source-list">' +
      sources
        .map(function (src) {
          return (
            '<a class="hx-org-source-link" href="' +
            esc(src.url) +
            '" target="_blank" rel="noreferrer"><strong>' +
            esc(src.title) +
            '</strong><small>' +
            esc(src.url) +
            '</small></a>'
          )
        })
        .join('') +
      '</div>'
    )
  }

  function orgTabPanelHtml(org, tabId) {
    if (tabId === 'departments') {
      return (
        '<div class="department-directory hx-org-detail-depts hx-org-dept-grid-root">' +
        departmentPanelsHtml(org) +
        '</div>'
      )
    }
    if (tabId === 'experts') return expertsPanelHtml(org)
    if (tabId === 'team') return teamPanelHtml(org)
    return sourcesPanelHtml(org)
  }

  function bindDetailTabs(root) {
    if (!root || root.dataset.tabsBound === '1') return
    root.dataset.tabsBound = '1'
    root.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-org-tab]')
      if (!btn || !root.contains(btn)) return
      var tab = btn.getAttribute('data-org-tab')
      root.querySelectorAll('[data-org-tab]').forEach(function (b) {
        b.classList.toggle('active', b === btn)
      })
      root.querySelectorAll('[data-org-panel]').forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-org-panel') !== tab
      })
    })
  }

  function removeCustomDetail() {
    document.getElementById(DETAIL_ID)?.remove()
    document.body.classList.remove(CUSTOM)
  }

  function renderCustomDetail(org, activeTab) {
    removeCustomDetail()
    if (!org) return
    document.body.classList.add(CUSTOM)
    var tab = activeTab || 'departments'
    var tabBtns = ORG_TABS.map(function (pair) {
      return (
        '<button type="button" class="' +
        (pair[0] === tab ? 'active' : '') +
        '" data-org-tab="' +
        esc(pair[0]) +
        '">' +
        esc(pair[1]) +
        '</button>'
      )
    }).join('')
    var panels = ORG_TABS.map(function (pair) {
      return (
        '<div class="hx-org-detail-panel" data-org-panel="' +
        esc(pair[0]) +
        '"' +
        (pair[0] === tab ? '' : ' hidden') +
        '>' +
        orgTabPanelHtml(org, pair[0]) +
        '</div>'
      )
    }).join('')
    var html =
      '<div id="' +
      DETAIL_ID +
      '" class="hx-org-detail-custom" data-org-id="' +
      esc(org.id) +
      '">' +
      '<header class="organization-head hx-org-detail-custom-head">' +
      '<div><h2>' +
      esc(org.name) +
      '</h2><span>' +
      esc(org.region || '') +
      (org.beds ? ' · ' + esc(org.beds) : '') +
      '</span></div>' +
      '<span class="hx-org-detail-tag">' +
      esc(org.collab || '') +
      '</span></header>' +
      '<div class="tab-row hx-org-detail-tabs">' +
      tabBtns +
      '</div>' +
      '<div class="hx-org-detail-panels">' +
      panels +
      '</div></div>'
    var flow = document.getElementById(HOST_ID)
    if (flow) flow.insertAdjacentHTML('afterend', html)
    bindDetailTabs(document.getElementById(DETAIL_ID))
  }

  function updateSubtitle() {
    var span = document.querySelector('main.workspace .workspace-heading span')
    if (span) {
      span.textContent =
        '按县域 → 乡镇 → 村/镇/县/市分级筛选；目录数据为演示，可与后端 /organizations 对接'
    }
  }

  function groupedOrgCards(list, townId, orgId) {
    if (!list.length) return '<p class="hx-org-empty">当前筛选下暂无机构，请调整县域、乡镇或分级</p>'
    if (townId || list.length <= 6) {
      return (
        '<div class="hx-org-list-inner">' +
        list
          .map(function (o) {
            return orgCard(o, orgId)
          })
          .join('') +
        '</div>'
      )
    }
    var groups = {}
    list.forEach(function (o) {
      var key = o.townId || '_none'
      if (!groups[key]) groups[key] = []
      groups[key].push(o)
    })
    return Object.keys(groups)
      .map(function (key) {
        var town = key === '_none' ? null : townMeta(key)
        var title = town ? town.label : '其他'
        var cards = groups[key]
          .map(function (o) {
            return orgCard(o, orgId)
          })
          .join('')
        return '<div class="hx-org-group"><h4>' + esc(title) + ' <small>' + groups[key].length + ' 家</small></h4><div class="hx-org-list-inner">' + cards + '</div></div>'
      })
      .join('')
  }

  function orgCard(o, orgId) {
    return (
      '<button type="button" class="hx-org-card' +
      (o.id === orgId ? ' active' : '') +
      '" data-org="' +
      esc(o.id) +
      '">' +
      '<strong>' +
      esc(o.name) +
      '</strong>' +
      '<span>' +
      esc(o.region || '') +
      '</span>' +
      (o.beds ? '<span class="hx-org-beds">' + esc(o.beds) + '</span>' : '') +
      '<em>' +
      esc(o.collab || '') +
      '</em>' +
      '</button>'
    )
  }

  function shellHtml(state) {
    var tier = tierMeta(state.tier)
    var county = countyMeta(state.county)
    var org = state.org ? findOrg(state.org) : null
    var town = state.town ? townMeta(state.town) : null
    var list = filterOrgs(state)
    var tiers = catalog.tiers || []
    var cityName = (county && county.city) || ''
    var countyChoices = countiesInCity(cityName)
    var townChoices = townsInCounty(state.county)
    var showTown = !!state.town || townChoices.length > 0

    function menuHtml(items, current) {
      return items
        .map(function (item) {
          var on = String(item.value) === String(current)
          return (
            '<li><button type="button" class="hx-org-menu-item" role="option" data-value="' +
            esc(item.value) +
            '" aria-selected="' +
            (on ? 'true' : 'false') +
            '">' +
            esc(item.label) +
            '</button></li>'
          )
        })
        .join('')
    }

    function pickHtml(key, caption, valueText, items, current, disabled) {
      return (
        '<div class="hx-org-filter' +
        (disabled ? ' is-disabled' : '') +
        '"><span>' +
        esc(caption) +
        '</span><button type="button" class="hx-org-pick" data-filter="' +
        esc(key) +
        '"' +
        (disabled ? ' disabled' : '') +
        ' aria-haspopup="listbox" aria-expanded="false">' +
        esc(valueText) +
        '</button>' +
        (disabled
          ? ''
          : '<ul class="hx-org-menu" role="listbox" hidden>' + menuHtml(items, current) + '</ul>') +
        '</div>'
      )
    }

    var cityItems = cities().map(function (name) {
      return { value: name, label: name }
    })
    var countyItems = countyChoices.map(function (c) {
      return { value: c.id, label: c.label }
    })
    var townItems = [{ value: '', label: townChoices.length ? '全部乡镇' : '无下级乡镇' }].concat(
      townChoices.map(function (t) {
        return { value: t.id, label: t.label }
      })
    )
    var townLabel = state.town && town ? town.label : townItems[0].label

    var tierChoices = tiers.filter(function (t) {
      if (!county || !county.tierScope) return true
      return county.tierScope.indexOf(t.id) >= 0
    })

    var tierTabs = tierChoices
      .map(function (t) {
        var n = tierCount(t.id, state.county, state.town)
        return (
          '<button type="button" class="hx-org-tier' +
          (t.id === state.tier ? ' active' : '') +
          '" data-tier="' +
          esc(t.id) +
          '">' +
          esc(t.label) +
          '<span class="hx-org-tier-n">' +
          n +
          '</span></button>'
        )
      })
      .join('')

    var crumb =
      '<nav class="hx-org-crumb" aria-label="路径">' +
      '<span>协作机构</span>' +
      (cityName ? '<span>' + esc(cityName) + '</span>' : '') +
      (county ? '<span>' + esc(county.label) + '</span>' : '') +
      (town ? '<span>' + esc(town.label) + '</span>' : '') +
      (tier ? '<span>' + esc(tier.label) + '</span>' : '') +
      (org ? '<span class="on">' + esc(org.name) + '</span>' : '') +
      '</nav>'

    var stats =
      '<p class="hx-org-stats">当前筛选 <strong>' +
      list.length +
      '</strong> 家机构' +
      (state.q ? ' · 关键词「' + esc(state.q) + '」' : '') +
      '</p>'

    return (
      '<div id="' +
      HOST_ID +
      '" class="hx-org-flow">' +
      crumb +
      '<div class="hx-org-filters">' +
      '<div class="hx-org-cascade" role="group" aria-label="地区层级">' +
      pickHtml('city', '地市', cityName, cityItems, cityName, false) +
      '<span class="hx-org-cascade-sep" aria-hidden="true"></span>' +
      pickHtml('county', '区县', county ? county.label : '', countyItems, state.county, false) +
      '<span class="hx-org-cascade-sep" aria-hidden="true"></span>' +
      pickHtml('town', '乡镇', townLabel, townItems, state.town || '', !townChoices.length) +
      '</div>' +
      '<label class="hx-org-filter hx-org-filter--search"><span>搜索</span><input type="search" data-filter="q" placeholder="机构名称、地区" value="' +
      esc(state.q) +
      '"></label>' +
      '</div>' +
      '<div class="hx-org-tier-row">' +
      '<div class="hx-org-tier-tabs" role="tablist">' +
      tierTabs +
      '</div>' +
      stats +
      '</div>' +
      '<div class="hx-org-list-wrap">' +
      groupedOrgCards(list, state.town, state.org) +
      '</div>' +
      (org
        ? '<div class="hx-org-selected-bar">' +
          '<span>当前：<strong>' +
          esc(org.name) +
          '</strong></span>' +
          '<button type="button" class="hx-org-change" data-act="change-org">重新筛选</button>' +
          '</div>'
        : '') +
      '</div>'
    )
  }

  function closeMenus(root) {
    root.querySelectorAll('.hx-org-filter.is-open').forEach(function (filter) {
      filter.classList.remove('is-open')
      var pick = filter.querySelector('.hx-org-pick')
      var menu = filter.querySelector('.hx-org-menu')
      if (pick) pick.setAttribute('aria-expanded', 'false')
      if (menu) menu.hidden = true
    })
  }

  function applyFilter(key, value) {
    var host = document.getElementById(HOST_ID)
    if (host) closeMenus(host)
    var st = readState()
    if (key === 'city') {
      var inCity = countiesInCity(value)
      var nextCounty = inCity[0]
      if (!nextCounty) return
      var cityTier = st.tier
      if (nextCounty.tierScope && nextCounty.tierScope.indexOf(cityTier) < 0) {
        cityTier = nextCounty.tierScope[0] || cityTier
      }
      setHash({ county: nextCounty.id, tier: cityTier, town: '', org: '', q: '' })
    } else if (key === 'county') {
      var cm = countyMeta(value)
      var nt = st.tier
      if (cm && cm.tierScope && cm.tierScope.indexOf(nt) < 0) nt = cm.tierScope[0] || nt
      setHash({ county: value, tier: nt, town: '', org: '', q: '' }, false)
    } else if (key === 'town') {
      setHash({ county: st.county, town: value, tier: st.tier, org: '', q: st.q })
    } else if (key === 'tier') {
      var countyId = st.county
      var cmTier = countyMeta(countyId)
      if (cmTier && cmTier.tierScope && cmTier.tierScope.indexOf(value) < 0) {
        var altTierCounty = (catalog.counties || []).filter(function (x) {
          return x.tierScope && x.tierScope.indexOf(value) >= 0
        })[0]
        if (altTierCounty) countyId = altTierCounty.id
      }
      setHash({
        county: countyId,
        tier: value,
        org: '',
        town: countyId === st.county ? st.town : '',
        q: st.q,
      })
    }
  }

  var menuDocBound = false

  function bindFlow(root) {
    if (!menuDocBound) {
      menuDocBound = true
      document.addEventListener('click', function () {
        var host = document.getElementById(HOST_ID)
        if (host) closeMenus(host)
      })
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape') return
        var host = document.getElementById(HOST_ID)
        if (host) closeMenus(host)
      })
    }
    if (root.dataset.bound === '1') return
    root.dataset.bound = '1'
    root.addEventListener('click', function (ev) {
      var menuItem = ev.target.closest('.hx-org-menu-item')
      if (menuItem && root.contains(menuItem)) {
        ev.stopPropagation()
        var pickFrom = menuItem.closest('.hx-org-filter')
        var pickBtn = pickFrom && pickFrom.querySelector('.hx-org-pick')
        if (pickBtn) applyFilter(pickBtn.getAttribute('data-filter'), menuItem.getAttribute('data-value') || '')
        return
      }
      var pick = ev.target.closest('.hx-org-pick')
      if (pick && root.contains(pick)) {
        ev.stopPropagation()
        if (pick.disabled) return
        var filter = pick.closest('.hx-org-filter')
        var willOpen = filter && !filter.classList.contains('is-open')
        closeMenus(root)
        if (willOpen && filter) {
          filter.classList.add('is-open')
          pick.setAttribute('aria-expanded', 'true')
          var menu = filter.querySelector('.hx-org-menu')
          if (menu) menu.hidden = false
        }
        return
      }
      var tierBtn = ev.target.closest('[data-tier]')
      if (tierBtn && root.contains(tierBtn)) {
        var st = readState()
        var newTier = tierBtn.getAttribute('data-tier')
        var county = st.county
        var c = countyMeta(county)
        if (c && c.tierScope && c.tierScope.indexOf(newTier) < 0) {
          var alt = (catalog.counties || []).filter(function (x) {
            return x.tierScope && x.tierScope.indexOf(newTier) >= 0
          })[0]
          if (alt) county = alt.id
        }
        setHash({
          county: county,
          tier: newTier,
          org: '',
          town: county === st.county ? st.town : '',
          q: st.q,
        })
        return
      }
      var orgBtn = ev.target.closest('[data-org]')
      if (orgBtn && root.contains(orgBtn)) {
        var st2 = readState()
        setHash({
          county: st2.county,
          town: st2.town,
          tier: st2.tier,
          org: orgBtn.getAttribute('data-org'),
          q: st2.q,
        })
        return
      }
      if (ev.target.closest('[data-act="change-org"]')) {
        var st3 = readState()
        setHash({ county: st3.county, town: st3.town, tier: st3.tier, org: '', q: st3.q })
      }
    })
    root.addEventListener('input', function (ev) {
      var inp = ev.target.closest('[data-filter="q"]')
      if (!inp || !root.contains(inp)) return
      clearTimeout(searchTimer)
      searchTimer = setTimeout(function () {
        var st = readState()
        setHash({ county: st.county, town: st.town, tier: st.tier, org: st.org, q: inp.value.trim() })
      }, 280)
    })
  }

  function mountFlow() {
    if (!catalog) return
    var state = readState()
    document.body.classList.add(BODY)
    document.body.classList.toggle(PICK, !state.org)
    document.body.classList.toggle('hx-org-detail-open', !!state.org)

    var main = document.querySelector('main.workspace')
    if (!main) return
    updateSubtitle()

    var html = shellHtml(state)
    var host = document.getElementById(HOST_ID)
    var heading = main.querySelector('.workspace-heading')
    if (!host) {
      if (heading) heading.insertAdjacentHTML('afterend', html)
      else main.insertAdjacentHTML('afterbegin', html)
      host = document.getElementById(HOST_ID)
      if (host) bindFlow(host)
    } else if (host.dataset.html !== html) {
      host.outerHTML = html
      host = document.getElementById(HOST_ID)
      if (host) bindFlow(host)
    }
    if (host) host.dataset.html = html

    if (state.org) {
      var org = findOrg(state.org)
      if (org) {
        if (REACT_ORGS[org.id]) syncReactSelection(org)
        var existing = document.getElementById(DETAIL_ID)
        if (!existing || existing.dataset.orgId !== org.id) {
          renderCustomDetail(org, 'departments')
        }
      } else {
        removeCustomDetail()
      }
    } else {
      removeCustomDetail()
    }
  }

  function unmount() {
    document.body.classList.remove(BODY, PICK, CUSTOM, 'hx-org-detail-open')
    document.getElementById(HOST_ID)?.remove()
    removeCustomDetail()
  }

  function tick() {
    if (path() !== ROUTE) {
      unmount()
      return
    }
    loadCatalog().then(function (d) {
      if (!d) return
      if (migrateHash()) return
      if (applyDefaults()) return
      mountFlow()
    })
  }

  window.addEventListener('hashchange', tick)
  window.hxEnhance(tick, { wait: 320, afterNav: 100 })
})()
