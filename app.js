// ---------- 공통 ----------
function timeAgo(ts) {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  return m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 전`;
}
function expiryText(ts) {
  const d = new Date(ts);
  if (ts === endOfToday()) return '오늘 자정까지';
  if (d.toDateString() === new Date().toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}까지`;
  return `${d.getMonth() + 1}/${d.getDate()}까지`;
}
// 한 줄 요약: 지도 등록 상태 vs 현장 제보
// 받침 유무에 따라 조사 선택 (예: 영업 중 + 으로, 휴무 + 로)
function josa(word, withBatchim, without) {
  const code = word.charCodeAt(word.length - 1) - 0xAC00;
  return word + (code >= 0 && code % 28 !== 0 ? withBatchim : without);
}
function summaryHTML(d) {
  const baseLabel = STATUS[d.base].label;
  if (d.status === d.base) {
    return d.base === 'unknown'
      ? '아직 등록된 정보가 없어요'
      : `지도에 <b>${josa(baseLabel, '으로', '로')}</b> 등록되어 있어요`;
  }
  if (d.status === 'checking') {
    return `지도에는 <b>${josa(baseLabel, '으로', '로')}</b> 등록되어 있지만, <b>${d.count}명</b>이 <b>${josa(STATUS[d.reportedStatus].label, '이라고', '라고')}</b> 제보해서 <b>확인 중</b>이에요`;
  }
  const tail = d.level === 'confirmed' ? '확정됐어요' : '<b>거의 확정</b>이에요 (1명만 더 인증하면 확정)';
  return `지도 등록은 <b>${josa(baseLabel, '이지만', '지만')}</b>, <b>${d.count}명</b>이 <b>${josa(STATUS[d.status].label, '으로', '로')}</b> 제보해서 ${tail}`;
}
function badgeHTML(d, small) {
  let extra = '';
  if (d.status !== 'checking' && d.level) {
    if (d.level === 'almost') extra += ' · 거의 확정';
    if (d.status === 'holiday' && d.latest && d.latest.note) extra += ` · ${d.latest.note}`;
  }
  return `<span class="badge s-${d.status}" ${small ? 'style="font-size:12px;padding:3px 9px"' : ''}>${STATUS[d.status].label}${extra}</span>`;
}

// ---------- 탭 전환 ----------
document.querySelectorAll('.tabbar button').forEach(btn => {
  btn.addEventListener('click', () => {
    closeDetail();
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === btn.dataset.view));
    if (btn.dataset.view === 'view-map') setTimeout(() => map.invalidateSize(), 0);
  });
});

// ---------- 지도 ----------
const map = L.map('map', { zoomControl: false }).setView(CENTER, 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© OpenStreetMap'
}).addTo(map);

const markers = {};
let userPos = null, userMarker = null, nearIds = new Set(); // 내 위치와 150m 안(제보 가능) 가게
// 즐겨찾기: { 가게id: 마지막으로 본 상태 } (브라우저 localStorage)
const FAV_KEY = 'nowopen.fav';
function getFav() { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || {}; } catch { return {}; } }
function saveFav(f) { localStorage.setItem(FAV_KEY, JSON.stringify(f)); }
const isFav = id => String(id) in getFav();
function toggleFav(s) {
  const f = getFav();
  if (isFav(s.id)) delete f[s.id]; else f[s.id] = computeDisplay(s).status;
  saveFav(f);
  renderPins();
  if (typeof renderMe === 'function') renderMe();
  toast(isFav(s.id) ? '즐겨찾기에 추가했어요 ★' : '즐겨찾기에서 뺐어요');
}

// 화면 디자인 설정: 'brand'(브랜드·마스코트 '여리') / 'classic'(기본)
const THEME_KEY = 'nowopen.theme';
const theme = () => document.documentElement.dataset.theme === 'classic' ? 'classic' : 'brand';
function setTheme(t) {
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.dataset.theme = t;
  renderPins();                                  // 핀 모양 바꾸기
  if (typeof renderMe === 'function') renderMe();
  setTimeout(() => { map.invalidateSize(); fitTicker(); }, 0); // 앱바가 생기거나 사라지면 지도 크기도 바뀐다
  toast(t === 'brand' ? '브랜드 디자인으로 바꿨어요' : '기본 디자인으로 바꿨어요');
}

// 지도 핀: 브랜드 디자인은 마스코트 '여리'의 얼굴 핀(표정으로도 상태 구분), 기본 디자인은 동그란 핀
function pinIcon(status, near, fav) {
  if (theme() === 'classic') {
    return L.divIcon({
      className: '',
      html: `<div class="pin s-${status} ${near ? 'near' : ''}"><b>${STATUS[status].icon}</b>${fav ? '<i class="star">★</i>' : ''}</div>`,
      iconSize: [34, 34], iconAnchor: [17, 34],
    });
  }
  return L.divIcon({
    className: '',
    html: `<div class="bp ${near ? 'near' : ''}">${Brand.statusPin(status, 40)}${fav ? '<i class="star">★</i>' : ''}</div>`,
    iconSize: [40, 48], iconAnchor: [17, 45],
  });
}
function renderPins() {
  STORES.forEach(s => {
    const d = computeDisplay(s), near = nearIds.has(s.id), fav = isFav(s.id);
    if (markers[s.id]) { markers[s.id].setIcon(pinIcon(d.status, near, fav)); return; }
    markers[s.id] = L.marker([s.lat, s.lng], { icon: pinIcon(d.status, near, fav) })
      .addTo(map).on('click', () => openSheet(s));
  });
}
renderPins();
// 위쪽(띠·검색창)과 아래쪽(탭바) 가림 영역을 비워 두고 전체가 보이게 맞춘다
map.fitBounds(STORES.map(s => [s.lat, s.lng]), { paddingTopLeft: [24, 150], paddingBottomRight: [24, 80], maxZoom: 17 });
map.on('click', closeSheet);

// ---------- 하단 시트 ----------
const sheet = document.getElementById('sheet');
let sheetStore = null, detailStore = null;
function openSheet(s, pan = true) {
  sheetStore = s;
  const d = computeDisplay(s);
  sheet.innerHTML = `
    <h3>${s.name}</h3>
    <div class="cat">${s.category}</div>
    ${badgeHTML(d)}
    <div class="meta">${summaryHTML(d)}</div>
    ${nearTag(s)}
    <button class="btn" id="to-detail">자세히 보기</button>`;
  sheet.classList.remove('hidden');
  if (pan) map.panTo([s.lat, s.lng]);
  document.getElementById('to-detail').onclick = () => openDetail(s);
}
function closeSheet() { sheet.classList.add('hidden'); }

// ---------- 가게 상세 ----------
const detail = document.getElementById('detail');
function openDetail(s) {
  detailStore = s;
  const d = computeDisplay(s);
  const full = fullStatuses(s);
  const week = hoursWeek(s.hours);
  { const f = getFav(); if (isFav(s.id)) { f[s.id] = d.status; saveFav(f); } } // 즐겨찾기 가게를 보면 '본 상태'로 갱신
  const tel = s.tel && s.tel !== '-' ? s.tel.split('/')[0].replace(/[^\d]/g, '') : '';
  const routeName = encodeURIComponent(s.name.replace(/\s*\(.*\)/, ''));
  // 제보 가능 상태: 사장님이 등록해 둔(=지도에 표시된) 상태와 다른 것만
  const options = allowedReports(s.registered);
  const todayCount = d.reports.length;

  const reportsHTML = d.reports.length
    ? d.reports.map(r => `
        <li>
          ${r.photo ? `<img class="ph" src="${r.photo}" alt="">` : '<div class="ph">사진</div>'}
          <div>
            <b>${STATUS[r.status].label}</b>${r.ai === 'verified' ? ' <span class="aitag">🤖 AI 확인</span>' : ''}
            <div class="sub">${timeAgo(r.at)} · ${r.note}</div>
            <div class="sub">표시 기간: ${expiryText(r.expiresAt)}</div>
          </div>
        </li>`).join('')
    : '<li class="empty">아직 제보가 없어요</li>';

  detail.innerHTML = `
    <header class="detail-head">
      <button id="back" aria-label="뒤로">←</button>
      <div><h2>${s.name}</h2><div class="sub">${s.category}</div></div>
      <button id="fav" class="fav ${isFav(s.id) ? 'on' : ''}" aria-label="즐겨찾기">${isFav(s.id) ? '★' : '☆'}</button>
    </header>
    <div class="detail-body">
      <div class="status-card s-${d.status}-bg">
        ${badgeHTML(d)}
        <p>${summaryHTML(d)}</p>
      </div>

      <div class="actions">
        ${tel ? `<a class="act" id="call" href="tel:${tel}">📞 전화하기</a>` : ''}
        <a class="act" target="_blank" rel="noopener" href="https://map.kakao.com/link/to/${routeName},${s.lat},${s.lng}">🧭 길찾기</a>
      </div>
      ${nearTag(s)}

      <div class="info">
        ${week ? `<details class="hours"><summary><span>등록 영업시간</span>${hoursTextToday(s.hours)} <em>전체 보기 ▾</em></summary>
          <table>${week.map(w => `<tr class="${w.today ? 'today' : ''}"><td>${w.day}${w.today ? ' (오늘)' : ''}</td><td>${w.text}</td></tr>`).join('')}</table>
        </details>` : `<div><span>등록 영업시간</span>${hoursTextToday(s.hours)}</div>`}
        <div><span>주소</span>경기 ${s.addr}</div>
        <div><span>전화</span>${s.tel}</div>
        ${s.approx ? '<div class="sub">※ 정확한 좌표가 없어 위치는 대략적으로 표시했어요</div>' : ''}
      </div>

      <h4>현장 제보 <span class="sub">(오늘 ${todayCount}/${DAILY_LIMIT}명)</span></h4>
      ${full.length ? `<div class="full-tag">🔒 ${full.map(k => STATUS[k].label).join(', ')} 제보는 ${DAILY_LIMIT}명이 모두 참여해서 <b>마감</b>됐어요</div>` : ''}
      <ul class="reports">${reportsHTML}</ul>

      <h4>실제로는 다른가요?</h4>
      <p class="sub" style="margin-bottom:10px">지도에 등록된 상태(<b>${STATUS[s.registered || 'unknown'].label}</b>)와 다를 때만 제보할 수 있어요.</p>
      <div class="chips">${options.map(k => `<span class="chip s-${k}-bg ${full.includes(k) ? 'full' : ''}">${STATUS[k].label}${full.includes(k) ? ' · 마감' : ''}</span>`).join('')}</div>
      <button class="btn" id="to-report">현장에서 제보하기</button>
      <p class="warn">${FALSE_WARNING}</p>
    </div>`;
  detail.classList.remove('hidden');
  document.getElementById('back').onclick = closeDetail;
  document.getElementById('fav').onclick = () => { toggleFav(s); openDetail(s); };
  detail.querySelectorAll('img.ph').forEach(img => img.onclick = () => showPhoto(img.src));
  const callBtn = document.getElementById('call');
  if (callBtn) callBtn.onclick = e => { e.preventDefault(); confirmCall(s, tel); };
  document.getElementById('to-report').onclick = () => openReport(s);
}
function closeDetail() { detail.classList.add('hidden'); }

// 사진 크게 보기
function showPhoto(src) {
  const o = document.createElement('div');
  o.className = 'lightbox';
  o.innerHTML = `<button aria-label="닫기">✕</button><img src="${src}" alt="제보 사진"><p>얼굴·번호판은 자동으로 가려진 사진이에요</p>`;
  o.onclick = () => o.remove();
  document.getElementById('app').appendChild(o);
}

// 전화 걸기 전 확인 창 ("OO에 전화하시겠습니까?")
function confirmCall(s, tel) {
  const name = s.name.replace(/\s*\(.*\)/, '');
  const o = document.createElement('div');
  o.className = 'modal';
  o.innerHTML = `<div class="modal-box">
    <h3 style="color:var(--text)">📞 전화하시겠습니까?</h3>
    <p><b>${name}</b>에<br>전화를 겁니다.<br><span class="sub">${s.tel}</span></p>
    <div class="modal-btns"><button class="cancel">취소</button><button class="go">전화하기</button></div>
  </div>`;
  o.querySelector('.cancel').onclick = () => o.remove();
  o.onclick = e => { if (e.target === o) o.remove(); };
  o.querySelector('.go').onclick = () => { o.remove(); location.href = `tel:${tel}`; };
  document.getElementById('app').appendChild(o);
}

// ---------- 내 위치 · 근처 제보 가능 가게 ----------
const nearbyEl = document.getElementById('nearby');
const distTo = s => (userPos ? distanceM(userPos.lat, userPos.lng, s.lat, s.lng) : Infinity);
function nearTag(s) {
  return nearIds.has(s.id)
    ? `<div class="near-tag">📍 지금 가게 근처예요 (약 ${Math.round(distTo(s))}m) · 바로 제보할 수 있어요</div>` : '';
}
function setUserPos(lat, lng, demo, quiet = false) {
  userPos = { lat, lng, demo };
  if (userMarker) userMarker.setLatLng([lat, lng]);
  else userMarker = L.circleMarker([lat, lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map);
  nearIds = new Set(STORES.filter(s => distTo(s) <= GPS_RADIUS).map(s => s.id));
  if (!quiet) map.setView([lat, lng], 17);        // 조용한 갱신(자동)일 때는 지도를 건드리지 않는다
  renderPins(); refreshOpen(); renderTicker();
  if (!quiet || !nearbyEl.classList.contains('hidden')) renderNearby();
}
// 위치 권한이 이미 허용돼 있으면 묻지 않고 조용히 위치를 읽는다 (처음 열 때, 20초마다)
function quietLocate() {
  if (!navigator.geolocation || (userPos && userPos.demo)) return;
  navigator.geolocation.getCurrentPosition(p => setUserPos(p.coords.latitude, p.coords.longitude, false, true), () => {},
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 });
}
if (navigator.permissions) {
  navigator.permissions.query({ name: 'geolocation' }).then(p => { if (p.state === 'granted') quietLocate(); }).catch(() => {});
}
function locate() {
  nearbyEl.classList.remove('hidden');
  nearbyEl.innerHTML = '<div class="nb-head"><span>📍 내 위치를 확인하는 중이에요…</span></div>';
  if (!navigator.geolocation) return locateFail('이 브라우저는 위치 확인을 지원하지 않아요.');
  navigator.geolocation.getCurrentPosition(
    p => setUserPos(p.coords.latitude, p.coords.longitude, false),
    e => locateFail(e.code === 1 ? '위치 권한이 거부되어 있어요.' : '위치를 가져오지 못했어요.'),
    { enableHighAccuracy: true, timeout: 10000 });
}
function locateFail(msg) {
  nearbyEl.innerHTML = `<div class="nb-head"><span>📍 ${msg}</span><button class="nb-x" id="nb-close">✕</button></div>
    <button class="btn ghost small" id="nb-demo">데모용: 가상 위치 (중부대로 259 앞)</button>`;
  document.getElementById('nb-close').onclick = () => nearbyEl.classList.add('hidden');
  document.getElementById('nb-demo').onclick = () => setUserPos(37.27497, 127.04446, true);
}
function renderNearby() {
  const list = STORES.filter(s => nearIds.has(s.id)).sort((a, b) => distTo(a) - distTo(b));
  nearbyEl.innerHTML = `
    <div class="nb-head"><span>📍 근처 제보 가능 <b>${list.length}</b>곳${userPos.demo ? ' <em>(데모 위치)</em>' : ''}</span><button class="nb-x" id="nb-close">✕</button></div>
    ${list.length
      ? `<div class="nb-list">${list.map(s => `<button data-id="${s.id}">${s.name.replace(/\s*\(.*\)/, '')}<span>${Math.round(distTo(s))}m</span></button>`).join('')}</div>`
      : '<div class="sub" style="padding:2px 4px 4px">150m 안에 등록된 가게가 없어요.</div>'}`;
  document.getElementById('nb-close').onclick = () => nearbyEl.classList.add('hidden');
  nearbyEl.querySelectorAll('.nb-list button').forEach(b => b.onclick = () => openSheet(STORES.find(x => x.id === +b.dataset.id)));
}
document.getElementById('locate').onclick = locate;

// ---------- 상태 자동 갱신 ----------
// 시간이 지나면 영업 전→영업 중 같은 등록 상태와, 기간이 끝난 제보가 새로고침 없이 반영된다
function refreshOpen() {
  if (sheetStore && !sheet.classList.contains('hidden')) openSheet(sheetStore, false);
  if (detailStore && !detail.classList.contains('hidden') && reportEl.classList.contains('hidden')) {
    const top = detail.scrollTop; openDetail(detailStore); detail.scrollTop = top;
  }
}
function refreshAll() {
  STORES.forEach(s => { s.registered = statusFromHours(s.hours); });
  renderPins(); refreshOpen(); renderTicker();
}

// ---------- 브랜드: 로고 · 실시간 띠 · 아이콘 ----------
document.getElementById('logoHead').innerHTML = Brand.mascot({ legs: false, prop: 'none' });
{ // 파비콘 = 앱 아이콘
  const ico = document.querySelector('link[rel=icon]');
  ico.type = 'image/svg+xml';
  ico.href = 'data:image/svg+xml,' + encodeURIComponent(Brand.appIcon(false));
}
// 상단 띠와 칩: 내 위치 기준 150m 이내 가게만 보여 준다 (위치를 모르면 켜 달라는 안내)
function renderTicker() {
  const chip = document.getElementById('liveChip');
  let one;
  if (!userPos) {
    one = '<span class="tk-msg">📍 내 위치를 켜면 150m 안에 있는 가게 상태가 여기에 흘러가요 · 눌러서 위치 켜기</span>';
    chip.innerHTML = '<span>📍 위치 켜기</span>';
  } else {
    const near = STORES.filter(s => nearIds.has(s.id)).sort((a, b) => distTo(a) - distTo(b));
    chip.innerHTML = `<i class="live"></i><span><b>${near.length}</b>곳 근처</span>`;
    one = near.length
      ? near.map(s => { const d = computeDisplay(s);
          return `<span><i style="background:${Brand.STATUS[d.status].color}"></i>${s.name.replace(/\s*\(.*\)/, '')} · ${STATUS[d.status].label} · ${Math.round(distTo(s))}m</span>`; }).join('')
      : '<span class="tk-msg">150m 안에 등록된 가게가 없어요</span>';
  }
  const html = one + one + one + one;
  const el = document.getElementById('ticker');
  if (el.dataset.html !== html) {                // 바뀐 때만 갱신해야 흐르는 띠가 끊기지 않는다
    el.innerHTML = html; el.dataset.html = html;
    fitTicker();
  }
}
// 속도: 초당 약 30px로 천천히 (가게가 늘어 글자가 길어져도 같은 속도). 화면에 보일 때만 폭을 잴 수 있다
const TICKER_PX_PER_SEC = 30;
function fitTicker() {
  const el = document.getElementById('ticker');
  if (el.scrollWidth) el.style.animationDuration = Math.max(40, Math.round((el.scrollWidth / 2) / TICKER_PX_PER_SEC)) + 's';
}
renderTicker();
setInterval(() => { refreshAll(); if (userPos && !userPos.demo) quietLocate(); }, 20000);
// 띠나 위치 칩을 누르면 위치 켜기
document.getElementById('ticker').onclick = () => { if (!userPos) locate(); };
document.getElementById('liveChip').onclick = () => { if (!userPos) locate(); else if (nearbyEl.classList.contains('hidden')) renderNearby(), nearbyEl.classList.remove('hidden'); };
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(); });

// ---------- 검색 ----------
const searchEl = document.getElementById('search');
const resultsEl = document.getElementById('search-results');
searchEl.addEventListener('input', () => {
  const q = searchEl.value.trim();
  if (!q) { resultsEl.classList.add('hidden'); return; }
  const found = STORES.filter(s => s.name.includes(q) || s.category.includes(q));
  resultsEl.innerHTML = found.length
    ? found.map(s => `<li data-id="${s.id}"><span>${s.name}</span>${badgeHTML(computeDisplay(s), true)}</li>`).join('')
    : '<li>검색 결과가 없습니다</li>';
  resultsEl.classList.remove('hidden');
});
resultsEl.addEventListener('click', e => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  const s = STORES.find(x => x.id === +li.dataset.id);
  resultsEl.classList.add('hidden');
  searchEl.value = '';
  map.setView([s.lat, s.lng], 17);
  openSheet(s);
});
