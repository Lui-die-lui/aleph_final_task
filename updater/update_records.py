#!/usr/bin/env python3
"""기록 갱신 장치 (BR-A).

입력(inputs/):
  ritual.json         리추얼 기록 원본 JSON (필수 아님 - 없으면 빈 상태로 처리)
  attendance.csv      내 출석 기록      (형식: examples/attendance.example.csv)
  submissions.csv     내 제출 현황      (형식: examples/submissions.example.csv)
승인(approvals/approved.json):
  본인이 승인한 문단만 적는 파일. 여기 없는 후보는 공개 데이터에 들어가지 않는다.

출력(output/):
  metrics.json        출처·기간·정의가 붙은 숫자
  candidates.json     세 능력별 문단 후보(날짜·원문 근거 포함) - 로컬 검토용, 공개 금지
  candidates.md       위 후보를 사람이 읽기 쉽게 정리한 것
  site-records.json   공개 가능한 데이터(숫자 + 기록 날짜 + 승인된 문단만)

결정성: 현재 시각·무작위 값·네트워크/AI 호출을 쓰지 않는다. 같은 입력과 승인 파일이면
출력 파일의 바이트가 같다(정렬된 키, UTF-8, LF 줄바꿈).
표준 라이브러리만 사용한다.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCHEMA_VERSION = 1

ABILITIES = {
    "self_regulation": {
        "label": "자기조절력",
        "keywords": ["조절", "무리", "중요도", "우선순위", "숨", "쉴", "구분", "타협", "완급",
                     "임계점", "급하게", "선택", "판단", "순서대로"],
    },
    "interpersonal": {
        "label": "대인관계력",
        "keywords": ["공유", "함께", "동료", "조율", "교차검증", "물어", "질문", "설명", "경청",
                     "소통", "사과", "설득", "도와", "나눴"],
    },
    "self_motivation": {
        "label": "자기동기력",
        "keywords": ["공부", "자격증", "끝까지", "포기", "꾸준", "루틴", "매일", "복습", "해결",
                     "해내", "빠지지", "고치"],
    },
}

# 본인이 직접 쓴 항목만 후보 근거로 쓴다(동료가 쓴 문장은 쓰지 않는다).
OWN_FIELDS = {
    "강점이 드러난 일화": "open",
    "그 결과·알게 된 점": "open",
    "오늘의 첫 행동": "open",
    "강점을 위해 노력하고 생각한 것": "close",
    "내가 나눈 감사": "close",
}

# 공개 포트폴리오에 넣지 않는 내용: 진료·증상, 제3자 사정, 가림 처리 흔적.
EXCLUDE_PATTERNS = [
    "병가", "병원", "진료", "약국", "약사", "약을", "약 먹", "약먹", "두통", "열이", "아파", "아픈",
    "아프", "몸이 안좋", "몸이 안 좋", "속이", "울렁", "증상", "심신", "공결",
    "교수님", "동생", "위험", "성질", "화나는", "불미스러운",
    "(이름 가림)",
]

MIN_QUOTE_LEN = 12
MAX_CANDIDATES_PER_ABILITY = 8

ATTENDANCE_STATUSES = ["출석", "지각", "조퇴", "결석", "공결"]
SUBMISSION_STATUSES = ["제출", "미제출", "지연제출"]


# ---------------------------------------------------------------- 공통 유틸

def write_json(path: Path, data) -> None:
    text = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.encode("utf-8"))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.replace("\r\n", "\n").encode("utf-8"))


def parse_date(value: str) -> dt.date | None:
    try:
        return dt.date.fromisoformat(value.strip())
    except (ValueError, AttributeError):
        return None


def read_csv_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = [
            {(k or "").strip(): (v or "").strip() for k, v in row.items()}
            for row in csv.DictReader(f)
        ]
    return [r for r in rows if any(r.values())]


def source_status(path: Path, rows_or_days) -> str:
    if not path.exists():
        return "파일 없음"
    if not rows_or_days:
        return "빈 파일"
    return "반영"


# ---------------------------------------------------------------- 입력 읽기

def load_ritual(path: Path) -> list[dict]:
    """[{date, open:[...], close:[...]}] 날짜순. 없거나 비면 빈 목록."""
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    data = json.loads(raw)
    days = data.get("days", []) if isinstance(data, dict) else []
    out = []
    for day in days:
        d = parse_date(str(day.get("date", "")))
        if d is None:
            continue
        open_ = [str(x) for x in day.get("open", []) if str(x).strip()]
        close = [str(x) for x in day.get("close", []) if str(x).strip()]
        if not open_ and not close:
            continue
        out.append({"date": d, "open": open_, "close": close})
    out.sort(key=lambda x: x["date"])
    return out


def period(dates: list[dt.date]) -> dict | None:
    if not dates:
        return None
    return {"start": min(dates).isoformat(), "end": max(dates).isoformat()}


# ---------------------------------------------------------------- 숫자

def ritual_metrics(days: list[dict], status: str) -> list[dict]:
    dates = [d["date"] for d in days]
    per = period(dates)
    src = {"name": "리추얼 기록", "file": "inputs/ritual.json", "status": status}
    if not days:
        empty = {"value": None, "display": "자료 확인 후 반영", "period": None, "source": src}
        return [
            {**empty, "id": "ritual_days", "label": "리추얼 기록일", "unit": "일",
             "definition": "시작(open) 또는 마무리(close) 기록이 한 줄 이상 있는 날짜 수"},
        ]

    both = sum(1 for d in days if d["open"] and d["close"])
    weeks_with = sorted({d.isocalendar()[:2] for d in dates})
    first, last = min(dates), max(dates)
    total_weeks = 0
    cursor = first - dt.timedelta(days=first.weekday())
    while cursor <= last:
        total_weeks += 1
        cursor += dt.timedelta(days=7)
    practiced = 0
    for d in days:
        if any(line.replace(" ", "") in ("강점행동:실천했다",) for line in d["close"]):
            practiced += 1

    return [
        {
            "id": "ritual_days", "label": "리추얼 기록일", "value": len(days), "unit": "일",
            "display": f"{len(days)}일",
            "definition": "시작(open) 또는 마무리(close) 기록이 한 줄 이상 있는 날짜 수",
            "period": per, "source": src,
        },
        {
            "id": "ritual_weeks", "label": "기록이 있는 주", "value": len(weeks_with), "unit": "주",
            "display": f"{total_weeks}주 중 {len(weeks_with)}주",
            "definition": "기록 기간(첫 기록 주 월요일~마지막 기록 주)의 달력 주 가운데 기록이 1일 이상 있는 주의 수",
            "period": per, "source": src,
        },
        {
            "id": "ritual_open_close_days", "label": "시작·마무리를 모두 쓴 날", "value": both,
            "unit": "일", "display": f"{both}일",
            "definition": "같은 날짜에 시작 기록과 마무리 기록이 모두 있는 날짜 수",
            "period": per, "source": src,
        },
        {
            "id": "ritual_practiced_days", "label": "강점 행동 '실천했다' 표시", "value": practiced,
            "unit": "일", "display": f"{practiced}일",
            "definition": "마무리 기록에 '강점 행동: 실천했다'라고 본인이 표시한 날짜 수(자기 보고)",
            "period": per, "source": src,
        },
    ]


def attendance_metrics(rows: list[dict], status: str) -> list[dict]:
    src = {"name": "내 출석 기록", "file": "inputs/attendance.csv", "status": status}
    base = {"id": "attendance", "label": "출석", "unit": "일",
            "definition": "출석 기록 원본에서 상태가 '출석' 또는 '지각'인 날짜 수 / 기록된 수업일 수"}
    valid = [(parse_date(r.get("date", "")), r.get("status", "")) for r in rows]
    valid = [(d, s) for d, s in valid if d is not None and s in ATTENDANCE_STATUSES]
    if not valid:
        return [{**base, "value": None, "display": "자료 확인 후 반영", "period": None, "source": src}]
    by_date = {}
    for d, s in sorted(valid):
        by_date[d] = s  # 같은 날짜가 여러 번이면 마지막 행을 쓴다
    present = sum(1 for s in by_date.values() if s in ("출석", "지각"))
    return [{**base, "value": {"present": present, "total": len(by_date)},
             "display": f"{len(by_date)}일 중 {present}일",
             "period": period(list(by_date)), "source": src}]


def submission_metrics(rows: list[dict], status: str) -> list[dict]:
    src = {"name": "내 제출 현황", "file": "inputs/submissions.csv", "status": status}
    base = {"id": "submissions", "label": "과제 제출", "unit": "건",
            "definition": "제출 현황 원본에서 상태가 '제출' 또는 '지연제출'인 과제 수 / 목록의 과제 수"}
    valid = [r for r in rows if r.get("task_id") and r.get("status") in SUBMISSION_STATUSES]
    if not valid:
        return [{**base, "value": None, "display": "자료 확인 후 반영", "period": None, "source": src}]
    by_task = {}
    for r in sorted(valid, key=lambda r: r["task_id"]):
        by_task[r["task_id"]] = r
    done = sum(1 for r in by_task.values() if r["status"] in ("제출", "지연제출"))
    dates = [parse_date(r.get("due_date", "")) for r in by_task.values()]
    return [{**base, "value": {"submitted": done, "total": len(by_task)},
             "display": f"{len(by_task)}건 중 {done}건",
             "period": period([d for d in dates if d]), "source": src}]


# ---------------------------------------------------------------- 후보 문단

def split_field(line: str) -> tuple[str, str] | None:
    if ":" not in line:
        return None
    field, text = line.split(":", 1)
    return field.strip(), text.strip()


def evidence_lines(days: list[dict]) -> list[dict]:
    out = []
    for day in days:
        for part in ("open", "close"):
            for line in day[part]:
                parsed = split_field(line)
                if not parsed:
                    continue
                field, text = parsed
                if OWN_FIELDS.get(field) != part:
                    continue
                if len(text) < MIN_QUOTE_LEN:
                    continue
                if any(p in text for p in EXCLUDE_PATTERNS):
                    continue
                out.append({"date": day["date"].isoformat(), "field": field, "quote": text})
    return out


def korean_date(iso: str) -> str:
    d = dt.date.fromisoformat(iso)
    return f"{d.year}년 {d.month}월 {d.day}일"


def build_candidates(days: list[dict]) -> dict:
    lines = evidence_lines(days)
    result = {}
    for key, spec in ABILITIES.items():
        scored = []
        for ev in lines:
            hits = sorted({k for k in spec["keywords"] if k in ev["quote"]})
            if hits:
                scored.append((-len(hits), ev["date"], ev["field"], ev["quote"], hits))
        scored.sort()
        items = []
        seen = set()
        for _, date, field, quote, hits in scored:
            if (date, quote) in seen:
                continue
            seen.add((date, quote))
            # 순위가 아니라 날짜+원문으로 만든 id라서 기록이 늘어도 같은 후보는 같은 id를 유지한다.
            digest = hashlib.sha1(f"{date}|{field}|{quote}".encode("utf-8")).hexdigest()[:6]
            cid = f"{key}-{date}-{digest}"
            items.append({
                "id": cid,
                "ability": spec["label"],
                "date": date,
                "evidence": {"source": "리추얼 기록", "field": field, "quote": quote},
                "matched_keywords": hits,
                "draft": (f"{korean_date(date)} 리추얼 기록에 저는 \"{quote}\"라고 적었습니다. "
                          f"(이 장면에서 {spec['label']}이 드러나는지 본인이 판단해 문장을 다듬어 승인하세요.)"),
            })
            if len(items) >= MAX_CANDIDATES_PER_ABILITY:
                break
        result[key] = items
    return result


def candidates_markdown(cands: dict) -> str:
    out = ["# 세 능력별 문단 후보 (자동 생성 · 공개 금지)", "",
           "이 파일의 문장은 **후보**입니다. 사이트에는 들어가지 않습니다.",
           "쓰고 싶은 후보의 id를 `approvals/approved.json`에 옮기고, 직접 다듬은 문장을 `text`에 적은 뒤",
           "`\"approved\": true`로 바꿔 다시 실행하면 그 문장만 `output/site-records.json`에 들어갑니다.", ""]
    for key, spec in ABILITIES.items():
        out.append(f"## {spec['label']}")
        out.append("")
        items = cands.get(key, [])
        if not items:
            out.append("- 후보 없음 (리추얼 기록이 없거나 조건에 맞는 문장이 없음)")
        for it in items:
            ev = it["evidence"]
            out.append(f"- `{it['id']}` · {it['date']} · {ev['field']}")
            out.append(f"  - 원문: \"{ev['quote']}\"")
            out.append(f"  - 초안: {it['draft']}")
        out.append("")
    return "\n".join(out)


# ---------------------------------------------------------------- 승인 반영

def load_approvals(path: Path) -> list[dict]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []
    data = json.loads(raw)
    return list(data.get("paragraphs", []))


def apply_approvals(approvals: list[dict], cands: dict) -> tuple[list[dict], list[str]]:
    by_id = {it["id"]: it for items in cands.values() for it in items}
    published, warnings = [], []
    for a in approvals:
        cid = a.get("candidate_id", "")
        if a.get("approved") is not True:
            continue
        text = str(a.get("text", "")).strip()
        if cid not in by_id:
            warnings.append(f"{cid}: 현재 입력에서 만들어진 후보가 아니어서 제외했습니다.")
            continue
        if not text:
            warnings.append(f"{cid}: 승인 문장(text)이 비어 있어 제외했습니다.")
            continue
        c = by_id[cid]
        published.append({"id": cid, "ability": c["ability"], "date": c["date"], "text": text,
                          "evidence": {"source": c["evidence"]["source"], "field": c["evidence"]["field"]}})
    published.sort(key=lambda p: (p["ability"], p["date"], p["id"]))
    return published, warnings


# ---------------------------------------------------------------- 실행

def run(base: Path, publish_to: Path | None) -> int:
    inputs = base / "inputs"
    out_dir = base / "output"

    ritual_path = inputs / "ritual.json"
    att_path = inputs / "attendance.csv"
    sub_path = inputs / "submissions.csv"

    days = load_ritual(ritual_path)
    att_rows = read_csv_rows(att_path)
    sub_rows = read_csv_rows(sub_path)

    metrics = (ritual_metrics(days, source_status(ritual_path, days))
               + attendance_metrics(att_rows, source_status(att_path, att_rows))
               + submission_metrics(sub_rows, source_status(sub_path, sub_rows)))
    metrics_doc = {
        "schema_version": SCHEMA_VERSION,
        "note": "빈칸(기록이 없는 날)을 실패로 해석하지 않는다. 출석·제출 수치는 리추얼 기록으로 추정하지 않는다.",
        "metrics": metrics,
    }

    cands = build_candidates(days)
    approvals = load_approvals(base / "approvals" / "approved.json")
    published, warnings = apply_approvals(approvals, cands)

    site_doc = {
        "schema_version": SCHEMA_VERSION,
        "generated_by": "updater/update_records.py",
        "metrics": metrics,
        "calendar": {
            "source": "리추얼 기록",
            "dates": [d["date"].isoformat() for d in days],
            "period": period([d["date"] for d in days]),
            "note": "기록이 확인된 날짜만 표시합니다. 빈칸을 실패한 날로 해석하지 않습니다.",
        },
        "approved_paragraphs": published,
    }

    write_json(out_dir / "metrics.json", metrics_doc)
    write_json(out_dir / "candidates.json", {"schema_version": SCHEMA_VERSION, "candidates": cands})
    write_text(out_dir / "candidates.md", candidates_markdown(cands) + "\n")
    write_json(out_dir / "site-records.json", site_doc)

    if publish_to is not None:
        publish_to.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(out_dir / "site-records.json", publish_to)

    for m in metrics:
        print(f"[숫자] {m['label']}: {m['display']} ({m['source']['name']}: {m['source']['status']})")
    total = sum(len(v) for v in cands.values())
    print(f"[후보] 세 능력 문단 후보 {total}개 -> output/candidates.md (공개되지 않음)")
    print(f"[승인] 공개 데이터에 들어간 승인 문단 {len(published)}개")
    for w in warnings:
        print(f"[경고] {w}")
    if publish_to is not None:
        print(f"[게시] {publish_to}")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="리추얼·출석·제출 기록으로 숫자와 문단 후보를 다시 만든다.")
    ap.add_argument("--base", type=Path, default=HERE, help="inputs/ approvals/ output/ 이 있는 폴더")
    ap.add_argument("--publish-to", type=Path, default=None,
                    help="site-records.json을 복사할 사이트 데이터 경로 (예: ../site/data/records.json)")
    args = ap.parse_args(argv)
    return run(args.base.resolve(), args.publish_to)


if __name__ == "__main__":
    sys.exit(main())
