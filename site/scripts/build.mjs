// 정적 사이트 빌드: content/ + data/records.json + static/ → dist/
// 외부 패키지 없이 Node 18+ 로 실행한다.  (npm run build)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseStory, storyPlainText } from "./story.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const decisions = readJson("content/author-decisions.json");
const story = parseStory(join(ROOT, "content/story.md"));
const records = readJson("data/records.json");
const profile = readJson("content/profile.json");

// ------------------------------------------------------------ 유틸
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isFinal = (item) => item && item.status === "확정";
// 문장 속 날짜를 강조한다: 2026년 8월 11일 / 9월 7일
const markDates = (html) =>
  html.replace(/((?:\d{4}년\s)?\d{1,2}월\s\d{1,2}일)/g, '<strong class="date">$1</strong>');
const dot = (iso) => iso.replaceAll("-", ".");
const kb = (p) => `${Math.round(statSync(p).size / 1024)}KB`;

function fail(msg) {
  console.error(`빌드 중단: ${msg}`);
  process.exit(1);
}

// ------------------------------------------------------------ 안전 확인
const contact = decisions.contact;
if (contact.value && !isFinal(contact)) fail("연락 수단은 status를 \"확정\"으로 바꾼 뒤에만 넣을 수 있습니다.");

// ------------------------------------------------------------ 조각
const hero = decisions.heroLine;
const first = decisions.storyFirstSentence;
const last = decisions.storyLastSentence;
const pairing = decisions.hardshipNumberPairing;
const anyDraft = [hero, first, last, pairing, contact].some((x) => !isFinal(x));

const metaBar = `
  <div class="meta-bar" aria-hidden="true">
    <span>2026</span>
    <span>Portfolio of<br>Lee Seulgi</span>
    <span class="meta-bar__right">Data<br>Development<br>AX Infra<br>Security</span>
  </div>`;

const menu = [
  ["story", "01", "이야기"],
  ["records", "02", "기록"],
  ["works", "03", "대표작"],
  ["about", "04", "이력"],
];

const heroCard = `
<section class="card card--hero" aria-labelledby="hero-title">
  ${metaBar}
  <div class="hero">
    <h1 id="hero-title" class="hero__title">${hero.lines.map((l) => `<span>${esc(l)}</span>`).join("")}</h1>
    <div class="hero__rule" aria-hidden="true"></div>
    <p class="hero__sub">${esc(hero.sub).replace(/\n/g, "<br>")}</p>
    <nav class="hero__menu" aria-label="바로가기">
      <ul>${menu.map(([id, n, label]) => `<li><a href="#${id}"><span class="num">${n}</span>${label}</a></li>`).join("")}</ul>
    </nav>
  </div>
</section>`;

const aboutCard = `
<section class="card card--about" aria-labelledby="about-title">
  <div class="about">
    <figure class="about__photo">
      <img src="images/lee-seulgi.jpg" width="900" height="1125" alt="이슬기 증명사진" loading="lazy" decoding="async">
    </figure>
    <div class="about__text">
      <p class="eyebrow">About</p>
      <h2 id="about-title" class="about__name">이슬기</h2>
      <p class="about__lead">${esc(profile.lead)}</p>
      <p>새로운 분야를 만날 때 먼저 기준을 이해하고, 문제를 정리한 다음, 작동하는 결과물로 확인합니다.</p>
      <ol class="timeline" aria-label="확인된 이력">
        ${profile.timeline.map((t) => `<li><span class="timeline__period">${esc(t.period)}</span><span class="timeline__title">${esc(t.title)}</span><span class="timeline__detail">${esc(t.detail)}</span></li>`).join("")}
      </ol>
      <p class="about__interest"><strong>관심 분야</strong> 데이터 · 개발 · AX 인프라 · 보안 <span class="muted">(배우는 중)</span></p>
      <ul class="link-row">
        ${profile.links.map((l) => `<li><a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗<span class="sr-only"> (새 창)</span></a></li>`).join("")}
      </ul>
    </div>
  </div>
</section>`;

const abilityLegend = [
  ["01", "자기조절력", "여러 일이 겹치면 시급성보다 중요도로 우선순위를 다시 정하고, 오래 지속할 수 있는 속도를 지킵니다."],
  ["02", "대인관계력", "구현 전에 화면과 코드의 기준을 먼저 맞추고, 해결한 문제는 원인과 과정을 기록해 팀과 공유합니다."],
  ["03", "자기동기력", "음악에서 디자인, 개발로 영역을 넓혀 왔고, '돌아가는 코드'보다 '이해하고 쓰는 코드'를 목표로 배웁니다."],
];

const storyOpenCard = `
<section class="card card--story-open" aria-labelledby="story-title">
  <div class="story-open">
    <p class="eyebrow" id="story-title">Story · 이야기</p>
    <p class="story-open__first">${esc(first.text)}</p>
    <p class="story-open__intro">음악을 공부하며 익힌 집중과 반복은 저를 앞으로 움직이게 했지만, 모든 일을 같은 힘으로 붙잡을 수는 없었습니다. 무엇을 계속하고 무엇을 덜어낼지 판단하며 다른 길을 배우기 시작했습니다.</p>
    <ol class="abilities" aria-label="이야기에서 드러나는 세 능력">
      ${abilityLegend.map(([n, name, line]) => `<li><span class="num">${n}</span><strong>${name}</strong><span>${line}</span></li>`).join("")}
    </ol>
  </div>
</section>`;

const chapterCards = story.chapters
  .map((ch, i) => {
    const isLast = i === story.chapters.length - 1;
    const paras = ch.paragraphs
      .map((p) => {
        const tags = p.abilities.map((a) => `<span class="tag">${esc(a)}</span>`).join("");
        return `<p>${tags ? `<span class="tags">${tags}</span>` : ""}${markDates(esc(p.text))}</p>`;
      })
      .join("\n");
    return `
<section class="card card--chapter" aria-labelledby="ch-${i + 1}">
  <div class="chapter">
    <header class="chapter__head">
      <span class="chapter__num">${String(i + 1).padStart(2, "0")}</span>
      <p class="eyebrow">${esc(ch.kicker)}</p>
      <h2 id="ch-${i + 1}" class="chapter__title">${esc(ch.title)}</h2>
    </header>
    <div class="chapter__body">
      ${paras}
      ${isLast ? `<p class="chapter__last">${esc(last.text)}</p>` : ""}
    </div>
  </div>
</section>`;
  })
  .join("\n");

// ---- 잔디 달력: 기록 기간의 주(월~일)를 열로, 기록 있는 날만 칠한다.
function calendarHtml(cal) {
  if (!cal.dates.length || !cal.period) {
    return `<p class="empty">리추얼 기록 자료 확인 후 반영</p>`;
  }
  const has = new Set(cal.dates);
  const start = new Date(cal.period.start + "T00:00:00Z");
  const end = new Date(cal.period.end + "T00:00:00Z");
  const monday = new Date(start);
  monday.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const weeks = [];
  for (let w = new Date(monday); w <= end; w.setUTCDate(w.getUTCDate() + 7)) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(w);
      day.setUTCDate(w.getUTCDate() + d);
      const iso = day.toISOString().slice(0, 10);
      const inRange = day >= start && day <= end;
      days.push({ iso, inRange, on: has.has(iso) });
    }
    weeks.push(days);
  }
  const dayNames = ["월", "화", "수", "목", "금", "토", "일"];
  const cols = weeks
    .map((days) => {
      const m = days[0].iso.slice(5, 7);
      const label = `${Number(m)}월 ${Number(days[0].iso.slice(8))}일 주`;
      return `<div class="cal__week" title="${label}">${days
        .map((d) =>
          !d.inRange
            ? `<span class="cal__cell cal__cell--out"></span>`
            : `<span class="cal__cell${d.on ? " cal__cell--on" : ""}" title="${dot(d.iso)}${d.on ? " · 기록 있음" : ""}"></span>`
        )
        .join("")}</div>`;
    })
    .join("");
  const monthMarks = weeks
    .map((days, i) => {
      // 그 달의 첫 월요일이 있는 주(또는 첫 주)에만 달 이름을 붙인다.
      const mondayDay = Number(days[0].iso.slice(8));
      const label = i === 0 || mondayDay <= 7 ? `${Number(days[0].iso.slice(5, 7))}월` : "";
      return `<span>${label}</span>`;
    })
    .join("");
  return `
  <figure class="cal" role="img" aria-label="${dot(cal.period.start)}부터 ${dot(cal.period.end)}까지 리추얼 기록이 있는 날 ${cal.dates.length}일을 칠한 달력">
    <div class="cal__months" aria-hidden="true" style="--weeks:${weeks.length}">${monthMarks}</div>
    <div class="cal__grid" aria-hidden="true">
      <div class="cal__days">${dayNames.map((d) => `<span>${d}</span>`).join("")}</div>
      ${cols}
    </div>
    <figcaption>
      <span class="cal__legend"><span class="cal__cell cal__cell--on"></span>기록 있음</span>
      <span class="cal__legend"><span class="cal__cell"></span>기록 없음</span>
      <span>${esc(cal.note)}</span>
    </figcaption>
  </figure>`;
}

function metricHtml(m) {
  const period = m.period ? `${dot(m.period.start)}–${dot(m.period.end)}` : "기간 미정";
  const pending = m.value === null;
  return `
    <li class="metric${pending ? " metric--pending" : ""}">
      <span class="metric__label">${esc(m.label)}</span>
      <span class="metric__value">${esc(m.display)}</span>
      <span class="metric__def">${esc(m.definition)}</span>
      <span class="metric__src">${esc(period)} · 출처: ${esc(m.source.name)}</span>
    </li>`;
}

const shownMetrics = ["ritual_days", "ritual_weeks", "ritual_practiced_days", "attendance", "submissions"];
const metrics = shownMetrics.map((id) => records.metrics.find((m) => m.id === id)).filter(Boolean);
const approved = records.approved_paragraphs ?? [];

const paperPdf = join(ROOT, "static/files/lee-seulgi-t10-paper.pdf");
if (!existsSync(paperPdf)) fail("static/files/lee-seulgi-t10-paper.pdf 가 없습니다.");

const evidenceCard = `
<section class="card card--evidence" aria-labelledby="records-title">
  <div class="evidence">
    <div class="evidence__records">
      <p class="eyebrow">Records · 기록과 숫자</p>
      <h2 id="records-title" class="section-title">계속했다는 말 대신,<br>남아 있는 기록을 보여드립니다.</h2>
      <div class="records-top">
        ${calendarHtml(records.calendar)}
        <ul class="metrics metrics--stack">${metrics.filter((m) => m.id.startsWith("ritual_")).map(metricHtml).join("")}</ul>
      </div>
      <ul class="metrics metrics--pair">${metrics.filter((m) => !m.id.startsWith("ritual_")).map(metricHtml).join("")}</ul>
      <div class="pairing">
        <p class="pairing__label">고난 장면과 짝지은 숫자 · 리추얼 기록일</p>
        <p>${markDates(esc(pairing.text))}</p>
      </div>
      ${
        approved.length
          ? `<div class="approved"><p class="pairing__label">기록에서 고른 문장</p><ul>${approved
              .map((p) => `<li><span class="tag">${esc(p.ability)}</span><span class="date">${dot(p.date)}</span> ${esc(p.text)} <span class="muted">(출처: ${esc(p.evidence.source)})</span></li>`)
              .join("")}</ul></div>`
          : ""
      }
      <p class="note">출석·과제 제출 수치는 리추얼 기록으로 추정하지 않고 원본 확인 뒤 반영합니다. 모든 숫자는 기록 갱신 장치가 원본에서 다시 계산합니다.</p>
    </div>

    <div class="evidence__works" id="works">
      <p class="eyebrow">Works · 대표작</p>
      <article class="work">
        <p class="work__kind"><span class="num">01</span> 연구 논문 · 2026.09.27</p>
        <h3 class="work__title">다른 분야의 경험은 언제 새 문제로 옮겨지는가</h3>
        <p class="work__subtitle">연결 단서와 실패 양상에 관한 공개 실험 연구의 탐색적 증거 매핑</p>
        <p>이전에 접한 해법을 새 문제에 적용할 때, 명시적 단서나 사례 비교가 해법을 접하기만 한 조건과 어떤 차이를 만드는지 공개 실험 연구를 사전 기준에 따라 정리했습니다.</p>
        <div class="verdict">
          <div><span class="verdict__num">9<small>편</small></span><span>판정 가능한 연구</span></div>
          <div><span class="verdict__num">10<small>편</small></span><span>사전에 정한 판정 기준</span></div>
          <div><span class="verdict__num verdict__num--word">불분명</span><span>최종 판정</span></div>
        </div>
        <p class="muted small">판정 가능한 9편 중 6편은 단서·비교 조건이 높은 방향, 3편은 차이 없음이었지만 기준 편수에 못 미쳐 가설이 입증되었다고 보지 않습니다.</p>
        <dl class="roles">
          <div><dt>Claude Code</dt><dd>검색·중복 제거, 168건 1·2차 선별, 공개 원문 확인과 코딩, 집계 스크립트, 원고 작성과 수정</dd></div>
          <div><dt>Codex CLI</dt><dd>원본 수정 권한 없는 읽기 전용 독립 검토 2회</dd></div>
          <div><dt>이슬기</dt><dd>연구 방향 결정, 프로토콜 수정 요청, 핵심 코딩 18행·2차 선별 49건 검토, 결론 수용 판단</dd></div>
        </dl>
        <div class="actions">
          <a class="btn" href="files/lee-seulgi-t10-paper.pdf" target="_blank" rel="noopener">PDF 보기<span class="sr-only"> (새 창)</span></a>
          <a class="btn btn--ghost" href="files/lee-seulgi-t10-paper.pdf" download="이슬기_다른분야의경험은언제새문제로옮겨지는가.pdf">PDF 다운로드</a>
          <span class="muted small">PDF · 16쪽 · ${kb(paperPdf)}</span>
        </div>
      </article>
      <article class="work work--placeholder" aria-label="13번 앱 자리">
        <p class="work__kind"><span class="num">02</span> 다음 대표작</p>
        <h3 class="work__title">13번 앱</h3>
        <p class="muted">완료 후 공개 예정</p>
      </article>
    </div>
  </div>
</section>`;

const contactHtml =
  contact.value && isFinal(contact)
    ? /^https?:/.test(contact.href)
      ? `<a class="contact__value" href="${esc(contact.href)}" target="_blank" rel="noopener">${esc(contact.value)} ↗<span class="sr-only"> (Gmail 새 창)</span></a>`
      : `<a class="contact__value" href="${esc(contact.href)}">${esc(contact.value)}</a>`
    : `<span class="contact__value contact__value--pending">공개할 연락 수단 확정 후 입력</span>`;

const docsCard = `
<section class="card card--docs" aria-labelledby="contact-title">
  <div class="docs">
    <p class="eyebrow">Works &amp; Contact · 지나온 작업과 연락</p>
    <h2 id="contact-title" class="section-title">지금까지 만든 것들과<br>연락할 곳입니다.</h2>
    <div class="past-works">
      <p class="past-works__label">지나온 작업</p>
      <ul>
        ${profile.works.map((w) => {
          // 링크 종류를 주소로 구분해 밝힌다: GitHub 저장소 / 배포된 사이트
          const body = `<span class="past-works__name">${esc(w.name)}</span><span class="past-works__meta">${esc(w.kind)} · ${esc(w.period)}</span><span class="past-works__summary">${esc(w.summary)}</span>`;
          // 공개 링크가 없는 작업(진행 중인 팀 프로젝트 등)은 링크 없이 보여 준다.
          if (!w.href) return `<li><div class="past-works__item">${body}<span class="past-works__link past-works__link--none">${esc(w.noLink ?? "공개 링크 없음")}</span></div></li>`;
          const linkType = /^https:\/\/github\.com\//.test(w.href) ? "GitHub 저장소" : "사이트 보기";
          return `<li><a href="${esc(w.href)}" target="_blank" rel="noopener">${body}<span class="past-works__link">${linkType} ↗<span class="sr-only"> (새 창)</span></span></a></li>`;
        }).join("")}
      </ul>
    </div>
    <div class="contact">
      <span class="contact__label">${esc(contact.label ?? "연락")}</span>
      ${contactHtml}
    </div>
    <footer class="site-footer">
      <span>© 2026 이슬기</span>
      <a href="#top">처음으로 ↑</a>
    </footer>
  </div>
</section>`;

const plain = storyPlainText(story, first.text, last.text);
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>이슬기 · 포트폴리오</title>
<meta name="description" content="${esc(hero.lines.join(" "))} 음악과 웹디자인을 지나 데이터와 개발, AX 인프라·보안을 배우는 이슬기의 이야기, 기록, 대표작.">
${anyDraft ? '<meta name="robots" content="noindex">' : ""}
<meta name="color-scheme" content="light">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="assets/styles.css">
<script src="assets/stack.js" defer></script>
</head>
<body>
<a class="skip" href="#story">이야기로 건너뛰기</a>
<main class="stack" data-stack>
<span id="top" class="anchor"></span>
${heroCard}
<span id="about" class="anchor"></span>
${aboutCard}
<span id="story" class="anchor"></span>
${storyOpenCard}
${chapterCards}
<span id="records" class="anchor"></span>
${evidenceCard}
<span id="contact" class="anchor"></span>
${docsCard}
</main>
</body>
</html>
`;

// ------------------------------------------------------------ 쓰기
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, "assets"), { recursive: true });
cpSync(join(ROOT, "static"), DIST, { recursive: true });
cpSync(join(ROOT, "src"), join(DIST, "assets"), { recursive: true });
writeFileSync(join(DIST, "index.html"), html);

const files = [];
const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : files.push(join(d, e.name))));
walk(DIST);
console.log(`빌드 완료: dist/ (${files.length}개 파일)`);
console.log(`이야기 분량: ${plain.length}자(공백 포함) / ${plain.replace(/\s/g, "").length}자(공백 제외)`);
console.log(`확정 전 문구: ${anyDraft ? "있음 → 검색 제외(noindex) 유지. author-decisions.json에서 확정하면 해제" : "없음"}`);
