// ---------- 현장 제보: GPS 확인 → 카메라 촬영 → 상태·기간 선택 → 등록 ----------
const GPS_RADIUS = 150; // m. 이 안에 있어야 제보 가능
const SAVE_KEY = 'nowopen.reports';
const reportEl = document.getElementById('report');
let R = null; // 진행 중인 제보 상태

const LABEL = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label]));
const BEFORE_MINS = 30; // 영업 전 제보 표시 시간(분). 영업 종료·폐업·영업 중은 오늘 자정까지
// 제보 메모
const TODAY_NOTE = { open: '영업 중 확인', before: '아직 영업 전', closed: '일찍 영업 종료', holiday: '오늘 휴무', shut: '폐업 안내 확인' };

function distanceM(lat1, lng1, lat2, lng2) {
  const rad = x => x * Math.PI / 180, a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function pad(n) { return String(n).padStart(2, '0'); }
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.getElementById('app').appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ----- 허위 제보 페널티 (브라우저 localStorage, 데모용) -----
const PENALTY_KEY = 'nowopen.penalty';
const BAN_AT = 3; // 페널티가 이만큼 쌓이면 제보 이용 제한
const FALSE_WARNING = '⚠️ 허위 제보가 적발되면 제보가 바로 삭제되고 <b>페널티</b>가 부과돼요. ' + BAN_AT + '회 누적되면 제보를 할 수 없어요.';
function getPenalty() {
  try { return JSON.parse(localStorage.getItem(PENALTY_KEY)) || { count: 0, log: [] }; }
  catch { return { count: 0, log: [] }; }
}
function addPenalty(storeId, reason) {
  const p = getPenalty();
  p.count += 1; p.log.push({ at: Date.now(), storeId, reason });
  localStorage.setItem(PENALTY_KEY, JSON.stringify(p));
  if (typeof renderMe === 'function') renderMe();
  return p.count;
}
function showNotice(title, bodyHTML) {
  const o = document.createElement('div');
  o.className = 'modal';
  o.innerHTML = `<div class="modal-box"><h3>${title}</h3><p>${bodyHTML}</p><button class="btn">확인</button></div>`;
  o.querySelector('button').onclick = () => o.remove();
  document.getElementById('app').appendChild(o);
}
// 사진 속 글자가 선택한 상태와 정반대로 읽히면 허위 제보: 바로 삭제하고 페널티를 부과한다
function rejectFalseReport(a) {
  const claimed = LABEL[R.status], read = LABEL[a.status];
  const count = addPenalty(R.store.id, `${claimed} 제보 / 사진 속 글자는 ${read}`);
  closeReport();
  showNotice('허위 제보로 판단됐어요',
    `사진 속 글자는 <b>${read}</b> 안내인데 <b>${josa(claimed, '으로', '로')}</b> 제보하셨어요.<br>
     제보는 <b>바로 삭제</b>되었고 <b>페널티 ${count}회</b>가 부과되었어요.<br>
     <span class="sub">${count >= BAN_AT ? `누적 ${BAN_AT}회로 제보 이용이 제한돼요.` : `${BAN_AT}회 누적되면 제보 이용이 제한돼요.`}</span>`);
}

// ----- 열기/닫기 -----
function openReport(store) {
  if (getPenalty().count >= BAN_AT) {
    showNotice('제보 이용이 제한됐어요', `허위 제보 페널티가 ${BAN_AT}회 누적되어 제보할 수 없어요.`);
    return;
  }
  R = { store, step: 'gps', msg: '', photo: null, status: null, period: 'today', stream: null };
  try { ocrWarmup(); } catch {} // 촬영하기 전에 AI 모델을 미리 준비
  getFaceDetector().catch(() => {});
  reportEl.classList.remove('hidden');
  render();
}
function closeReport() {
  stopCamera();
  reportEl.classList.add('hidden');
  R = null;
}
function stopCamera() {
  if (R && R.stream) { R.stream.getTracks().forEach(t => t.stop()); R.stream = null; }
}
function go(step) { R.step = step; render(); }

// ----- 화면 -----
const STEPS = ['gps', 'camera', 'blur', 'status'];
function frame(title, body) {
  const idx = STEPS.indexOf(R.step);
  reportEl.innerHTML = `
    <header class="detail-head">
      <button id="r-close" aria-label="닫기">✕</button>
      <div><h2>${R.store.name}</h2><div class="sub">현장 제보 · ${idx + 1}/${STEPS.length} ${title}</div></div>
    </header>
    <div class="detail-body">${body}</div>`;
  document.getElementById('r-close').onclick = closeReport;
}

function render() {
  if (R.step === 'gps') return renderGps();
  if (R.step === 'camera') return renderCamera();
  if (R.step === 'blur') return renderBlur();
  if (R.step === 'status') return renderStatus();
}

// 1) 위치 확인
function renderGps() {
  frame('위치 확인', `
    <p class="r-msg" id="gps-msg">${R.msg || '내 위치를 확인하는 중이에요…'}</p>
    <div id="gps-actions"></div>
    <button class="btn ghost small" id="gps-skip">데모용: 위치 확인 건너뛰기</button>`);
  document.getElementById('gps-skip').onclick = () => go('camera');
  if (!R.msg) checkGps();
  else showGpsActions();
}
function showGpsActions() {
  document.getElementById('gps-actions').innerHTML = '<button class="btn" id="gps-retry">다시 확인</button>';
  document.getElementById('gps-retry').onclick = () => { R.msg = ''; render(); };
}
function checkGps() {
  const token = R;
  const fail = msg => { if (R !== token || R.step !== 'gps') return; R.msg = msg; render(); };
  if (userPos && userPos.demo) { // 지도의 '데모용 가상 위치'를 쓰는 중이면 그 위치로 거리 계산
    const d = distanceM(userPos.lat, userPos.lng, R.store.lat, R.store.lng);
    if (d <= GPS_RADIUS) return go('camera');
    return fail(`가게에서 약 ${Math.round(d)}m 떨어져 있어요. 가게 앞(${GPS_RADIUS}m 이내)에서 제보해 주세요.`);
  }
  if (!navigator.geolocation) return fail('이 브라우저는 위치 확인을 지원하지 않아요.');
  navigator.geolocation.getCurrentPosition(pos => {
    if (R !== token) return;
    const d = distanceM(pos.coords.latitude, pos.coords.longitude, R.store.lat, R.store.lng);
    if (d <= GPS_RADIUS) go('camera');
    else fail(`가게에서 약 ${Math.round(d)}m 떨어져 있어요. 가게 앞(${GPS_RADIUS}m 이내)에서 제보해 주세요.`);
  }, err => fail(err.code === 1 ? '위치 권한이 거부되어 있어요. 브라우저 설정에서 허용해 주세요.' : '위치를 가져오지 못했어요.'),
  { enableHighAccuracy: true, timeout: 10000 });
}

// 2) 카메라 촬영 (앨범 업로드 없이 실시간 촬영만)
function renderCamera() {
  frame('사진 촬영', `
    <p class="sub" style="margin-bottom:10px">가게 문이나 안내문이 보이도록 지금 바로 촬영해 주세요. (앨범 사진은 올릴 수 없어요)</p>
    <p class="warn">${FALSE_WARNING}</p>
    <div class="cam"><video id="cam" autoplay playsinline muted></video></div>
    <p class="r-msg" id="cam-msg"></p>
    <button class="btn" id="shoot" disabled>촬영하기</button>
    <p class="sub" style="margin:14px 0 6px">데모용 샘플 사진 (카메라가 없을 때)</p>
    <div class="samples">${SAMPLES.map((s, i) => `<button class="btn ghost small" data-sample="${i}">${s[0]}</button>`).join('')}</div>`);
  reportEl.querySelectorAll('[data-sample]').forEach(b => b.onclick = () => {
    stopCamera(); usePhoto(samplePhoto(SAMPLES[+b.dataset.sample][1]));
  });
  startCamera();
}

// 사진이 정해지면 AI가 글자를 읽기 시작한다
function usePhoto(photo) {
  R.original = photo; R.photo = null; R.status = null; R.ai = { state: 'reading' };
  R.regions = []; R.strokes = []; R.auto = { state: 'working' };
  R.aiSkip = false; R.aiFailed = false; R.stMsg = ''; R.period = 'today';
  const token = R;
  const ocrP = ocrRead(photo);
  const faceP = detectFaces(photo).catch(() => null); // null = 얼굴 인식을 쓸 수 없음
  ocrP.then(res => {
    if (R !== token) return;
    const text = res.text;
    const a = analyzeText(text);
    R.ai = { state: 'done', text, ...a };
    // 읽은 상태가 선택 가능하면 미리 골라 준다
    if (a.status && allowedReports(R.store.registered).includes(a.status)) {
      R.status = a.status;
      if (a.status === 'holiday') {
        const hm = h => `${pad(h)}:00`;
        const t0 = new Date();
        if (a.range) { R.period = 'range'; R.dFrom = a.range.from; R.dTo = a.range.to; }
        else if (a.days) { // 'N일간' -> 오늘부터 N일
          R.period = 'range'; R.dFrom = ymd(t0); R.dTo = ymd(new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + a.days - 1));
        }
        else if (a.time) { R.period = 'time'; R.timeFrom = hm(a.time[0]); R.timeTo = hm(a.time[1]); }
      }
    }
    if (R.step === 'status') render();
  }).catch(() => {
    if (R !== token) return;
    R.ai = { state: 'error' };
    if (R.step === 'status') render();
  });

  // 얼굴(AI)과 번호판(글자 인식 결과)을 자동으로 찾아 가릴 곳으로 등록
  Promise.allSettled([ocrP, faceP, loadImage(photo)]).then(([o, f, im]) => {
    if (R !== token) return;
    const W = im.value.naturalWidth, H = im.value.naturalHeight;
    const faces = f.value, plates = o.status === 'fulfilled' ? findPlates(o.value, W, H) : null;
    R.regions = [...(faces || []), ...(plates || [])];
    R.auto = { state: 'done', faces: faces ? faces.length : null, plates: plates ? plates.length : null };
    if (R.step === 'blur') renderBlur();
  });
  go('blur');
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function aiPanel() {
  const a = R.ai;
  if (!a || a.state === 'reading') return '<div class="ai reading">🤖 AI가 사진 속 글자를 읽는 중이에요… (처음에는 몇 초 걸려요)</div>';
  if (a.state === 'error') return '<div class="ai err">🤖 AI 글자 인식을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</div>';
  const txt = (a.text || '').replace(/\s+/g, ' ').trim();
  if (!txt) return '<div class="ai err">🤖 사진에서 글자를 찾지 못했어요.</div>';
  return `<div class="ai ok">🤖 AI가 읽은 글자: “${esc(txt.slice(0, 60))}”${a.status ? `<br><b>→ ${LABEL[a.status]} 안내로 보여요</b>` : ''}</div>`;
}
async function startCamera() {
  const token = R, msg = document.getElementById('cam-msg');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    if (R !== token || R.step !== 'camera') { stream.getTracks().forEach(t => t.stop()); return; }
    R.stream = stream;
    const video = document.getElementById('cam');
    video.srcObject = stream;
    const shoot = document.getElementById('shoot');
    shoot.disabled = false;
    shoot.onclick = () => { const p = snapshot(video); stopCamera(); usePhoto(p); };
  } catch (e) {
    if (R === token) msg.textContent = '카메라를 켤 수 없어요. 권한을 허용하거나 아래 데모 버튼을 써 주세요.';
  }
}
function snapshot(video) {
  const w = Math.min(720, video.videoWidth || 720), h = Math.round(w * (video.videoHeight || 540) / (video.videoWidth || 720));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(video, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.7);
}
const SAMPLES = [
  ['휴무', '오늘 휴무입니다'],
  ['3일 휴무', '3일간 휴무합니다'],
  ['11/7-11/9 휴무', '11/7-11/9 휴무합니다'],
  ['11월 10일~12일', '11월 10일부터 12일까지 휴무'],
  ['영업 종료', '영업 종료'],
  ['폐업', '폐업했습니다'],
  ['영업 전', '오픈 준비중'],
  ['번호판', '12가 3456'],
  ['글자 없음', ''],
];
function samplePhoto(text) { // 카메라가 없는 PC용 샘플 안내문 사진
  const c = document.createElement('canvas'); c.width = 640; c.height = 360;
  const g = c.getContext('2d');
  g.fillStyle = '#d6d3d1'; g.fillRect(0, 0, 640, 360);
  g.fillStyle = '#fff'; g.fillRect(40, 90, 560, 170);
  g.fillStyle = '#111'; g.font = 'bold 48px "Malgun Gothic", sans-serif'; g.textAlign = 'center';
  g.fillText(text, 320, 195);
  return c.toDataURL('image/jpeg', 0.8);
}

// 3) 상태·기간 선택
function renderStatus() {
  const s = R.store;
  const options = allowedReports(s.registered);
  const showPeriod = R.status === 'holiday'; // 휴무(잠깐 닫거나 쉬는 것)만 기간을 고른다
  const showShort = R.status === 'before'; // 영업 전은 30분간만 표시
  const now = new Date();
  const later = new Date(now.getTime() + 2 * 3600000);

  frame('상태 선택', `
    <img class="shot" src="${R.photo}" alt="촬영한 사진">
    ${aiPanel()}
    <h4>지금 실제 상태는요?</h4>
    <p class="sub" style="margin-bottom:10px">지도 등록은 <b>${STATUS[s.registered || 'unknown'].label}</b>이에요. 다른 상태만 고를 수 있어요.</p>
    <div class="chips">${options.map(k => { const isFull = fullStatuses(s).includes(k);
      return `<button class="chip s-${k}-bg ${R.status === k ? 'sel' : 'dim'} ${isFull ? 'full' : ''}" data-st="${k}" ${isFull ? 'disabled' : ''}>${LABEL[k]}${isFull ? ' · 마감' : ''}</button>`; }).join('')}</div>

    ${showShort ? `<p class="sub" style="margin-top:14px">영업 전 제보는 ${BEFORE_MINS}분간만 표시돼요. 곧 문을 열 수 있어서 짧게 보여 줘요.</p>` : ''}
    ${R.status && !showPeriod && !showShort ? '<p class="sub" style="margin-top:14px">이 제보는 오늘 자정까지 표시돼요.</p>' : ''}
    ${showPeriod ? `
      <h4>언제까지인가요?</h4>
      <label class="radio"><input type="radio" name="per" value="today" ${R.period === 'today' ? 'checked' : ''}> 오늘 하루 (자정까지)</label>
      <label class="radio"><input type="radio" name="per" value="time" ${R.period === 'time' ? 'checked' : ''}> 시간 지정 <span class="sub">(오늘 잠깐 닫아요)</span></label>
      ${R.period === 'time' ? `<div class="row"><input type="time" id="t-from" value="${R.timeFrom || `${pad(now.getHours())}:${pad(now.getMinutes())}`}"> ~ <input type="time" id="t-to" value="${R.timeTo || `${pad(later.getHours())}:${pad(later.getMinutes())}`}"></div>` : ''}
      <label class="radio"><input type="radio" name="per" value="range" ${R.period === 'range' ? 'checked' : ''}> 날짜 지정 <span class="sub">(여러 날 닫아요)</span></label>
      ${R.period === 'range' ? `<div class="row"><input type="date" id="d-from" value="${R.dFrom || ymd(now)}"> ~ <input type="date" id="d-to" value="${R.dTo || ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2))}"></div>` : ''}` : ''}

    <p class="warn">${FALSE_WARNING}</p>
    <p class="r-msg" id="st-msg">${R.stMsg || ''}</p>
    ${R.aiFailed ? '<button class="btn ghost small" id="ai-skip">데모용: AI 확인 건너뛰기</button>' : ''}
    <button class="btn" id="submit" ${R.status ? '' : 'disabled style="opacity:.5"'}>제보 등록</button>
    <button class="btn ghost small" id="retake">사진 다시 찍기</button>`);

  // 입력값은 다시 그려져도 사라지지 않게 바로 저장
  const keep = (id, key) => { const el = document.getElementById(id); if (el) el.oninput = () => { R[key] = el.value; }; };
  keep('t-from', 'timeFrom'); keep('t-to', 'timeTo'); keep('d-from', 'dFrom'); keep('d-to', 'dTo');
  const skip = document.getElementById('ai-skip');
  if (skip) skip.onclick = () => { R.aiSkip = true; R.aiFailed = false; R.stMsg = ''; render(); };
  reportEl.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { R.status = b.dataset.st; R.stMsg = ''; R.aiFailed = false; render(); });
  reportEl.querySelectorAll('input[name=per]').forEach(r => r.onchange = () => { R.period = r.value; render(); });
  document.getElementById('retake').onclick = () => go('camera');
  document.getElementById('submit').onclick = submitReport;
}

// ----- 등록 -----
function buildReport() {
  const label = LABEL[R.status], now = Date.now();
  if (R.status === 'before') {
    return { expiresAt: now + BEFORE_MINS * 60000, note: `${TODAY_NOTE.before} (${BEFORE_MINS}분간 표시)` };
  }
  if (R.status !== 'holiday' || R.period === 'today') {
    return { expiresAt: endOfToday(), note: TODAY_NOTE[R.status] };
  }
  if (R.period === 'time') {
    const [fh, fm] = document.getElementById('t-from').value.split(':').map(Number);
    const [th, tm] = document.getElementById('t-to').value.split(':').map(Number);
    const from = new Date(); from.setHours(fh, fm, 0, 0);
    const to = new Date(); to.setHours(th, tm, 0, 0);
    if (isNaN(from) || isNaN(to) || to <= from) return { error: '끝나는 시간이 시작 시간보다 늦어야 해요.' };
    if (to.getTime() <= now) return { error: '이미 지난 시간이에요.' };
    return { startsAt: from.getTime(), expiresAt: to.getTime(), note: `오늘 ${pad(fh)}:${pad(fm)}~${pad(th)}:${pad(tm)} ${label}` };
  }
  // 날짜 지정: 시작일 0시 ~ 종료일 24시. 시작일이 미래면 그날부터 표시된다
  const fromV = document.getElementById('d-from').value, toV = document.getElementById('d-to').value;
  if (!fromV || !toV) return { error: '시작일과 종료일을 입력해 주세요.' };
  const [fy, fm2, fd] = fromV.split('-').map(Number), [ty, tm2, td] = toV.split('-').map(Number);
  const from = new Date(fy, fm2 - 1, fd), to = new Date(ty, tm2 - 1, td + 1); // 종료일 끝(다음날 0시)
  const days = Math.round((to - from) / DAY);
  if (to <= from) return { error: '종료일이 시작일보다 같거나 늦어야 해요.' };
  if (to.getTime() <= now) return { error: '이미 지난 날짜예요.' };
  if (days > 30) return { error: '날짜는 최대 30일까지 지정할 수 있어요.' };
  const md = d => `${d.getMonth() + 1}/${d.getDate()}`;
  const last = new Date(ty, tm2 - 1, td);
  const note = days === 1 ? `${md(from)} 하루 ${label}` : `${md(from)}~${md(last)} ${label} (${days}일간)`;
  return { ...(from.getTime() > now ? { startsAt: from.getTime() } : {}), expiresAt: to.getTime(), note };
}
// 안내문 글자로 확인할 수 있는 상태들 ('영업 중'은 안내문이 없을 수 있어 AI 확인 없이 받는다)
const NEEDS_TEXT = ['before', 'holiday', 'closed', 'shut'];
function submitReport() {
  const msg = document.getElementById('st-msg');

  // 사진 속 글자가 선택과 다른 상태로 읽히면 허위 제보
  if (R.ai && R.ai.state === 'done' && R.ai.status && R.ai.status !== R.status) return rejectFalseReport(R.ai);

  // AI가 사진 속 글자로 선택한 상태를 확인해야 제보가 인정된다
  let aiState = 'n/a';
  if (NEEDS_TEXT.includes(R.status)) {
    const a = R.ai;
    if (R.aiSkip) aiState = 'skipped';
    else if (!a || a.state === 'reading') { msg.textContent = 'AI가 아직 사진을 읽는 중이에요. 잠시만 기다려 주세요.'; return; }
    else if (a.state === 'done' && a.status === R.status) aiState = 'verified';
    else {
      R.stMsg = a.state === 'error'
        ? 'AI 글자 인식을 쓸 수 없어요.'
        : `사진에서 <b>${LABEL[R.status]}</b> 안내문을 확인하지 못했어요. 안내문이 잘 보이게 다시 찍어 주세요.`;
      R.aiFailed = true; render(); return;
    }
  }

  const b = buildReport();
  if (b.error) { msg.textContent = b.error; return; }

  const s = R.store, now = Date.now();
  const same = s.reports.filter(r => r.status === R.status && r.expiresAt > now).length;
  if (same >= DAILY_LIMIT) { msg.textContent = `이미 ${DAILY_LIMIT}명이 같은 내용으로 제보해서 마감됐어요.`; return; }

  const aiText = R.ai && R.ai.text ? R.ai.text.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  // helped: '내 덕분에 헛걸음을 피한 사람 수' (데모용 가상 숫자. 실제 서비스에서는 이 제보를 본 사람 수)
  const helped = 3 + Math.floor(Math.random() * 10);
  const report = { status: R.status, at: now, photo: R.photo, mine: true, ai: aiState, aiText, helped, ...b };
  s.reports.push(report);
  persist(s.id, report);
  closeReport();
  renderPins();
  openDetail(s);
  renderMe(); renderTicker();
  toast(`제보가 등록됐어요! +${reportPoints(report)}P`);
}

// ----- 저장 (브라우저 localStorage, 데모용) -----
function readSaved() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } }
function persist(storeId, report) {
  const all = readSaved();
  (all[storeId] = all[storeId] || []).push(report);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(all)); }
  catch { delete report.photo; /* 용량 초과 시 사진 없이 저장 */ all[storeId][all[storeId].length - 1] = report; localStorage.setItem(SAVE_KEY, JSON.stringify(all)); }
}
renderMe(); // 내 활동 화면은 me.js

(function loadSaved() {
  const all = readSaved();
  STORES.forEach(s => (all[s.id] || []).forEach(r => s.reports.push(r)));
  // 데모 제보에는 샘플 안내문 사진을 붙여 '사진 확대'를 볼 수 있게 한다
  const DEMO_TEXT = { closed: '영업 종료', holiday: '3일간 휴무합니다', before: '오픈 준비중', shut: '폐업했습니다', open: 'OPEN' };
  STORES.forEach(s => s.reports.forEach(r => { if (!r.photo && !r.mine) r.photo = samplePhoto(DEMO_TEXT[r.status] || ''); }));
  renderPins();
})();
