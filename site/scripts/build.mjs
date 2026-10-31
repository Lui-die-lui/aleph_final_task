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
  html.replace(/(\d{4}년\s\d{1,2}월(?:\s\d{1,2}일)?|\d{1,2}월\s\d{1,2}일)/g, '<strong class="date">$1</strong>');
const dot = (iso) => iso.replaceAll("-", ".");
const kb = (p) => `${Math.round(statSync(p).size / 1024)}KB`;

function fail(msg) {
  console.error(`빌드 중단: ${msg}`);
  process.exit(1);
}

// ------------------------------------------------------------ 안전 확인
const docs = Object.entries(decisions.documents ?? {}).filter(([k]) => !k.startsWith("_"));
for (const [, d] of docs) {
  const onDisk = existsSync(join(ROOT, "static", d.file));
  if (d.published && !onDisk) fail(`${d.label}: published=true 인데 static/${d.file} 파일이 없습니다. documents 폴더에서 node build_docs.mjs를 실행하세요.`);
  if (!d.published && onDisk) fail(`${d.label}: 비공개(published=false)인데 static/${d.file} 이 있어 공개될 수 있습니다.`);
}
const contact = decisions.contact;
if (contact.value && !isFinal(contact)) fail("연락 수단은 status를 \"확정\"으로 바꾼 뒤에만 넣을 수 있습니다.");

// ------------------------------------------------------------ 조각
const hero = decisions.heroLine;
const first = decisions.storyFirstSentence;
const last = decisions.storyLastSentence;
const pairing = decisions.hardshipNumberPairing;
const role = decisions.targetRole;
const roleLine = role.candidates[role.selected];
const anyDraft = [hero, first, last, pairing, contact, role, decisions.siteStory].some((x) => !isFinal(x));

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
  ["documents", "04", "이력서"],
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
      <p class="about__interest"><strong>지원 방향</strong> ${esc(roleLine)}</p>
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

// 능력 이름은 story.md 원문 그대로 두고, 사이트에는 author-decisions.json의 표시 이름으로 보여 준다.
const siteStory = decisions.siteStory;
const abilityLabel = (a) => siteStory.abilityLabels[a] ?? fail(`siteStory.abilityLabels에 "${a}" 표시 이름이 없습니다.`);

// 사이트에 보일 때 과정 내부 용어를 바꾼다.
const siteWording = [
  ["ALEPH 과정의 첫 리추얼 기록", "AI 보안·네트워크 실무 교육의 첫 기록"],
  ["AX 인프라와 보안을 배우는 중입니다", "AI 보안과 네트워크를 배우는 중입니다"],
];
const forSite = (text) => siteWording.reduce((t, [from, to]) => t.replaceAll(from, to), text);

const chapterBlocks = story.chapters
  .map((ch, i) => {
    const isLast = i === story.chapters.length - 1;
    const paras = ch.paragraphs
      .map((p) => `<p>${markDates(esc(forSite(p.text)))}</p>`)
      .join("\n");
    // 능력 태그는 문단마다 붙이지 않고 챕터 머리에 한 번씩만 보여 준다.
    const hidden = siteStory.hiddenLabels?.[i + 1] ?? [];
    const tags = [...new Set(ch.paragraphs.flatMap((p) => p.abilities))].filter((a) => !hidden.includes(a)).map((a) => `<span class="tag">${esc(abilityLabel(a))}</span>`).join("");
    return `
<section class="chapter" aria-labelledby="ch-${i + 1}">
    <header class="chapter__head">
      <span class="chapter__num">${String(i + 1).padStart(2, "0")}</span>
      <p class="eyebrow">${esc(ch.kicker)}</p>
      <h2 id="ch-${i + 1}" class="chapter__title">${esc(ch.title)}</h2>
      ${tags ? `<p class="tags">${tags}</p>` : ""}
    </header>
    <div class="chapter__body">
      ${paras}
      ${isLast ? `<p class="chapter__last">${esc(last.text)}</p>` : ""}
    </div>
</section>`;
  })
  .join("\n");

const storyOpenCard = `
<section class="card card--story-open" aria-labelledby="story-title">
  <div class="story-open">
    <p class="eyebrow" id="story-title">Story · 이야기</p>
    <p class="story-open__first">${esc(siteStory.title)}</p>
    <p class="story-open__intro">음악을 공부하며 익힌 집중과 반복은 저를 앞으로 움직이게 했지만, 모든 일을 같은 힘으로 붙잡을 수는 없었습니다. 무엇을 계속하고 무엇을 덜어낼지 판단하며 다른 길을 배우기 시작했습니다.</p>
    <ol class="abilities" aria-label="이야기에서 드러나는 세 강점">
      ${abilityLegend.map(([n, name, line]) => `<li><span class="num">${n}</span><strong>${esc(abilityLabel(name))}</strong><span>${line}</span></li>`).join("")}
    </ol>
    <details class="story-more">
      <summary><span class="story-more__open">전체 이야기 읽기</span><span class="story-more__close">이야기 접기</span></summary>
      ${chapterBlocks}
    </details>
  </div>
</section>`;

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
  const period = !m.period ? "기간 미정" : m.period.start ? `${dot(m.period.start)}–${dot(m.period.end)}` : `${dot(m.period.end)} 확인 기준`;
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

// 달력·리추얼·출석·과제 카드는 채용용 화면에서 끈다. records.json과 updater는 그대로 둔다.
const SHOW_COURSE_RECORDS = false;
const courseRecords = `
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
      <p class="note">출석·과제 제출 수치는 리추얼 기록으로 추정하지 않고 각 원본에서 셉니다. 모든 숫자는 기록 갱신 장치가 원본에서 다시 계산합니다.</p>`;

// 프로젝트 근거 숫자: profile.json에서 계산한다.
const allProjects = [...profile.featured, ...profile.works];
const isTeam = (w) => w.kind.startsWith("팀");
const isDeployed = (w) => w.href && !/^https:\/\/github\.com\//.test(w.href);
const teamCount = allProjects.filter(isTeam).length;
const proofs = [
  { label: "직접 배포한 서비스", value: `${allProjects.filter(isDeployed).length}개`, def: "공개 주소로 지금 열어 볼 수 있는 서비스" },
  { label: "진행한 프로젝트", value: `${allProjects.length}개`, def: `개인 ${allProjects.length - teamCount} · 팀 ${teamCount}` },
  { label: "CI/CD 구축", value: `${profile.cicdProjects.length}건`, def: `${profile.cicdProjects.join(", ")} · GitHub Actions → EC2 자동 배포` },
  { label: "취득 자격", value: `${profile.certifications.length}개`, def: profile.certifications.join(" · ") },
];
const proofHtml = (p) => `
    <li class="metric">
      <span class="metric__label">${esc(p.label)}</span>
      <span class="metric__value">${esc(p.value)}</span>
      <span class="metric__def">${esc(p.def)}</span>
    </li>`;

const skillsTable = `
      <dl class="skills" aria-label="기술 스택">
        ${profile.stack.map((s) => `<div><dt>${esc(s.area)}</dt><dd>${esc(s.items)}</dd></div>`).join("")}
      </dl>`;

const muzin = profile.featured[0];
const nextlife = profile.featured[1];
const muzinCard = `
      <article class="work">
        <p class="work__kind"><span class="num">01</span> ${esc(muzin.kind)} · ${esc(muzin.period)}</p>
        <h3 class="work__title">${esc(muzin.title)}</h3>
        <div class="work__body">
          <div class="work__desc"><p class="work__subtitle">${esc(muzin.summary)}</p></div>
          <dl class="roles">
            ${muzin.details.map((d) => `<div><dt>${esc(d.label)}</dt><dd>${esc(d.text)}</dd></div>`).join("")}
          </dl>
        </div>
        <div class="actions">
          ${muzin.links.map((l, i) => `<a class="btn${i ? " btn--ghost" : ""}" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗<span class="sr-only"> (새 창)</span></a>`).join("")}
        </div>
      </article>`;

const paperPdf = join(ROOT, "static/files/lee-seulgi-t10-paper.pdf");
if (!existsSync(paperPdf)) fail("static/files/lee-seulgi-t10-paper.pdf 가 없습니다.");

const recordsCard = `
<section class="card card--evidence" aria-labelledby="records-title">
  <div class="evidence">
    <p class="eyebrow">Records · 기록</p>
    <h2 id="records-title" class="section-title">만들고 배포한 기록</h2>
    <div class="evidence__cols">
      ${SHOW_COURSE_RECORDS ? courseRecords : `<ul class="metrics metrics--pair">${proofs.map(proofHtml).join("")}</ul>`}
      ${skillsTable}
    </div>
  </div>
</section>`;

const worksCard = `
<section class="card card--evidence" aria-labelledby="works-title">
  <div class="evidence">
    <h2 id="works-title" class="eyebrow">Works · 대표작</h2>
    <div class="works">
${muzinCard}
      <article class="work work--app">
        <p class="work__kind"><span class="num">02</span> 웹 앱 · 다음 생 NextLife</p>
        <h3 class="work__title">분야는 바뀌어도, 경험은 이어집니다</h3>
        <div class="work__body">
        <div class="work__desc">
          <p class="work__subtitle">지금까지의 경험에서 다음 도전에 가져갈 방법을 찾고, 작은 실험으로 확인하는 앱</p>
          <p class="muted small">연구 논문의 연결 단서·구조 비교 논의를 바탕으로 경험을 억지로 잇지 않고 달라서 안 되는 차이까지 적게 설계했으며, 외부 AI용 프롬프트는 만들어 주되 대신 전송하지 않고 앱의 실제 효과는 검증하지 않았다고 화면에 밝혀 둡니다.</p>
        </div>
        <dl class="roles">
          <div><dt>경험</dt><dd>분야를 가리지 않고 해본 일과 풀어낸 방법을 기록</dd></div>
          <div><dt>연결</dt><dd>새 도전과 공통된 목표·장애물·제약, 달라서 안 되는 점을 연결 카드로</dd></div>
          <div><dt>실험</dt><dd>체크리스트와 종료일 알림으로 작게 해 보고, 보고서를 남겨야 마무리</dd></div>
        </dl>
        </div>
        <div class="actions">
          <a class="btn" href="${esc(nextlife.href)}" target="_blank" rel="noopener">앱 열기 ↗<span class="sr-only"> (새 창)</span></a>
          <span class="muted small">Next.js · 로그인 없이 데모 체험</span>
        </div>
        <details class="work__basis">
          <summary>설계 근거 · 연구 논문</summary>
          <dl class="roles">
            <div><dt>Claude Code</dt><dd>검색·중복 제거, 168건 1·2차 선별, 공개 원문 확인과 코딩, 집계 스크립트, 원고 작성과 수정</dd></div>
            <div><dt>Codex CLI</dt><dd>원본 수정 권한 없는 읽기 전용 독립 검토 2회</dd></div>
            <div><dt>이슬기</dt><dd>연구 방향 결정, 프로토콜 수정 요청, 핵심 코딩 18행·2차 선별 49건 검토, 결론 수용 판단</dd></div>
          </dl>
          <a class="text-link" href="files/lee-seulgi-t10-paper.pdf" target="_blank" rel="noopener">PDF 보기 ↗<span class="sr-only"> (새 창)</span></a>
        </details>
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

const github = profile.links.find((l) => l.label === "GitHub");

const docsCard = `
<section class="card card--docs" aria-labelledby="documents-title">
  <div class="docs">
    <p class="eyebrow">Documents · 문서와 연락</p>
    <h2 id="documents-title" class="section-title">함께 일할 때 필요한 정보는<br>문서로 정리했습니다.</h2>
    <ul class="doc-list">${docs
      .map(([, d]) =>
        d.published
          ? `<li><a class="doc" href="${esc(d.file)}" download="${esc(d.downloadName ?? "")}"><span>${esc(d.label)}</span><span class="doc__meta">DOCX 다운로드 · ${kb(join(ROOT, "static", d.file))}</span></a></li>`
          : `<li><span class="doc doc--pending" aria-disabled="true"><span>${esc(d.label)}</span><span class="doc__meta">준비 중</span></span></li>`
      )
      .join("")}</ul>
    <div class="contact">
      <span class="contact__item"><span class="contact__label">${esc(contact.label ?? "연락")}</span>${contactHtml}</span>
      <span class="contact__item"><span class="contact__label">GitHub</span><a class="contact__value" href="${esc(github.href)}" target="_blank" rel="noopener">${esc(github.href.replace("https://", ""))} ↗<span class="sr-only"> (새 창)</span></a></span>
    </div>
    <div class="past-works">
      <p class="past-works__label">지나온 작업</p>
      <ul>
        ${profile.works.filter((w) => w.listed !== false).map((w) => {
          // 링크 종류를 주소로 구분해 밝힌다: GitHub 저장소 / 배포된 사이트
          const body = `<span class="past-works__name">${esc(w.name)}</span><span class="past-works__meta">${esc(w.kind)} · ${esc(w.period)}</span><span class="past-works__summary">${esc(w.summary)}</span>${w.role ? `<span class="past-works__role">${esc(w.role)}</span>` : ""}`;
          // 공개 링크가 없는 작업(진행 중인 팀 프로젝트 등)은 링크 없이 보여 준다.
          if (!w.href) return `<li><div class="past-works__item">${body}<span class="past-works__link past-works__link--none">${esc(w.noLink ?? "공개 링크 없음")}</span></div></li>`;
          const linkType = w.linkLabel ?? (/^https:\/\/github\.com\//.test(w.href) ? "GitHub 저장소" : "사이트 보기");
          return `<li><a href="${esc(w.href)}" target="_blank" rel="noopener">${body}<span class="past-works__link">${linkType} ↗<span class="sr-only"> (새 창)</span></span></a></li>`;
        }).join("")}
      </ul>
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
<meta name="description" content="${esc(hero.lines.join(" "))} 음악과 웹디자인을 지나 데이터와 개발, AI 보안·네트워크를 배우는 이슬기의 이야기, 기록, 대표작.">
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
<span id="records" class="anchor"></span>
${recordsCard}
<span id="works" class="anchor"></span>
${worksCard}
<span id="documents" class="anchor"></span>
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
