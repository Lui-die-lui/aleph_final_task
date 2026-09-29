# BR-A · 이슬기 공개 포트폴리오

처음 온 사람이 3분 안에 "어떤 경험을 거쳐 지금 어떻게 일하는 사람인지" 읽을 수 있는 한 페이지 정적 사이트와, 새 기록으로 숫자·문단 후보를 다시 만드는 장치입니다. 로그인·DB·댓글·통계는 없습니다.

## 폴더

| 경로 | 내용 |
|---|---|
| `site/` | 공개 사이트 (Vercel 루트). 외부 패키지 없는 Node 빌드 → `site/dist/` |
| `site/content/author-decisions.json` | **본인이 확정할 문구 한 파일**: 첫 화면 한 줄 소개, 이야기 첫·마지막 문장, 숫자-고난 짝, 공개 연락 수단, 문서 공개 여부 |
| `site/content/story.md` | 자기소개 본편(약 1,450자). 사이트와 자기소개서가 같은 파일을 씀 |
| `site/data/records.json` | 장치가 만든 공개 데이터(숫자·기록 날짜·승인 문단). 직접 고치지 않음 |
| `site/static/` | 증명사진(메타데이터 제거·축소본), 최종 논문 PDF |
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

1. 이 폴더를 GitHub 저장소로 올립니다(`.gitignore`가 원본 기록·ZIP을 제외).
2. Vercel에서 저장소를 가져오고 **Root Directory를 `site`** 로 지정합니다. 빌드 설정은 `site/vercel.json`(빌드 `npm run build`, 출력 `dist`)을 따릅니다.
3. 배포 주소를 새 시크릿 창에서 열어 로그인 없이 보이는지, "PDF 보기"·"PDF 다운로드"가 동작하는지 확인합니다.

`author-decisions.json`의 문구는 모두 확정 상태입니다. 나중에 `status`가 "확정"이 아닌 항목이 생기면 페이지에 `noindex`가 붙습니다.
