(function () {
// 지금 열었나요? 브랜드 그래픽 생성기 (마스코트 '여리' + 로고 + 상태 핀)
// 모든 함수는 SVG 문자열을 돌려준다. 페이지에서 innerHTML로 넣어 쓴다.
const C = {
  pink: '#FF5BA7',
  pinkDeep: '#E63E8C',
  blue: '#1E4BD8',
  green: '#A7E631',
  navy: '#0F1F3F',
  cream: '#F3EEE3',
  white: '#FFFFFF',
  orange: '#FF9F1C',
  red: '#F0453A',
  gray: '#A3A9B6',
};
const STATUS = {
  before:   { label: '영업 전',   color: '#3b82f6', text: C.white },
  open:     { label: '영업 중',   color: '#22a55b', text: C.white },
  closed:   { label: '영업 종료', color: '#e5484d', text: C.white },
  holiday:  { label: '휴무',      color: '#8b5cf6', text: C.white },
  shut:     { label: '폐업',      color: '#1f2937', text: C.white },
  checking: { label: '확인 중',   color: '#f59e0b', text: C.navy },
  unknown:  { label: '정보 없음', color: '#c4c9d1', text: C.navy },
};
let _uid = 0;
const uid = (p) => `${p}${++_uid}`;
// 마스코트 몸통(지도 핀) 경로. 중심 (110,100), 끝점 (110,205)
const BODY = 'M110 205C92 182 50 148 50 100A60 60 0 0 1 170 100C170 148 128 182 110 205Z';
function eyesSvg(type) {
  const n = C.navy;
  const eye = (x) => `<ellipse cx="${x}" cy="112" rx="15" ry="19" fill="${C.white}" stroke="${n}" stroke-width="4"/>`;
  const pupil = (x, dx = 4, dy = 4) =>
    `<circle cx="${x + dx}" cy="${112 + dy}" r="8" fill="${n}"/><circle cx="${x + dx + 3}" cy="${112 + dy - 4}" r="2.6" fill="${C.white}"/>`;
  switch (type) {
    case 'wink':
      return eye(92) + pupil(92) +
        `<path d="M115 114Q128 103 141 114" fill="none" stroke="${n}" stroke-width="5" stroke-linecap="round"/>`;
    case 'happy':
      return `<path d="M78 116Q92 100 106 116" fill="none" stroke="${n}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M114 116Q128 100 142 116" fill="none" stroke="${n}" stroke-width="5" stroke-linecap="round"/>`;
    case 'look':
      return eye(92) + eye(128) + pupil(92, -5, 2) + pupil(128, -5, 2);
    case 'focus': // 한쪽 눈 감고 촬영
      return eye(92) + pupil(92, 5, 2) +
        `<path d="M116 112L140 112" stroke="${n}" stroke-width="5" stroke-linecap="round"/>`;
    default:
      return eye(92) + eye(128) + pupil(92) + pupil(128);
  }
}
function capSvg(capText, capColor = C.green, brimColor = C.blue) {
  const n = C.navy;
  return `
    <path d="M150 80C176 69 206 72 216 87C196 95 166 93 146 91Z" fill="${brimColor}" stroke="${n}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M52 88C50 34 170 32 168 88C140 77 80 77 52 88Z" fill="${capColor}" stroke="${n}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M110 40C100 52 96 68 96 80" fill="none" stroke="${n}" stroke-width="2.5" opacity=".5"/>
    <circle cx="110" cy="38" r="5" fill="${n}"/>
    ${capText ? `<text x="112" y="70" text-anchor="middle" font-family="'Black Han Sans','Arial Black',sans-serif" font-size="16" fill="${n}" transform="rotate(-5 112 66)" letter-spacing="1">${capText}</text>` : ''}`;
}
function legsSvg(walk = true) {
  const n = C.navy;
  const shoe = (x, y, r = 0) => `
    <g transform="rotate(${r} ${x} ${y})">
      <path d="M${x - 17} ${y + 4}C${x - 17} ${y - 10} ${x + 12} ${y - 12} ${x + 18} ${y + 2}Z" fill="${C.blue}" stroke="${n}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M${x - 18} ${y + 4}L${x + 19} ${y + 3}" stroke="${n}" stroke-width="4" stroke-linecap="round"/>
      <path d="M${x - 18} ${y + 7}L${x + 19} ${y + 6}" stroke="${C.white}" stroke-width="3" stroke-linecap="round"/>
    </g>`;
  if (walk) {
    return `<path d="M100 186L86 226" stroke="${n}" stroke-width="5" stroke-linecap="round"/>
      <path d="M120 186L138 222" stroke="${n}" stroke-width="5" stroke-linecap="round"/>
      ${shoe(80, 229, -8)}${shoe(144, 224, 12)}`;
  }
  return `<path d="M102 188L98 226" stroke="${n}" stroke-width="5" stroke-linecap="round"/>
    <path d="M118 188L122 226" stroke="${n}" stroke-width="5" stroke-linecap="round"/>
    ${shoe(92, 229)}${shoe(130, 229)}`;
}
function hand(x, y, color = C.pink) {
  return `<circle cx="${x}" cy="${y}" r="9.5" fill="${color}" stroke="${C.navy}" stroke-width="4"/>`;
}
function propSvg(prop, opts) {
  const n = C.navy;
  switch (prop) {
    case 'camera':
      return `
        <rect x="140" y="121" width="20" height="12" rx="3" fill="${n}"/>
        <rect x="126" y="129" width="62" height="44" rx="9" fill="${n}"/>
        <rect x="174" y="135" width="9" height="6" rx="2" fill="${C.green}"/>
        <circle cx="156" cy="151" r="15" fill="${C.blue}" stroke="${C.white}" stroke-width="4"/>
        <circle cx="156" cy="151" r="6" fill="${n}"/>
        <circle cx="152" cy="147" r="2.5" fill="${C.white}"/>
        ${hand(128, 163)}${hand(186, 158)}`;
    case 'sign':
      return `
        <path d="M188 214L188 120" stroke="${n}" stroke-width="5" stroke-linecap="round"/>
        <g transform="rotate(-6 190 100)">
          <rect x="146" y="78" width="90" height="44" rx="6" fill="${C.green}" stroke="${n}" stroke-width="5"/>
          <text x="191" y="110" text-anchor="middle" font-family="'Black Han Sans','Arial Black',sans-serif" font-size="25" fill="${n}">${opts.signText || 'OPEN!'}</text>
        </g>
        ${hand(182, 160)}${hand(194, 176)}`;
    case 'wave':
      return `
        <path d="M58 132C46 122 38 108 36 92" fill="none" stroke="${n}" stroke-width="5" stroke-linecap="round"/>
        ${hand(36, 86)}
        <path d="M14 70L24 76M18 52L28 62M34 44L36 58" stroke="${n}" stroke-width="4" stroke-linecap="round"/>`;
    case 'phone':
      return `
        <rect x="146" y="120" width="32" height="54" rx="7" fill="${n}" transform="rotate(10 162 147)"/>
        <rect x="151" y="127" width="22" height="36" rx="3" fill="${C.green}" transform="rotate(10 162 147)"/>
        ${hand(152, 166)}`;
    default:
      return '';
  }
}
function motionSvg() {
  const n = C.navy;
  return `<path d="M30 118L12 112M34 136L10 136M30 154L14 160" stroke="${n}" stroke-width="4" stroke-linecap="round"/>`;
}
function sparkSvg() {
  return `<path d="M196 42L210 30M204 58L224 54M190 30L192 12" stroke="${C.green}" stroke-width="6" stroke-linecap="round"/>`;
}
/**
 * 마스코트
 * opts: eyes(normal|wink|happy|look|focus), prop(camera|sign|wave|phone|none),
 *       legs(true/false), walk(true/false), cap(true/false), capText, motion, spark,
 *       body(색), peek(true면 벽 위로 빼꼼), width
 */
function mascot(opts = {}) {
  const o = Object.assign({ eyes: 'normal', prop: 'camera', legs: true, walk: true, cap: true, capText: 'OPEN', motion: false, spark: false, body: C.pink, peek: false }, opts);
  const n = C.navy;
  const grain = uid('g');
  const clip = uid('c');
  const face = `
    <path d="${BODY}" fill="${o.body}" stroke="${n}" stroke-width="5" stroke-linejoin="round"/>
    <path d="${BODY}" fill="url(#${grain})" opacity=".35"/>
    <ellipse cx="76" cy="84" rx="9" ry="17" fill="${C.white}" opacity=".45" transform="rotate(25 76 84)"/>
    ${eyesSvg(o.eyes)}
    <ellipse cx="76" cy="138" rx="9" ry="5.5" fill="${C.pinkDeep}" opacity=".75"/>
    <ellipse cx="144" cy="138" rx="9" ry="5.5" fill="${C.pinkDeep}" opacity=".75"/>
    ${o.eyes === 'happy'
      ? `<path d="M98 138Q110 156 122 138Z" fill="${n}"/>`
      : `<path d="M101 140Q110 149 119 140" fill="none" stroke="${n}" stroke-width="4" stroke-linecap="round"/>`}
    ${o.cap ? capSvg(o.capText) : ''}`;
  const defs = `<defs>
    <pattern id="${grain}" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1" fill="${C.navy}" opacity=".35"/><circle cx="4.5" cy="4.5" r=".8" fill="${C.white}" opacity=".5"/>
    </pattern>
    <clipPath id="${clip}"><rect x="0" y="0" width="240" height="166"/></clipPath>
  </defs>`;
  if (o.peek) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 10 240 180" ${o.width ? `width="${o.width}"` : ''}>${defs}
      <g clip-path="url(#${clip})">${face}</g>
      <path d="M8 166L232 166" stroke="${n}" stroke-width="6" stroke-linecap="round"/>
      ${hand(74, 164)}${hand(146, 164)}
      ${o.spark ? sparkSvg() : ''}
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 250" ${o.width ? `width="${o.width}"` : ''}>${defs}
    ${o.motion ? motionSvg() : ''}
    ${o.spark ? sparkSvg() : ''}
    ${o.legs ? legsSvg(o.walk) : ''}
    ${face}
    ${propSvg(o.prop, o)}
  </svg>`;
}
/** 지도 위 상태 핀 (작은 얼굴 핀). status: before|open|closed|holiday|shut|checking|unknown */
function statusPin(status, size = 44) {
  const s = STATUS[status] || STATUS.unknown;
  const n = C.navy;
  const sleepy = status === 'closed' || status === 'holiday';
  const wide = `<ellipse cx="92" cy="110" rx="14" ry="18" fill="#fff" stroke="${n}" stroke-width="5"/><ellipse cx="128" cy="110" rx="14" ry="18" fill="#fff" stroke="${n}" stroke-width="5"/><circle cx="96" cy="114" r="8" fill="${n}"/><circle cx="132" cy="114" r="8" fill="${n}"/>`;
  const dots = `<circle cx="92" cy="112" r="7" fill="${n}"/><circle cx="128" cy="112" r="7" fill="${n}"/>`;
  const xeyes = `<path d="M80 100L104 124M104 100L80 124M116 100L140 124M140 100L116 124" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`;
  const eyes = sleepy
    ? `<path d="M78 112Q92 122 106 112M114 112Q128 122 142 112" fill="none" stroke="${n}" stroke-width="6" stroke-linecap="round"/>`
    : status === 'shut' ? xeyes
    : (status === 'checking' || status === 'unknown') ? dots
    : wide;
  const extra = status === 'before'
    ? `<circle cx="160" cy="48" r="20" fill="#fff" stroke="${n}" stroke-width="5"/><path d="M160 36L160 49L169 54" fill="none" stroke="${n}" stroke-width="5" stroke-linecap="round"/>`
    : status === 'checking'
      ? `<text x="160" y="62" text-anchor="middle" font-family="'Black Han Sans',sans-serif" font-size="44" fill="${n}">?</text>`
      : status === 'closed' ? `<text x="150" y="58" font-family="'Black Han Sans',sans-serif" font-size="30" fill="${n}">z</text>`
      : status === 'holiday' ? `<circle cx="160" cy="48" r="20" fill="#fff" stroke="${n}" stroke-width="5"/><text x="160" y="58" text-anchor="middle" font-family="'Black Han Sans',sans-serif" font-size="25" fill="${C.red}">휴</text>`
      : '';
  const mouth = status === 'open' ? `<path d="M100 140Q110 150 120 140" fill="none" stroke="${n}" stroke-width="5" stroke-linecap="round"/>`
    : status === 'shut' ? `<path d="M100 148Q110 138 120 148" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 22 160 194" width="${size}" height="${Math.round(size * 1.2)}" aria-label="${s.label}">
    <path d="${BODY}" fill="${s.color}" stroke="${n}" stroke-width="7" stroke-linejoin="round"/>
    ${eyes}${mouth}${extra}
  </svg>`;
}
/** 워드마크. variant: color | navy | white */
function wordmark(variant = 'color', opts = {}) {
  const ji = variant === 'color' ? C.pink : variant === 'white' ? C.white : C.navy;
  const yeol = variant === 'color' ? C.blue : variant === 'white' ? C.white : C.navy;
  const line = variant === 'navy' ? C.navy : C.green;
  const stacked = opts.stacked;
  // Black Han Sans는 큰 크기에서 '었' 같은 겹받침 획이 뭉쳐 보여서 한 단계 얇은 Do Hyeon을 쓴다
  const font = "'Do Hyeon','Black Han Sans','Malgun Gothic',sans-serif";
  if (stacked) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 190" ${opts.width ? `width="${opts.width}"` : ''}>
      <text x="8" y="80" font-family="${font}" font-size="88" fill="${ji}">지금</text>
      <text x="8" y="166" font-family="${font}" font-size="88" fill="${yeol}">열었나요?</text>
      <path d="M14 182C90 170 200 168 286 176" fill="none" stroke="${line}" stroke-width="10" stroke-linecap="round"/>
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 120" ${opts.width ? `width="${opts.width}"` : ''}>
    <text x="6" y="88" font-family="${font}" font-size="96" fill="${ji}">지금</text>
    <text x="196" y="88" font-family="${font}" font-size="96" fill="${yeol}">열었나요?</text>
    <path d="M206 108C300 98 440 96 548 102" fill="none" stroke="${line}" stroke-width="11" stroke-linecap="round"/>
  </svg>`;
}
/** 원형 스티커 배지 */
function badge(opts = {}) {
  const id = uid('arc');
  const top = opts.top || '지금 열었나요?';
  const bottom = opts.bottom || '헛걸음 없는 우리 동네 · 아주대';
  const bg = opts.bg || C.green;
  const font = "'Black Han Sans','Malgun Gothic',sans-serif";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" ${opts.width ? `width="${opts.width}"` : ''}>
    <defs>
      <path id="${id}t" d="M50 150A100 100 0 0 1 250 150"/>
      <path id="${id}b" d="M38 150A112 112 0 0 0 262 150"/>
    </defs>
    <circle cx="150" cy="150" r="142" fill="${bg}" stroke="${C.navy}" stroke-width="6"/>
    <circle cx="150" cy="150" r="128" fill="none" stroke="${C.navy}" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round"/>
    <text font-family="${font}" font-size="34" fill="${C.navy}"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${top}</textPath></text>
    <text font-family="${font}" font-size="17" fill="${C.navy}" letter-spacing="2"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${bottom}</textPath></text>
    <g transform="translate(70 74) scale(.68)">${mascot({ prop: 'camera', motion: false }).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
  </svg>`;
}
/** 앱 아이콘 */
function appIcon(dark = false, size) {
  const bg = dark ? C.navy : C.pink;
  const body = dark ? C.pink : C.pink;
  const inner = mascot({ legs: false, prop: 'none', eyes: dark ? 'wink' : 'normal', body, capText: 'OPEN' }).replace(/<svg[^>]*>|<\/svg>/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" ${size ? `width="${size}" height="${size}"` : ''}>
    <rect width="240" height="240" rx="54" fill="${bg}"/>
    ${dark ? '' : `<rect x="6" y="6" width="228" height="228" rx="50" fill="none" stroke="${C.navy}" stroke-width="5"/>`}
    <g transform="translate(17 20) scale(.92)">${inner}</g>
  </svg>`;
}
/** 가로 로고 (마스코트 + 워드마크) */
function lockup(variant = 'color', width) {
  const m = mascot({ prop: 'camera', motion: true, spark: true }).replace(/<svg[^>]*>|<\/svg>/g, '');
  const w = wordmark(variant).replace(/<svg[^>]*>|<\/svg>/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 250" ${width ? `width="${width}"` : ''}>
    <g>${m}</g>
    <g transform="translate(220 60)">${w}</g>
  </svg>`;
}
window.Brand = { C, STATUS, mascot, statusPin, wordmark, badge, appIcon, lockup };
})();
