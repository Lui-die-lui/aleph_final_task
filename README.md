# BR-A · 이슬기 공개 포트폴리오

처음 온 사람이 3분 안에 "어떤 경험을 거쳐 지금 어떻게 일하는 사람인지" 읽을 수 있는 한 페이지 정적 사이트와, 새 기록으로 숫자·문단 후보를 다시 만드는 장치입니다. 로그인·DB·댓글·통계는 없습니다.

## 폴더

| 경로 | 내용 |
|---|---|
| `site/` | 공개 사이트 (Vercel 루트). 외부 패키지 없는 Node 빌드 → `site/dist/` |
| `site/content/author-decisions.json` | **본인이 확정할 문구 한 파일**: 첫 화면 한 줄 소개, 이야기 첫·마지막 문장, 숫자-고난 짝, 공개 연락 수단, 문서 공개 여부 |
| `site/content/story.md` | 자기소개 본편(약 1,550자). 사이트와 자기소개서가 같은 파일을 씀 |
| `site/data/records.json` | 장치가 만든 공개 데이터(숫자·기록 날짜·승인 문단). 직접 고치지 않음 |
| `site/content/profile.json` | 확인된 이력·링크·지나온 작업 목록 |
| `site/static/` | 증명사진(메타데이터 제거·축소본), 최종 논문 PDF, 문서 DOCX(`build_docs.mjs`가 생성) |
| `updater/` | 기록 갱신 장치(Python, 표준 라이브러리). 사용법은 `updater/README.md` |
| `documents/` | 이력서·자기소개서·경력기술서 생성기(`build_docs.mjs`) → `documents/out/`, `확인필요목록.md` |
| `tools/privacy_scan.py` | 다른 사람 실명·연락처·비밀값·원본 기록 흔적 검사 |
| `tools/make_zips.py` | 제출 ZIP 생성 + README대로 새 폴더 실행 검증 |
| `deliverables/` | 제출용 ZIP 2개 |

공개하지 않는 원본(`ritual-history-*.json`, 논문 재현 ZIP, `updater/inputs/`의 원본)은 `.gitignore`에 있으며 `site/`에 들어가지 않습니다.

## 다시 만들기

```bash
cd site && npm run build            # 사이트 → site/dist (npm run preview 로 http://localhost:4173)
cd documents && npm install && node build_docs.mjs   # DOCX 3종
python tools/make_zips.py           # 장치 결과 갱신 + 재현성 검증 + 제출 ZIP
python tools/privacy_scan.py site/dist deliverables   # 공개물 검사
```

## 배포 (Vercel)

- 공개 주소: **https://seulgistory.vercel.app/**
- `main` 브랜치에 푸시하면 Vercel이 자동으로 다시 배포합니다. 저장소 루트의 `vercel.json`이 `site/`를 빌드하고 `site/dist`를 배포하므로 Root Directory를 따로 지정하지 않아도 됩니다(`site`로 지정해도 `site/vercel.json`으로 동작).
- 배포 뒤 새 시크릿 창에서 로그인 없이 열리는지, PDF·문서 다운로드가 동작하는지 확인합니다.

## 과정이 끝난 뒤에도 사이트를 새로 만드는 방법

사이트의 숫자와 '기록에서 고른 문장'은 손으로 고치지 않고, 새 기록을 넣어 장치로 다시 만듭니다.

1. 새로 내보낸 리추얼 JSON·출석 기록·제출 현황을 `updater/inputs/`에 넣습니다(파일 형식은 `updater/examples/`).
2. `cd updater && python update_records.py --publish-to ../site/data/records.json` — 잔디 달력·숫자 칸이 다시 계산되고, 세 능력별 문단 후보가 날짜·원문 근거와 함께 `updater/output/candidates.md`에 생깁니다(공개되지 않음).
3. 쓸 후보를 `updater/approvals/approved.json`에 옮겨 직접 다듬고 `"approved": true`로 바꾼 뒤 2단계를 다시 실행합니다. 승인한 문장만 사이트에 들어갑니다.
4. 커밋·푸시하면 Vercel이 다시 배포합니다.

같은 입력과 같은 승인 파일이면 결과 파일은 바이트 단위로 같습니다(현재 시각·무작위 값·AI 응답을 쓰지 않음). 자세한 내용은 `updater/README.md`.

`author-decisions.json`의 문구는 모두 확정 상태입니다. 나중에 `status`가 "확정"이 아닌 항목이 생기면 페이지에 `noindex`가 붙습니다.
