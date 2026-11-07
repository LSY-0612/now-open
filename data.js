// 데모 데이터: 아주대학교 주변 실제 시설 17곳 (아주대학교_주변_통합_시설_17곳.md 기준) + 가상 식당 1곳.
// registered = '사장님이 지도에 등록해 둔 영업시간'으로 지금 시각의 상태를 계산한 값 (영업시간 없으면 null = 정보 없음)
// reports    = 현장 사용자의 제보. expiresAt이 지나면 자동으로 무시된다.
const STATUS = {
  before:   { label: '영업 전',   icon: '◔' },
  open:     { label: '영업 중',   icon: '●' },
  closed:   { label: '영업 종료', icon: '■' },
  holiday:  { label: '휴무',      icon: '▲' },
  shut:     { label: '폐업',      icon: '✕' },
  checking: { label: '확인 중',   icon: '?' },
  unknown:  { label: '정보 없음', icon: '–' },
};
// 영업 전: 오늘 영업하는데 아직 안 열었음 / 영업 종료: 영업 시간이 남았는데 일찍 닫았거나 영업이 끝남
// 휴무: 잠깐 닫거나 쉬는 것 / 폐업: 아예 문을 닫음
// 현재 지도 등록 상태에 따라 제보할 수 있는 상태 (등록 상태와 다른 것만, 말이 되는 것만)
const ALLOWED_REPORTS = {
  open:    ['before', 'closed', 'holiday', 'shut'],
  before:  ['open', 'holiday', 'shut'],
  closed:  ['open', 'holiday', 'shut'],
  holiday: ['open', 'shut'],
  shut:    ['open'],
  unknown: ['before', 'open', 'closed', 'holiday', 'shut'],
};
const allowedReports = registered => ALLOWED_REPORTS[registered || 'unknown'];
const DAILY_LIMIT = 3;           // 하루(또는 휴무 1건)당 제보 가능 인원
const ALMOST_COUNT = 2;          // 같은 제보 2명 -> '거의 확정'
const CONFIRM_COUNT = 3;         // 같은 제보 3명 -> '확정'

const CENTER = [37.2776, 127.0446]; // 아주대학교 주변

function endOfToday() { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); }
const ago = min => Date.now() - min * 60000;
const DAY = 86400000;

// ---------- 영업시간 ----------
// 'HH:MM-HH:MM' (끝이 시작보다 이르면 익일), null = 휴무/휴진
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function parseRange(s) {
  if (!s) return null;
  const [a, b] = s.split('-').map(toMin);
  return [a, b <= a ? b + 1440 : b];
}
// week(월,화,수,목,금,토,일) -> 인덱스 0=일 ... 6=토
function week(mon, tue, wed, thu, fri, sat, sun) {
  return [sun, mon, tue, wed, thu, fri, sat].map(parseRange);
}
const same = (wk, sat, sun) => week(wk, wk, wk, wk, wk, sat, sun);

function statusFromHours(hours, now = new Date()) {
  if (!hours) return null;
  const day = now.getDay(), min = now.getHours() * 60 + now.getMinutes();
  const prev = hours[(day + 6) % 7];
  if (prev && prev[1] > 1440 && min < prev[1] - 1440) return 'open'; // 전날 밤샘 영업의 연장
  const today = hours[day];
  if (!today) return 'holiday';
  if (min < today[0]) return 'before';
  return min < today[1] ? 'open' : 'closed';
}
function hoursTextToday(hours, now = new Date()) {
  if (!hours) return '등록된 영업시간이 없어요';
  const r = hours[now.getDay()];
  if (!r) return '오늘은 휴무일이에요';
  const f = m => { m = m % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  return `오늘 ${f(r[0])} ~ ${r[1] > 1440 ? '익일 ' : ''}${r[1] === 1440 ? '24:00' : f(r[1])}`;
}

// 월~일 시간표 (오늘 표시용)
function hoursWeek(hours, now = new Date()) {
  if (!hours) return null;
  const f = m => { m = m % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  return [1, 2, 3, 4, 5, 6, 0].map(d => {
    const r = hours[d];
    return { day: names[d], today: d === now.getDay(), text: r ? `${f(r[0])} ~ ${r[1] > 1440 ? '익일 ' : ''}${r[1] === 1440 ? '24:00' : f(r[1])}` : '휴무' };
  });
}

// ---------- 가게 ----------
// 같은 건물(중부대로 259) 가게들은 핀이 겹치지 않도록 좌표를 조금씩 옮겼다.
const RAW = [
  { id: 1,  name: '키와마루아지',          category: '식당·일식',       addr: '수원시 팔달구 아주로13번길 22', tel: '031-214-9015', lat: 37.27617705, lng: 127.04260971, hours: same('11:00-21:30', '11:00-21:30', '11:00-21:30') },
  { id: 2,  name: '뚱보아저씨 수제돈까스 아주대점', category: '식당·돈가스', addr: '수원시 팔달구 아주로39번길 14', tel: '031-215-3111', lat: 37.27851960, lng: 127.04293400, hours: same('11:30-21:00', '11:30-21:00', '11:30-21:00') },
  { id: 3,  name: '겐코 아주대점',          category: '식당·일식',       addr: '수원시 팔달구 아주로47번길 12', tel: '031-213-7523', lat: 37.27923142, lng: 127.04305119, hours: same('11:00-22:00', '11:00-22:00', '11:00-22:00') },
  { id: 4,  name: '빕스 아주대점',          category: '식당·패밀리레스토랑', addr: '수원시 팔달구 중부대로 233', tel: '031-216-1997', lat: 37.27592670, lng: 127.04174520, hours: same('10:30-22:00', '10:00-22:00', '10:00-22:00') },
  { id: 5,  name: '국수나무 수원아주대점',   category: '식당·분식',       addr: '수원시 영통구 아주로 20', tel: '031-217-7061', lat: 37.27661745, lng: 127.04415616, hours: same('11:00-21:30', '11:00-21:30', '12:00-21:30') },
  { id: 6,  name: '우리집',                category: '식당·한식 백반',   addr: '수원시 영통구 월드컵로179번길 48, 1층', tel: '031-214-3050', lat: 37.2790, lng: 127.0468, approx: true, hours: same('11:00-14:00', '11:00-14:00', null) },
  { id: 7,  name: '하이장',                category: '식당·한식',       addr: '수원시 영통구 월드컵로179번길 6, 삼아빌딩 2층', tel: '031-216-5239', lat: 37.27854930, lng: 127.04566040, hours: null },
  { id: 8,  name: '빨간석쇠구이 아주대본점', category: '식당·석쇠구이',   addr: '수원시 영통구 중부대로 259', tel: '031-211-2238', lat: 37.27498750, lng: 127.04455880, hours: same('17:00-05:00', '17:00-05:00', '17:00-05:00') },
  { id: 9,  name: '아주굿정형외과의원',      category: '의원·정형외과',   addr: '수원시 팔달구 중부대로 245', tel: '031-217-7366', lat: 37.27539080, lng: 127.04287630, hours: same('09:00-19:00', '09:00-16:00', null) },
  { id: 10, name: '이이형내과의원',          category: '의원·내과',       addr: '수원시 영통구 중부대로 266-1, 3~5층', tel: '031-212-3688', lat: 37.27416870, lng: 127.04486130, hours: same('09:00-18:30', '09:00-14:00', null) },
  { id: 11, name: '최영일내과의원',          category: '의원·내과',       addr: '수원시 영통구 중부대로 259, 602호', tel: '031-217-0875', lat: 37.27519, lng: 127.04446, hours: week('09:00-17:00', '09:00-13:00', '09:00-17:00', '09:00-13:00', '09:00-17:00', '09:00-13:00', null) },
  { id: 12, name: '아주탑치과의원',          category: '의원·치과',       addr: '수원시 팔달구 아주로 3, 대학빌딩 2층', tel: '031-217-2297', lat: 37.27509932, lng: 127.04382664, hours: week('14:00-21:00', '14:00-21:00', '14:00-21:00', '14:00-21:00', null, null, null) },
  { id: 13, name: '송이비인후과의원',        category: '의원·이비인후과', addr: '수원시 영통구 중부대로 259, 503호', tel: '031-215-8275', lat: 37.27497, lng: 127.04428, hours: same('09:00-19:00', '09:00-14:30', null) },
  { id: 14, name: '아주약국',              category: '약국',           addr: '수원시 영통구 월드컵로 151', tel: '031-214-4886', lat: 37.27720500, lng: 127.04852100, hours: same('09:00-19:00', '09:00-13:00', null) },
  { id: 15, name: '아주메디약국',           category: '약국',           addr: '수원시 영통구 월드컵로155번길 5', tel: '031-213-1492', lat: 37.27723786, lng: 127.04834, hours: same('08:30-18:00', null, null) },
  { id: 16, name: '씨티팜대학약국',          category: '약국',           addr: '수원시 영통구 중부대로 259, 106호', tel: '031-211-4722', lat: 37.27475, lng: 127.04446, hours: same('09:00-22:00', '09:00-21:00', '13:00-21:00') },
  { id: 17, name: '아주대학교병원 (응급실)', category: '병원·상급종합',   addr: '수원시 영통구 월드컵로 164', tel: '031-219-5114', lat: 37.27946120, lng: 127.04768370, hours: same('00:00-24:00', '00:00-24:00', '00:00-24:00') },
  // 가상 가게: 사장님이 영업 정보를 등록하지 않은 경우를 보여 주기 위한 데모용
  { id: 18, name: '골목 파스타 (가상)',      category: '식당·양식',       addr: '데모용 가상 가게', tel: '-', lat: 37.27745, lng: 127.04515, hours: null },
];

// 데모용 제보. 사장님 등록 상태와 '다른' 제보만 효력이 있으므로, 등록 상태에 맞춰 반대 상태로 만든다.
function demoReports(registered, kind, count, minsAgo) {
  let status, note, expiresAt;
  if (kind === 'holiday3') {
    status = registered === 'holiday' ? 'open' : 'holiday';
    note = status === 'holiday' ? '오늘부터 3일간 휴무' : '영업 중 확인';
    expiresAt = status === 'holiday' ? Date.now() + 3 * DAY : endOfToday();
  } else {
    status = registered === 'open' ? 'closed' : 'open';
    note = status === 'closed' ? '영업 종료 안내문' : '영업 중 확인';
    expiresAt = status === 'before' ? Date.now() + 25 * 60000 : endOfToday(); // 영업 전만 짧게
  }
  return Array.from({ length: count }, (_, i) => ({ status, at: ago(minsAgo[i]), expiresAt, note, ai: status === 'open' ? 'n/a' : 'verified' }));
}
const DEMO = {
  6:  ['basic', 1, [20]],               // 확인 중
  9:  ['basic', 2, [50, 30]],           // 거의 확정
  14: ['holiday3', 3, [300, 180, 120]], // 확정
};

const STORES = RAW.map(s => {
  const registered = statusFromHours(s.hours);
  const demo = DEMO[s.id];
  return { ...s, registered, reports: demo ? demoReports(registered, ...demo) : [] };
});

// 오늘 제보 인원(DAILY_LIMIT)이 다 찬 상태 목록 -> 더 이상 제보할 수 없다 (제보 마감)
function fullStatuses(store, now = Date.now()) {
  const active = store.reports.filter(r => r.expiresAt > now && (!r.startsAt || r.startsAt <= now));
  return REPORTABLE_ALL.filter(st => active.filter(r => r.status === st).length >= DAILY_LIMIT);
}
const REPORTABLE_ALL = ['before', 'open', 'closed', 'holiday', 'shut'];

// 지금 지도에 보여 줄 상태를 계산한다.
// - 유효한 제보가 없으면 사장님 등록 상태
// - 등록 상태와 다른 제보 1명  -> '확인 중'
// - 같은 제보 2명              -> 그 상태 '거의 확정'
// - 같은 제보 3명              -> 그 상태 '확정'
function computeDisplay(store, now = Date.now()) {
  const base = store.registered || 'unknown';
  // 만료되지 않았고, 시작 시각(시간 지정 휴무)이 된 제보만 유효
  const active = store.reports.filter(r => r.expiresAt > now && (!r.startsAt || r.startsAt <= now));
  const diff = active.filter(r => r.status !== store.registered);
  if (!diff.length) return { status: base, base, reports: [], count: 0 };

  const tally = {};
  diff.forEach(r => (tally[r.status] = (tally[r.status] || 0) + 1));
  const [topStatus, topCount] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const latest = diff[diff.length - 1];

  if (topCount >= CONFIRM_COUNT) {
    return { status: topStatus, base, reports: diff, count: topCount, level: 'confirmed', latest };
  }
  if (topCount >= ALMOST_COUNT) {
    return { status: topStatus, base, reports: diff, count: topCount, level: 'almost', latest };
  }
  return { status: 'checking', base, reports: diff, count: diff.length, reportedStatus: topStatus, latest };
}

