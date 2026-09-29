#!/usr/bin/env python3
"""재현성 확인: 이 폴더를 새 임시 폴더에 복사해 update_records.py를 두 번 실행하고
output/ 파일의 SHA-256을 비교한다. 결과는 verification/reproducibility.md에 쓴다.

기록 파일에는 임시 폴더 경로·실행 시각을 쓰지 않는다(개인 경로 노출 방지).
"""
from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
COPY_ITEMS = ["update_records.py", "approvals", "inputs", "examples", "README.md"]


def sha256_dir(folder: Path) -> dict[str, str]:
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(folder.iterdir()) if p.is_file()}


def fresh_copy(root: Path) -> Path:
    work = root / "updater"
    work.mkdir()
    for name in COPY_ITEMS:
        src = HERE / name
        if src.is_dir():
            shutil.copytree(src, work / name)
        elif src.exists():
            shutil.copy2(src, work / name)
    return work


def run_once(work: Path) -> dict[str, str]:
    subprocess.run([sys.executable, "update_records.py"], cwd=work, check=True,
                   stdout=subprocess.DEVNULL, env={"PYTHONIOENCODING": "utf-8", **_env()})
    return sha256_dir(work / "output")


def _env() -> dict[str, str]:
    import os
    return dict(os.environ)


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="bra-updater-") as tmp:
        work = fresh_copy(Path(tmp))
        first = run_once(work)
        second = run_once(work)
    with tempfile.TemporaryDirectory(prefix="bra-updater-") as tmp2:
        third = run_once(fresh_copy(Path(tmp2)))

    names = sorted(set(first) | set(second) | set(third))
    same = all(first.get(n) == second.get(n) == third.get(n) for n in names)
    lines = [
        "# 재현성 확인 기록",
        "",
        "방법: `python verify_twice.py`",
        "",
        "1. 이 폴더의 `update_records.py`, `approvals/`, `inputs/`, `examples/`, `README.md`를 새 임시 폴더 A에 복사",
        "2. 폴더 A에서 `python update_records.py`를 두 번 실행(1회차, 2회차)",
        "3. 또 다른 새 임시 폴더 B에 복사해 한 번 실행(3회차)",
        "4. 각 실행 뒤 `output/`의 모든 파일 SHA-256을 비교",
        "",
        "| 파일 | 1회차(폴더 A) | 2회차(폴더 A) | 3회차(폴더 B) | 일치 |",
        "|---|---|---|---|---|",
    ]
    for n in names:
        ok = first.get(n) == second.get(n) == third.get(n)
        lines.append(f"| `{n}` | `{first.get(n, '-')}` | `{second.get(n, '-')}` | `{third.get(n, '-')}` | {'예' if ok else '아니오'} |")
    lines += ["", f"결론: {'세 번의 실행 결과 바이트가 모두 같습니다.' if same else '결과가 다릅니다. 확인이 필요합니다.'}", ""]
    out = HERE / "verification" / "reproducibility.md"
    out.parent.mkdir(exist_ok=True)
    out.write_bytes("\n".join(lines).encode("utf-8"))
    print("\n".join(lines))
    return 0 if same else 1


if __name__ == "__main__":
    sys.exit(main())
