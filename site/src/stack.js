// 카드 넘김: 다음 카드가 아래에서 올라와 이전 카드를 덮도록 CSS sticky를 켠다.
// - 넓은 화면 + 동작 줄이기 설정이 꺼져 있을 때만 켠다. 아니면 일반 세로 문서.
// - 화면보다 긴 카드는 아랫부분까지 모두 읽힌 뒤에 멈추도록 top을 음수로 준다.
// - 카드 안을 읽는 동안은 일반 스크롤. 카드와 카드 사이(다음 카드가 올라오는 구간)에서는
//   휠을 조금 굴리면 다음 카드가 살짝 들리고, 일정 양을 넘기면 끝까지 빠르게 올라온다.
//   덜 굴리고 멈추면 제자리로 돌아간다. 키보드·터치·스크롤바로 구간 중간에 멈춰도 가까운 쪽으로 붙는다.
(function () {
  var stack = document.querySelector("[data-stack]");
  if (!stack || !window.matchMedia) return;
  var mq = window.matchMedia("(min-width: 900px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)");
  var cards = Array.prototype.slice.call(stack.querySelectorAll(".card"));

  var THRESHOLD = 80;   // 이만큼 휠을 굴리면 넘어간다(마우스 휠 한 칸 ≈ 100)
  var on = false;
  var rests = [];       // 카드마다 [다음 카드가 다 덮은 위치, 그 카드를 끝까지 읽은 위치]

  function layout() {
    if (!mq.matches) {
      on = false;
      stop();
      stack.classList.remove("is-stacking");
      cards.forEach(function (c) { c.style.removeProperty("--stick-top"); });
      return;
    }
    on = true;
    stack.classList.add("is-stacking");
    var vh = window.innerHeight;
    cards.forEach(function (c) {
      c.style.setProperty("--stick-top", Math.min(0, vh - c.offsetHeight) + "px");
    });
    measure();
  }

  // sticky라 offsetTop은 붙어 있는 위치를 돌려주므로, 카드 높이를 쌓아 원래 자리를 구한다.
  function measure() {
    var vh = window.innerHeight;
    var y = stack.getBoundingClientRect().top + window.scrollY;
    rests = cards.map(function (c) {
      var start = y;
      y += c.offsetHeight;
      return [start, start + Math.max(0, c.offsetHeight - vh)];
    });
  }

  // 지금 위치에서 dir 방향으로 가면 지나게 되는 카드 사이 구간 번호(없으면 -1)
  function gapAt(y, dir) {
    for (var k = 0; k < rests.length - 1; k++) {
      var a = rests[k][1], b = rests[k + 1][0];
      if (dir > 0 && y >= a - 1 && y < b - 1) return k;
      if (dir < 0 && y > a + 1 && y <= b + 1) return k;
    }
    return -1;
  }
  function gapEnds(k) { return [rests[k][1], rests[k + 1][0]]; }

  function jump(y) { window.scrollTo({ top: y, behavior: "instant" }); }

  // ------------------------------------------------------------ 움직임
  var anim = 0;
  function easeOut(p) { return 1 - Math.pow(1 - p, 4); }
  function glide(to, ms) {
    stop();
    var from = window.scrollY, t0 = 0;
    if (Math.abs(to - from) < 1) return;
    function step(now) {
      if (!t0) t0 = now;
      var p = Math.min(1, (now - t0) / ms);
      jump(from + (to - from) * easeOut(p));
      anim = p < 1 ? requestAnimationFrame(step) : 0;
    }
    anim = requestAnimationFrame(step);
  }
  function stop() {
    if (anim) cancelAnimationFrame(anim);
    anim = 0;
  }

  // ------------------------------------------------------------ 휠: 당겼다가 넘기기
  var pull = null, pullTimer = 0;
  var locked = false, unlockTimer = 0;

  // 넘어간 뒤 트랙패드 관성 스크롤이 다음 카드까지 넘기지 않도록 휠이 잠잠해질 때까지 막는다.
  function lockUntilQuiet() {
    locked = true;
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(function () {
      if (anim) lockUntilQuiet();
      else locked = false;
    }, 220);
  }

  // 당긴 양에 따라 처음엔 잘 따라오다 점점 무거워진다.
  function peek(amount) { return window.innerHeight * 0.16 * (1 - Math.exp(-amount / 150)); }

  function release(go) {
    clearTimeout(pullTimer);
    var ends = gapEnds(pull.k), dir = pull.dir;
    pull = null;
    if (go) {
      glide(dir > 0 ? ends[1] : ends[0], 720);
      lockUntilQuiet();
    } else {
      glide(dir > 0 ? ends[0] : ends[1], 380);
    }
  }

  function onWheel(e) {
    if (!on || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    var d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
    if (!d) return;
    if (locked) { e.preventDefault(); lockUntilQuiet(); return; }
    var dir = d > 0 ? 1 : -1;
    if (pull && pull.dir !== dir) { e.preventDefault(); release(false); return; }
    if (!pull) {
      measure();
      var k = gapAt(window.scrollY, dir);
      if (k < 0) return;
      stop();
      pull = { k: k, dir: dir, from: window.scrollY, amount: 0 };
    }
    e.preventDefault();
    pull.amount += Math.abs(d);
    if (pull.amount >= THRESHOLD) { release(true); return; }
    jump(pull.from + dir * peek(pull.amount));
    clearTimeout(pullTimer);
    pullTimer = setTimeout(function () { release(false); }, 200);
  }

  // ------------------------------------------------------------ 키보드: 사이 구간이면 한 번에 넘기기
  var KEYS = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 };
  function onKey(e) {
    if (!on || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var dir = KEYS[e.key];
    if (!dir) return;
    if (e.key === " " && e.shiftKey) dir = -1;
    measure();
    var k = gapAt(window.scrollY, dir);
    if (k < 0) { stop(); return; }
    e.preventDefault();
    var ends = gapEnds(k);
    glide(dir > 0 ? ends[1] : ends[0], 720);
  }

  // ------------------------------------------------------------ 그 밖의 스크롤: 사이에 멈추면 가까운 쪽으로
  var lastY = window.scrollY, lastDir = 1, idleTimer = 0, touching = false;
  function onScroll() {
    var y = window.scrollY;
    if (y !== lastY) lastDir = y > lastY ? 1 : -1;
    lastY = y;
    if (!on || anim || pull) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(settle, 160);
  }
  function settle() {
    if (!on || anim || pull || touching) return;
    measure();
    var y = window.scrollY, vh = window.innerHeight;
    for (var k = 0; k < rests.length - 1; k++) {
      var ends = gapEnds(k), a = ends[0], b = ends[1];
      if (y <= a + 2 || y >= b - 2) continue;
      var focused = document.activeElement;
      var to;
      if (focused && cards[k + 1].contains(focused)) to = b;
      else if (focused && cards[k].contains(focused)) to = a;
      else if (lastDir > 0) to = y - a > vh * 0.12 ? b : a;
      else to = b - y > vh * 0.12 ? a : b;
      glide(to, 520);
      return;
    }
  }

  layout();
  window.addEventListener("resize", layout);
  if (mq.addEventListener) mq.addEventListener("change", layout);
  else if (mq.addListener) mq.addListener(layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  window.addEventListener("load", layout);

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("touchstart", function () { touching = true; stop(); }, { passive: true });
  window.addEventListener("touchend", function () { touching = false; onScroll(); }, { passive: true });
})();
