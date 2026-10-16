/**
 * 患者详情页 tab 增强
 * - 概要：隐藏「危急值」「病程记录」区块（内容已迁移到对应 tab）
 * - 危急值记录：渲染 API criticalValues + controlRecords
 * - 病程记录：渲染 API courseRecords + notes
 * - 用药/检验/护理/管控/辅助分析：渲染 API 对应数据
 */
(function () {
  'use strict';

  const API_BASE = (window.__HX_API_BASE__ || '').replace(/\/$/, '') || 'http://62.234.128.72:7824/api/v1';

  let cachedPatient = null;
  let cachedPatientId = '';

  function getToken() {
    return sessionStorage.getItem('hx_token') || localStorage.getItem('hx_token') || '';
  }

  function getPatientIdFromHash() {
    const m = location.hash.match(/#\/patient\/([^/?]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  async function fetchPatient(id) {
    if (cachedPatientId === id && cachedPatient) return cachedPatient;
    const res = await fetch(`${API_BASE}/patients/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    cachedPatient = json.data || json;
    cachedPatientId = id;
    return cachedPatient;
  }

  function findRecordContent() {
    return document.querySelector('.record-content');
  }

  function findClinicalThree() {
    return document.querySelector('.clinical-three');
  }

  function hideOverviewSections() {
    const el = findClinicalThree();
    if (!el) return;
    const sections = el.querySelectorAll(':scope > section');
    sections.forEach((sec, i) => {
      // 前两个是 危急值 / 病程记录，第三个是 流转记录
      if (i < 2) sec.style.display = 'none';
    });
  }

  function getActiveTab() {
    const active = document.querySelector('.record-tabs button.active');
    return active ? active.textContent.trim().replace(/\d+$/, '') : '';
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('zh-CN', { hour12: false });
    } catch {
      return iso;
    }
  }

  function statusLabel(s) {
    return { new: '待确认', acknowledged: '已确认', treating: '处置中', resolved: '已结案', pending: '待通知', notified: '已通知' }[s] || s || '—';
  }

  function renderCriticalTab(patient) {
    const cv = patient.criticalValues || [];
    const cr = patient.controlRecords || [];
    if (!cv.length && !cr.length) return '<p class="api-muted">暂无危急值记录</p>';

    let html = '';
    if (cv.length) {
      html += '<h3 style="margin-bottom:12px">检验危急值</h3>';
      html += cv.map((v) => `
        <article style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
          <h4 style="margin:0 0 8px">${esc(v.itemName)} <span style="color:#dc2626;font-size:12px">${esc(v.levelLabel || v.level)}</span></h4>
          <p style="margin:4px 0">结果：${esc(v.resultValue)} ${esc(v.unit)}（参考 ${esc(v.refRange)}）</p>
          <p style="margin:4px 0">标本：${esc(v.specimen)} · 状态：${esc(v.statusLabel || statusLabel(v.status))}</p>
          <p style="margin:4px 0;color:#64748b;font-size:13px">${fmtTime(v.reportedAt)}</p>
        </article>`).join('');
    }
    if (cr.length) {
      html += '<h3 style="margin:16px 0 12px">预警管控</h3>';
      html += cr.map((w) => `
        <article style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
          <h4 style="margin:0 0 8px">${esc(w.title)} <span style="color:#d97706;font-size:12px">${esc(w.levelLabel || w.level)}</span></h4>
          <p style="margin:4px 0">指标：${esc(w.metric)} = ${esc(w.currentValue)} · 状态：${esc(w.statusLabel || statusLabel(w.status))}</p>
          <p style="margin:4px 0;color:#64748b;font-size:13px">${fmtTime(w.occurredAt)}</p>
          ${(w.records || []).map((r) => `<p style="margin:4px 0 0 12px;font-size:13px;color:#475569">├ ${esc(r.stage)}：${esc(r.note)} <span style="color:#94a3b8">${fmtTime(r.actedAt)}</span></p>`).join('')}
        </article>`).join('');
    }
    return html;
  }

  function renderCourseTab(patient) {
    const list = patient.courseRecords || [];
    const notes = patient.notes || '';
    if (!list.length && !notes) return '<p class="api-muted">暂无病程记录</p>';

    let html = '';
    if (notes) {
      html += `<article style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
        <h4 style="margin:0 0 8px">病情摘要</h4>
        <p style="margin:0">${esc(notes)}</p>
      </article>`;
    }
    if (list.length) {
      html += list.map((c) => `
        <article style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
          <h4 style="margin:0 0 8px">${esc(c.title || '病程记录')}</h4>
          <p style="margin:4px 0">${esc(c.text || c.content || '')}</p>
          <p style="margin:4px 0;color:#64748b;font-size:13px">${fmtTime(c.at || c.createdAt)}</p>
        </article>`).join('');
    }
    return html;
  }

  function renderNursingTab(patient) {
    const list = patient.nursingRecords || [];
    if (!list.length) return '<p class="api-muted">暂无护理记录</p>';
    return list.map((n) => `
      <article style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
        <h4 style="margin:0 0 8px">${esc(n.title || n.kind)}</h4>
        <p style="margin:4px 0">${esc(n.text || '')}</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px">${fmtTime(n.at)}</p>
      </article>`).join('');
  }

  function renderMedicationTab(patient) {
    const list = patient.medicationRecords || [];
    if (!list.length) return '<p class="api-muted">暂无用药记录</p>';
    return list.map((m) => `
      <article style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
        <h4 style="margin:0 0 8px">${esc(m.title || m.name || '用药记录')}</h4>
        <p style="margin:4px 0">${esc(m.text || m.note || '')}</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px">${fmtTime(m.at)}</p>
      </article>`).join('');
  }

  function renderLabTab(patient) {
    const list = patient.labRecords || [];
    if (!list.length) return '<p class="api-muted">暂无检验记录</p>';
    return list.map((l) => `
      <article style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
        <h4 style="margin:0 0 8px">${esc(l.title || l.itemName || '检验记录')}</h4>
        <p style="margin:4px 0">${esc(l.text || l.result || '')}</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px">${fmtTime(l.at)}</p>
      </article>`).join('');
  }

  function renderControlTab(patient) {
    const list = patient.controlRecords || [];
    if (!list.length) return '<p class="api-muted">暂无管控记录</p>';
    return list.map((w) => `
      <article style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
        <h4 style="margin:0 0 8px">${esc(w.title)} <span style="color:#d97706;font-size:12px">${esc(w.levelLabel || w.level)}</span></h4>
        <p style="margin:4px 0">指标：${esc(w.metric)} = ${esc(w.currentValue)} · 状态：${esc(w.statusLabel || statusLabel(w.status))}</p>
        <p style="margin:4px 0;color:#64748b;font-size:13px">${fmtTime(w.occurredAt)}</p>
        ${(w.records || []).map((r) => `<p style="margin:4px 0 0 12px;font-size:13px;color:#475569">├ ${esc(r.stage)}：${esc(r.note)} <span style="color:#94a3b8">${fmtTime(r.actedAt)}</span></p>`).join('')}
      </article>`).join('');
  }

  function renderAuxiliaryTab(patient) {
    const aux = patient.auxiliaryAnalysis || {};
    const trend = aux.vitalTrend || [];
    const preds = aux.predictions || [];
    if (!trend.length && !preds.length) return '<p class="api-muted">AI 分析服务未接入，无自动诊断或预测结论</p>';

    let html = '';
    if (trend.length) {
      html += '<h3 style="margin-bottom:12px">体征趋势</h3>';
      html += '<div class="business-table"><table><thead><tr><th>时间</th><th>心率</th><th>血氧</th><th>呼吸</th><th>体温</th><th>血压</th><th>NEWS</th></tr></thead><tbody>';
      trend.forEach((t) => {
        html += `<tr><td>${fmtTime(t.at)}</td><td>${esc(t.heartRate)}</td><td>${esc(t.spo2)}%</td><td>${esc(t.resp)}</td><td>${esc(t.temp)}℃</td><td>${t.systolic ? `${esc(t.systolic)}/${esc(t.diastolic)}` : '—'}</td><td>${esc(t.news)}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    if (preds.length) {
      html += '<h3 style="margin:16px 0 12px">趋势预测</h3>';
      html += preds.map((p) => `
        <article style="margin-bottom:12px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
          <p style="margin:4px 0"><b>${esc(p.metric)}</b> 当前 ${esc(p.currentValue)} → 预测 ${esc(p.predictedValue)}（${esc(p.withinMinutes)}分钟内）</p>
          <p style="margin:4px 0;color:#64748b;font-size:13px">${esc(p.note || '')}</p>
        </article>`).join('');
    }
    return html;
  }

  function enhanceTabContent(patient) {
    const tab = getActiveTab();
    const content = findRecordContent();
    if (!content) return;

    let html = '';
    switch (tab) {
      case '危急值记录':
        html = renderCriticalTab(patient);
        break;
      case '病程记录':
        html = renderCourseTab(patient);
        break;
      case '护理记录':
        html = renderNursingTab(patient);
        break;
      case '用药记录':
        html = renderMedicationTab(patient);
        break;
      case '检验记录':
        html = renderLabTab(patient);
        break;
      case '管控记录':
        html = renderControlTab(patient);
        break;
      case '辅助分析':
        html = renderAuxiliaryTab(patient);
        break;
      default:
        return; // 概览不处理
    }
    if (html) content.innerHTML = html;
  }

  async function enhance() {
    const pid = getPatientIdFromHash();
    if (!pid) return;

    try {
      const patient = await fetchPatient(pid);
      hideOverviewSections();
      enhanceTabContent(patient);
    } catch (e) {
      console.warn('[patient-detail-tabs-enhance]', e);
    }
  }

  // 监听 tab 点击
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.record-tabs button');
    if (!btn) return;
    setTimeout(enhance, 50);
  });

  // 监听 hash 变化
  window.addEventListener('hashchange', () => {
    cachedPatientId = '';
    setTimeout(enhance, 100);
  });

  // 监听 DOM 变化（React 重渲染后重新增强）
  let enhancing = false;
  const observer = new MutationObserver(() => {
    if (enhancing) return;
    const pid = getPatientIdFromHash();
    if (!pid) return;
    enhancing = true;
    setTimeout(() => {
      enhance().finally(() => { enhancing = false; });
    }, 80);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // 初始执行 + 轮询兜底
  setTimeout(enhance, 300);
  setTimeout(enhance, 1000);
  setTimeout(enhance, 2500);
})();
