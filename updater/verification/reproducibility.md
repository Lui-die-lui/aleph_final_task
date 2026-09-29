# 재현성 확인 기록

방법: `python verify_twice.py`

1. 이 폴더의 `update_records.py`, `approvals/`, `inputs/`, `examples/`, `README.md`를 새 임시 폴더 A에 복사
2. 폴더 A에서 `python update_records.py`를 두 번 실행(1회차, 2회차)
3. 또 다른 새 임시 폴더 B에 복사해 한 번 실행(3회차)
4. 각 실행 뒤 `output/`의 모든 파일 SHA-256을 비교

| 파일 | 1회차(폴더 A) | 2회차(폴더 A) | 3회차(폴더 B) | 일치 |
|---|---|---|---|---|
| `candidates.json` | `ea66ec818bd26ef7e491a9e94c1c2efe81ffa6ab7dc8a5b6b023a2ddc1bd095c` | `ea66ec818bd26ef7e491a9e94c1c2efe81ffa6ab7dc8a5b6b023a2ddc1bd095c` | `ea66ec818bd26ef7e491a9e94c1c2efe81ffa6ab7dc8a5b6b023a2ddc1bd095c` | 예 |
| `candidates.md` | `f9d9314246a2b430c27664bd2e1147c4fac5fd4806933624052a7bc1d0c489ab` | `f9d9314246a2b430c27664bd2e1147c4fac5fd4806933624052a7bc1d0c489ab` | `f9d9314246a2b430c27664bd2e1147c4fac5fd4806933624052a7bc1d0c489ab` | 예 |
| `metrics.json` | `73a16aa7334da96b0404276378568a35a19d8b7ea4f1855bd5239b6fbdc2fff4` | `73a16aa7334da96b0404276378568a35a19d8b7ea4f1855bd5239b6fbdc2fff4` | `73a16aa7334da96b0404276378568a35a19d8b7ea4f1855bd5239b6fbdc2fff4` | 예 |
| `site-records.json` | `cf0d790dac92acb8340b7ef60a83258109e48140a25d4c3be3badd28404b9a1d` | `cf0d790dac92acb8340b7ef60a83258109e48140a25d4c3be3badd28404b9a1d` | `cf0d790dac92acb8340b7ef60a83258109e48140a25d4c3be3badd28404b9a1d` | 예 |

결론: 세 번의 실행 결과 바이트가 모두 같습니다.
