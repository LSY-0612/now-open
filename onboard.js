// ---------- 처음 사용 안내 (첫 접속 때 한 번, '내 활동'에서 다시 볼 수 있음) ----------
// 브랜드 디자인에서는 마스코트 '여리'가, 기본 디자인에서는 이모지가 한 장씩 안내한다
const SEEN_KEY = 'nowopen.seen';
const GUIDE = [
  { icon: '🗺️', m: { prop: 'camera', motion: true },
    title: '지도에서 영업 상태 확인', brandTitle: '지금 열었나요?',
    text: '핀 색과 표정으로 영업 상태를 한눈에 확인해요.\n영업 전 · 영업 중 · 영업 종료 · 휴무 · 폐업' },
  { icon: '📸', m: { prop: 'camera', walk: false, eyes: 'focus', spark: true },
    title: '현장에서 사진으로 제보', brandTitle: '찰칵! 현장에서 제보',
    text: '지도와 다르면 가게 앞에서 사진을 찍어 알려 주세요.\nAI가 안내문을 확인하고, 얼굴과 번호판은 자동으로 가려요.' },
  { icon: '🏅', m: { prop: 'sign', walk: false, eyes: 'happy' },
    title: '제보하고 포인트 받기', brandTitle: '제보하고 포인트 받기',
    text: '제보할 때마다 포인트와 배지를 받아요.\n허위 제보는 바로 삭제되고 페널티가 부과돼요.' },
];

function showOnboarding() {
  let i = 0;
  const o = document.createElement('div');
  o.className = 'onboard';
  document.getElementById('app').appendChild(o);

  const finish = () => { localStorage.setItem(SEEN_KEY, '1'); o.remove(); };
  const draw = () => {
    const g = GUIDE[i], last = i === GUIDE.length - 1, brand = theme() === 'brand';
    o.innerHTML = `
      <button class="ob-skip">${last ? '' : '건너뛰기'}</button>
      <div class="ob-body">
        ${brand ? `<div class="ob-m">${Brand.mascot(g.m)}</div>` : `<div class="ob-icon">${g.icon}</div>`}
        <h2>${brand ? g.brandTitle : g.title}</h2>
        <p>${g.text.replace(/\n/g, '<br>')}</p>
      </div>
      <div class="ob-dots">${GUIDE.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <button class="ob-next">${last ? '시작하기' : '다음'}</button>`;
    o.querySelector('.ob-skip').onclick = finish;
    o.querySelector('.ob-next').onclick = () => (last ? finish() : (i++, draw()));
  };
  draw();
}

if (!localStorage.getItem(SEEN_KEY)) showOnboarding();
