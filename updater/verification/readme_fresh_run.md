# README대로 새 폴더에서 실행한 기록

1. 장치 ZIP을 새 임시 폴더에 풀었습니다(이 기록 파일을 넣기 전의 ZIP).
2. README 1단계: `inputs/`에 리추얼 기록 원본을 `ritual.json`으로 넣었습니다. 출석·제출 원본은 아직 없어 넣지 않았습니다.
3. README 2단계: `python update_records.py`를 두 번 실행했습니다.
4. 두 실행의 `output/` SHA-256과, ZIP에 들어 있는 `output/`(작업 폴더 결과)의 SHA-256을 비교했습니다.

| 파일 | 새 폴더 1회차 | 새 폴더 2회차 | ZIP 안 결과 | 일치 |
|---|---|---|---|---|
| `candidates.json` | `ea66ec818bd26ef7e491a9e94c1c2efe81ffa6ab7dc8a5b6b023a2ddc1bd095c` | `ea66ec818bd26ef7e491a9e94c1c2efe81ffa6ab7dc8a5b6b023a2ddc1bd095c` | `ea66ec818bd26ef7e491a9e94c1c2efe81ffa6ab7dc8a5b6b023a2ddc1bd095c` | 예 |
| `candidates.md` | `f9d9314246a2b430c27664bd2e1147c4fac5fd4806933624052a7bc1d0c489ab` | `f9d9314246a2b430c27664bd2e1147c4fac5fd4806933624052a7bc1d0c489ab` | `f9d9314246a2b430c27664bd2e1147c4fac5fd4806933624052a7bc1d0c489ab` | 예 |
| `metrics.json` | `73a16aa7334da96b0404276378568a35a19d8b7ea4f1855bd5239b6fbdc2fff4` | `73a16aa7334da96b0404276378568a35a19d8b7ea4f1855bd5239b6fbdc2fff4` | `73a16aa7334da96b0404276378568a35a19d8b7ea4f1855bd5239b6fbdc2fff4` | 예 |
| `site-records.json` | `cf0d790dac92acb8340b7ef60a83258109e48140a25d4c3be3badd28404b9a1d` | `cf0d790dac92acb8340b7ef60a83258109e48140a25d4c3be3badd28404b9a1d` | `cf0d790dac92acb8340b7ef60a83258109e48140a25d4c3be3badd28404b9a1d` | 예 |

결론: README대로 새 폴더에서 두 번 실행한 결과가 서로, 그리고 제출한 결과와 바이트 단위로 같습니다.
