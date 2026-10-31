// 이력서·자기소개서·경력기술서 DOCX 생성
// 자기소개서 본문은 content/cover-letter.md, 기술 스택은 사이트와 같은 profile.json을 읽는다.
// 확인되지 않은 정보는 추측하지 않고 문서에 쓰지 않는다. 남은 확인 항목은 확인필요목록.md에 모은다.
// 생성한 DOCX는 사이트 다운로드용으로 ../site/static/files/ 에도 복사한다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, LevelFormat, Packer, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from "docx";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..", "site");
const OUT = join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const decisions = JSON.parse(readFileSync(join(SITE, "content/author-decisions.json"), "utf8"));
const profile = JSON.parse(readFileSync(join(SITE, "content/profile.json"), "utf8"));
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

const draftNote = !final(decisions.heroLine)
  ? [muted("※ 한 줄 소개는 본인 확정 전 후보 문구입니다. 확정 후 다시 생성하세요.")]
  : [];

// ------------------------------------------------------------ 프로젝트 (경력기술서·이력서 공용)
// 근거: 이력서 PDF의 자기소개서·포트폴리오 항목(저장소 제외). 역할 일부는 사이트 profile.json의 담당 내용을 인용했다.
const projects = [
  {
    kind: "개인", name: "MU:ZIN", title: "클래식 악기 레슨 예약 플랫폼", period: "2025.12 ~ 2026.10",
    role: "기획·프론트엔드·백엔드·배포 단독 수행, mu-zin.com 공개",
    work: [
      "요청·확정·취소·완료 상태 전이를 도메인 메서드로 정리하고, 허용되지 않는 변경을 거절하는 테스트 작성",
      "AI 레슨 추천에 사용량·월 예산 제한 적용, 가격·예약 가능 시간은 서버가 DB에서 조회해 AI가 임의로 안내하지 않게 분리",
      "AWS EC2 배포, GitHub Actions 자동 배포 구성",
      "폴링 방식 알림을 기존 채팅 WebSocket 연결로 전환",
      "방문 기록 집계 기능 구현",
    ],
    stack: "React, TypeScript, React Query, Zustand, Spring Boot, JPA, PostgreSQL, AWS EC2, GitHub Actions",
    career: true,
  },
  {
    kind: "개인", name: "다음 생 NextLife", title: "경험을 다음 도전으로 잇는 앱", period: "2026",
    stack: "Next.js",
  },
  {
    kind: "팀 5인", name: "OMIJOY", title: "공연 통합 플랫폼", period: "2025.10 ~ 2025.12",
    role: "초기 구조 설계, 관심 공연 스크랩 기능 이식, Firebase Storage 프로필 이미지 업로드, 초기 발표",
    work: [
      "초기 파일·라우터 구조 정리, Figma 와이어프레임으로 구현 기준 마련",
      "마이페이지 구현 시 다른 팀원의 코드와 API 응답을 확인해 연결",
      "반복 UI 분리 기준 개선, React Query·커스텀 훅으로 데이터 처리 로직 분리",
    ],
    stack: "Java, Spring Boot, MariaDB, React, TypeScript",
    career: true,
  },
  {
    kind: "팀 4인", name: "RunnersHigh", title: "러닝 기록 공유 플랫폼", period: "2025.09 ~ 2025.10",
    role: "카카오맵 API 기반 위치 시각화 피드 화면 구현 주도, 최종 발표",
    work: ["문제·원인·해결 과정을 Notion에 정리해 팀과 공유"],
    stack: "Java, Spring Boot, MySQL, React, JavaScript",
    career: true,
  },
  {
    kind: "개인", name: "ODYSSEY PLAN", title: "AI 5년 계획 서비스", period: "2026.03",
    role: "개인 프로젝트 단독 수행",
    work: ["가입자·AI 요청 통계 대시보드 구현"],
    stack: "Next.js, React, TypeScript, Tailwind CSS, Recharts, OpenAI, PostgreSQL, Prisma",
    career: true,
  },
  {
    kind: "개인", name: "쑥쑥 Ssuk Ssuk", title: "수분 습관 앱인토스 미니앱", period: "2026.07",
    stack: "React, Emotion, Supabase",
  },
  {
    kind: "팀 4인", name: "외부 LLM 게이트웨이", title: "ALEPH 교육 팀 프로젝트", period: "2026 교육 과정 중",
    role: "담당 작업 완료 후 전체 흐름 QA",
    work: ["QA 중 임시 권한 처리 API 누락을 발견하고, 근거 공유·합의 후 직접 구현"],
    stack: "",
    career: true,
  },
];

// ------------------------------------------------------------ 회사·교습 경력 (기존 포트폴리오 공개 내용 기준)
const workHistory = [
  ["2025.02 ~ 2025.06", "골든보이 · 웹 디자이너", "Cafe24 기반 자사몰 페이지 수정 및 웹 콘텐츠 유지보수, 상품·콘텐츠 관리와 쇼핑몰 운영 지원"],
  ["2023.02 ~ 2024.12", "인더슈(슈파티) · 웹 디자이너·사원", "자사몰 의류·슈즈 상세 작업 및 업로드, 메인 배너 기획·디자인, CAFE24·EZAdmin 자사몰 관리, 쿠팡 보조 업무 및 G마켓·11번가 딜 세팅 전담, 상세 페이지 기획·디자인"],
];
const otherWork = [
  ["2020.09 ~ 2023.01", "루이 아트테인먼트 · 사회활동", "네이버 온라인 스토어 운영 및 상품 상세페이지 기획·제작, 상품 등록·관리 및 판매 콘텐츠 제작"],
];
const teachingHistory = [
  ["2019.03 ~ 2024.12", "바젤 음악학원 · 강사", "이론 지도 및 담당 악기 교습"],
  ["2021.03 ~ 2021.12", "개림중학교 오케스트라 · 방과후교사", "오케스트라 지휘 및 학생 관리"],
  ["2020.07 ~ 2021.08", "서창중학교 관악부 · 방과후교사", "관악부 담당 악기 교습 및 학생 관리"],
  ["2019.03 ~ 2021.08", "중부초등학교 관악부 · 방과후교사", "관악부 담당 악기 교습 및 학생 관리"],
];

// ------------------------------------------------------------ 이력서
// 상단: 왼쪽 이름·연락처, 오른쪽 증명사진 (사이트와 같은 메타데이터 제거본, 4:5)
const PHOTO = readFileSync(join(SITE, "static", "images", "lee-seulgi.jpg"));
const PHOTO_COL = 2000;
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none };
const resumeHeader = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: [CONTENT_W - PHOTO_COL, PHOTO_COL],
  borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
  rows: [new TableRow({ children: [
    new TableCell({
      borders: noBorders, width: { size: CONTENT_W - PHOTO_COL, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({ style: "Title", children: [new TextRun("이력서")] }),
        p("이슬기", { run: { size: 28, bold: true } }),
        p(heroLine, { run: { color: MUTED } }),
        p(contactText),
        p("포트폴리오: seulgistory.vercel.app · mu-zin.com · nextlife-iota.vercel.app · github.com/Lui-die-lui", { run: { color: MUTED, size: 18 } }),
      ],
    }),
    new TableCell({
      borders: noBorders, width: { size: PHOTO_COL, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new ImageRun({ type: "jpg", data: PHOTO, transformation: { width: 108, height: 135 },
          altText: { title: "증명사진", description: "이슬기 증명사진", name: "photo" } }),
      ] })],
    }),
  ] })],
});

const resume = doc("이력서", [
  resumeHeader,
  ...draftNote,

  h1("학력"),
  table([2600, CONTENT_W - 2600], [
    ["기간", "내용"],
    ["2015.03 ~ 2019.08", "동의대학교(4년제) 음악학과 졸업 (플루트 전공)"],
  ]),

  h1("경력 · 웹디자인 (총 2년 4개월)"),
  table([2200, 3000, CONTENT_W - 5200], [["기간", "회사 · 직무", "담당 업무"], ...workHistory]),
  h2("관련 활동"),
  table([2200, 3000, CONTENT_W - 5200], [["기간", "구분", "내용"], ...otherWork]),

  h1("경력 · 음악 교육"),
  table([2200, 3000, CONTENT_W - 5200], [["기간", "기관 · 직무", "담당 업무"], ...teachingHistory]),

  h1("교육"),
  table([2600, CONTENT_W - 2600], [
    ["기간", "내용"],
    ["2026.08 ~ 2026.11", "코리아IT아카데미 · SK텔레콤 ALEPH(알레프) AI 보안·네트워크 실무 교육(수료 예정)"],
    ["2025.12 ~ 2026.04", "Google, Anthropic · AI Essentials 및 Claude 활용·Claude Code 관련 온라인 교육 수료"],
    ["2025.07 ~ 2025.12", "코리아 IT 아카데미 · 빅데이터 활용 클라우드 SaaS 기반 ERP 개발 과정 수료"],
    ["2025.04 ~ 2025.10", "코리아 IT 아카데미 · 웹개발 과정 수료"],
  ]),

  h1("자격"),
  table([2600, CONTENT_W - 2600], [
    ["시기", "내용"],
    ["2026.12", "정보처리기사 최종 발표 예정 · 한국산업인력공단"],
    ["2026.10", "리눅스마스터 2급 최종합격 · 한국정보통신진흥협회"],
    ["2026.08", "컴퓨터활용능력 2급 최종합격 · 대한상공회의소"],
    ["2026.03", "SQL개발자(SQLD) 최종합격 · 한국데이터베이스진흥센터"],
  ]),

  h1("음악 활동"),
  bullet("2022.10 제1회 리사이틀(독주회) · 한국예술인복지재단 사업 선정 및 연주 기획"),
  bullet("2015.05 ~ 2018.12 부산 플루트 유스 앙상블 · 2018년 악장, 단체·단원 관리"),

  h1("기술"),
  table([2600, CONTENT_W - 2600], [
    ["분야", "기술"],
    ...profile.stack.map((s) => [s.area, s.items]),
    ["Design", "Photoshop, Illustrator, Figma"],
  ]),

  h1("프로젝트"),
  table([1500, 4100, CONTENT_W - 5600], [
    ["구분", "프로젝트", "사용 기술"],
    ...projects.map((t) => [t.kind, `${t.name} · ${t.title}\n${t.period}`, t.stack || "-"]),
  ]),
]);

// ------------------------------------------------------------ 자기소개서
// 원문은 documents/content/cover-letter.md. 사이트 이야기(story.md)와 분리되어 있다.
const coverSource = readFileSync(join(HERE, "content", "cover-letter.md"), "utf8");
const coverChildren = [
  new Paragraph({ style: "Title", children: [new TextRun("자기소개서")] }),
  p("이슬기", { run: { bold: true } }),
];
for (const block of coverSource.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean)) {
  coverChildren.push(block.startsWith("## ") ? h1(block.slice(3)) : p(block));
}
const cover = doc("자기소개서", coverChildren);

// ------------------------------------------------------------ 경력기술서
const careerChildren = [
  new Paragraph({ style: "Title", children: [new TextRun("경력기술서")] }),
  p("이슬기", { run: { bold: true } }),
  h1("회사 경력"),
  table([2200, 3000, CONTENT_W - 5200], [["기간", "회사 · 직무", "담당 업무"], ...workHistory, ...otherWork]),
  h1("교습 경력"),
  table([2200, 3000, CONTENT_W - 5200], [["기간", "기관 · 직무", "담당 업무"], ...teachingHistory]),
  h1("프로젝트 경험"),
];
for (const t of projects.filter((x) => x.career)) {
  careerChildren.push(h2(`${t.name} (${t.kind} · ${t.period})`));
  careerChildren.push(table([1500, CONTENT_W - 1500], [
    ["역할", t.role],
    ["한 일", t.work.map((w) => `• ${w}`).join("\n")],
    ...(t.stack ? [["기술", t.stack]] : []),
  ], { header: false }));
}
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
