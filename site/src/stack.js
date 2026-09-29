// 카드 넘김: 다음 카드가 아래에서 올라와 이전 카드를 덮도록 CSS sticky를 켠다.
// - 스크롤 방향·휠 동작은 건드리지 않는다(자연스러운 세로 스크롤).
// - 넓은 화면 + 동작 줄이기 설정이 꺼져 있을 때만 켠다. 아니면 일반 세로 문서.
// - 화면보다 긴 카드는 아랫부분까지 모두 읽힌 뒤에 멈추도록 top을 음수로 준다.
(function () {
  var stack = document.querySelector("[data-stack]");
  if (!stack || !window.matchMedia) return;
  var mq = window.matchMedia("(min-width: 900px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)");
  var cards = Array.prototype.slice.call(stack.querySelectorAll(".card"));

  function layout() {
    if (!mq.matches) {
      stack.classList.remove("is-stacking");
      cards.forEach(function (c) { c.style.removeProperty("--stick-top"); });
      return;
    }
    stack.classList.add("is-stacking");
    var vh = window.innerHeight;
    cards.forEach(function (c) {
      c.style.setProperty("--stick-top", Math.min(0, vh - c.offsetHeight) + "px");
    });
  }

  layout();
  window.addEventListener("resize", layout);
  if (mq.addEventListener) mq.addEventListener("change", layout);
  else if (mq.addListener) mq.addListener(layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  window.addEventListener("load", layout);
})();
