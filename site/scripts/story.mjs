// content/story.md 파서. 사이트 빌드와 문서(자기소개서) 빌드가 함께 쓴다.
//
// 형식
//   --- (머리말: key: value) ---
//   ## 짧은 이름 | 제목          → 장(chapter)
//   {능력, 능력} 문단 내용       → 문단 앞의 {…}는 이 문단에서 드러나는 능력
import { readFileSync } from "node:fs";

export function parseStory(path) {
  const raw = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const meta = {};
  let body = raw;
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    for (const line of fm[1].split("\n")) {
      const i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    body = raw.slice(fm[0].length);
  }

  const chapters = [];
  for (const block of body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)) {
    const h = block.match(/^##\s+(.+)$/);
    if (h) {
      const [kicker, title] = h[1].split("|").map((s) => s.trim());
      chapters.push({ kicker, title: title ?? kicker, paragraphs: [] });
      continue;
    }
    if (!chapters.length) throw new Error("story.md: 첫 문단 앞에 '## 장 제목'이 필요합니다.");
    const tag = block.match(/^\{([^}]*)\}\s*/);
    const abilities = tag ? tag[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
    const text = (tag ? block.slice(tag[0].length) : block).replace(/\s*\n\s*/g, " ");
    chapters.at(-1).paragraphs.push({ abilities, text });
  }
  return { meta, chapters };
}

export function storyPlainText(story, first, last) {
  const parts = [first, ...story.chapters.flatMap((c) => c.paragraphs.map((p) => p.text)), last];
  return parts.filter(Boolean).join(" ");
}
