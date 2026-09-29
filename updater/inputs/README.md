# inputs 폴더

이 폴더의 파일은 **공개하지 않습니다**(ZIP·사이트에 넣지 않음).

| 파일 | 내용 | 없을 때 |
|---|---|---|
| `ritual.json` | 리추얼 기록 원본 JSON (`{"student", "days": [{"date", "open": [], "close": []}]}`) | 숫자 "자료 확인 후 반영", 후보 없음 |
| `attendance.csv` | 내 출석 기록. 형식은 `../examples/attendance.example.csv` (status: 출석·지각·조퇴·결석·공결·공가) | 출석 "자료 확인 후 반영" |
| `submissions.csv` | 내 제출 현황. 형식은 `../examples/submissions.example.csv` (status: 제출·미제출·지연제출, checked_on: 원본 확인 날짜) | 제출 "자료 확인 후 반영" |

헤더만 있는 빈 CSV도 "빈 파일"로 처리되어 숫자를 만들지 않습니다.
