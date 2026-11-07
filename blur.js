// ---------- 개인정보 가리기: 얼굴(AI) + 번호판(글자 인식) 자동 모자이크 + 손가락으로 직접 보정 ----------

// --- 얼굴 인식 (MediaPipe, 브라우저에서 실행) ---
const MP_VER = '0.10.14';
let _faceDetector = null;
function getFaceDetector() {
  if (!_faceDetector) {
    _faceDetector = (async () => {
      const { FaceDetector, FilesetResolver } = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/+esm`);
      const files = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/wasm`);
      return FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
        runningMode: 'IMAGE', minDetectionConfidence: 0.4,
      });
    })().catch(e => { _faceDetector = null; throw e; });
  }
  return _faceDetector;
}
function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
// 상자를 비율만큼 키우고 사진 안으로 자른다
function padBox(b, ratio, W, H) {
  const px = b.w * ratio, py = b.h * ratio;
  const x = Math.max(0, b.x - px), y = Math.max(0, b.y - py);
  return { x, y, w: Math.min(W - x, b.w + px * 2), h: Math.min(H - y, b.h + py * 2) };
}
async function detectFaces(dataUrl) {
  const [det, img] = await Promise.all([getFaceDetector(), loadImage(dataUrl)]);
  const W = img.naturalWidth, H = img.naturalHeight;
  return det.detect(img).detections.map(d => {
    const b = d.boundingBox;
    return padBox({ x: b.originX, y: b.originY, w: b.width, h: b.height }, 0.3, W, H);
  });
}

// --- 번호판: 글자 인식 결과에서 번호판 모양(예: 12가 3456)이 있는 줄을 찾는다 ---
const PLATE_RE = /\d{2,3}[가-힣]\d{4}/;
function findPlates(ocr, W, H) {
  return (ocr.lines || [])
    .filter(l => PLATE_RE.test((l.text || '').replace(/\s+/g, '')))
    .map(l => padBox({ x: l.bbox.x0, y: l.bbox.y0, w: l.bbox.x1 - l.bbox.x0, h: l.bbox.y1 - l.bbox.y0 }, 0.15, W, H));
}

// --- 가리기 화면 ---
function blurSummary() {
  const a = R.auto;
  if (a.state === 'working') return '🤖 AI가 얼굴과 번호판을 찾는 중이에요… (처음에는 몇 초 걸려요)';
  const parts = [];
  parts.push(a.faces === null ? '얼굴 자동 인식을 쓸 수 없었어요' : `얼굴 ${a.faces}곳`);
  parts.push(a.plates === null ? '번호판 인식을 쓸 수 없었어요' : `번호판 ${a.plates}곳`);
  const ok = a.faces !== null && a.plates !== null;
  return `🤖 ${ok ? parts.join(', ') + '을 가렸어요.' : parts.join(', ') + '. 직접 가려 주세요.'}`;
}
function renderBlur() {
  const working = R.auto.state === 'working';
  frame('개인정보 가리기', `
    <p class="ai ${working ? 'reading' : 'ok'}" style="margin:0 0 12px">${blurSummary()}</p>
    <div class="blurwrap"><canvas id="bl"></canvas></div>
    <p class="sub" style="margin-top:8px">놓친 얼굴이나 번호판은 손가락으로 칠해서 가려 주세요.</p>
    <button class="btn" id="bl-done" ${working ? 'disabled style="opacity:.5"' : ''}>다음</button>
    <button class="btn ghost small" id="bl-clear">직접 칠한 것 지우기</button>`);
  document.getElementById('bl-clear').onclick = () => { R.strokes = []; setupBlurCanvas(); };
  document.getElementById('bl-done').onclick = () => {
    if (!R.blur) return;
    R.photo = R.blur.c.toDataURL('image/jpeg', 0.75);
    go('status');
  };
  setupBlurCanvas();
}
async function setupBlurCanvas() {
  const token = R;
  const img = await loadImage(R.original);
  const c = document.getElementById('bl');
  if (R !== token || !c) return;
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');

  // 모자이크 전체 버전을 한 번 만들어 두고, 가릴 곳만 오려 붙인다
  const block = Math.max(12, Math.round(c.width / 32));
  const small = document.createElement('canvas');
  small.width = Math.ceil(c.width / block); small.height = Math.ceil(c.height / block);
  small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
  const mosaic = document.createElement('canvas');
  mosaic.width = c.width; mosaic.height = c.height;
  const mg = mosaic.getContext('2d');
  mg.imageSmoothingEnabled = false;
  mg.drawImage(small, 0, 0, small.width, small.height, 0, 0, c.width, c.height);

  g.drawImage(img, 0, 0);
  const cover = shape => { g.save(); g.beginPath(); shape(); g.clip(); g.drawImage(mosaic, 0, 0); g.restore(); };
  const rect = r => cover(() => g.rect(r.x, r.y, r.w, r.h));
  const dot = p => cover(() => g.arc(p.x, p.y, p.r, 0, Math.PI * 2));
  (R.regions || []).forEach(rect);
  (R.strokes || []).forEach(dot);
  R.blur = { c };

  // 손가락으로 칠하기
  c.style.touchAction = 'none';
  let drawing = false;
  const paint = e => {
    const b = c.getBoundingClientRect(), k = c.width / b.width;
    const p = { x: (e.clientX - b.left) * k, y: (e.clientY - b.top) * k, r: 24 * k };
    R.strokes.push(p); dot(p);
  };
  c.onpointerdown = e => { drawing = true; c.setPointerCapture(e.pointerId); paint(e); };
  c.onpointermove = e => { if (drawing) paint(e); };
  c.onpointerup = c.onpointercancel = () => { drawing = false; };
}
