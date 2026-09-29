#!/usr/bin/env python3
"""제출용 ZIP 만들기.

  deliverables/BR-A_lee-seulgi_updater.zip    장치: 실행 소스·README·마지막 결과·검증 기록
  deliverables/BR-A_lee-seulgi_documents.zip  이력서·자기소개서·경력기술서(DOCX)·확인 필요 목록

리추얼 원본(inputs/ritual.json 등)은 넣지 않는다. ZIP 안 파일의 시각은 고정해 같은 내용이면 같은 ZIP이 된다.
장치 ZIP은 한 번 만든 뒤 새 임시 폴더에 풀어 README 2단계를 두 번 실행해 보고, 그 기록을 넣어 다시 만든다.
"""
from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UPD = ROOT / "updater"
DOCS = ROOT / "documents"
OUT = ROOT / "deliverables"
FIXED_TIME = (2026, 9, 29, 0, 0, 0)

UPDATER_FILES = [
    "README.md", "update_records.py", "verify_twice.py",
    "inputs/README.md",
    "examples/attendance.example.csv", "examples/submissions.example.csv",
    "approvals/approved.json",
    "output/metrics.json", "output/candidates.json", "output/candidates.md", "output/site-records.json",
    "verification/reproducibility.md", "verification/readme_fresh_run.md",
]
DOC_FILES = [
    ("out/lee-seulgi-resume.docx", "이슬기_이력서.docx"),
    ("out/lee-seulgi-cover-letter.docx", "이슬기_자기소개서.docx"),
    ("out/lee-seulgi-career-description.docx", "이슬기_경력기술서.docx"),
    ("확인필요목록.md", "확인필요목록.md"),
]


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write_zip(dest: Path, entries: list[tuple[Path, str]]) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
        for src, arc in sorted(entries, key=lambda e: e[1]):
            info = zipfile.ZipInfo(arc, date_time=FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            info.flag_bits |= 0x800  # UTF-8 파일 이름
            z.writestr(info, src.read_bytes())


def updater_entries() -> list[tuple[Path, str]]:
    return [(UPD / f, f"updater/{f}") for f in UPDATER_FILES if (UPD / f).exists()]


def readme_fresh_run(zip_path: Path) -> str:
    """ZIP을 새 임시 폴더에 풀고 README 1~2단계를 그대로 두 번 실행한다."""
    with tempfile.TemporaryDirectory(prefix="bra-readme-") as tmp:
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(tmp)
        work = Path(tmp) / "updater"
        # README 1단계: 입력 넣기 (원본 리추얼 기록만 있음. 출석·제출 원본은 아직 없음)
        shutil.copyfile(UPD / "inputs" / "ritual.json", work / "inputs" / "ritual.json")
        runs = []
        for _ in range(2):
            # README 2단계 (사이트 폴더가 없는 새 폴더이므로 --publish-to 없이)
            subprocess.run([sys.executable, "update_records.py"], cwd=work, check=True,
                           stdout=subprocess.DEVNULL, env={**__import__("os").environ, "PYTHONIOENCODING": "utf-8"})
            runs.append({p.name: sha(p) for p in sorted((work / "output").iterdir())})
    repo = {p.name: sha(p) for p in sorted((UPD / "output").iterdir())}
    lines = ["# README대로 새 폴더에서 실행한 기록", "",
             "1. 장치 ZIP을 새 임시 폴더에 풀었습니다(이 기록 파일을 넣기 전의 ZIP).",
             "2. README 1단계: `inputs/`에 리추얼 기록 원본을 `ritual.json`으로 넣었습니다. 출석·제출 원본은 아직 없어 넣지 않았습니다.",
             "3. README 2단계: `python update_records.py`를 두 번 실행했습니다.",
             "4. 두 실행의 `output/` SHA-256과, ZIP에 들어 있는 `output/`(작업 폴더 결과)의 SHA-256을 비교했습니다.", "",
             "| 파일 | 새 폴더 1회차 | 새 폴더 2회차 | ZIP 안 결과 | 일치 |", "|---|---|---|---|---|"]
    ok_all = True
    for n in sorted(repo):
        ok = runs[0].get(n) == runs[1].get(n) == repo[n]
        ok_all &= ok
        lines.append(f"| `{n}` | `{runs[0].get(n, '-')}` | `{runs[1].get(n, '-')}` | `{repo[n]}` | {'예' if ok else '아니오'} |")
    lines += ["", f"결론: {'README대로 새 폴더에서 두 번 실행한 결과가 서로, 그리고 제출한 결과와 바이트 단위로 같습니다.' if ok_all else '결과가 다릅니다.'}", ""]
    if not ok_all:
        print("\n".join(lines))
        raise SystemExit("README 새 폴더 실행 결과가 일치하지 않습니다.")
    return "\n".join(lines)


def main() -> int:
    env = {**__import__("os").environ, "PYTHONIOENCODING": "utf-8"}
    # 0. 최신 결과와 재현성 기록
    subprocess.run([sys.executable, "update_records.py", "--publish-to", "../site/data/records.json"], cwd=UPD, check=True, env=env)
    subprocess.run([sys.executable, "verify_twice.py"], cwd=UPD, check=True, stdout=subprocess.DEVNULL, env=env)

    upd_zip = OUT / "BR-A_lee-seulgi_updater.zip"
    fresh = UPD / "verification" / "readme_fresh_run.md"
    fresh.unlink(missing_ok=True)
    write_zip(upd_zip, updater_entries())
    fresh.write_bytes(readme_fresh_run(upd_zip).encode("utf-8"))
    write_zip(upd_zip, updater_entries())

    doc_zip = OUT / "BR-A_lee-seulgi_documents.zip"
    write_zip(doc_zip, [(DOCS / src, arc) for src, arc in DOC_FILES])

    for z in (upd_zip, doc_zip):
        with zipfile.ZipFile(z) as zf:
            names = zf.namelist()
        assert not any(n.endswith("ritual.json") for n in names), "리추얼 원본이 ZIP에 들어갔습니다."
        print(f"{z.relative_to(ROOT)}  sha256={sha(z)}")
        for n in names:
            print(f"  - {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
