// ---------- AI 글자 인식 (브라우저용 Tesseract.js, 한글+영어) ----------
// 사진 속 안내문을 읽어서 '휴무 / 영업 종료 / 폐업 / 영업 전 / 영업 중' 중 무엇인지 알아낸다.
let _ocrWorker = null;

// 미리 모델을 내려받아 둔다 (처음 한 번은 몇 초 걸림)
function ocrWarmup() {
  if (!_ocrWorker && window.Tesseract) {
    _ocrWorker = Tesseract.createWorker('kor+eng').catch(e => { _ocrWorker = null; throw e; });
  }
  return _ocrWorker;
}
async function ocrRead(image) {
  const p = ocrWarmup();
  if (!p) throw new Error('Tesseract unavailable');
  const worker = await p;
  const { data } = await worker.recognize(image);
  // 글자와 줄별 위치(번호판 가리기에 사용)
  return { text: data.text || '', lines: (data.lines || []).map(l => ({ text: l.text, bbox: l.bbox })) };
}

// 키워드 규칙 (앞에 있을수록 우선). 공백은 모두 지우고 비교한다.
const OCR_RULES = [
  ['shut',    /폐업|폐점|점포정리/],
  ['holiday', /휴무|휴업|쉽니다|쉬어갑니다|쉬어요/],
  ['closed',  /영업종료|영업을종료|마감|종료했|종료합|closed/i],
  ['before',  /준비중|오픈전|오픈예정|영업전|opensoon/i],
  ['open',    /영업중|open/i],
];

// ---- 날짜 범위 읽기: '11/7-11/9', '11월 7일~9일', '7일부터 9일까지', '11/9까지' ----
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const SEP = '(?:부터|~|-|–|—|에서)';
function parseDateRange(t, today = new Date()) {
  const y = today.getFullYear(), cm = today.getMonth() + 1;
  const ok = (m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31;
  let m1, d1, m2, d2, m;
  if ((m = t.match(new RegExp(`(\\d{1,2})월(\\d{1,2})일?${SEP}(?:(\\d{1,2})월)?(\\d{1,2})일?`)))) {
    [m1, d1, m2, d2] = [+m[1], +m[2], +(m[3] || m[1]), +m[4]];
  } else if ((m = t.match(new RegExp(`(\\d{1,2})[/.](\\d{1,2})일?${SEP}(?:(\\d{1,2})[/.])?(\\d{1,2})일?`)))) {
    [m1, d1, m2, d2] = [+m[1], +m[2], +(m[3] || m[1]), +m[4]];
  } else if ((m = t.match(new RegExp(`(\\d{1,2})일${SEP}(\\d{1,2})일`)))) {
    [m1, d1, m2, d2] = [cm, +m[1], cm, +m[2]];
  } else if ((m = t.match(/(\d{1,2})월(\d{1,2})일까지|(\d{1,2})[\/.](\d{1,2})까지/))) { // 끝나는 날만 있는 경우: 오늘부터
    const mm = +(m[1] || m[3]), dd = +(m[2] || m[4]);
    if (!ok(mm, dd)) return null;
    let to = new Date(y, mm - 1, dd);
    if (to < new Date(y, today.getMonth(), today.getDate())) to = new Date(y + 1, mm - 1, dd);
    return { from: ymd(today), to: ymd(to) };
  } else return null;
  if (!ok(m1, d1) || !ok(m2, d2)) return null;
  const from = new Date(y, m1 - 1, d1);
  let to = new Date(y, m2 - 1, d2);
  if (to < from) to = new Date(y + 1, m2 - 1, d2); // 12/30~1/2 처럼 해를 넘기는 경우
  return { from: ymd(from), to: ymd(to) };
}

function analyzeText(raw) {
  // '연중무휴'는 쉬지 않는다는 뜻이라 휴무로 읽히지 않게 지운다
  const t = (raw || '').replace(/\s+/g, '').replace(/연중무휴|무휴/g, '');
  const hit = OCR_RULES.find(([, re]) => re.test(t));
  const out = { status: hit ? hit[0] : null };

  const range = parseDateRange(t);
  if (range) out.range = range;
  const d = t.match(/(\d{1,2})일(?:간|동안)/);
  if (d) out.days = Math.min(30, Math.max(1, +d[1]));
  const tm = t.match(/(\d{1,2})시(?:\d{1,2}분)?(?:부터|~|-|에서)(\d{1,2})시/);
  if (tm) {
    const fix = h => (h < 9 ? h + 12 : h); // '3시~5시'는 오후로 본다
    out.time = [fix(+tm[1]), fix(+tm[2])];
  }
  return out;
}
