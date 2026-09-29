# README대로 새 폴더에서 실행한 기록

1. 장치 ZIP을 새 임시 폴더에 풀었습니다(이 기록 파일을 넣기 전의 ZIP).
2. README 1단계: `inputs/`에 원본 `ritual.json`, `attendance.csv`, `submissions.csv`를 넣었습니다(리추얼 기록·출석 기록·제출 현황).
3. README 2단계: `python update_records.py`를 두 번 실행했습니다.
4. 두 실행의 `output/` SHA-256과, ZIP에 들어 있는 `output/`(작업 폴더 결과)의 SHA-256을 비교했습니다.

| 파일 | 새 폴더 1회차 | 새 폴더 2회차 | ZIP 안 결과 | 일치 |
|---|---|---|---|---|
| `candidates.json` | `ea66ec818bd26ef7e491a9e94c1c2efe81ffa6ab7dc8a5b6b023a2ddc1bd095c` | `ea66ec818bd26ef7e491a9e94c1c2efe81ffa6ab7dc8a5b6b023a2ddc1bd095c` | `ea66ec818bd26ef7e491a9e94c1c2efe81ffa6ab7dc8a5b6b023a2ddc1bd095c` | 예 |
| `candidates.md` | `f9d9314246a2b430c27664bd2e1147c4fac5fd4806933624052a7bc1d0c489ab` | `f9d9314246a2b430c27664bd2e1147c4fac5fd4806933624052a7bc1d0c489ab` | `f9d9314246a2b430c27664bd2e1147c4fac5fd4806933624052a7bc1d0c489ab` | 예 |
| `metrics.json` | `172b26c5b83182c02a7e962dbb456f31964621a821f3c1d89f074ba496283c12` | `172b26c5b83182c02a7e962dbb456f31964621a821f3c1d89f074ba496283c12` | `172b26c5b83182c02a7e962dbb456f31964621a821f3c1d89f074ba496283c12` | 예 |
| `site-records.json` | `03317c3ba41590baa19fb12b8a4a753e23497e169120fb7e752b37765e0c1c21` | `03317c3ba41590baa19fb12b8a4a753e23497e169120fb7e752b37765e0c1c21` | `03317c3ba41590baa19fb12b8a4a753e23497e169120fb7e752b37765e0c1c21` | 예 |

결론: README대로 새 폴더에서 두 번 실행한 결과가 서로, 그리고 제출한 결과와 바이트 단위로 같습니다.
