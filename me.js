// ---------- 내 활동: 포인트 · 배지 · 랭킹 · "내 덕분에 N명" (브라우저 localStorage 기반 데모) ----------
const POINT_VERIFIED = 10;   // AI가 안내문을 확인한 제보, 또는 영업 중 제보
const POINT_SKIPPED = 5;     // AI 확인을 건너뛰고 등록한 제보
const POINT_PENALTY = 20;    // 허위 제보 페널티 1회당 차감

const reportPoints = r => (r.ai === 'skipped' ? POINT_SKIPPED : POINT_VERIFIED);

// 내가 한 제보(저장된 것)를 모두 모은다
function myReports() {
  const all = readSaved(), list = [];
  Object.keys(all).forEach(id => all[id].forEach(r => list.push({ ...r, storeId: +id })));
  return list.sort((a, b) => b.at - a.at);
}
function myStats() {
  const reports = myReports(), pen = getPenalty();
  const earned = reports.reduce((n, r) => n + reportPoints(r), 0);
  return {
    reports,
    penalty: pen,
    points: Math.max(0, earned - pen.count * POINT_PENALTY),
    helped: reports.reduce((n, r) => n + (r.helped || 0), 0),
    aiVerified: reports.filter(r => r.ai === 'verified').length,
  };
}

const BADGES = [
  { icon: '🌱', name: '첫 제보',        desc: '제보 1건',                  ok: s => s.reports.length >= 1 },
  { icon: '🔍', name: '동네 탐정',      desc: '제보 5건',                  ok: s => s.reports.length >= 5 },
  { icon: '🛡️', name: '헛걸음 방지단',  desc: '제보 10건',                 ok: s => s.reports.length >= 10 },
  { icon: '🤖', name: 'AI 인증',        desc: 'AI 확인 제보 3건',          ok: s => s.aiVerified >= 3 },
  { icon: '😇', name: '클린 제보러',    desc: '제보 3건 이상 + 페널티 0회', ok: s => s.reports.length >= 3 && s.penalty.count === 0 },
];

// 랭킹 (나를 뺀 사람들은 데모용 가상 사용자)
const DEMO_RANK = [
  { name: '영통 지킴이', points: 120 }, { name: '아주 탐정', points: 85 },
  { name: '원천동 토박이', points: 60 }, { name: '야식러버', points: 35 }, { name: '새내기 기자', points: 15 },
];

const PINK = Brand.C.pink, GREEN = Brand.C.green, BLUE = Brand.C.blue;
// 빈 화면: 브랜드 디자인은 마스코트가 빼꼼, 기본 디자인은 글자만
const emptyM = text => theme() === 'brand'
  ? `<div class="empty-m"><div class="m">${Brand.mascot({ peek: true, eyes: 'look' })}</div><span>${text}</span></div>`
  : `<span class="sub">${text}</span>`;
function statusLabel(k) { return STATUS[k] ? STATUS[k].label : k; }

function renderMe() {
  const el = document.getElementById('me-body');
  if (!el) return;
  const s = myStats(), p = s.penalty, brandOn = theme() === 'brand';

  const rank = [...DEMO_RANK, { name: '나', points: s.points, me: true }].sort((a, b) => b.points - a.points);
  const myRank = rank.findIndex(r => r.me) + 1;

  // 즐겨찾기 (마지막으로 본 상태와 지금 상태가 다르면 '바뀌었어요' 표시)
  const favs = getFav();
  const favList = STORES.filter(x => String(x.id) in favs).map(x => {
    const now = computeDisplay(x).status, seen = favs[x.id];
    return { s: x, now, seen, changed: seen !== now };
  });

  const history = s.reports.slice(0, 8).map(r => {
    const store = STORES.find(x => x.id === r.storeId);
    const live = r.expiresAt > Date.now();
    return `<li><div><b>${store ? store.name : '가게'}</b> <span class="sub">${statusLabel(r.status)}${r.ai === 'verified' ? ' · 🤖' : ''}</span>
      <div class="sub">${timeAgo(r.at)} · +${reportPoints(r)}P${live ? ' · 표시 중' : ''}</div></div></li>`;
  }).join('');

  el.innerHTML = `
    ${settingsOpen ? `
    <div class="settings">
      <div class="set-title">⚙️ 설정</div>
      <div class="set-label sub">화면 디자인</div>
      <div class="seg" id="theme-seg">
        <button data-theme-set="classic" class="${theme() === 'classic' ? 'on' : ''}">기본 디자인</button>
        <button data-theme-set="brand" class="${theme() === 'brand' ? 'on' : ''}">브랜드 디자인</button>
      </div>
      <button class="btn ghost small" id="me-guide">사용 안내 다시 보기</button>
      <button class="btn ghost small" id="me-reset">데모용: 내 활동 전체 초기화</button>
    </div>` : ''}

    <div class="me-hero">
      ${brandOn ? '<div class="latin" style="font-size:11px;color:var(--green)">My points</div>' : ''}
      <div class="me-pts">${s.points}<span>P</span></div>
      <div class="sub">내 순위 ${myRank}위 · 제보 ${s.reports.length}건</div>
      ${brandOn ? `<div class="m">${Brand.mascot({ peek: true, spark: true, eyes: s.points ? 'happy' : 'normal' })}</div>` : ''}
    </div>

    <h4 class="me-h">⭐ 즐겨찾기 <span class="sub">(${favList.length})</span></h4>
    <ul class="favs">${favList.length ? favList.map(f => `
      <li data-id="${f.s.id}">
        <div><b>${f.s.name.replace(/\s*\(.*\)/, '')}</b><div class="sub">${f.s.category}</div>
          ${f.changed ? `<div class="chg">🔔 상태가 바뀌었어요: ${statusLabel(f.seen)} → ${statusLabel(f.now)}</div>` : ''}</div>
        <span class="badge s-${f.now}" style="font-size:12px;padding:3px 9px">${statusLabel(f.now)}</span>
      </li>`).join('') : `<li class="empty">${emptyM('가게 상세에서 ☆를 눌러<br>즐겨찾기를 추가해 보세요')}</li>`}</ul>

    <div class="me-card helped" style="margin-top:14px">
      <div class="sub">내 덕분에 헛걸음을 피한 사람</div>
      <div class="me-num">${s.helped}명</div>
      <div class="sub">※ 데모용 가상 숫자예요. 실제로는 내 제보를 본 사람 수예요.</div>
    </div>

    <h4 class="me-h">배지</h4>
    <div class="badges">${BADGES.map(b => {
      const on = b.ok(s);
      return `<div class="bd ${on ? 'on' : ''}"><div class="bd-i">${b.icon}</div><b>${b.name}</b><span class="sub">${b.desc}</span></div>`;
    }).join('')}</div>

    <h4 class="me-h">랭킹</h4>
    <ol class="rank">${rank.map((r, i) =>
      `<li class="${r.me ? 'me' : ''}"><span class="n">${i + 1}</span>
        ${brandOn ? `<span class="av" style="background:${[PINK, GREEN, BLUE][i % 3]}"><span>${Brand.mascot({ legs: false, prop: 'none', cap: i < 3, eyes: ['happy', 'normal', 'wink', 'look', 'normal', 'wink'][i % 6] })}</span></span>` : ''}
        <span class="nm">${r.name}${i === 0 && brandOn ? ' 👑' : ''}</span><span class="pt">${r.points}P</span></li>`).join('')}</ol>

    <h4 class="me-h">허위 제보 페널티</h4>
    <div class="me-card ${p.count ? 'bad' : ''}">
      <div class="me-num">${p.count}회 <span class="sub">/ ${BAN_AT}회 누적 시 제보 제한</span></div>
      <div class="sub">1회당 ${POINT_PENALTY}P가 차감돼요.</div>
      ${p.log.map(l => `<div class="sub">· ${l.reason}</div>`).join('')}
      ${p.count ? '<button class="btn ghost small" id="pen-reset">데모용: 페널티 초기화</button>' : ''}
    </div>

    <h4 class="me-h">최근 제보</h4>
    <ul class="hist">${history || `<li class="empty">${emptyM('아직 제보가 없어요.<br>가게 앞에서 첫 제보를 해 보세요!')}</li>`}</ul>

    <h4 class="me-h">포인트 안내</h4>
    <p class="sub" style="padding:0 20px 8px;line-height:1.7">AI가 안내문을 확인한 제보와 영업 중 제보는 +${POINT_VERIFIED}P, AI 확인을 건너뛴 제보는 +${POINT_SKIPPED}P예요.
      허위 제보 1회당 -${POINT_PENALTY}P가 차감돼요.</p>
    <p class="demo-note">※ 데모 서비스예요. 영업 상태와 제보는 예시 데이터이며, 실제 영업 여부가 아니에요.</p>`;

  const guideBtn = document.getElementById('me-guide');
  if (guideBtn) guideBtn.onclick = () => showOnboarding();
  el.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => {
    if (b.dataset.themeSet !== theme()) setTheme(b.dataset.themeSet);
  });
  el.querySelectorAll('.favs li[data-id]').forEach(li => li.onclick = () => {
    const st = STORES.find(x => x.id === +li.dataset.id);
    document.querySelectorAll('.tabbar button')[0].click(); // 지도 탭으로
    map.setView([st.lat, st.lng], 17);
    openDetail(st);
  });

  const b = document.getElementById('pen-reset');
  if (b) b.onclick = () => { localStorage.removeItem(PENALTY_KEY); renderMe(); };
  const resetBtn = document.getElementById('me-reset');
  if (resetBtn) resetBtn.onclick = () => {
    [PENALTY_KEY, SAVE_KEY, FAV_KEY, SEEN_KEY].forEach(k => localStorage.removeItem(k)); location.reload();
  };
}

// 설정(톱니바퀴): 누르면 펼쳐지고, 다시 누르면 접힌다. 기본은 숨김
let settingsOpen = false;
document.getElementById('gear').onclick = () => {
  settingsOpen = !settingsOpen;
  document.getElementById('gear').classList.toggle('on', settingsOpen);
  renderMe();
  if (settingsOpen) document.getElementById('view-me').scrollTop = 0;
};
