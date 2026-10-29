// 레고 소식 · 유튜버 · 레고스토어 (2026-10-29 조사)
// 유튜브: 채널 ID는 각 채널 페이지에서 확인. 영상은 유튜브 공식 임베드(채널 업로드 목록)로 보여 줌 → 항상 최신
// 뉴스: Supabase Edge Function 'feeds'가 RSS를 대신 받아 줌 (허용 주소만, 15분 캐시)
// 스토어: 레고 공식 사이트 스토어 찾기(lego.com/ko-kr/stores) 기준. 주소는 공식 영문 주소를 한글로 옮김

// 이름|채널 ID|핸들|kr·world|한 줄 소개
window.BRICK_YT = `
레고도사꾸삐|UCmA7038F43v888Q82sNTNCw|@kupibricks|kr|조립·리뷰, 구독자 100만 넘는 국내 대표 레고 채널
레고따단 DDadan|UC2BRSQm6_TSz2Y5zWU6fUfQ|@LegoDdadan|kr|레고 리뷰와 스톱모션
흑백리뷰|UC5T4b53jVkm07JbYoyYiu7A|@흑백리뷰|kr|레고·장난감 리뷰
Late autumn 늦가을|UCCT13ljH0QQrO0kCUH84llA|@lateautumn|kr|레고 리뷰
ABUJI BRICK 브릭 아부지|UCKha6gyKf5v8s9-WrVBlS8w|@ABUJI-BRICK|kr|레고 리뷰
레고 단추|UCoVlMBiDdz6HKOxXk1CkjaQ|@lego-button|kr|레고 리뷰
레고웅 LEGO WOONG|UCBxxzausXBbyu5JfM0PjrNg|@레고웅|kr|레고 리뷰
삐요의 블럭리뷰|UCQEN1RKh_9INXIcq0kldBww|@레고삐요|kr|블록 리뷰
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
