#!/usr/bin/env python3
"""공개 사이트·제출 파일 검사: 다른 사람의 실명·연락처, 비밀번호·토큰·API 키, 원본 기록 유출 흔적.

사용: python tools/privacy_scan.py <경로> [<경로> ...]
  폴더·일반 텍스트·.zip·.docx·.pdf 를 읽는다(.zip 안의 .docx/.pdf 도 읽음).
종료 코드: 차단 항목(ERROR)이 있으면 1, 경고(WARN)만 있거나 없으면 0.
"""
from __future__ import annotations

import io
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEXT_EXT = {".html", ".htm", ".css", ".js", ".mjs", ".json", ".md", ".txt", ".csv", ".py", ".xml", ".svg"}

OWNER = {"이슬기", "슬기", "Lee Seulgi", "Seulgi"}

# 절대 들어가면 안 되는 값(참고 이미지 속 다른 사람의 이름·연락처 등)은 이 파일에 쓰지 않고
# 제출물에 넣지 않는 로컬 파일 tools/deny.local.txt(한 줄에 하나)에서 읽는다.
DENY_FILE = Path(__file__).resolve().parent / "deny.local.txt"
DENY = [l.strip() for l in DENY_FILE.read_text(encoding="utf-8").splitlines()
        if l.strip() and not l.startswith("#")] if DENY_FILE.exists() else []

SECRET_PATTERNS = {
    "OpenAI/Anthropic 키": r"\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}",
    "GitHub 토큰": r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}",
    "AWS 키": r"\bAKIA[0-9A-Z]{16}\b",
    "Google API 키": r"\bAIza[0-9A-Za-z_-]{35}\b",
    "Slack 토큰": r"\bxox[abprs]-[A-Za-z0-9-]{10,}",
    "JWT": r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}",
    "개인키": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "비밀값 대입": r"(?i)\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|service[_-]?role)\b\s*[:=]\s*['\"]?[^\s'\"<>]{6,}",
    "DB 접속 문자열": r"(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s'\"<>]+",
}
EMAIL = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
PHONE = r"(?<!\d)(?:01[016789]|0[2-6][0-9]?)[-. ]?\d{3,4}[-. ]?\d{4}(?!\d)"
# 원본 리추얼 JSON이 그대로 새어 나갔는지 보는 흔적
RAW_MARKERS = ["(이름 가림)", "peerNamesMasked", "동료 1가 말해 준", "동료 2가 나눈 감사"]
# 한국어 이름 + 호칭 (경고: 사람이 확인)
SURNAMES = "김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부가복태목형피두감음빈동온호범좌팽승간상갈단견당화창"
NAME_HONORIFIC = rf"(?<![가-힣])[{SURNAMES}][가-힣]{{1,2}}(?:님|씨|선생님|교수님)"
HEALTH = ["병가", "진료", "병원", "두통", "약국", "증상", "울렁", "열이 많이", "공결"]


def allowed_emails() -> set[str]:
    p = ROOT / "site" / "content" / "author-decisions.json"
    try:
        c = json.loads(p.read_text(encoding="utf-8")).get("contact", {})
        if c.get("status") == "확정" and c.get("value"):
            return {str(c["value"]).lower()}
    except (OSError, ValueError):
        pass
    return set()


def docx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        xml = "".join(z.read(n).decode("utf-8", "ignore") for n in z.namelist()
                      if n.startswith(("word/", "docProps/")) and n.endswith(".xml"))
    xml = re.sub(r"</w:p>", "\n", xml)
    return re.sub(r"<[^>]+>", "", xml)


def pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""
    r = PdfReader(io.BytesIO(data))
    meta = " ".join(str(v) for v in (r.metadata or {}).values())
    return meta + "\n" + "\n".join((pg.extract_text() or "") for pg in r.pages)


def texts(name: str, data: bytes):
    ext = Path(name).suffix.lower()
    if ext == ".docx":
        yield name, docx_text(data)
    elif ext == ".pdf":
        yield name, pdf_text(data)
    elif ext == ".zip":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for n in z.namelist():
                if not n.endswith("/"):
                    yield from texts(f"{name}!{n}", z.read(n))
    elif ext in TEXT_EXT:
        yield name, data.decode("utf-8", "ignore")


def scan_text(name: str, text: str, ok_emails: set[str], out: list):
    is_paper = name.lower().endswith(".pdf")
    for label, pat in SECRET_PATTERNS.items():
        for m in re.finditer(pat, text):
            out.append(("ERROR", name, label, m.group(0)[:60]))
    for d in DENY:
        if d.lower() in text.lower():
            out.append(("ERROR", name, "금지 값(deny.local.txt)", d[:2] + "…"))
    for m in re.finditer(EMAIL, text):
        e = m.group(0).lower()
        if e in ok_emails or e.endswith(("@example.com", "@anthropic.com")):
            continue
        out.append(("ERROR", name, "이메일", m.group(0)))
    for m in re.finditer(PHONE, text):
        out.append(("ERROR", name, "전화번호 형식", m.group(0)))
    for mk in RAW_MARKERS:
        # 장치 소스는 이 흔적을 '제외 규칙'으로 가지고 있으므로 검사하지 않는다.
        if mk in text and not name.endswith(".py"):
            out.append(("ERROR", name, "원본 리추얼 기록 흔적", mk))
    if not is_paper:
        for m in re.finditer(NAME_HONORIFIC, text):
            if any(m.group(0).startswith(o) for o in OWNER):
                continue
            out.append(("WARN", name, "이름+호칭(사람 확인)", m.group(0)))
        for h in HEALTH:
            if h in text and not name.endswith(("privacy_scan.py", "update_records.py", "확인필요목록.md", "README.md")):
                out.append(("WARN", name, "건강 관련 단어", h))


def main(paths: list[str]) -> int:
    ok_emails = allowed_emails()
    findings: list = []
    n = 0
    for arg in paths:
        base = Path(arg)
        files = [base] if base.is_file() else sorted(p for p in base.rglob("*") if p.is_file())
        for f in files:
            if "node_modules" in f.parts:
                continue
            for name, text in texts(str(f), f.read_bytes()):
                n += 1
                scan_text(name, text, ok_emails, findings)
    for level, name, label, value in findings:
        print(f"[{level}] {label}: {value!r}  ← {name}")
    errors = sum(1 for f in findings if f[0] == "ERROR")
    warns = len(findings) - errors
    print(f"검사한 텍스트 {n}개 · 차단 {errors}건 · 경고 {warns}건")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ["site/dist"]))
