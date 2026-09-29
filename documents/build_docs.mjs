// 이력서·자기소개서·경력기술서 DOCX 생성
// 자기소개서 본문은 사이트와 같은 파일(../site/content/story.md, author-decisions.json)을 읽는다.
// 확인되지 않은 정보는 추측하지 않고 문서에 쓰지 않는다. 남은 확인 항목은 확인필요목록.md에 모은다.
// 생성한 DOCX는 사이트 다운로드용으로 ../site/static/files/ 에도 복사한다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, LevelFormat, Packer, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { parseStory, storyPlainText } from "../site/scripts/story.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..", "site");
const OUT = join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const decisions = JSON.parse(readFileSync(join(SITE, "content/author-decisions.json"), "utf8"));
const story = parseStory(join(SITE, "content/story.md"));
const final = (x) => x && x.status === "확정";
const contactText = final(decisions.contact) && decisions.contact.value
  ? `${decisions.contact.label}: ${decisions.contact.value}`
  : "[확인 필요 #1] 공개 연락 수단 (본인 확정 후 기입)";
const heroLine = decisions.heroLine.lines.join(" ").replace(/\s+/g, " ");

// ------------------------------------------------------------ 스타일
const FONT = "Malgun Gothic";
const INK = "111111";
const MUTED = "6D6D6A";
const PAGE_W = 11906; // A4
const MARGIN = 1134; // 2cm
const CONTENT_W = PAGE_W - MARGIN * 2;

const styles = {
  default: { document: { run: { font: FONT, size: 20, color: INK }, paragraph: { spacing: { line: 320, after: 80 } } } },
  paragraphStyles: [
    { id: "Title", name: "Title", basedOn: "Normal", run: { size: 40, bold: true }, paragraph: { spacing: { after: 120 } } },
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 24, bold: true }, paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 0,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: INK, space: 4 } } } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 21, bold: true }, paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 1 } },
  ],
};
const numbering = {
  config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 400, hanging: 240 } } } }] }],
};

const p = (text, opts = {}) => new Paragraph({ ...opts, children: runs(text, opts.run) });
const muted = (text) => new Paragraph({ children: [new TextRun({ text, color: MUTED, size: 18 })] });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const bullet = (text) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: runs(text) });
// "[확인 필요 …]" 부분은 회색 기울임으로 보여 준다.
function runs(text, base = {}) {
  return String(text).split(/(\[확인 필요[^\]]*\])/).filter(Boolean).map((part) =>
    part.startsWith("[확인 필요")
      ? new TextRun({ text: part, italics: true, color: "9A4B00", ...base })
      : new TextRun({ text: part, ...base }));
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(columnWidths, rows, { header = true } = {}) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths,
    rows: rows.map((cells, r) => new TableRow({
      tableHeader: header && r === 0,
      children: cells.map((c, i) => new TableCell({
        borders,
        width: { size: columnWidths[i], type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        shading: header && r === 0 ? { fill: "EFEFEC", type: ShadingType.CLEAR, color: "auto" } : undefined,
        children: String(c).split("\n").map((line) => new Paragraph({
          spacing: { after: 40, line: 280 },
          children: runs(line, header && r === 0 ? { bold: true, size: 18 } : { size: 18 }),
        })),
      })),
    })),
  });
}

function doc(title, children) {
  return new Document({
    creator: "이슬기",
    title,
    styles,
    numbering,
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `이슬기 · ${title} · `, size: 16, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED })] })] }) },
      children,
    }],
  });
}

const draftNote = [decisions.heroLine, decisions.storyFirstSentence, decisions.storyLastSentence].some((x) => !final(x))
  ? [muted("※ 한 줄 소개·첫 문장·마지막 문장은 본인 확정 전 후보 문구입니다. 확정 후 다시 생성하세요.")]
  : [];

// ------------------------------------------------------------ 과제 목록 (경력기술서·이력서 공용)
// 근거: 본인 이력서(저장소 제외), 기존 포트폴리오(seulgi-portfolio-henna.vercel.app)의 Dev/Projects, 각 과제 폴더의 README·CHECK·SUBMISSION,
//       이전 LaTeX 경력기술서(본인 제공, GOING·연락처 제외), 10번 논문 README, 리추얼 기록
const tasks = [
  {
    id: "실무", name: "자사몰 운영 및 웹디자인 실무 (인더슈)", period: "2023.02 ~ 2024.12",
    ability: "대인관계력",
    stack: "Photoshop, Illustrator, Figma, CAFE24, EZAdmin",
    situation: "디자인과 운영을 함께 맡아 자사몰과 여러 오픈마켓을 동시에 관리해야 했고, HTML을 아는 사람이 거의 없어 이미지 삽입 위주로 자사몰과 파일이 비효율적으로 관리되고 있었다.",
    action: "CAFE24·EZAdmin 기반으로 자사몰을 운영하며 의류·슈즈 상세 페이지와 메인·프로모션 배너를 기획·디자인하고, G마켓·11번가 딜 세팅을 전담했다. 운영 담당자와의 협업과 사용자 경험을 고려해 상세 페이지를 설계했고, 회사 간 사업 추진을 위한 물류 프로세스를 기획해 PPT로 정리했다.",
    result: "디자인 제작부터 상품 운영·프로모션 반영·판매 채널 관리까지 수행했고, 물류 프로세스 정리로 계약 추진에 기여했다. 구조적인 문제는 디자인만으로 풀 수 없다는 한계를 느껴 회사에 다니며 DBMS와 웹 개발 수업을 병행하기 시작했다.",
  },
  {
    id: "팀", name: "RunnersHigh (러닝 기록 공유 플랫폼)", period: "2025.09.01 ~ 2025.10.01 · 팀 4인",
    ability: "자기조절력 · 대인관계력",
    stack: "React, JavaScript, Kakao Maps API, Spring Boot, MyBatis, MySQL",
    situation: "4인 팀이 러닝 기록을 저장하고 피드에 공유하는 플랫폼을 만들어야 했다.",
    action: "카카오맵 API 기반 위치 시각화 피드 화면 구현을 주도하고, 최종 발표를 맡았다. 국비 과정·자격증 공부와 병행하며 잠을 줄여 시간을 쏟았지만, 다른 팀원의 로직을 충분히 이해하지 못해 원인 추적에 오래 걸렸다.",
    result: "프로젝트 완료. 서비스 흐름과 구현 내용을 정리해 최종 발표했다. 이후 문제·원인·해결 과정을 Notion에 정리해 팀과 공유하고, '돌아가는 코드'보다 '이해하고 쓰는 코드'를 목표로 삼았다. Repository: github.com/Zone2Maker/RunnersHigh-readme",
  },
  {
    id: "팀", name: "OMIJOY (공연 통합 플랫폼)", period: "2025.10.29 ~ 2025.12.10 · 팀 5인",
    ability: "대인관계력",
    stack: "React, TypeScript, Zustand, React Query, Java, Spring Boot, MariaDB, Firebase Storage, Figma, Canva",
    situation: "5인 팀이 공연 정보 탐색, 공연장 확인, 예매처 이동, 관심 공연·공연장 저장 기능을 갖춘 플랫폼을 처음부터 구성해야 했다. 프론트엔드 중심으로 참여했다.",
    action: "프로젝트 초기에 파일·라우터 구조를 정리하고 Figma 와이어프레임을 만들어 팀원들과 구현 기준을 공유했다. 공연 favorite·공연장 flag 기능을 서비스 흐름에 맞게 이식·확장하고, 모달 중심이던 지연 저장 방식을 페이지형 상세 화면에서도 동작하게 구현했다. Firebase Storage 프로필 이미지 업로드를 구현하고, 반복되는 상태 로직은 React Query와 커스텀 훅으로 분리했다. 초기·최종 발표 자료를 만들고 초기 발표를 맡았다.",
    result: "프로젝트 완료. 페이지별로 나눠 구현한 같은 기능의 로직이 달라지는 문제를 겪으며, 설계 단계의 사전 합의와 인터페이스 정의가 중요하다는 기준을 얻었다. Repository: github.com/Team-OMIJA",
  },
  {
    id: "개인", name: "MU:ZIN (음악 아티스트 매칭·레슨 플랫폼)", period: "2025.12 ~ 진행 중",
    ability: "자기동기력",
    stack: "React, TypeScript, React Query, Zustand, Java, Spring Boot, Spring Security, JPA, QueryDSL, PostgreSQL",
    situation: "레슨 예약 과정의 정보 비대칭 문제를 개선하려고, 음악 전공자·아티스트를 위한 레슨·매칭 플랫폼(아티스트 인증, 레슨 생성, 타임슬롯 예약, 알림·채팅)을 React + TypeScript 프론트엔드와 Spring Boot 백엔드로 직접 설계·구현했다.",
    action: "반복 규칙 기반 타임슬롯 자동 생성과 OPEN/CLOSED/BOOKED 상태 분리로 예약 충돌을 막았다. QueryDSL로 악기·레슨 스타일·시간 조건을 조합하는 동적 검색을 만들고, 서버 상태는 React Query, UI 상태는 Zustand로 나눴으며, OAuth2·JWT로 일반 사용자와 아티스트 권한을 분리했다.",
    result: "진행 중. 레슨·타임슬롯·예약 도메인을 중심으로 확장 가능한 구조를 설계하고, 공통화 기준을 명확히 해 중복 로직과 사이드이펙트를 줄였다. query key를 도메인별로 관리해 캐시 무효화 흐름을 정리했다. Repository: FE github.com/Lui-die-lui/MU-ZIN_frontend · BE github.com/Lui-die-lui/MU-ZIN_backend",
  },
  {
    id: "개인", name: "개인 학습 프로젝트 (핵심 개념 분리 학습)", period: "2025.12 ~ 진행 중",
    ability: "자기동기력",
    stack: "React, TypeScript, Spring Boot, JPA, PostgreSQL",
    situation: "팀 프로젝트에서 이해하지 못한 채 쓴 코드 때문에 같은 문제를 반복해서 푸는 데 시간을 썼다. 실무 프로젝트에 바로 적용할 수 있을 만큼 핵심 개념을 이해할 필요가 있었다.",
    action: "상태 관리, 인증, 트랜잭션 처리 등 핵심 개념을 분리해 학습하고, 단순 기능 구현이 아니라 '왜 이런 구조가 필요한지'를 정리했다. 학습 중 트러블슈팅과 설계 고민을 기술 블로그와 Notion에 기록했다.",
    result: "정리한 내용을 MU:ZIN의 상태 관리·인증 구조에 다시 적용하고 있다.",
  },
  {
    id: "개인", name: "ODYSSEY PLAN (AI 5년 계획 서비스)", period: "2026.03.20 ~ 2026.03.24",
    ability: "자기동기력",
    stack: "Next.js, TypeScript, Tailwind CSS, Recharts, OpenAI, PostgreSQL, Prisma",
    situation: "AI 인터뷰 응답을 바탕으로 5년 계획과 요약 결과를 만드는 서비스를 개인 프로젝트로 기획했다.",
    action: "인터뷰 응답 수집부터 계획 생성·요약 결과 화면까지 기획하고 구현했다.",
    result: "완료·배포(odyssey-plan-studio-vzqt.vercel.app).",
  },
  {
    id: "T01", name: "나를 소개하는 한 페이지", period: "2026",
    ability: "자기동기력",
    stack: "HTML, CSS, JavaScript (반응형 한 페이지)",
    situation: "음악·웹디자인·개발로 이어진 경험을 처음 보는 사람에게 근거와 함께 보여 줘야 했다.",
    action: "첫 화면에 이름·대표 문장·근거 요약을 두고, 분야별 폴더(About Me·Music·Dev/Projects·Web Design)를 모달로 여는 한 페이지를 설계·구현했다.",
    result: "공개 주소로 배포(seulgi-portfolio-henna.vercel.app). 좁은 화면에서는 세로로 쌓이는 반응형 구조.",
  },
  {
    id: "T02", name: "웹 게임 「잉크의 방」", period: "2026",
    ability: "자기동기력",
    stack: "TypeScript, React(vinext), Canvas, Node 테스트",
    situation: "기존 코드의 방 생성이 공식 기반이라 가구가 거의 없고, 일부 단계에서 열쇠가 순찰 경로 위에 놓이는 등 설계 문제가 있었다.",
    action: "방 31개를 지도 데이터로 다시 만들고, 순찰·추격 로직과 자동 정지를 정리했으며, 모든 방이 풀리는지 확인하는 해법 탐색 테스트를 붙였다.",
    result: "공개 주소로 배포(ink-room-five.vercel.app).",
  },
  {
    id: "T03", name: "짤칵 스튜디오 (이미지·문구 편집기)", period: "2026",
    ability: "자기조절력",
    stack: "Vite, React, TypeScript, localStorage",
    situation: "이미지 편집 도구를 만들되 잘못된 파일이 들어와도 작업이 사라지지 않아야 했다.",
    action: "서버·로그인·DB 없이 브라우저 안에서만 처리하도록 범위를 정하고, PNG·JPEG 외 파일은 거부 이유를 보여 주며 기존 작업을 유지하게 했다.",
    result: "화면비(1:1·4:5·9:16)별 PNG 저장과 템플릿 관리가 되는 편집기. 공개 주소로 배포(zzalkakstudio.vercel.app).",
  },
  {
    id: "T04", name: "AFTERWAVE (지진 정보판)", period: "2026",
    ability: "자기조절력",
    stack: "Next.js, React, TypeScript, Supabase, Vitest, USGS GeoJSON",
    situation: "USGS 공개 데이터가 늦거나 틀릴 때도 정보판이 정직하게 상태를 설명해야 했다.",
    action: "마지막 정상값을 '오래된 값' 표시와 함께 보존하고, 느린 응답·401/403·429·오프라인·형식 변경 다섯 실패를 합성 재생해 각각 다른 안내를 보이게 했다.",
    result: "실패가 나도 임의의 값이 실제 값처럼 보이지 않는 대시보드. 공개 주소로 배포(afterwave-lilac.vercel.app).",
  },
  {
    id: "ALEPH", name: "DO:IT 플랜두씨 다이어리 (+ 7번 과제 접근 제어)", period: "2026",
    ability: "자기조절력",
    stack: "Next.js App Router, TypeScript, Drizzle ORM, PostgreSQL(Supabase), Tailwind CSS, Vitest",
    situation: "남의 예시가 아니라 내 실제 공부 계획을 넣어 계획과 실제의 차이를 보는 도구가 필요했다.",
    action: "계획→실행 기록→돌아보기가 서버 DB에 이어지게 만들고, 집계 숫자를 누르면 근거 기록이 보이게 했다. 로그인과 부가 기능은 과제 범위 밖이라 다음 과제로 미뤘다.",
    result: "새로고침해도 기록이 유지되는 다이어리. 공개 주소로 배포(doitdiary.vercel.app).",
  },
  {
    id: "T10", name: "논문 「다른 분야의 경험은 언제 새 문제로 옮겨지는가」", period: "2026-09-27 완성",
    ability: "대인관계력 · 자기동기력",
    stack: "Python(표준 라이브러리), OpenAlex, Claude Code, Codex CLI",
    situation: "다분야 경험이 새 문제로 옮겨진다는 기대를 검증 가능한 질문으로 좁혀야 했다.",
    action: "사전 기준을 정하고 OpenAlex 레코드 168건을 선별했다. Claude Code가 선별·코딩·원고를 맡고, Codex CLI가 읽기 전용 독립 검토를 2회 했으며, 검토 의견을 항목별로 수용·반박·확인 불가로 분류해 반영했다. 핵심 코딩 18행과 2차 선별 49건은 직접 검토했다.",
    result: "판정 가능한 연구 9편(사전 기준 10편 미달) → 최종 판정 '불분명'. 가설 입증으로 쓰지 않았다.",
  },
  {
    id: "ALEPH", name: "과정 중 조별 활동 (리추얼 기록 근거)", period: "2026-08-11 ~ 2026-09-29",
    ability: "대인관계력",
    stack: "-",
    situation: "갑작스러운 조별 활동과 발표, 서로 다른 과제 결과처럼 함께 풀어야 하는 상황이 반복됐다.",
    action: "첫 주 조별 활동에서 팀장을 맡아 기준을 세웠고(2026-08-11), 쉬는 시간마다 모르는 명령어를 정리해 공유했으며(2026-08-12), 결과가 다를 때 코드를 교차검증했다(2026-09-21).",
    result: "동료 피드백에 '기준을 잘 세워 줘서 좋았다', '팀장으로서 떨지 않고 잘 이끌어 줬다'는 말이 기록되었다(2026-08-11, 이름 비공개).",
  },
];

// ------------------------------------------------------------ 회사·교습 경력 (기존 포트폴리오 공개 내용 기준)
const workHistory = [
  ["2023.02 ~ 2024.12", "인더슈(슈파티) · 웹 디자이너·사원", "자사몰 의류·슈즈 상세 작업 및 업로드, 메인 배너 기획·디자인, CAFE24·EZAdmin 자사몰 관리, 쿠팡 보조 업무 및 G마켓·11번가 딜 세팅 전담, 상세 페이지 기획·디자인"],
];
const otherWork = [
  ["2025.02 ~ 2025.06", "골든보이 · 아르바이트", "웹 디자인 업무 및 자사몰 유지보수"],
  ["2020.09 ~ 2023.01", "루이 아트테인먼트 · 사회활동", "네이버 스토어 운영, 상세 페이지 제작, 주얼리·잡화 디자인·제작 및 판매"],
];
const teachingHistory = [
  ["2019.03 ~ 2024.12", "바젤 음악학원 · 강사", "이론 지도 및 담당 악기 교습"],
  ["2021.03 ~ 2021.12", "개림중학교 오케스트라 · 방과후교사", "오케스트라 지휘 및 학생 관리"],
  ["2020.07 ~ 2021.08", "서창중학교 관악부 · 방과후교사", "관악부 담당 악기 교습 및 학생 관리"],
  ["2019.03 ~ 2021.08", "중부초등학교 관악부 · 방과후교사", "관악부 담당 악기 교습 및 학생 관리"],
];

// ------------------------------------------------------------ 이력서
const resume = doc("이력서", [
  new Paragraph({ style: "Title", children: [new TextRun("이력서")] }),
  p("이슬기", { run: { size: 28, bold: true } }),
  p(heroLine, { run: { color: MUTED } }),
  p(contactText),
  p("포트폴리오: seulgi-portfolio-henna.vercel.app · GitHub: github.com/Lui-die-lui", { run: { color: MUTED, size: 18 } }),
  ...draftNote,

  h1("관심 분야"),
  p("데이터 · 개발 (현재 관심) / AX 인프라 · 보안 (학습 중)"),

  h1("학력"),
  table([2600, CONTENT_W - 2600], [
    ["기간", "내용"],
    ["2015.03 ~ 2019.08", "동의대학교(4년제) 음악학과 졸업 (플루트 전공)"],
  ]),

  h1("경력 · 웹디자인"),
  table([2200, 3000, CONTENT_W - 5200], [["기간", "회사 · 직무", "담당 업무"], ...workHistory]),
  h2("관련 활동"),
  table([2200, 3000, CONTENT_W - 5200], [["기간", "구분", "내용"], ...otherWork]),

  h1("경력 · 음악 교육"),
  table([2200, 3000, CONTENT_W - 5200], [["기간", "기관 · 직무", "담당 업무"], ...teachingHistory]),

  h1("교육"),
  table([2600, CONTENT_W - 2600], [
    ["기간", "내용"],
    ["2026.08.11 ~ 진행 중", "ALEPH 과정 · AX 인프라 (리추얼 기록 기준 시작일)"],
    ["2025.07 ~ 2025.12", "빅데이터 활용 클라우드 SaaS 기반 시니어케어 ERP 개발 과정 수료 · 코리아 IT 아카데미 (국민내일배움카드)"],
    ["2025.04 ~ 2025.10", "웹개발 과정 수료 · 코리아 IT 아카데미"],
  ]),

  h1("자격 · 이수"),
  table([2600, CONTENT_W - 2600], [
    ["취득·이수", "내용"],
    ["2026.03", "SQLD (SQL개발자) 최종합격 · 한국데이터베이스진흥센터"],
    ["2026.04", "Claude 101 · Anthropic"],
    ["2026.04", "Introduction to Claude Cowork · Anthropic"],
    ["2026.03", "Claude Code in Action · Anthropic"],
    ["2025.12", "Google AI Essentials · Google"],
  ]),

  h1("음악 활동 · 수상"),
  bullet("2023.06 ~ 2025.12 부산 에코 플루트 앙상블 단원 (전공 교수 추진 앙상블)"),
  bullet("2022.10 제1회 리사이틀(독주회) · 한국예술인복지재단 사업 선정 및 연주 기획"),
  bullet("2017 부산 교향악 축제 협연"),
  bullet("2015.05 ~ 2018.12 부산 플루트 유스 앙상블 · 전공자·비전공자와 매주 연습 및 봉사 연주 (2018년 악장, 단체·단원 관리)"),
  bullet("부산청년 오케스트라 단원 · Seoul International Music Camp 수료"),
  bullet("2016.06 제28회 예진 서울음악콩쿠르 입상 · 부산음악협회 콩쿠르 1위 및 다수 입상"),
  bullet("2013.04 제40회 전국학생음악경연대회 · 2012.10 제48회 경남 종합학예대회 우수상"),

  h1("기술"),
  table([2600, CONTENT_W - 2600], [
    ["분야", "기술 (기존 포트폴리오 기준)"],
    ["Frontend", "React, Next.js, TypeScript, JavaScript, JSX, HTML5, CSS3, Emotion, Tailwind CSS, React Query(TanStack Query), React Router, Zustand"],
    ["Backend", "Java, Spring Boot, Spring Security, Spring Data JPA, QueryDSL, MyBatis, OAuth2, SockJS"],
    ["Database · Infra", "PostgreSQL, MariaDB, MySQL, Prisma, Supabase, Firebase, Vercel"],
    ["Tools", "IntelliJ IDEA, VSCode, DBeaver, Postman, GitHub"],
    ["Design", "Photoshop(실무), Illustrator, Figma"],
  ]),

  h1("프로젝트 · 과제"),
  table([1500, 4100, CONTENT_W - 5600], [
    ["구분", "프로젝트", "사용 기술"],
    ...tasks.filter((t) => !t.name.startsWith("과정 중 조별 활동") && t.id !== "실무").map((t) => [t.id, `${t.name}\n${t.period}`, t.stack]),
    ["BR-A", "공개 포트폴리오와 기록 갱신 장치", "정적 HTML/CSS/JS, Node 빌드, Python"],
  ]),
]);

// ------------------------------------------------------------ 자기소개서
const coverChildren = [
  new Paragraph({ style: "Title", children: [new TextRun("자기소개서")] }),
  p("이슬기", { run: { bold: true } }),
  ...draftNote,
  h1("성장 과정과 지금의 일하는 방식"),
  p(decisions.storyFirstSentence.text, { run: { bold: true } }),
];
for (const ch of story.chapters) {
  coverChildren.push(h2(`${ch.kicker} — ${ch.title}`));
  for (const para of ch.paragraphs) coverChildren.push(p(para.text));
}
coverChildren.push(p(decisions.storyLastSentence.text, { run: { bold: true } }));
coverChildren.push(h1("이 글에서 드러나는 세 능력"));
const abilityRows = [["능력", "장면(날짜)"]];
const byAbility = {};
story.chapters.forEach((ch) => ch.paragraphs.forEach((para) => para.abilities.forEach((a) => {
  const dates = para.text.match(/(?:\d{4}년\s)?\d{1,2}월\s\d{1,2}일/g) ?? ["날짜 미확인 장면"];
  (byAbility[a] ??= []).push(`${ch.kicker}: ${dates.join(", ")}`);
})));
for (const a of ["자기조절력", "대인관계력", "자기동기력"]) abilityRows.push([a, (byAbility[a] ?? ["-"]).join("\n")]);
coverChildren.push(table([2200, CONTENT_W - 2200], abilityRows));
const plain = storyPlainText(story, decisions.storyFirstSentence.text, decisions.storyLastSentence.text);
coverChildren.push(muted(`본문 분량: ${plain.length}자(공백 포함). 사이트 이야기와 같은 원문(site/content/story.md)에서 생성.`));
const cover = doc("자기소개서", coverChildren);

// ------------------------------------------------------------ 경력기술서
const careerChildren = [
  new Paragraph({ style: "Title", children: [new TextRun("경력기술서")] }),
  p("이슬기", { run: { bold: true } }),
  muted("과제 하나당 한 항목. 각 항목에 해당 능력(자기조절력·대인관계력·자기동기력)과 상황·행동·결과를 적었습니다."),
  h1("요약"),
  table([1500, 3900, 1900, CONTENT_W - 7300], [
    ["구분", "과제", "해당 능력", "기간"],
    ...tasks.map((t) => [t.id, t.name, t.ability, t.period]),
  ]),
  h1("과제별 상황·행동·결과"),
];
for (const t of tasks) {
  careerChildren.push(h2(`${t.id} · ${t.name}`));
  careerChildren.push(table([1500, CONTENT_W - 1500], [
    ["해당 능력", t.ability],
    ["기간", t.period],
    ["상황", t.situation],
    ["행동", t.action],
    ["결과", t.result],
  ], { header: false }));
}
careerChildren.push(h1("회사 경력 요약"));
careerChildren.push(muted("회사 경력은 기존 포트폴리오에 공개한 기간·담당 업무만 적었습니다. 정량 성과는 확인되지 않아 쓰지 않았습니다."));
careerChildren.push(table([2200, 3000, CONTENT_W - 5200], [["기간", "회사 · 직무", "담당 업무"], ...workHistory, ...otherWork, ...teachingHistory]));
const career = doc("경력기술서", careerChildren);

// ------------------------------------------------------------ 쓰기
const files = [
  ["lee-seulgi-resume.docx", resume],
  ["lee-seulgi-cover-letter.docx", cover],
  ["lee-seulgi-career-description.docx", career],
];
const SITE_FILES = join(SITE, "static", "files");
mkdirSync(SITE_FILES, { recursive: true });
for (const [name, d] of files) {
  const buf = await Packer.toBuffer(d);
  writeFileSync(join(OUT, name), buf);
  writeFileSync(join(SITE_FILES, name), buf); // 사이트 다운로드용
  console.log(`out/${name} (+ site/static/files)`);
}
