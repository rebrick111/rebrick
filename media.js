// 레고 소식 · 유튜버 · 레고스토어 (2026-10-29 조사)
// 유튜브: 채널 ID는 각 채널 페이지에서 확인. 영상은 유튜브 공식 임베드(채널 업로드 목록)로 보여 줌 → 항상 최신
// 뉴스: Supabase Edge Function 'feeds'가 RSS를 대신 받아 줌 (허용 주소만, 15분 캐시)
// 스토어: 레고 공식 사이트 스토어 찾기(lego.com/ko-kr/stores) 기준. 주소는 공식 영문 주소를 한글로 옮김

// 이름|채널 ID|핸들|kr·world|한 줄 소개
// 2026-11-02 사용자: "이상훈TV처럼 어른 수집가·레고 리뷰 결" — 최근 영상까지 확인해서 고름.
// 뺀 것: 흑백리뷰(먹방 채널), 레고 단추(요즘 건담·트랜스포머), 늦가을(레고 콩트 쇼츠), 레고웅(닌자고 설정 해설), 레고매니아(2024년 뒤로 안 올림)
window.BRICK_YT = `
이상훈TV|UCY-d9-BjGZtnETUVdWqOt4Q|@LeeSanghoontv|kr|개그맨 이상훈의 레고·피규어 수집 리뷰 (25년 수집가, 토이 뮤지엄)
레고도사꾸삐|UCmA7038F43v888Q82sNTNCw|@kupibricks|kr|국내 대표 레고 채널 — 신제품 리뷰·공식몰 프로모션 이야기
레고따단 DDadan|UC2BRSQm6_TSz2Y5zWU6fUfQ|@LegoDdadan|kr|레고 수집가 출신 레고 전문 채널, 레고 창작 대회
ABUJI BRICK 브릭 아부지|UCKha6gyKf5v8s9-WrVBlS8w|@ABUJI-BRICK|kr|매달 신제품 소식·자동차 세트 리뷰·브릭 창작가 인터뷰
브릭키|UC5GGGj_QmUaeRlhMnCq7pzQ|@브릭키|kr|"이 레고는 사지 마세요" — 솔직한 구매 조언 리뷰
문워커 Moon Walker|UCC0I6GYZxzyNadv27tjz-lQ|@MoonWalkerLEGO|kr|레고에 진심인 어른의 레고 놀이·합체 영상
학희 haki|UCeQ5bROeD75lIvD-hsf15kQ|@hakibrick|kr|레고 스타워즈 덕후의 대형 세트 리뷰·할인 정보
삐요의 블럭리뷰|UCQEN1RKh_9INXIcq0kldBww|@레고삐요|kr|레고·옥스포드 리뷰, 출시 예정 소식
LEGO (공식)|UCP-Ng5SXUEt0VE-TXqRdL6g|@lego|world|레고 본사 공식 채널 — 신제품 영상
Brick Technology|UCUuvZ0skL2WYZ3rhPMZbfdA|@BrickTechnology|world|레고로 만드는 기계·과학 실험
Brick Experiment Channel|UClsFdM0HzTdF1JYoraQ0aUw|@BrickExperimentChannel|world|레고 테크닉 실험
JANGBRiCKS|UCH09uL3dLqsVsOh0XmapzLQ|@JANGBRiCKS|world|신제품 리뷰
RacingBrick|UCfU8ME4_m48QwDJCUvpzqyQ|@Racingbrick|world|테크닉·자동차 세트 리뷰
Tiago Catarino|UCqLbTAc5Mn2cJDu1-FZ2W3g|@TiagoCatarino|world|레고 디자인 이야기
BrickVault|UCrhb3SP2lZBgguLHIWWuHOQ|@brickvault|world|레고 역사·이야기
PuzzLEGO|UC4GaWcWGhh5n1WmJvb1oBkA|@PuzzLEGO|world|레고로 만든 퍼즐·장치
MandRproductions|UCLnr9MzQ_v_a_OPmJkye5lA|@MandRproductions|world|레고 영상
brickhubs|UC0Xx7xOz0L9_DUzkZcDrsdg|@BrickHubs|world|레고 영상
`;

// 채널 프로필 사진 (2026-11-02 각 채널 페이지 og:image에서 가져옴). 채널이 사진을 바꾸면 옛 주소가 안 열릴 수 있음 → 사이트는 글자 동그라미로 대신
// 값 = yt3.googleusercontent.com/ 뒤 경로 (크기 부분 "=s…" 빼고)
window.BRICK_YT_AVATAR = {
  'UCY-d9-BjGZtnETUVdWqOt4Q': 'ytc/AIdro_muMEj9o-CSx7NJO8bpCggKZOJguPfqY2NtEmCQFla2Tlg',
  'UCmA7038F43v888Q82sNTNCw': 'BVqfGlVVPTHqRSpXOqfkhCxC-t7IV6uKDa9QTeLEZQftkKmB7mXCorTr5Yownq3jXum-wySy4Ic',
  'UC2BRSQm6_TSz2Y5zWU6fUfQ': 'WGRveqsTai6tiP7FHpL6Lcq1ia64lrVgoUyhJm45CBsaiYEg5LzdWmDdKLIDwjjzVbUfvYRlAg',
  'UCKha6gyKf5v8s9-WrVBlS8w': 'mdC2PRRbLUrsQI5QZxGGgo4olT5hUufdnplNbWyIRkajbDL0ZeJXHA4UPBmanZS5yFkR1_Sx',
  'UC5GGGj_QmUaeRlhMnCq7pzQ': 'KV2WjVkRkWyT0PM4KG8abRVQ92NowqPy1ZZD1dx1Hr8qawkJ4EQHV0D3i8IGYPXtAZsX7P6ypQ',
  'UCC0I6GYZxzyNadv27tjz-lQ': 'Dlnl2R3KRL8OFYap5JxPW3ZEHlJr6IYLyfyzgj0K0qmuNaZ2GIDJ6q4hiZ3wVly_yAdGNJhq9Q',
  'UCeQ5bROeD75lIvD-hsf15kQ': 'X146qaDlbqHa1Ezme0d8wOPt4-c4-thm0-0I15f7VnQeEK09NsNiuBGxJIs_409gep_2gmQm2A',
  'UCQEN1RKh_9INXIcq0kldBww': 'RYsyu8ck-zv8HtNovIT6e450d14UXhDyE5D9S-04jqTYzHq2_YgPhSg23Hf2Ko3a8fXyZ-Q5',
  'UCP-Ng5SXUEt0VE-TXqRdL6g': 'gH8N9RvRWYqmXjYx9cs9OM5De_VA6w1-qxRYiEd2pJ1VvHvpT0iYhI7NQ8WAApIik0IANfuEoQ',
  'UCUuvZ0skL2WYZ3rhPMZbfdA': '7QMRvHdlzbb-ZggL_a0Qq0GBLZDw9yQJyxpdQRG34UNBnGPK7ehEWe74QDfxkbq8PCSc8XuBmg',
  'UClsFdM0HzTdF1JYoraQ0aUw': 'ytc/AIdro_m8-EAIC1BpP1XGw_bY5ECY9aO4x9jikMRjJH-aSJQp0-w',
  'UCH09uL3dLqsVsOh0XmapzLQ': 'awc5yhWXGI3voaVfkCnZXzJJDU3rEhGHiWFVBkxJyA3XLFOEZ3uFfRmwxtLgXVsjBTrVPbMI',
  'UCfU8ME4_m48QwDJCUvpzqyQ': 'ytc/AIdro_kbj-MLXk2UG9_EIL45DFL6vmXHysoYXyS-fsJ0D6gYyg',
  'UCqLbTAc5Mn2cJDu1-FZ2W3g': 'oyW5dkD2zh1W_ZHZBwW7wwjOC6Ve6bV6PS-pa5E2avyAsWrmF8ba26stpIdGJBcTuarVv6ihsQ',
  'UCrhb3SP2lZBgguLHIWWuHOQ': 'GGXtWDJgvoLKJNz7cQ44e1UdmiQmCjkD_EsafP13FISoj5LVsizLCAGPVWoYhcgal8h9RGC5',
  'UC4GaWcWGhh5n1WmJvb1oBkA': 'WMQ1fZIwvKYKxUiROt91VLNrLZPpX8wqMLICZkUtXcFS-Dhh0GM7tfVZfK4w6L7L_qZ1T_9xXw',
  'UCLnr9MzQ_v_a_OPmJkye5lA': 'ubyNE_6TqPrPp0nYBwpf7mKR0DF7DQh_onHLRuzlhsEIzWj-jGSYjuM5PA3fCRc0ZkHSzq2n3J0',
  'UC0Xx7xOz0L9_DUzkZcDrsdg': 'zovU08YR2L2KIHpIqHeRwhMMxqIz68IntobtcZRCS7atqB2XYKz7V0Lp-0KOQcX_jWki_UxsOQ',
};

// 뉴스 피드 (Edge Function 허용 목록과 같아야 함)
window.BRICK_NEWS_FEEDS = {
  kr: ['https://news.google.com/rss/search?q=' + encodeURIComponent('레고') + '&hl=ko&gl=KR&ceid=KR:ko'],
  world: ['https://www.brickfanatics.com/feed/', 'https://www.thebrickfan.com/feed/'],
};
// 공식 채널 바로가기
window.BRICK_SNS = [
  ['instagram', 'LEGO 인스타그램', '@lego · 레고 본사 공식', 'https://www.instagram.com/lego/'],
  ['youtube', 'LEGO 유튜브', '신제품 공개 영상', 'https://www.youtube.com/@lego'],
  ['news', 'LEGO 뉴스룸', '레고 그룹 공식 발표', 'https://www.lego.com/ko-kr/aboutus/newsroom'],
  ['store', '레고 공식몰 신제품', '한국 공식몰', 'https://www.lego.com/ko-kr/categories/new-sets-and-products'],
];

// 지역|매장 이름|주소|전화|영업시간
window.BRICK_STORES = `
서울|코엑스|서울 강남구 영동대로 513 (코엑스몰) B1|02-6002-3993|매일 10:30~22:00
서울|강남|서울 서초구 신반포로 176 10층|02-3479-1133|월~목 10:30~20:00 · 금~일 10:30~20:30
서울|김포|서울 강서구 하늘길 77|02-6116-3066|매일 10:30~22:00
서울|현대 목동|서울 양천구 목동동로 257 현대백화점 B2||
서울|아이파크 용산|서울 용산구 (아이파크몰)||
서울|롯데 잠실|서울 송파구 (롯데월드몰)||
서울|명동|서울 중구 남대문로 67 2층|02-2118-5235|
서울|월계|서울 노원구 마들로3길 15 2층|02-948-2514|
서울|여의도|서울 영등포구 여의대로 108|02-3277-0546|
서울|영등포|서울 영등포구 영중로 15 B1|02-3667-0308|
경기|동탄|경기 화성시 동탄역로 160|031-8036-3815|
경기|고양|경기 고양시 덕양구 고양대로 1955 3층|031-5173-3416|
경기|광교|경기 수원시 광교중앙로 124 6층|031-5174-7633|
경기|중동|경기 부천시 길주로 172|032-623-1032|
경기|판교|경기 성남시 분당구 판교역로146번길 20 5층|031-5170-1557|
경기|신세계 경기|경기 용인시 수지구 포은대로 536 신세계백화점 4층||
경기|수원|경기 수원시 권선구 세화로 134 3층|1577-0001|매일 10:30~22:00
인천|인천|인천 미추홀구 연남로 35 3층|032-242-2399|
강원|레고랜드 빅샵|강원 춘천시 (레고랜드 코리아 리조트)||
부산|롯데 부산 서면|부산 부산진구 (롯데백화점 부산본점)||
부산|신세계 센텀시티|부산 해운대구 (신세계 센텀시티)||
대구|더현대 대구|대구 중구 (더현대 대구)||
대전|신세계 대전|대전 유성구 (대전신세계 Art & Science)||
울산|현대 울산|울산 남구 삼산로 261 현대백화점 6층|052-228-0656|매일 10:30~20:00
경남|신세계 김해|경남 김해시 (신세계 김해점)||
`;
window.BRICK_STORES_DATE = '2026-10-29';
