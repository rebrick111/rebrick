// 리브릭 —화면은 주소의 # 뒤로 나뉨: #/ 목록, #/item/번호 상세, #/sell 등록, #/edit/번호 수정,
// #/login 로그인, #/me 내 정보, #/chats 채팅 목록, #/chat/상품번호/구매자id 채팅방,
// #/set/세트번호 세트 시세, #/collection 내 컬렉션
const CFG = window.BRICK_CONFIG || {};
const CATALOG = window.BRICK_CATALOG || {};
const MARKET = window.BRICK_MARKET || {};
const BL = window.BRICK_BL || {};
const PROMOS = window.BRICK_PROMOS || [];
// 코믹콘 한정판 · 테마별 명작 (limited.js)
const LIMITED = (window.BRICK_LIMITED || '').trim().split('\n').filter(Boolean).map(l => {
  const [id, name, year, event, kind, qty, retail, value, theme] = l.split('|');
  return { id, no: id.replace(/-1$/, ''), name, year: +year, event, kind, qty: +qty || 0, retail: +retail || 0, value: +value || 0, theme };
});
const ICONIC = Object.fromEntries(Object.entries(window.BRICK_ICONIC || {}).map(([t, s]) => [t, s.trim().split('\n').map(l => {
  const [no, retail, value, note] = l.split('|');
  return { no, retail: +retail || 0, value: +value || 0, note };
})]));
const SDCC = window.BRICK_SDCC_NEXT;
// 공식몰 전체 목록(store.js)을 세트 정보에 합침: 공식몰 이름·피스·정가·판매 상태
const storeTheme = t => ({ '레고 아이콘': '아이콘즈', '크리에이터 엑스퍼트': '아이콘즈', '반지의 제왕': '아이콘즈', '스파이더맨': '마블', '아키텍쳐': '아키텍처',
  '겨울왕국': '디즈니', '크리에이터 3-in-1': '크리에이터', '미니피겨 시리즈': '미니피규어', '블루이': '듀플로' })[t] || t;
(window.BRICK_STORE || '').trim().split('\n').forEach(line => {
  const [no, name, price, list, pcs, theme, avail, sale, flags] = line.split('|');
  if (!no) return;
  const old = CATALOG[no] || {};
  CATALOG[no] = { ...old, name, theme: old.theme && old.theme !== '기타' ? old.theme : storeTheme(theme), pieces: +pcs || old.pieces || 0,
    msrp: +(list || price), store: { price: +price, avail, sale: +sale || 0, flags: (flags || '').split(' ').filter(Boolean) } };
});
// 역대 전 세트·미니피규어(allsets.js, Rebrickable 자료): 없는 번호는 새로 넣고, 있는 번호엔 영어 이름(검색용)·연도·피스만 보탬
{
  const T = window.BRICK_ALL_THEMES || [];
  const merge = (no, en, year, theme, pcs, rbf) => {
    const c = CATALOG[no];
    if (!c) { CATALOG[no] = { name: en, theme, pieces: pcs, ...(year ? { year } : {}), en: true, rb: true, ...(rbf ? { rbf } : {}) }; return; }
    c.alias = [c.alias, en].filter(Boolean).join(' ');
    c.rb = true;
    if (rbf) c.rbf = rbf;
    if (!c.year && year) c.year = year;
    if (!c.pieces && pcs) c.pieces = pcs;
  };
  (window.BRICK_ALL_SETS || '').trim().split('\n').forEach(l => { const [no, en, y, t, p] = l.split('|'); if (no) merge(no, en, +y, T[+t] || '기타', +p || 0); });
  (window.BRICK_ALL_FIGS || '').trim().split('\n').forEach(l => { const [id, en, p, f] = l.split('|'); if (id) merge(id, en, 0, '미니피규어', +p || 0, +f || 0); });
  // 명작 세트는 한글 이름으로 (영어 이름은 검색용 별명으로)
  Object.entries(window.BRICK_ICONIC_NAMES || {}).forEach(([no, ko]) => { const c = CATALOG[no]; if (c?.en) { c.alias = [c.alias, c.name].filter(Boolean).join(' '); c.name = ko; c.en = false; } });
}
const legoUrl = no => `https://www.lego.com/ko-kr/search?q=${encodeURIComponent(no)}`;
// 판매 상태 → 짧은 표시
function storeBadge(no) {
  const s = CATALOG[no]?.store;
  if (!s) return null;
  if (/출시 예정/.test(s.avail)) return { cls: 'soon', text: '📅 ' + s.avail.replace(/^\d{4}년 /, '') };
  if (/선주문|출고 예정/.test(s.avail)) return { cls: 'soon', text: '🛒 ' + (/선주문/.test(s.avail) ? '선주문 중' : s.avail.replace(/^\d{4}년 /, '')) };
  if (s.sale) return { cls: 'sale', text: `🔥 ${s.sale}% 할인` };
  if (s.flags.includes('retiringSoon')) return { cls: 'retire', text: '⏳ 곧 단종' };
  if (/품절/.test(s.avail)) return { cls: 'out', text: '일시 품절' };
  if (s.flags.includes('new')) return { cls: 'new', text: '✨ 신제품' };
  return null;
}
const badgeEl = no => { const b = storeBadge(no); return b ? el('span', { class: 'sbadge ' + b.cls }, b.text) : ''; };
const ymdNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const promoState = p => { const t = ymdNow(); return p.to && p.to < t ? 'past' : p.from && p.from > t ? 'soon' : p.from || p.to ? 'now' : 'soon'; };
const promosFor = no => PROMOS.filter(p => promoState(p) !== 'past' && p.need?.includes(no));
const isFig = no => (window.BRICK_FIG_RE || /^[a-z]{2,4}\d{3,4}[a-z]?$/i).test(String(no || '').trim());
// 브릭링크 상품 화면 주소 (가격 가이드 탭). 세트는 보통 "번호-1"
const blLink = no => { const f = isFig(no), id = BL[no]?.id || (f ? no : `${no}-1`); return `https://www.bricklink.com/v2/catalog/catalogitem.page?${f ? 'M' : 'S'}=${encodeURIComponent(id)}#T=P`; };
const blOf = (no, cond) => { const b = BL[no]; return b ? (cond === 'sealed' ? b.new : b.used) || null : null; };
const pct = (a, b) => Math.round((a / b - 1) * 100);
const diffText = (a, b, what) => {
  const d = pct(a, b);
  if (d >= 100) return `${what}의 약 ${(a / b).toFixed(1)}배예요`;
  return d === 0 ? `${what}와 같아요` : `${what}보다 ${Math.abs(d)}% ${d > 0 ? '비싸요' : '싸요'}`;
};
const THEMES = { '스타워즈': '#3a4a63', '테크닉': '#4c5560', '아이콘즈': '#8a5a2b', '시티': '#2b6cb0', '해리포터': '#6b2730',
                 '마블': '#b0302a', '아이디어': '#3d7a46', '아키텍처': '#5b5e66', '보태니컬': '#4f7d3a', '스피드 챔피언': '#a8461f',
                 '프렌즈': '#c0507a', '닌자고': '#2f6f5e', '올드 레고': '#7b5e3b', '미니피규어': '#b8860b', '디즈니': '#3b5fa8', '마인크래프트': '#4b7f2f',
                 '크리에이터': '#c2701f', '슈퍼 마리오': '#c43a2f', 'DC': '#2d3a55', '쥬라기 월드': '#6b6b2a', '포켓몬': '#d4a017', '듀플로': '#d9502b', '기타': '#6c6f7a' };
const STICKER = { '': '모름 · 해당 없음', unapplied: '안 붙임 (스티커 따로 있음)', applied: '붙임', none: '스티커 없는 세트' };
const TRADE = { direct: '직거래', delivery: '택배' };
const REPORT_REASONS = { prepay: '선입금만 요구해요', outside: '다른 메신저·링크로 유도해요', fake: '가품·호환 블록 같아요',
                         mismatch: '사진·설명과 실물이 달라요', noshow: '연락이 끊겼어요 (잠수)', etc: '기타' };
// 채팅에서 사기 때 자주 나오는 말 → 주의 안내
const RISK_PATTERNS = [
  [/카톡|카카오|오픈\s*채팅|텔레그램|라인\s*아이디|open\.kakao|t\.me\/|kakao/i, '다른 메신저로 옮기자고 하면 조심하세요. 대화 기록이 사라져서 사기를 당해도 증거가 없어요.'],
  [/https?:\/\/|www\.|\.com\b|\.kr\b|bit\.ly/i, '모르는 링크는 누르지 마세요. 가짜 "안전결제" 페이지로 돈을 받아 가는 사기가 많아요.'],
  [/안전\s*결제|안전\s*거래\s*링크|에스크로|결제\s*링크/i, '리브릭에는 안전결제 기능이 없어요. 안전결제 링크를 보내면 사기일 가능성이 매우 커요.'],
  [/선입금|입금\s*먼저|먼저\s*입금|계약금|예약금/i, '물건을 보기 전에 돈부터 보내라고 하면 조심하세요. 택배거래라면 더치트에서 계좌·전화번호를 먼저 조회하세요.'],
  [/상품권|기프트\s*카드|문화상품권|코인|비트코인|usdt/i, '상품권·코인으로 결제하자고 하면 거의 사기예요.'],
  [/인증\s*번호|인증\s*코드|otp/i, '인증번호는 누구에게도 알려 주지 마세요. 계정이 털릴 수 있어요.'],
];
const riskOf = text => RISK_PATTERNS.filter(([re]) => re.test(text)).map(([, msg]) => msg);
const COND = { sealed: '미개봉', complete: '개봉 · 완전체', missing: '개봉 · 일부 누락', parts: '부품 · 벌크' };
const STATUS = { selling: '판매중', reserved: '예약중', sold: '판매완료' };
const MAX_PHOTOS = 5;

const configured = /^https:\/\/.+\.supabase\.co$/.test(CFG.url || '') && CFG.anonKey && !CFG.anonKey.includes('YOUR-');
const sb = configured ? window.supabase.createClient(CFG.url, CFG.anonKey) : null;
let me = null, channel = null;
const filters = { theme: '', cond: '', trade: '', sort: 'new', q: '', showSold: false };
const $view = document.getElementById('view');

// ---- 도우미 ---------------------------------------------------------------
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n[k] = v; else n.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(k => k != null && k !== '' && n.append(k));
  return n;
}
const won = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';
const ppp = it => it.pieces > 0 && it.price > 0 ? Math.round(it.price / it.pieces) : null;
const msrpOf = it => CATALOG[it.set_no]?.msrp || 0;
function vsMsrp(it) {
  const m = msrpOf(it);
  if (!m || !it.price) return null;
  const d = Math.round((it.price / m - 1) * 100);
  return d < 0 ? { text: `정가보다 ${-d}% 싸요`, cls: 'vs down' } : d > 0 ? { text: `정가보다 ${d}% 비싸요`, cls: 'vs up' } : { text: '정가와 같아요', cls: 'vs' };
}
// 세트·미니피규어 공식 이미지 (Rebrickable 이미지 서버). 세트는 "번호-1", 미니피규어는 Rebrickable 번호, 행사 한정판은 번호 연결표
const RB_IMG = 'https://cdn.rebrickable.com/media/sets/';
const RBMAP = Object.fromEntries(Object.entries(window.BRICK_RB_SETMAP || {}).map(([k, v]) => [k.toLowerCase(), v]));
function imgOf(no) {
  no = String(no || '').trim();
  if (!no) return '';
  const lo = no.toLowerCase(), full = /-\d+$/.test(lo) ? lo : lo + '-1';
  // 코믹콘 미니피규어(블리스터)는 안에 든 미니피규어 사진이 먼저 (블리스터 세트 번호엔 사진이 없는 경우가 많음)
  const figFor = (window.BRICK_LIMITED_FIG || {})[lo.replace(/-1$/, '')];
  const c = CATALOG[figFor || no] || CATALOG[lo];
  if (c?.rbf) return `${RB_IMG}fig-${String(c.rbf).padStart(6, '0')}.jpg`;
  if (RBMAP[full]) return RB_IMG + RBMAP[full] + '.jpg';
  // 공식몰 세트는 역대 목록에서 뺀 것(조립판 등)이나 새로 나온 것도 이미지가 있을 수 있어 일단 시도 (없으면 자리표시)
  return (c?.rb || c?.store) && !isFig(no) ? RB_IMG + (/-\d+$/.test(no) ? no : no + '-1') + '.jpg' : '';
}
// 표 한 줄용 작은 이미지 + 세트번호
function miniThumb(no) {
  const src = imgOf(no);
  const img = src ? el('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : el('i', {});
  if (src) img.onerror = () => img.replaceWith(el('i', {}));
  return el('a', { class: 'refthumb', href: `#/set/${encodeURIComponent(no)}`, 'aria-label': `${no} 시세` }, img, el('span', { class: 'setno' }, `#${no}`));
}
const placeholder = it => el('div', { class: 'ph', style: `--c:${THEMES[it.theme] || THEMES['기타']}`, role: 'img', 'aria-label': `${it.name || it.set_no || ''} 사진 없음` },
  el('small', {}, it.theme || ''), el('span', { class: String(it.set_no || '').length > 6 ? 'long' : null }, it.set_no || '?'));
// 판매자 사진 → 없으면 공식 이미지(판매 글이면 '공식 이미지' 표시) → 그것도 없으면 테마색 자리표시
function thumb(it) {
  if (it.photos?.length) return el('img', { src: it.photos[0], alt: `${it.name} 사진`, loading: 'lazy' });
  const src = imgOf(it.set_no);
  if (!src) return placeholder(it);
  const box = el('div', { class: 'catimg' });
  const img = el('img', { src, alt: `${it.name || it.set_no} 공식 이미지`, loading: 'lazy', referrerpolicy: 'no-referrer' });
  img.onerror = () => box.replaceWith(placeholder(it));
  box.append(img);
  if (it.id) box.append(el('span', { class: 'catnote' }, '공식 이미지'));
  return box;
}
// 선 아이콘 (24×24, 선 색 = 글자색)
const ICONS = {
  chart: 'M4 19h16M6 15l4-4 3 3 5-6M15 8h3v3',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9 7 12 7zm0 0c1.5-3 5-3.5 5-1.2C17 7 15 7 12 7z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4',
  chat: 'M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6',
  plus: 'M12 5v14M5 12h14',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5',
  tip: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  camera: 'M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  play: 'M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM10 9l5 3-5 3z',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  paper: 'M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5',
};
function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  p.setAttribute('d', ICONS[name]); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '1.9'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
  s.append(p);
  return s;
}
const status = (text, err) => el('div', { class: 'status' + (err ? ' err' : ''), 'aria-live': 'polite' }, text || '');
const show = (...nodes) => $view.replaceChildren(...nodes);
function errMsg(e) {
  const m = e?.message || '';
  if (/rate limit|too many/i.test(m)) return '메일을 너무 자주 보냈어요. 1시간쯤 뒤에 다시 해 주세요.';
  if (/failed to fetch|network/i.test(m)) return '인터넷 연결이 불안정해요. 잠시 뒤 다시 해 주세요.';
  if (/invalid.*email|email.*invalid/i.test(m)) return '이메일 주소를 다시 확인해 주세요.';
  return m ? `문제가 생겼어요: ${m}` : '문제가 생겼어요. 잠시 뒤 다시 해 주세요.';
}
let toastTimer;
function toast(text, err) {
  const t = document.getElementById('toast');
  t.textContent = text; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
}
const isHome = () => !filters.q.trim() && !filters.theme && !filters.cond && !filters.trade;
// update_2.sql / update_3.sql 을 아직 안 돌렸으면 새 칸이 없음 → 안내
const needUpdate = e => /trade_|ship_fee|meet_place|reports/.test(e?.message || '')
  ? '저장소 설계도가 예전 버전이에요. Supabase SQL Editor에서 update_2.sql 을 한 번 실행해 주세요.'
  : /sold_|figs_|sticker|yellowed|has_tray|collections|set_prices/.test(e?.message || '')
  ? '저장소 설계도가 예전 버전이에요. Supabase SQL Editor에서 update_3.sql 을 한 번 실행해 주세요.' : errMsg(e);

// ---- 시세 -------------------------------------------------------------------
// 리브릭 실거래(set_prices, 판매완료 때 적은 가격) → 없으면 market.js 참고 시세(중고 매물 조사)
const fmtRange = r => r[0] === r[1] ? won(r[0]) : `${won(r[0])} ~ ${won(r[1])}`;
const mid = r => Math.round((r[0] + r[1]) / 2);
async function soldStats(nos) {
  if (!nos.length) return [];
  const { data, error } = await sb.from('set_prices').select('*').in('set_no', nos);
  return error ? [] : data;   // update_3.sql 전이면 실거래 없이 참고 시세만
}
function estimate(no, cond, stats) {
  const s = stats.find(x => x.set_no === no && x.cond === cond);
  if (s) return { v: s.avg_price, src: `리브릭 실거래 ${s.n}건` };
  const m = MARKET[no], r = cond === 'sealed' ? m?.sealed : cond === 'complete' ? m?.used : null;
  if (r) return { v: mid(r), src: '중고 매물 참고' };
  const b = ['sealed', 'complete'].includes(cond) ? blOf(no, cond) : null;
  return b ? { v: b[1], src: '브릭링크 평균 (해외)' } : null;
}
const searchText = (no, c) => `${no} ${c.name} ${c.alias || ''}`.toLowerCase();
const tradeBadges = it => [it.trade_direct ? el('span', { class: 'trade' }, '🤝 직거래') : '',
  it.trade_delivery ? el('span', { class: 'trade' }, '📦 택배' + (it.ship_fee ? ` +${won(it.ship_fee)}` : ' (택배비 포함)')) : ''];
// 정가보다 지나치게 싼 미개봉·완전체 → 사기 미끼일 수 있음
const tooCheap = it => { const m = msrpOf(it); return m && it.price && ['sealed', 'complete'].includes(it.cond) && it.price < m * 0.5; };
const daysSince = d => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
function needLogin() {
  show(el('section', { class: 'panel' }, el('h2', {}, '로그인이 필요해요'), el('p', {}, '판매 등록과 채팅은 로그인한 뒤에 쓸 수 있어요.'),
    el('div', {}, el('a', { class: 'btn primary', href: '#/login' }, '로그인하러 가기'))));
}

// ---- 위쪽 메뉴 -------------------------------------------------------------
function renderNav() {
  const nav = document.getElementById('nav');
  if (!sb) { nav.replaceChildren(); return; }
  // 둘러보기 메뉴(시세·신제품 등)는 index.html의 #menu, 여기는 판매하기·채팅·내 정보만 (로그아웃은 내 정보 화면에)
  nav.replaceChildren(...(me
    ? [el('a', { class: 'btn icon', href: '#/chats', 'aria-label': '채팅', title: '채팅' }, icon('chat')),
       el('a', { class: 'btn icon', href: '#/me', 'aria-label': '내 정보', title: '내 정보' }, icon('user'))]
    : [el('a', { class: 'btn ghost', href: '#/login' }, '로그인')]),
    el('a', { class: 'btn primary', href: '#/sell' }, icon('plus'), el('span', { class: 'label' }, '판매하기')));
}
// ☰ 전체 메뉴 서랍: 버튼·바깥·✕·Esc·메뉴 고르면 닫힘
const drawer = document.getElementById('drawer'), menuBtn = document.getElementById('menuBtn');
function setDrawer(open) {
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  menuBtn.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) {
    document.getElementById('drawerFoot').replaceChildren(me
      ? el('div', { class: 'small' }, `${me.email} 로그인 중`)
      : el('a', { class: 'btn', href: '#/login' }, '로그인 / 가입'));
    drawer.querySelector('.drawer-panel').focus();
  } else if (drawer.contains(document.activeElement)) menuBtn.focus();
}
menuBtn.onclick = () => setDrawer(!drawer.classList.contains('open'));
drawer.addEventListener('click', e => { if (e.target.closest('[data-close], a')) setDrawer(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) setDrawer(false); });
// 로고·'홈'을 누르면 검색어·테마·상태·거래 방식·정렬을 모두 지우고 처음 화면으로
// (이미 #/ 이면 주소가 안 바뀌어 화면이 그대로라서 직접 다시 그림)
document.querySelectorAll('.logo, #menu a[href="#/"], #drawer a[href="#/"]').forEach(a => a.addEventListener('click', () => {
  Object.assign(filters, { q: '', theme: '', cond: '', trade: '', sort: 'new', showSold: false });
  document.getElementById('q').value = '';
  if (location.hash === '#/' || !location.hash) { window.scrollTo(0, 0); renderList(); }
}));
// 둘러보기 메뉴에서 지금 화면 표시
function markMenu() {
  const h = location.hash || '#/';
  // 위쪽 메뉴·서랍 메뉴 각각에서 지금 화면에 가장 잘 맞는 링크 하나 표시
  for (const sel of ['#menu a', '.dgroup a']) {
    const links = [...document.querySelectorAll(sel)];
    const best = links.filter(a => a.getAttribute('href') === '#/' ? h === '#/' || h === '#' : h.startsWith(a.getAttribute('href')))
      .sort((a, b) => b.getAttribute('href').length - a.getAttribute('href').length)[0];
    links.forEach(a => a === best ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  }
}
let qTimer;
document.getElementById('q').oninput = e => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    filters.q = e.target.value;
    if (!location.hash || location.hash === '#/') renderList(); else location.hash = '#/';
  }, 300);
};

// ---- 길 찾기 ---------------------------------------------------------------
async function route() {
  if (channel) { sb.removeChannel(channel); channel = null; }
  if (!sb) return renderSetup();
  const [page, a, b] = location.hash.replace(/^#\/?/, '').split('/');
  window.scrollTo(0, 0);
  markMenu();
  try {
    if (page === 'item' && a) return await renderItem(+a);
    if (page === 'sell') return await renderForm(null, a ? decodeURIComponent(a) : '');
    if (page === 'edit' && a) return await renderForm(+a);
    if (page === 'login') return renderLogin();
    if (page === 'me') return await renderMe();
    if (page === 'chats') return await renderChats();
    if (page === 'chat' && a && b) return await renderChat(+a, b);
    if (page === 'safety') return renderSafety();
    if (page === 'guide') return renderGuide(a === 'delivery' ? 'delivery' : 'direct');
    if (page === 'prices') return renderPrices(a ? decodeURIComponent(a) : '');
    if (page === 'set' && a) return await renderSet(decodeURIComponent(a));
    if (page === 'compare') return renderCompare();
    if (page === 'new') return renderNew(a || 'soon');
    if (page === 'promos') return renderPromos();
    if (page === 'limited') return renderLimited();
    if (page === 'themes') return renderThemes();
    if (page === 'theme' && a) return await renderTheme(decodeURIComponent(a));
    if (page === 'sellguide') return renderSellGuide();
    if (page === 'news') return renderNews();
    if (page === 'youtube') return renderYouTube(a ? decodeURIComponent(a) : '');
    if (page === 'stores') return renderStores();
    if (page === 'collection') return await renderCollection(a ? decodeURIComponent(a) : '');
    if (page === 'report' && a) return await renderReport(+a);
    return await renderList();
  } catch (e) { show(el('section', { class: 'panel' }, el('h2', {}, '화면을 열지 못했어요'), status(errMsg(e), true))); }
}
window.addEventListener('hashchange', route);

function renderSetup() {
  show(el('section', { class: 'panel' },
    el('h2', {}, '아직 저장소(Supabase)가 연결되지 않았어요'),
    el('p', {}, 'config.js 파일에 Supabase 프로젝트 주소와 anon 키를 넣으면 사이트가 켜져요. 설정 방법은 같은 폴더의 사용법 파일에 있어요.')));
}

// ---- 목록 -----------------------------------------------------------------
async function renderList() {
  const chips = el('div', { class: 'filters scroll', role: 'group', 'aria-label': '테마' }, ['', ...Object.keys(THEMES)].map(t =>
    el('button', { class: 'chip', 'aria-pressed': String(filters.theme === t), onclick: () => { filters.theme = t; renderList(); } }, t || '전체')));
  const cond = el('select', { id: 'fCondSel', 'aria-label': '상태' }, el('option', { value: '' }, '모든 상태'),
    Object.entries(COND).map(([v, t]) => el('option', { value: v, selected: filters.cond === v }, t)));
  cond.onchange = () => { filters.cond = cond.value; renderList(); };
  const trade = el('select', { id: 'fTradeSel', 'aria-label': '거래 방식' }, [['', '모든 거래 방식'], ['direct', '직거래 가능'], ['delivery', '택배 가능']]
    .map(([v, t]) => el('option', { value: v, selected: filters.trade === v }, t)));
  trade.onchange = () => { filters.trade = trade.value; renderList(); };
  const sort = el('select', { id: 'fSortSel', 'aria-label': '정렬' }, [['new', '최신순'], ['low', '낮은 가격순'], ['high', '높은 가격순'], ['ppp', '피스당 가격 낮은순']]
    .map(([v, t]) => el('option', { value: v, selected: filters.sort === v }, t)));
  sort.onchange = () => { filters.sort = sort.value; renderList(); };
  const sold = el('input', { type: 'checkbox', id: 'fSold', checked: filters.showSold, style: 'width:auto' });
  sold.onchange = () => { filters.showSold = sold.checked; renderList(); };
  const summary = el('span', { class: 'summary' }, '불러오는 중…');
  const grid = el('div', { class: 'grid', 'aria-label': '상품 목록', 'aria-busy': 'true' },
    Array.from({ length: 5 }, () => el('div', { class: 'card skel', 'aria-hidden': 'true' }, el('div', { class: 'thumb' }),
      el('div', { class: 'body' }, el('i', {}), el('i', {}), el('i', { class: 'short' })))));
  const home = isHome();
  const q0 = filters.q.trim();
  // 리브릭의 주인공은 중고거래 → 첫 화면은 얇은 배너 바로 아래 매물, 바로가기·소식·시세는 그 아래
  show(home ? renderHero('banner') : '',
    el('section', { class: 'section' },
      el('div', { class: 'sec-head' }, el('h2', {}, q0 ? `'${q0}' 검색 결과` : home ? '방금 올라온 세트' : '상품'), summary,
        el('a', { class: 'more', href: '#/sell' }, '+ 내 세트 팔기')),
      chips,
      el('div', { class: 'filters scroll' }, cond, trade, sort, el('label', { class: 'small', style: 'display:inline-flex;gap:6px;align-items:center;flex:none' }, sold, '판매완료도 보기')),
      grid),
    home ? renderHero('extras') : '',
    home ? (() => {   // 레고 소식 (국내 뉴스 5개, 늦게 와도 화면은 먼저)
      const box = el('div', { class: 'nlist' }, el('div', { class: 'hint' }, '불러오는 중…'));
      loadFeeds(window.BRICK_NEWS_FEEDS.kr).then(items => box.replaceChildren(newsTicker(items.slice(0, 12)))).catch(() => box.replaceChildren(el('div', { class: 'hint' }, '소식을 불러오지 못했어요.')));
      return el('section', { class: 'section two' },
        el('div', { class: 'section' }, el('div', { class: 'sec-head' }, el('h2', {}, '레고 소식'), el('span', { class: 'live' }, '실시간'), el('a', { class: 'more', href: '#/news' }, '더 보기 →')), box),
        el('div', { class: 'section' }, el('div', { class: 'sec-head' }, el('h2', {}, '레고 유튜버'), el('a', { class: 'more', href: '#/youtube' }, '전체 →')),
          el('div', { class: 'ymini' }, YT.filter(c => c.area === 'kr').slice(0, 4).concat(YT.filter(c => c.area === 'world').slice(0, 2)).map(c =>
            el('a', { class: 'ych', href: `#/youtube/${c.id}` }, el('span', { class: 'yav', style: `--h:${[...c.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360}` }, c.name.replace(/^LEGO.*/, 'L').slice(0, 1)),
              el('span', { class: 'ytxt' }, el('b', {}, c.name), el('span', { class: 'small' }, c.note)))))));
    })() : '',
    home ? renderRails() : '',
    home ? (() => { const { n } = themeCounts(); return el('section', { class: 'section' },
      el('div', { class: 'sec-head' }, el('div', {}, el('h2', {}, '테마별로 둘러보기'), el('p', {}, '명작 시세 · 한정판 · 곧 단종을 테마별로')), el('a', { class: 'more', href: '#/themes' }, '전체 테마 →')),
      el('div', { class: 'ttiles' }, ['스타워즈', '해리포터', '마블', '올드 레고', '아이콘즈', '테크닉', '닌자고', '미니피규어'].map(t => themeTile(t, n[t])))); })() : '',
    home ? renderPriceGuide() : '');

  let qy = sb.from('listings').select('*').limit(120);
  if (!filters.showSold) qy = qy.neq('status', 'sold');
  if (filters.theme) qy = qy.eq('theme', filters.theme);
  if (filters.cond) qy = qy.eq('cond', filters.cond);
  if (filters.trade) qy = qy.eq(`trade_${filters.trade}`, true);
  const q = filters.q.trim().replace(/[,()%*\\]/g, ' ').trim();
  if (q) qy = qy.or(`set_no.ilike.%${q}%,name.ilike.%${q}%`);
  qy = filters.sort === 'low' ? qy.order('price') : filters.sort === 'high' ? qy.order('price', { ascending: false }) : qy.order('created_at', { ascending: false });
  const { data, error } = await qy;
  if (error) { grid.replaceChildren(el('div', { class: 'status err', style: 'grid-column:1/-1' }, needUpdate(error))); summary.textContent = ''; return; }
  let list = data;
  if (filters.sort === 'ppp') list = [...list].sort((a, b) => (ppp(a) ?? 1e12) - (ppp(b) ?? 1e12));
  summary.textContent = `상품 ${list.length}개`;
  grid.replaceChildren(); grid.removeAttribute('aria-busy');
  if (!list.length) {
    const any = q || filters.theme || filters.cond || filters.trade;
    grid.append(el('div', { class: 'empty', style: 'grid-column:1/-1' },
      (() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'big'); s.innerHTML = '<use href="#mark"/>'; return s; })(),
      el('b', {}, any ? '조건에 맞는 상품이 없어요' : '첫 번째 판매자가 되어 주세요'),
      any ? '다른 이름이나 세트번호로 찾아보세요.' : '세트번호만 넣으면 이름·피스 수·공식몰 정가가 자동으로 채워져요.',
      el('a', { class: 'btn primary', href: '#/sell' }, icon('plus'), '내 세트 팔기')));
    return;
  }
  grid.append(...list.map(listingCard));
}
// 상품 카드: 정사각 사진 → 이름 → 가격 → 정가 대비 → 상태·거래 방식 → 세트번호·지역
function listingCard(it) {
  const p = ppp(it), v = vsMsrp(it);
  return el('a', { class: 'card' + (it.status === 'sold' ? ' sold' : ''), href: `#/item/${it.id}` },
    el('div', { class: 'thumb' }, thumb(it), it.status !== 'selling' ? el('span', { class: 'flag' }, STATUS[it.status]) : ''),
    el('div', { class: 'body' },
      el('div', { class: 'name' }, it.name),
      el('div', { class: 'price' }, won(it.price)),
      v ? el('div', { class: v.cls }, v.text) : '',
      el('div', { class: 'tags' }, el('span', { class: `cond ${it.cond}` }, COND[it.cond]), tradeBadges(it)),
      el('div', { class: 'meta' }, [`#${it.set_no}`, it.region || '지역 미정', p ? `피스당 ${p.toLocaleString('ko-KR')}원` : ''].filter(Boolean).join(' · '))));
}
// 공식몰 세트 카드 (상품이 아직 없을 때도 첫 화면이 비어 보이지 않게)
function setCard([no, c], flagText) {
  return el('a', { class: 'card', href: `#/set/${no}` },
    el('div', { class: 'thumb' }, thumb({ set_no: no, theme: c.theme, name: c.name }), flagText ? el('span', { class: 'flag store' }, flagText) : ''),
    el('div', { class: 'body' },
      el('div', { class: 'name' }, c.name),
      el('div', { class: 'price' }, c.msrp ? won(c.store?.price || c.msrp) : '-'),
      el('div', { class: 'meta' }, [`#${no}`, c.theme, c.pieces ? `${c.pieces.toLocaleString('ko-KR')}피스` : ''].filter(Boolean).join(' · '))));
}
// ---- 움직이는 첫 화면: 가로 줄 자동 넘김 · 뉴스 전광판 ---------------------------------
// 마우스를 올리거나 손으로 만지는 동안·탭이 안 보일 때·'동작 줄이기' 설정이면 멈춤
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function hoverPause(box) {
  const s = { paused: false };
  box.addEventListener('pointerenter', () => { s.paused = true; });
  box.addEventListener('pointerleave', () => { s.paused = false; });
  box.addEventListener('focusin', () => { s.paused = true; });
  box.addEventListener('focusout', () => { s.paused = false; });
  box.addEventListener('touchstart', () => { s.paused = true; clearTimeout(s.t); }, { passive: true });
  box.addEventListener('touchend', () => { s.t = setTimeout(() => { s.paused = false; }, 5000); }, { passive: true });
  return s;
}
function railStep(rail, dir) {
  const card = rail.firstElementChild;
  if (!card) return;
  const step = card.getBoundingClientRect().width + (parseFloat(getComputedStyle(rail).columnGap) || 14);
  const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
  const atStart = rail.scrollLeft <= 4;
  rail.scrollTo({ left: dir > 0 ? (atEnd ? 0 : rail.scrollLeft + step) : (atStart ? rail.scrollWidth : rail.scrollLeft - step), behavior: calm() ? 'auto' : 'smooth' });
}
function autoSlide(rail, ms = 3500) {
  if (calm()) return;
  const s = hoverPause(rail);
  const t = setInterval(() => {
    if (!rail.isConnected) return clearInterval(t);
    if (!s.paused && !document.hidden) railStep(rail, 1);
  }, ms);
}
// 가로 줄 + ‹ › 버튼 + 자동 넘김
function slideRail(cards, ms) {
  const rail = el('div', { class: 'rail' }, cards);
  autoSlide(rail, ms);
  const arrows = el('div', { class: 'rail-arrows' },
    el('button', { type: 'button', class: 'rarrow', 'aria-label': '이전', onclick: () => railStep(rail, -1) }, '‹'),
    el('button', { type: 'button', class: 'rarrow', 'aria-label': '다음', onclick: () => railStep(rail, 1) }, '›'));
  return { rail, arrows };
}
// 뉴스 전광판: show 줄만 보이고 ms마다 한 줄씩 위로
function newsTicker(items, show = 4, ms = 3500) {
  const list = el('div', { class: 'ticker-list' }, items.map(newsRow));
  const box = el('div', { class: 'ticker' }, list);
  let i = 0;
  const fit = () => {
    const rows = [...list.children];
    if (!rows.length) return;
    box.style.height = rows.slice(i, i + show).reduce((a, r) => a + r.offsetHeight, 0) + 'px';
    list.style.transform = `translateY(-${rows[i].offsetTop}px)`;
  };
  requestAnimationFrame(fit);
  if (calm() || items.length <= show) return box;
  const s = hoverPause(box);
  const t = setInterval(() => {
    if (!box.isConnected) return clearInterval(t);
    if (s.paused || document.hidden) return;
    i = (i + 1) % (items.length - show + 1);
    fit();
  }, ms);
  addEventListener('resize', fit);
  return box;
}

function renderRails() {
  const all = Object.entries(CATALOG).filter(([, c]) => c.store);
  const rail = (title, desc, href, rows, flag) => {
    if (!rows.length) return '';
    const { rail: r, arrows } = slideRail(rows.map(x => setCard(x, flag)), 3200);
    return el('section', { class: 'section' },
      el('div', { class: 'sec-head' }, el('div', {}, el('h2', {}, title), el('p', {}, desc)), el('span', { class: 'grow' }), arrows, el('a', { class: 'more', href }, '전체 보기 →')),
      r);
  };
  return el('div', { style: 'display:grid;gap:28px' },
    rail('곧 단종되는 세트', '단종되면 중고 가격이 오르는 경우가 많아요', '#/new/retire',
      all.filter(([, c]) => c.store.flags.includes('retiringSoon')).sort((a, b) => b[1].msrp - a[1].msrp).slice(0, 12), '곧 단종'),
    rail('새로 나온 세트', '공식몰 신제품을 시세와 함께 확인하세요', '#/new/new',
      all.filter(([, c]) => c.store.flags.includes('new')).sort((a, b) => b[1].msrp - a[1].msrp).slice(0, 12), '신제품'));
}

// 첫 화면 소개 (검색·필터를 안 했을 때만)
// 배너 그림: 겹쳐 쌓인 브릭 세 개 (노랑·하양·연파랑)
const BANNER_ART = `<svg class="art" viewBox="0 0 440 300" aria-hidden="true">
  <defs><filter id="bs" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#0b1250" flood-opacity=".45"/></filter></defs>
  <g filter="url(#bs)">
    <g transform="translate(230 40) rotate(14)"><rect x="18" y="0" width="34" height="22" rx="9" fill="#9fb0ff"/><rect x="78" y="0" width="34" height="22" rx="9" fill="#9fb0ff"/><rect x="0" y="14" width="130" height="70" rx="18" fill="#9fb0ff"/></g>
    <g transform="translate(40 150) rotate(-7)"><rect x="20" y="0" width="38" height="24" rx="10" fill="#fff"/><rect x="86" y="0" width="38" height="24" rx="10" fill="#fff"/><rect x="152" y="0" width="38" height="24" rx="10" fill="#fff"/><rect x="0" y="16" width="210" height="86" rx="22" fill="#fff"/></g>
    <g transform="translate(150 92) rotate(-2)"><rect x="22" y="0" width="40" height="26" rx="11" fill="#ffc83d"/><rect x="92" y="0" width="40" height="26" rx="11" fill="#ffc83d"/><rect x="0" y="17" width="154" height="92" rx="24" fill="#ffc83d"/>
      <g fill="none" stroke="#18237a" stroke-width="9" stroke-linecap="round"><path d="M51 58 A27 27 0 0 1 101 56"/><path d="M103 77 A27 27 0 0 1 53 79"/></g>
      <g fill="#18237a"><path d="M107 69 L114 50 L94 55 Z"/><path d="M47 66 L40 85 L60 80 Z"/></g></g>
  </g></svg>`;
// part = 'banner' (얇은 배너, 매물 위) / 'extras' (바로가기·안내 띠, 매물 아래)
function renderHero(part) {
  const banner = el('section', { class: 'banner slim' },
    el('span', { class: 'eyebrow' }, '레고 중고거래, 이제 시세 보고 하세요'),
    el('h2', {}, '레고만큼은, ', el('em', {}, '리브릭')),
    el('p', {}, '세트번호 하나로 정가·중고 시세·브릭링크 가격까지. 비싸게 사지도, 싸게 팔지도 마세요.'),
    el('div', { class: 'bar' }, el('a', { class: 'btn primary', href: '#/sell' }, '내 세트 팔기'), el('a', { class: 'btn glass', href: '#/prices' }, '시세 찾아보기')));
  banner.insertAdjacentHTML('beforeend', BANNER_ART);
  if (part === 'banner') return banner;
  const sc = (href, ic, label, color) => el('a', { class: 'shortcut', href },
    el('span', { class: 'tile', style: `--t:color-mix(in srgb, ${color} 13%, var(--surface));color:${color}` }, icon(ic)), label);
  const p = PROMOS.find(x => promoState(x) === 'now' && x.gift) || PROMOS.find(x => promoState(x) === 'soon');
  return el('div', { style: 'display:grid;gap:22px' },
    el('nav', { class: 'shortcuts', 'aria-label': '바로가기' },
      sc('#/prices', 'chart', '시세표', '#3355ff'), sc('#/themes', 'layers', '테마', '#0f766e'), sc('#/limited', 'star', '한정판·SDCC', '#d97706'), sc('#/new/soon', 'spark', '신제품·단종', '#db2777'),
      sc('#/news', 'paper', '레고 소식', '#e5383b'), sc('#/youtube', 'play', '유튜버', '#dc2626'), sc('#/stores', 'pin', '레고스토어', '#12a150'), sc('#/sellguide', 'tip', '판매 꿀팁', '#7c4dff')),
    el('div', { class: 'strips' },
      SDCC ? el('a', { class: 'strip', href: '#/limited' }, el('span', { class: 'tag warm' }, `D-${daysUntil(SDCC.from)}`),
        el('span', { class: 'txt' }, `${SDCC.name} · 역대 코믹콘 한정판 ${LIMITED.length}개 시세`), el('span', { class: 'go' }, '→')) : '',
      p ? el('a', { class: 'strip', href: '#/promos' }, el('span', { class: 'tag ok' }, promoState(p) === 'now' ? '진행 중' : '예정'),
        el('span', { class: 'txt' }, '공식몰 · ' + (p.note || p.name)), el('span', { class: 'go' }, '→')) : '',
      el('a', { class: 'strip', href: '#/safety' }, el('span', { class: 'tag' }, '안전'),
        el('span', { class: 'txt' }, '선입금 요구 · 다른 메신저 유도 · 가짜 안전결제 링크는 사기 신호예요'), el('span', { class: 'go' }, '→'))));
}

// 공식몰 정가 참고표 (catalog.js) — "이 세트 팔기"를 누르면 등록 화면에 미리 채움, 이름을 누르면 세트 시세
const priced = () => Object.entries(CATALOG).filter(([, c]) => c.msrp).sort((a, b) => b[1].msrp - a[1].msrp);
// 시세표: 정가 있는 세트 + 정가는 없지만 중고 시세를 아는 세트(단종·올드 레고)
const pricedAll = () => [...priced(), ...Object.entries(CATALOG).filter(([no, c]) => !c.msrp && (MARKET[no] || BL[no]))];
const refRow = ([no, c]) => {
  const mk = MARKET[no], f = isFig(no), bu = BL[no]?.used;
  const used = [mk?.sealed && `${f ? '새것' : '미개봉'} ${fmtRange(mk.sealed)}`, mk?.used && `${f ? '' : '개봉 '}${fmtRange(mk.used)}`,
    bu && `🌏 브릭링크 중고 ${won(bu[1])}`].filter(Boolean).join(' · ');
  return el('div', { class: 'refrow' },
    miniThumb(no),
    el('a', { class: 'refname', href: `#/set/${no}` }, c.name, el('span', { class: 'small' }, ` · ${c.theme}` + (c.pieces ? ` · ${c.pieces.toLocaleString('ko-KR')}피스` : '') + (!c.msrp && c.year ? ` · ${c.year}년` : '')),
      storeBadge(no) ? el('span', {}, ' ', badgeEl(no)) : '',
      used ? el('span', { class: 'refmk' }, (mk ? '중고 ' : '') + used) : ''),
    el('b', { class: 'refprice' }, c.msrp ? won(c.msrp) : el('span', { class: 'small' }, f ? '미니피규어' : '공식몰 없음')),
    el('a', { class: 'btn', href: `#/sell/${no}` }, '이 세트 팔기'));
};
function renderPriceGuide() {
  const rows = priced();
  if (!rows.length) return '';
  return el('section', { class: 'panel' },
    el('div', { class: 'bar' }, el('h2', {}, '공식몰 정가 참고'), el('span', { class: 'grow' }), el('span', { class: 'small' }, `${window.BRICK_CATALOG_DATE} 레고 한국 공식몰 기준`)),
    el('div', { class: 'ref' }, rows.slice(0, 6).map(refRow)),
    el('div', {}, el('a', { class: 'btn', href: '#/prices' }, `전체 정가·시세표 보기 (${pricedAll().length}개) →`)));
}
function renderPrices(theme0 = '') {
  const rows = pricedAll();
  const have = new Set(rows.map(([, c]) => c.theme));
  const themes = ['', ...Object.keys(THEMES).filter(t => have.has(t))];
  let theme = themes.includes(theme0) ? theme0 : '', q = '';
  const list = el('div', { class: 'ref' });
  const count = el('span', { class: 'summary' });
  const draw = () => {
    const k = q.trim().toLowerCase();
    // 검색어가 있으면 역대 전 세트·미니피규어에서 찾음 (최대 300개 표시)
    const pool = k.length >= 2 ? Object.entries(CATALOG) : rows;
    const all = pool.filter(([no, c]) => (!theme || c.theme === theme) && (!k || searchText(no, c).includes(k)));
    const hit = all.slice(0, 300);
    count.textContent = k.length >= 2 ? `전체에서 ${all.length.toLocaleString('ko-KR')}개${all.length > 300 ? ' (300개만 표시)' : ''}` : `${all.length}개`;
    list.replaceChildren(...(hit.length ? hit.map(refRow) : [el('div', { class: 'hint' }, '찾는 세트가 없어요. 등록할 때 세트번호와 이름을 직접 넣으면 돼요.')]));
  };
  const chips = el('div', { class: 'filters', role: 'group', 'aria-label': '테마' }, themes.map(t => {
    const b = el('button', { class: 'chip', 'aria-pressed': String(t === theme) }, t || '전체');
    b.onclick = () => { theme = t; chips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); };
    return b;
  }));
  const search = el('input', { type: 'search', id: 'priceQ', placeholder: `역대 세트 ${Object.keys(CATALOG).length.toLocaleString('ko-KR')}개에서 찾기 — 번호·이름·영어 이름·별명 (예: 75192, 호그와트, Castle, 비룡성, sw0515)`, 'aria-label': '정가·시세표에서 찾기' });
  search.oninput = () => { q = search.value; draw(); };
  draw();
  show(el('section', { class: 'panel' },
    el('div', { class: 'bar' }, el('h2', {}, '📈 정가·시세표'), el('span', { class: 'grow' }), el('a', { class: 'btn', href: '#/compare' }, '🌏 한국 vs 브릭링크'), count),
    el('p', { class: 'small', style: 'margin:0' }, `정가: ${window.BRICK_CATALOG_DATE} 레고 한국 공식몰 판매가. 중고: ${window.BRICK_MARKET_DATE || ''} 국내 중고 매물 조사(올라온 가격 기준, 참고용). 🌏 브릭링크: 해외 거래 사이트의 최근 6개월 판매 평균(${window.BRICK_BL_DATE || ''} 기준, 해외 배송비·관세 제외). 이름을 누르면 자세히 볼 수 있어요.`),
    search, chips, list));
}

// ---- 신제품·예약 / 곧 단종 / 할인 (공식몰 store.js) ------------------------------
let newTheme = '';   // 신제품 화면에서 고른 테마 (탭을 바꿔도 유지)
function renderNew(tab) {
  const all = Object.entries(CATALOG).filter(([, c]) => c.store);
  const dateOf = s => { const m = s.avail.match(/(\d{4})년 (\d+)월 (\d+)일/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '9999'; };
  const TABS = {
    soon: ['📅 출시 예정·선주문', ([, c]) => /출시 예정|선주문|출고 예정/.test(c.store.avail), (a, b) => dateOf(a[1].store).localeCompare(dateOf(b[1].store))],
    new: ['✨ 신제품', ([, c]) => c.store.flags.includes('new'), (a, b) => b[1].msrp - a[1].msrp],
    retire: ['⏳ 곧 단종', ([, c]) => c.store.flags.includes('retiringSoon'), (a, b) => b[1].msrp - a[1].msrp],
    sale: ['🔥 할인 중', ([, c]) => c.store.sale > 0, (a, b) => b[1].store.sale - a[1].store.sale],
  };
  if (!TABS[tab]) tab = 'soon';
  const [title, test, sort] = TABS[tab];
  const inTab = all.filter(test);
  // 테마별로 골라 보기: 이 탭에 있는 테마만, 많은 순
  const counts = {};
  inTab.forEach(([, c]) => { counts[c.theme] = (counts[c.theme] || 0) + 1; });
  if (newTheme && !counts[newTheme]) newTheme = '';
  const themeChips = el('div', { class: 'filters', role: 'group', 'aria-label': '테마' },
    [['', inTab.length], ...Object.entries(counts).sort((a, b) => (a[0] === '기타') - (b[0] === '기타') || b[1] - a[1])].map(([t, n]) =>
      el('button', { class: 'chip', 'aria-pressed': String(newTheme === t), onclick: () => { newTheme = t; renderNew(tab); } }, `${t || '전체'} ${n}`)));
  const rows = inTab.filter(([, c]) => !newTheme || c.theme === newTheme).sort(sort);
  // 전체를 볼 때는 테마별로 묶어서 보여 줌
  const groups = newTheme ? [[newTheme, rows]] : Object.entries(rows.reduce((g, r) => ((g[r[1].theme] ||= []).push(r), g), {}))
    .sort((a, b) => (a[0] === '기타') - (b[0] === '기타') || b[1].length - a[1].length);   // '기타'는 맨 뒤
  const desc = {
    soon: '곧 나오는 세트와 선주문 받는 세트예요. 예약·선주문은 레고 공식몰에서 해요 (리브릭은 공식몰로 연결만 해요).',
    new: '공식몰에 "신제품"으로 표시된 세트예요.',
    retire: '공식몰에 "곧 단종"으로 표시된 세트예요. 단종되면 중고 가격이 오르는 경우가 많아서, 갖고 싶은 세트라면 미리 사 두는 게 좋아요.',
    sale: '지금 공식몰에서 할인 중인 세트예요.',
  }[tab];
  const row = ([no, c]) => el('div', { class: 'refrow' },
    miniThumb(no),
    el('a', { class: 'refname', href: `#/set/${no}` }, c.name, el('span', { class: 'small' }, ` · ${c.theme}` + (c.pieces ? ` · ${c.pieces.toLocaleString('ko-KR')}피스` : '')),
      el('span', { class: 'refmk' }, badgeEl(no), ' ', c.store.avail)),
    el('b', { class: 'refprice' }, c.store.sale ? el('span', {}, el('s', { class: 'small' }, won(c.msrp)), ' ', won(c.store.price)) : won(c.store.price)),
    el('a', { class: 'btn', href: legoUrl(no), target: '_blank', rel: 'noopener' }, tab === 'soon' ? '공식몰에서 예약 ↗' : '공식몰 ↗'));
  show(el('section', { class: 'panel' },
    el('div', { class: 'filters', role: 'group', 'aria-label': '보기' }, Object.entries(TABS).map(([k, [t, f]]) =>
      el('a', { class: 'chip', href: `#/new/${k}`, 'aria-pressed': String(k === tab) }, `${t} ${all.filter(f).length}`))),
    el('h2', {}, title),
    el('p', { class: 'small', style: 'margin:0' }, desc + ` (${window.BRICK_STORE_DATE} 공식몰 기준)`),
    themeChips,
    rows.length ? groups.map(([t, rs]) => el('div', { class: 'tgroup' }, el('h3', {}, `${t} ${rs.length}개`), el('div', { class: 'ref' }, rs.map(row))))
      : el('div', { class: 'hint' }, '지금은 해당하는 세트가 없어요.')));
}

// ---- 코믹콘(SDCC) 한정판 -------------------------------------------------------
const daysUntil = d => Math.ceil((new Date(d + 'T00:00:00') - new Date(ymdNow() + 'T00:00:00')) / 86400000);
const LIM_KIND = { fig: '미니피규어', set: '세트', head: '브릭헤즈' };
const multText = (v, r) => r && v ? `당시 ${won(r)} → ${(v / r).toFixed(1)}배` : '';
function limCard(x) {
  return el('a', { class: 'card', href: `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${encodeURIComponent(x.id)}#T=P`, target: '_blank', rel: 'noopener' },
    el('div', { class: 'thumb' }, thumb({ set_no: x.no, theme: x.theme === 'DC' ? 'DC' : x.theme, name: x.name }), el('span', { class: 'flag store' }, `${x.event} ${x.year}`)),
    el('div', { class: 'body' },
      el('div', { class: 'name' }, x.name),
      el('div', { class: 'price' }, x.value ? won(x.value) : '시세 정보 없음'),
      el('div', { class: 'tags' }, el('span', { class: 'cond complete' }, LIM_KIND[x.kind]), x.qty ? el('span', { class: 'cond missing' }, `${x.qty.toLocaleString('ko-KR')}개 한정`) : ''),
      el('div', { class: 'meta' }, multText(x.value, x.retail) || '행사장 배포·추첨')));
}
function sdccHero() {
  const d = daysUntil(SDCC.from), nextReg = SDCC.reg.find(([dt]) => daysUntil(dt) >= 0);
  return el('section', { class: 'banner dark' },
    el('span', { class: 'eyebrow' }, '한정판의 성지, 코믹콘'),
    el('h2', {}, d > 0 ? el('span', {}, `${SDCC.name}까지 `, el('em', {}, `D-${d}`)) : `${SDCC.name} 진행 중`),
    el('p', {}, `${SDCC.from.replace(/-/g, '.')} ~ ${SDCC.to.slice(5).replace('-', '.')} (프리뷰 나이트 ${SDCC.preview.slice(5).replace('-', '.')}) · 미국 샌디에이고` +
      (nextReg ? ` · ${nextReg[0].slice(5).replace('-', '/')} ${nextReg[1]}` : '')),
    el('div', { class: 'bar' }, el('a', { class: 'btn primary', href: '#/limited' }, '역대 한정판 시세 보기'),
      el('a', { class: 'btn glass', href: 'https://www.comic-con.org/', target: '_blank', rel: 'noopener' }, '코믹콘 공식 사이트 ↗')));
}
function renderLimited() {
  let kind = '', theme = '', sort = 'value';
  const grid = el('div', { class: 'grid' });
  const count = el('span', { class: 'summary' });
  const draw = () => {
    const rows = LIMITED.filter(x => (!kind || x.kind === kind) && (!theme || x.theme === theme));
    const by = { value: (a, b) => b.value - a.value, new: (a, b) => b.year - a.year, old: (a, b) => a.year - b.year,
      mult: (a, b) => (b.retail ? b.value / b.retail : 0) - (a.retail ? a.value / a.retail : 0) }[sort];
    rows.sort(by);
    count.textContent = `${rows.length}개`;
    grid.replaceChildren(...rows.map(limCard));
  };
  const chipRow = (opts, get, set) => {
    const box = el('div', { class: 'filters scroll' });
    opts.forEach(([v, t]) => { const b = el('button', { class: 'chip', 'aria-pressed': String(get() === v) }, t);
      b.onclick = () => { set(v); box.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); }; box.append(b); });
    return box;
  };
  const sortSel = el('select', { 'aria-label': '정렬' }, [['value', '시세 높은 순'], ['mult', '많이 오른 순'], ['new', '최근 행사 순'], ['old', '오래된 순']].map(([v, t]) => el('option', { value: v }, t)));
  sortSel.onchange = () => { sort = sortSel.value; draw(); };
  const top = [...LIMITED].sort((a, b) => b.value - a.value)[0];
  draw();
  show(sdccHero(),
    el('section', { class: 'section' },
      el('div', { class: 'sec-head' }, el('div', {}, el('h2', {}, '역대 코믹콘 한정판 레고'),
        el('p', {}, `샌디에이고(SDCC)·뉴욕(NYCC) 코믹콘에서 나눠 주거나 판매한 레고예요. 가장 비싼 건 ${top.year} ${top.name} (${won(top.value)}).`)), count),
      chipRow([['', '전체'], ['fig', '미니피규어'], ['set', '세트'], ['head', '브릭헤즈']], () => kind, v => { kind = v; }),
      el('div', { class: 'filters' }, chipRow([['', '모든 테마'], ['마블', '마블'], ['DC', 'DC'], ['스타워즈', '스타워즈'], ['기타', '기타']], () => theme, v => { theme = v; }), sortSel),
      grid,
      el('p', { class: 'hint', style: 'margin:0' }, `시세는 BrickEconomy 추정 가치(새것·미개봉 기준, ${window.BRICK_LIMITED_DATE} 조회), 생산 수량은 Brick Ranker 정리(일부 추정)예요. 카드를 누르면 브릭링크 가격 가이드가 열려요.`)),
    el('section', { class: 'panel guide' },
      el('h2', {}, '코믹콘 한정판, 이것만 알면 돼요'),
      el('div', { class: 'gboxes' },
        el('div', { class: 'gbox' }, el('b', {}, '🎟️ 한정판이란?'), el('p', {}, '코믹콘 행사장에서 추첨·선착순으로 나눠 주거나 판 레고예요. 미니피규어는 보통 100~1,750개만 만들어서, 2013년 스파이더맨(350개)은 2천만 원 가까이 해요.')),
        el('div', { class: 'gbox' }, el('b', {}, '📉 요즘 코믹콘은?'), el('p', {}, '2021년부터 미니피규어 배포가 거의 없어졌어요. 2023년엔 티셔츠 몸통 부품, 2024~25년엔 레고 마스터즈 흰색 미니피규어, 2026년엔 포스터·스티커 정도였고, 대신 신제품(스타트렉 브릿지 11385, 동키콩 아케이드 72051, 슈렉 미니피규어 71053)을 처음 공개했어요.')),
        el('div', { class: 'gbox' }, el('b', {}, '💎 값이 오르는 조건'), el('ul', {}, el('li', {}, '생산 수량이 적을수록'), el('li', {}, '블리스터(포장 카드)를 안 뜯은 미개봉'), el('li', {}, '스파이더맨·배트맨·슈퍼맨 같은 인기 캐릭터'), el('li', {}, '2011~2014년 초기 행사'))),
        el('div', { class: 'gbox warn' }, el('b', {}, '⚠️ 살 때 꼭 확인'), el('ul', {}, el('li', {}, '커스텀(가짜) 미니피규어가 아주 많아요. 프린팅·다리 색·블리스터 카드를 브릭링크 사진과 비교하세요.'),
          el('li', {}, '비싼 한정판은 직거래로 실물을 보고 사세요.'), el('li', {}, '팔 때는 세트번호 칸에 브릭링크 번호(예: comcon028)를 넣어 주세요.')))),
      el('div', {}, el('a', { class: 'btn primary', href: '#/sell' }, '내 한정판 팔기'))));
}

// ---- 테마 둘러보기 ----------------------------------------------------------------
const THEME_INTRO = {
  '스타워즈': '1999년부터 이어진 레고의 최장수 라이선스. UCS(얼티밋 컬렉터 시리즈)는 단종 뒤 몇 배씩 오르기로 유명해요.',
  '해리포터': '2001년 첫 출시, 2018년 재출시 뒤 성인용 대형 성·거리 세트가 꾸준히 나와요.',
  '마블': '2012년 시작. 헐크버스터·어벤져스 타워 같은 대형 세트와 영화 개봉에 맞춘 미니피규어가 인기예요.',
  '올드 레고': '1999년 이전 세트. 성·해적·우주·기차 시리즈는 박스·설명서가 있으면 수백만 원까지 가요.',
  '아이콘즈': '성인용 대형 세트(구 크리에이터 엑스퍼트). 모듈러 건물·자동차·랜드마크가 대표작이에요.',
  '테크닉': '기어·모터로 실제로 움직이는 기계 세트. 슈퍼카 시리즈가 특히 인기예요.',
  '닌자고': '2011년부터 이어진 레고 오리지널 테마. 닌자고 시티 시리즈는 단종 뒤 가격이 올라요.',
  '아이디어': '팬이 낸 아이디어 중 1만 표를 받은 작품을 레고가 정식 출시해요.',
  '미니피규어': '미니피규어는 브릭링크 번호로 거래해야 정확해요. 같은 캐릭터도 모양이 여러 가지예요.',
};
function themeCounts() {
  const n = {}, s = {}, r = {};
  Object.values(CATALOG).forEach(c => { n[c.theme] = (n[c.theme] || 0) + 1; if (c.store) { s[c.theme] = (s[c.theme] || 0) + 1; if (c.store.flags.includes('retiringSoon')) r[c.theme] = (r[c.theme] || 0) + 1; } });
  return { n, s, r };
}
const themeTile = (t, n) => el('a', { class: 'ttile', href: `#/theme/${encodeURIComponent(t)}`, style: `--c:${THEMES[t]}` },
  el('b', {}, t), el('span', {}, n ? `${n.toLocaleString('ko-KR')}개` : ''));
function renderThemes() {
  const { n } = themeCounts();
  show(el('section', { class: 'section' },
    el('div', { class: 'sec-head' }, el('div', {}, el('h2', {}, '테마별로 둘러보기'), el('p', {}, '테마를 고르면 명작 세트 시세, 곧 단종, 신제품, 올라온 매물을 한 번에 볼 수 있어요.'))),
    el('div', { class: 'ttiles' }, Object.keys(THEMES).filter(t => t !== '기타').map(t => themeTile(t, n[t])))));
}
function iconCard(x) {
  const c = CATALOG[x.no] || {};
  const v = x.value || BL[x.no]?.new?.[1] || 0;
  return el('a', { class: 'card', href: `#/set/${x.no}` },
    el('div', { class: 'thumb' }, thumb({ set_no: x.no, theme: c.theme, name: c.name }), v && x.retail ? el('span', { class: 'flag store' }, `${(v / x.retail).toFixed(1)}배`) : badgeFlag(x.no)),
    el('div', { class: 'body' },
      el('div', { class: 'name' }, (c.store ? c.name : (window.BRICK_ICONIC_NAMES || {})[x.no]) || c.name || `세트 ${x.no}`),
      el('div', { class: 'price' }, v ? won(v) : c.msrp ? won(c.msrp) : '-'),
      el('div', { class: 'meta' }, v ? multText(v, x.retail) || '새것 시세' : c.msrp ? '공식몰 정가' : ''),
      el('div', { class: 'small' }, x.note)));
}
const badgeFlag = no => { const b = storeBadge(no); return b ? el('span', { class: 'flag store' }, b.text) : ''; };
async function renderTheme(t) {
  if (!THEMES[t]) { location.hash = '#/themes'; return; }
  const { n, s, r } = themeCounts();
  const all = Object.entries(CATALOG).filter(([, c]) => c.theme === t);
  const store = all.filter(([, c]) => c.store);
  const rail = (title, desc, rows, flag, more) => rows.length ? el('section', { class: 'section' },
    el('div', { class: 'sec-head' }, el('div', {}, el('h2', {}, title), desc ? el('p', {}, desc) : ''), more ? el('a', { class: 'more', href: more }, '전체 보기 →') : ''),
    el('div', { class: 'rail' }, rows)) : '';
  const grid = el('div', { class: 'grid' }, el('div', { class: 'hint' }, '불러오는 중…'));
  const lim = LIMITED.filter(x => x.theme === t).sort((a, b) => b.value - a.value).slice(0, 12);
  show(
    el('section', { class: 'banner theme', style: `--c:${THEMES[t]}` },
      el('span', { class: 'eyebrow' }, '테마'),
      el('h2', {}, t),
      el('p', {}, THEME_INTRO[t] || `${t} 세트를 시세와 함께 둘러보세요.`),
      el('div', { class: 'bar' }, el('span', { class: 'stat' }, el('b', {}, (n[t] || 0).toLocaleString('ko-KR')), '역대 세트'),
        el('span', { class: 'stat' }, el('b', {}, s[t] || 0), '공식몰 판매 중'), el('span', { class: 'stat' }, el('b', {}, r[t] || 0), '곧 단종'))),
    rail('명작 세트 시세', '단종된 명작이 지금 얼마인지, 정가보다 몇 배 올랐는지', (ICONIC[t] || []).map(iconCard)),
    rail('코믹콘 한정판', '행사장에서만 나온 한정판', lim.map(limCard), null, '#/limited'),
    rail('곧 단종', '단종 전에 공식몰 정가로 살 마지막 기회', store.filter(([, c]) => c.store.flags.includes('retiringSoon')).sort((a, b) => b[1].msrp - a[1].msrp).slice(0, 12).map(x => setCard(x, '곧 단종')), null, '#/new/retire'),
    rail('신제품·예약', '', store.filter(([, c]) => c.store.flags.includes('new') || /출시 예정|선주문/.test(c.store.avail)).sort((a, b) => b[1].msrp - a[1].msrp).slice(0, 12).map(x => setCard(x, storeBadge(x[0])?.text.replace(/^\S+ /, '') || '신제품')), null, '#/new/soon'),
    el('section', { class: 'section' }, el('div', { class: 'sec-head' }, el('h2', {}, `리브릭에 올라온 ${t}`), el('a', { class: 'more', href: `#/prices/${encodeURIComponent(t)}` }, '정가·시세표 →')), grid));
  const { data } = await sb.from('listings').select('*').eq('theme', t).neq('status', 'sold').order('created_at', { ascending: false }).limit(20);
  grid.replaceChildren(...(data?.length ? data.map(listingCard) : [el('div', { class: 'empty', style: 'grid-column:1/-1' }, el('b', {}, `아직 올라온 ${t} 매물이 없어요`), el('a', { class: 'btn primary', href: '#/sell' }, '첫 매물 올리기'))]));
}

// ---- 판매 꿀팁 (판매의 정석) -----------------------------------------------------
function renderSellGuide() {
  const step = (title, ...body) => el('li', {}, el('b', {}, title), el('div', { class: 'small' }, ...body));
  show(el('section', { class: 'panel guide' },
    el('h2', {}, '레고, 이렇게 팔면 빨리 팔려요'),
    el('p', { class: 'small' }, '중고 거래 앱과 해외 거래 사이트(이베이)의 판매 가이드, 레고 수집가들의 거래 습관을 모아 정리했어요.'),
    el('ol', { class: 'steps' },
      step('시세부터 보고 "확정 가격"으로 올리세요', '리브릭 세트 시세에서 국내 중고·브릭링크 가격을 확인하세요. 처음부터 시세에 맞춘 확정가가 "네고 가능"보다 빨리 팔려요. 등록 화면의 ', el('b', {}, '빨리 팔기 / 적정 / 여유 있게'), ' 버튼을 누르면 가격이 바로 들어가요.'),
      step('사진은 5장, 첫 장이 승부예요', '① 박스 앞면(대표) ② 박스 뒷면·봉인 테이프 ③ 미니피규어 모아서 ④ 설명서·스티커 ⑤ 흠집·변색 부분. 밝은 곳에서, 배경은 깔끔하게. 남의 사진은 절대 쓰지 마세요.'),
      step('이름엔 세트번호 + 이름 + 상태', '구매자는 "75192"나 "밀레니엄 팔콘"으로 찾아요. 리브릭은 세트번호만 넣으면 이름이 자동으로 채워져요.'),
      step('설명엔 구성과 "흠"을 먼저', '박스·설명서·미니피규어 수·스티커·변색·조립 이력을 솔직하게. 흠을 먼저 밝히면 오히려 믿음이 생기고 분쟁이 줄어요. 등록 화면의 "설명 자동 작성"을 써 보세요.'),
      step('답장은 빠르게, 말투는 부드럽게', '"편하게 물어보세요, 확인하고 바로 답할게요" 같은 문장이 문의를 늘려요. 답이 빠른 판매자에게 거래가 몰려요.'),
      step('여러 곳에 동시에 알리세요', '상품 화면의 "당근·번개용 글 복사"를 누르면 리브릭 시세 링크가 붙은 판매글이 만들어져요. 다른 앱에 붙여 넣으면 구매자가 시세를 보고 안심해요.'),
      step('팔렸으면 "판매완료 + 실제 가격"', '실제 거래가를 남기면 모두가 보는 시세가 정확해져요. 다음에 살 때 내가 덕을 봐요.')),
    el('h3', {}, '레고만의 판매 타이밍'),
    el('div', { class: 'gboxes' },
      el('div', { class: 'gbox' }, el('b', {}, '📅 잘 팔리는 시기'), el('ul', {}, el('li', {}, '11~12월 (블랙프라이데이·크리스마스 선물)'), el('li', {}, '5월 (어린이날)'), el('li', {}, '영화·드라마 개봉 직후 (마블·스타워즈)'))),
      el('div', { class: 'gbox' }, el('b', {}, '⏳ 단종 효과'), el('ul', {}, el('li', {}, '공식몰에서 단종되면 미개봉 시세가 서서히 올라요.'), el('li', {}, '단종 직후 몇 달은 매물이 몰려 오히려 싸질 수 있어요.'), el('li', {}, '같은 세트가 재출시되면 옛 버전 가격이 흔들려요.'))),
      el('div', { class: 'gbox' }, el('b', {}, '💰 값을 지키는 법'), el('ul', {}, el('li', {}, '스티커는 붙이지 말고 따로 보관'), el('li', {}, '박스는 접지 말고 납작하게 보관'), el('li', {}, '흰색·회색 부품은 햇빛을 피해서 (변색)'), el('li', {}, '미니피규어는 세트와 함께 팔면 제값')))),
    el('div', { class: 'bar' }, el('a', { class: 'btn primary', href: '#/sell' }, '지금 팔아 보기'), el('a', { class: 'btn', href: '#/prices' }, '시세 먼저 보기'))));
}

// ---- 판매 도우미: 추천 가격 · 판매글 점수 · 다른 앱용 글 ------------------------
const iconicOf = no => Object.values(ICONIC).flat().find(x => x.no === no);
function priceSuggest(no, cond) {
  const k = x => Math.max(1000, Math.round(x / 1000) * 1000);
  const mk = MARKET[no], r = mk && (cond === 'sealed' ? mk.sealed : cond === 'complete' ? mk.used : null);
  if (r) return { quick: k(r[0]), fair: k(mid(r)), slow: k(r[1]), basis: '국내 중고 시세 기준' };
  const b = ['sealed', 'complete'].includes(cond) ? blOf(no, cond) : null;
  if (b) return { quick: k(b[1] * .75), fair: k(b[1] * .85), slow: k(b[1]), basis: '브릭링크 평균 기준 (한국은 보통 15~25% 싸요)' };
  const big = iconicOf(no)?.value || LIMITED.find(x => x.no === no || x.id === no)?.value;
  if (big) { const f = cond === 'sealed' ? [.8, .9, 1] : [.5, .6, .7]; return { quick: k(big * f[0]), fair: k(big * f[1]), slow: k(big * f[2]), basis: '해외 시세(BrickEconomy) 기준' }; }
  const m = CATALOG[no]?.msrp;
  if (!m) return null;
  const f = { sealed: [.8, .9, 1], complete: [.55, .65, .75], missing: [.35, .45, .55], parts: [.2, .3, .4] }[cond];
  return { quick: k(m * f[0]), fair: k(m * f[1]), slow: k(m * f[2]), basis: '공식몰 정가 대비 보통 거래 비율' };
}
function offsiteText(it) {
  const m = msrpOf(it);
  const parts = [it.has_box ? '박스 O' : '박스 X', it.has_manual ? '설명서 O' : '설명서 X',
    it.figs_total != null ? `미니피규어 ${it.figs_have ?? '?'}/${it.figs_total}` : it.all_figs ? '미니피규어 전부' : ''].filter(Boolean).join(' · ');
  return [`[레고 ${it.set_no}] ${it.name} (${COND[it.cond]})`,
    `가격: ${won(it.price)}` + (m ? ` (공식몰 정가 ${won(m)})` : ''),
    parts ? `구성: ${parts}` : '',
    [it.trade_direct ? `직거래${it.meet_place ? ` (${it.meet_place})` : ''}` : '', it.trade_delivery ? `택배${it.ship_fee ? ` +${won(it.ship_fee)}` : ' (택배비 포함)'}` : ''].filter(Boolean).join(' / '),
    it.description ? '\n' + it.description.slice(0, 400) : '',
    `\n📈 이 세트 시세·사진 더 보기: ${location.origin}${location.pathname}#/item/${it.id}`,
    '(리브릭 — 레고만큼은, 리브릭)'].filter(Boolean).join('\n');
}
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { const t = el('textarea', { style: 'position:fixed;opacity:0' }, text); document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); toast(okMsg); }
}
async function shareLink(title, url) {
  if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  copyText(url, '링크를 복사했어요. 카톡에 붙여 넣어 보세요.');
}

// ---- 레고 소식 · 유튜버 · 레고스토어 (media.js) -------------------------------------
const YT = (window.BRICK_YT || '').trim().split('\n').filter(Boolean).map(l => { const [name, id, handle, area, note] = l.split('|'); return { name, id, handle, area, note }; });
const STORES = (window.BRICK_STORES || '').trim().split('\n').filter(Boolean).map(l => { const [region, name, addr, tel, hours] = l.split('|'); return { region, name, addr, tel, hours }; });
const FEED_FN = (CFG.url || '') + '/functions/v1/feeds';
const feedCache = new Map();
// 여러 RSS를 한 번에 받아 날짜순으로 합침 (Edge Function 'feeds', 5분 동안 다시 안 부름)
async function loadFeeds(urls) {
  const key = urls.join(' ');
  const c = feedCache.get(key);
  if (c && Date.now() - c.t < 5 * 60 * 1000) return c.items;
  const r = await fetch(FEED_FN + '?' + urls.map(u => 'u=' + encodeURIComponent(u)).join('&'));
  if (!r.ok) throw new Error('feeds ' + r.status);
  const items = (await r.json()).flatMap(f => f.items.map(it => ({ ...it, src: f.u }))).filter(it => it.title && it.link)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  feedCache.set(key, { t: Date.now(), items });
  return items;
}
function ago(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (!isFinite(s)) return '';
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}분 전` : s < 86400 ? `${Math.round(s / 3600)}시간 전` : s < 86400 * 30 ? `${Math.round(s / 86400)}일 전` : new Date(d).toLocaleDateString('ko-KR');
}
const siteName = u => /brickfanatics/.test(u) ? 'Brick Fanatics' : /thebrickfan/.test(u) ? 'The Brick Fan' : /brickset/.test(u) ? 'Brickset' : '';
// 구글 뉴스 제목 끝의 " - 언론사" 떼기
const cleanTitle = (t, author) => author && t.endsWith(' - ' + author) ? t.slice(0, -(author.length + 3)) : t;
const newsRow = it => el('a', { class: 'nrow', href: it.link, target: '_blank', rel: 'noopener' },
  el('div', { class: 'ntitle' }, cleanTitle(it.title, it.author)),
  el('div', { class: 'meta' }, [it.author || siteName(it.src), ago(it.date)].filter(Boolean).join(' · ')));
const newsCard = it => el('a', { class: 'card ncard', href: it.link, target: '_blank', rel: 'noopener' },
  el('div', { class: 'thumb wide' }, it.image ? el('img', { src: it.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : el('div', { class: 'ph', style: '--c:#3355ff' }, el('small', {}, siteName(it.src)), el('span', {}, 'NEWS'))),
  el('div', { class: 'body' }, el('div', { class: 'name' }, it.title), el('div', { class: 'meta' }, [siteName(it.src), ago(it.date)].filter(Boolean).join(' · '))));
function snsCards() {
  const ic = { instagram: 'camera', youtube: 'play', news: 'paper', store: 'gift' };
  return el('div', { class: 'sns' }, (window.BRICK_SNS || []).map(([k, title, sub, href]) =>
    el('a', { class: 'snscard', href, target: '_blank', rel: 'noopener' }, el('span', { class: 'tile' }, icon(ic[k] || 'share')), el('div', {}, el('b', {}, title), el('div', { class: 'small' }, sub)), el('span', { class: 'go' }, '↗'))));
}
function renderNews() {
  const kr = el('div', { class: 'nlist' }, el('div', { class: 'hint' }, '불러오는 중…'));
  const world = el('div', { class: 'grid' }, el('div', { class: 'hint' }, '불러오는 중…'));
  show(el('section', { class: 'section' },
      el('div', { class: 'sec-head' }, el('div', {}, el('h2', {}, '레고 소식'), el('p', {}, '국내 기사와 해외 레고 전문 사이트의 새 글을 모았어요. 누르면 원래 기사로 가요.'))),
      snsCards()),
    el('section', { class: 'section' }, el('div', { class: 'sec-head' }, el('h2', {}, '국내 레고 뉴스'), el('span', { class: 'summary' }, '구글 뉴스 "레고" 검색')), kr),
    el('section', { class: 'section' }, el('div', { class: 'sec-head' }, el('h2', {}, '해외 레고 뉴스'), el('span', { class: 'summary' }, 'Brick Fanatics · The Brick Fan (영어)')), world));
  const fail = box => box.replaceChildren(el('div', { class: 'hint' }, '소식을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.'));
  loadFeeds(window.BRICK_NEWS_FEEDS.kr).then(items => kr.replaceChildren(...items.slice(0, 20).map(newsRow))).catch(() => fail(kr));
  loadFeeds(window.BRICK_NEWS_FEEDS.world).then(items => world.replaceChildren(...items.slice(0, 16).map(newsCard))).catch(() => fail(world));
}
// 유튜버: 채널을 고르면 그 채널의 업로드 목록(최신순)을 유튜브 공식 플레이어로 바로 재생
function renderYouTube(pick = '') {
  let area = '';
  const first = YT.find(c => c.id === pick) || YT[0];
  const player = el('div', { class: 'ytplayer' });
  const title = el('div', { class: 'ythead' });
  const play = c => {
    player.replaceChildren(el('iframe', { src: `https://www.youtube-nocookie.com/embed/videoseries?list=UU${c.id.slice(2)}`, title: `${c.name} 최신 영상`,
      allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen', allowfullscreen: true, loading: 'lazy', referrerpolicy: 'strict-origin-when-cross-origin' }));
    title.replaceChildren(el('div', {}, el('b', {}, c.name), el('div', { class: 'small' }, `${c.note} · 최신 영상부터 재생돼요. 오른쪽 위 목록 버튼으로 다른 영상도 골라요.`)),
      el('a', { class: 'btn', href: `https://www.youtube.com/${c.handle}/videos`, target: '_blank', rel: 'noopener' }, '유튜브에서 보기 ↗'));
    grid.querySelectorAll('.ych').forEach(n => n.setAttribute('aria-pressed', String(n.dataset.id === c.id)));
  };
  const grid = el('div', { class: 'ychs' });
  const draw = () => grid.replaceChildren(...YT.filter(c => !area || c.area === area).map(c => {
    const b = el('button', { class: 'ych', 'data-id': c.id, 'aria-pressed': 'false', onclick: () => { play(c); player.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
      el('span', { class: 'yav', style: `--h:${[...c.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360}` }, c.name.replace(/^LEGO.*/, 'L').slice(0, 1)),
      el('span', { class: 'ytxt' }, el('b', {}, c.name), el('span', { class: 'small' }, c.note)));
    return b;
  }));
  const chips = el('div', { class: 'filters' }, [['', '전체'], ['kr', '🇰🇷 한국'], ['world', '🌏 해외']].map(([v, t]) => {
    const b = el('button', { class: 'chip', 'aria-pressed': String(v === area) }, t);
    b.onclick = () => { area = v; chips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); };
    return b;
  }));
  draw();
  show(el('section', { class: 'section' },
    el('div', { class: 'sec-head' }, el('div', {}, el('h2', {}, '레고 유튜버'), el('p', {}, '국내·해외 인기 레고 채널의 새 영상을 바로 볼 수 있어요. 채널을 누르면 최신 영상부터 재생돼요.'))),
    el('div', { class: 'ytbox' }, title, player), chips, grid));
  play(first);
}
function renderStores() {
  let region = '';
  const list = el('div', { class: 'stores' });
  const regions = [...new Set(STORES.map(s => s.region))];
  const q = s => encodeURIComponent(`레고스토어 ${s.name}`);
  const draw = () => list.replaceChildren(...STORES.filter(s => !region || s.region === region).map(s => el('article', { class: 'store' },
    el('div', { class: 'store-top' }, el('span', { class: 'cond complete' }, s.region), el('b', {}, `레고® 스토어 ${s.name}`)),
    el('div', { class: 'small' }, s.addr),
    s.hours ? el('div', { class: 'small' }, '🕒 ' + s.hours) : '',
    el('div', { class: 'bar' },
      el('a', { class: 'btn', href: `https://map.naver.com/p/search/${q(s)}`, target: '_blank', rel: 'noopener' }, '네이버 지도'),
      el('a', { class: 'btn', href: `https://map.kakao.com/?q=${q(s)}`, target: '_blank', rel: 'noopener' }, '카카오맵'),
      s.tel ? el('a', { class: 'btn ghost', href: `tel:${s.tel.replace(/[^\d+]/g, '')}` }, '📞 ' + s.tel) : ''))));
  const chips = el('div', { class: 'filters scroll' }, [['', `전체 ${STORES.length}`], ...regions.map(r => [r, `${r} ${STORES.filter(s => s.region === r).length}`])].map(([v, t]) => {
    const b = el('button', { class: 'chip', 'aria-pressed': String(v === region) }, t);
    b.onclick = () => { region = v; chips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); };
    return b;
  }));
  draw();
  show(el('section', { class: 'banner theme', style: '--c:#e5383b' },
      el('span', { class: 'eyebrow' }, '오프라인 매장'),
      el('h2', {}, `전국 레고® 스토어 ${STORES.length}곳`),
      el('p', {}, '레고 공식 사이트에 등록된 국내 공인 매장(Certified Store)이에요. 매장에서만 하는 미니피규어 만들기·픽앤빌드도 즐겨 보세요.')),
    el('section', { class: 'section' }, chips, list,
      el('p', { class: 'hint', style: 'margin:0' }, `${window.BRICK_STORES_DATE} 레고 공식 사이트(스토어 찾기) 기준. 영업시간은 매장·백화점 사정에 따라 바뀔 수 있어요. 가기 전에 지도 앱에서 확인하세요. `,
        el('a', { href: 'https://www.lego.com/ko-kr/stores', target: '_blank', rel: 'noopener' }, '공식 스토어 찾기 ↗'))));
}

// ---- 위쪽 검색 자동완성: 세트번호·이름·별명 → 세트 시세 화면 ---------------------
(() => {
  const q = document.getElementById('q');
  const box = el('div', { class: 'suggest-box', role: 'listbox', id: 'qSuggest', hidden: true });
  q.closest('.search').append(box);
  q.setAttribute('aria-controls', 'qSuggest'); q.setAttribute('autocomplete', 'off');
  let items = [], sel = -1, timer;
  const close = () => { box.hidden = true; sel = -1; };
  const go = no => { close(); q.blur(); location.hash = `#/set/${encodeURIComponent(no)}`; };
  const paint = () => box.querySelectorAll('.sg').forEach((n, i) => n.setAttribute('aria-selected', String(i === sel)));
  const find = text => {
    const k = text.trim().toLowerCase();
    if (k.length < 2) return [];
    const exact = [], start = [], name = [];
    for (const [no, c] of Object.entries(CATALOG)) {
      const lo = no.toLowerCase();
      if (lo === k) exact.push([no, c]);
      else if (lo.startsWith(k)) start.push([no, c]);
      else if (name.length < 40 && searchText(no, c).includes(k)) name.push([no, c]);
      if (start.length > 40 && name.length >= 40) break;
    }
    // 공식몰에 있는(한글 이름) 세트를 앞으로
    const rank = ([, c]) => (c.store ? 0 : c.en ? 2 : 1);
    return [...exact, ...start.sort((a, b) => rank(a) - rank(b)), ...name.sort((a, b) => rank(a) - rank(b))].slice(0, 8);
  };
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      items = find(q.value); sel = -1;
      if (!items.length) { close(); return; }
      box.replaceChildren(el('div', { class: 'sg-head' }, '세트 시세 바로 보기'), ...items.map(([no, c], i) => {
        const n = el('div', { class: 'sg', role: 'option', 'aria-selected': 'false' },
          el('span', { class: 'setno' }, `#${no}`), el('span', { class: 'sg-name' }, c.name, el('span', { class: 'small' }, ` · ${c.theme}${c.year ? ' · ' + c.year : ''}`)),
          el('b', { class: 'small' }, c.msrp ? won(c.store?.price || c.msrp) : ''));
        n.onmousedown = e => { e.preventDefault(); go(no); };
        n.onmouseenter = () => { sel = i; paint(); };
        return n;
      }), el('div', { class: 'sg-foot' }, 'Enter = 올라온 매물에서 찾기'));
      box.hidden = false;
    }, 120);
  });
  q.addEventListener('keydown', e => {
    if (box.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(-1, sel - 1); paint(); }
    else if (e.key === 'Enter') { if (sel >= 0) { e.preventDefault(); go(items[sel][0]); } else close(); }
    else if (e.key === 'Escape') close();
  });
  q.addEventListener('blur', () => setTimeout(close, 100));
})();

// ---- 공식몰 프로모션 + 사은품 계산기 -------------------------------------------
function renderPromos() {
  const groups = { now: [], soon: [], past: [] };
  PROMOS.forEach(p => groups[promoState(p)].push(p));
  const fmtD = d => d ? d.slice(5).replace('-', '/') : '';
  const card = p => el('div', { class: 'promo ' + promoState(p) },
    el('div', { class: 'bar' }, el('b', {}, (p.gift ? '🎁 ' : p.kind === 'points' ? '⭐ ' : '📣 ') + p.name), p.gift ? el('a', { class: 'small', href: `#/set/${p.gift}` }, `#${p.gift}`) : '',
      el('span', { class: 'grow' }), el('span', { class: 'small' }, [p.from && fmtD(p.from), p.to && fmtD(p.to)].filter(Boolean).join(' ~ ') + (p.from && !p.to ? ' 부터' : ''))),
    el('div', { class: 'small' }, [
      p.min ? `${won(p.min)} 이상 구매` + (p.theme ? ` (${p.theme} 제품으로)` : '') : '',
      p.value ? `사은품 ${won(p.value)} 상당` : '', p.insiders ? 'Insiders 회원 계정 필요' : '', p.note || ''].filter(Boolean).join(' · ')));
  // 계산기: 세트번호를 넣으면 공식몰 가격 합계와 받을 수 있는 사은품
  const input = el('input', { id: 'promoSets', placeholder: '살 세트번호를 쉼표로 (예: 10356, 76419)', 'aria-label': '살 세트번호' });
  const out = el('div', { class: 'calc', 'aria-live': 'polite' });
  const calc = () => {
    const nos = input.value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    if (!nos.length) { out.replaceChildren(el('div', { class: 'hint' }, '세트번호를 넣으면 합계와 받을 수 있는 사은품을 알려 드려요.')); return; }
    const items = nos.map(no => ({ no, c: CATALOG[no] }));
    const total = items.reduce((s, x) => s + (x.c?.store?.price || 0), 0);
    const live = PROMOS.filter(p => p.gift && promoState(p) === 'now');
    const res = live.map(p => {
      if (p.need) return p.need.some(n => nos.includes(n)) ? ['ok', `🎁 ${p.name} 받아요 (${p.need.join(', ')} 포함)`] : null;
      if (p.min) return total >= p.min ? ['ok', `🎁 ${p.name} 받아요 (${won(p.min)} 이상)`] : ['more', `${won(p.min - total)} 더 사면 🎁 ${p.name} (${won(p.value || 0)} 상당)`];
      return null;
    }).filter(Boolean);
    out.replaceChildren(
      el('div', { class: 'ref' }, items.map(({ no, c }) => el('div', { class: 'refrow' }, el('span', { class: 'setno' }, `#${no}`),
        el('span', { class: 'refname' }, c ? c.name : '목록에 없는 번호예요', c?.store ? el('span', { class: 'small' }, ' · ' + c.store.avail) : ''),
        el('b', { class: 'refprice' }, c?.store ? won(c.store.price) : '-'), el('span', {})))),
      el('div', { class: 'bar' }, el('b', {}, `합계 ${won(total)}`), el('span', { class: 'small' }, '(공식몰 판매가, 배송비 제외)')),
      res.length ? el('div', { class: 'cmp' }, res.map(([k, t]) => el('div', { class: k }, t))) : el('div', { class: 'hint' }, '지금 진행 중인 사은품 조건에 해당하는 게 없어요.'));
  };
  input.oninput = calc; calc();
  show(el('section', { class: 'panel' },
      el('h2', {}, '🎁 레고 공식몰 프로모션'),
      el('p', { class: 'small', style: 'margin:0' }, `레고 한국 공식몰의 구매 사은품·행사 정보예요 (${window.BRICK_PROMOS_DATE} 확인). 재고가 떨어지면 일찍 끝날 수 있고, 정확한 조건은 공식몰 약관을 꼭 확인하세요.`),
      el('h3', {}, '진행 중'), groups.now.length ? el('div', { class: 'promos' }, groups.now.map(card)) : el('div', { class: 'hint' }, '지금 진행 중인 프로모션이 없어요.'),
      el('h3', {}, '다가오는 행사'), groups.soon.length ? el('div', { class: 'promos' }, groups.soon.map(card)) : el('div', { class: 'hint' }, '발표된 행사가 없어요.'),
      el('div', { class: 'bar' }, el('a', { class: 'btn', href: 'https://www.lego.com/ko-kr/page/lego-offers-promotions', target: '_blank', rel: 'noopener' }, '공식몰 할인 및 행사 ↗'),
        el('a', { class: 'btn', href: 'https://www.lego.com/ko-kr/page/lego-offers-promotions/latest-terms-and-conditions', target: '_blank', rel: 'noopener' }, '프로모션 약관 ↗'))),
    el('section', { class: 'panel' }, el('h2', {}, '🧮 사은품 계산기'), input, out),
    el('section', { class: 'panel' }, el('h2', {}, '📜 지난 프로모션'),
      el('p', { class: 'small', style: 'margin:0' }, '최근 두 달 반 동안의 사은품 행사예요. 보통 5만 6천 원 이상이면 6천 원대 작은 사은품, 14~24만 원 이상이면 3만 원대 사은품이 나왔어요.'),
      el('div', { class: 'promos' }, groups.past.map(card))));
}

// ---- 한국 vs 브릭링크 비교표 ----------------------------------------------------
function renderCompare() {
  // 한국 시세(중간값)와 브릭링크 평균이 둘 다 있는 것만. 미개봉↔새것, 개봉↔중고 끼리
  const rows = [];
  for (const [no, c] of Object.entries(CATALOG)) {
    const mk = MARKET[no], b = BL[no];
    if (!mk || !b) continue;
    if (mk.sealed && b.new) rows.push({ no, c, kind: isFig(no) ? '새것' : '미개봉', kr: mid(mk.sealed), bl: b.new[1], n: b.new[0] });
    if (mk.used && b.used) rows.push({ no, c, kind: '중고', kr: mid(mk.used), bl: b.used[1], n: b.used[0] });
  }
  rows.sort((a, b) => a.kr / a.bl - b.kr / b.bl);
  const ratio = r => r.kr / r.bl;
  const cheap = rows.filter(r => ratio(r) < 0.9).length, dear = rows.filter(r => ratio(r) > 1.1).length;
  show(el('section', { class: 'panel' },
    el('h2', {}, '🌏 한국 vs 브릭링크'),
    el('p', { class: 'small', style: 'margin:0' }, `한국 중고 시세(${window.BRICK_MARKET_DATE} 조사, 대부분 올라온 가격)와 브릭링크 최근 6개월 판매 평균(${window.BRICK_BL_DATE}, 해외 배송비·관세 제외)을 비교했어요. 한국이 싼 순서예요.`),
    el('div', { class: 'pboxes' },
      el('div', { class: 'pbox' }, el('b', {}, '비교한 항목'), el('div', { class: 'pv' }, `${rows.length}개`)),
      el('div', { class: 'pbox' }, el('b', {}, '한국이 10% 넘게 싼 것'), el('div', { class: 'pv' }, `${cheap}개`), el('div', { class: 'small' }, '해외에서 사 오는 것보다 국내가 이득')),
      el('div', { class: 'pbox' }, el('b', {}, '한국이 10% 넘게 비싼 것'), el('div', { class: 'pv' }, `${dear}개`), el('div', { class: 'small' }, '올드 레고·옛 닌자고 미니피규어가 많아요'))),
    el('div', { class: 'ref' }, rows.map(r => {
      const d = pct(r.kr, r.bl);
      return el('div', { class: 'refrow cmprow' },
        el('span', { class: 'setno' }, `#${r.no}`),
        el('a', { class: 'refname', href: `#/set/${r.no}` }, r.c.name, el('span', { class: 'small' }, ` · ${r.kind} · 브릭링크 ${r.n}건${r.n < 5 ? ' (적음)' : ''}`),
          el('span', { class: 'refmk' }, `한국 ${won(r.kr)} · 브릭링크 ${won(r.bl)}`)),
        el('b', { class: 'refprice ' + (d > 10 ? 'up' : d < -10 ? 'down' : '') }, d >= 100 ? `${(r.kr / r.bl).toFixed(1)}배` : `${d > 0 ? '+' : ''}${d}%`),
        el('a', { class: 'btn', href: blLink(r.no), target: '_blank', rel: 'noopener' }, '브릭링크 ↗'));
    })),
    el('div', { class: 'hint' }, '같은 상태라도 박스·설명서 유무, 한 건짜리 글 때문에 차이가 크게 날 수 있어요. 참고용으로만 봐 주세요.')));
}

// ---- 세트 시세 --------------------------------------------------------------
async function renderSet(no) {
  const c = CATALOG[no], mk = MARKET[no], bl = BL[no], f = isFig(no);
  // 브릭링크(해외) 6개월 판매 평균과 한국 시세 비교
  const blBox = () => {
    const kr = mk?.used ? mid(mk.used) : null, krS = mk?.sealed ? mid(mk.sealed) : null;
    const cmp = [krS && bl?.new && `한국 ${f ? '새것' : '미개봉'} 시세는 ${diffText(krS, bl.new[1], '브릭링크')}`,
      kr && bl?.used && `한국 중고 시세는 ${diffText(kr, bl.used[1], '브릭링크')}`].filter(Boolean);
    return el('div', { class: 'blbox' },
      el('div', { class: 'bar' }, el('h3', {}, '🌏 브릭링크 (해외) 최근 6개월 판매 평균'), el('span', { class: 'grow' }),
        el('a', { class: 'btn', href: blLink(no), target: '_blank', rel: 'noopener' }, '브릭링크에서 보기 ↗')),
      bl ? el('div', { class: 'pboxes' },
          box(f ? '새것' : '새것 (미개봉)', bl.new ? won(bl.new[1]) : '-', bl.new ? `${bl.new[0]}건 거래${bl.new[0] < 5 ? ' · 거래가 적어 참고만' : ''}` : '최근 거래 없음'),
          box('중고', bl.used ? won(bl.used[1]) : '-', bl.used ? `${bl.used[0]}건 거래${bl.used[0] < 5 ? ' · 거래가 적어 참고만' : ''}` : '최근 거래 없음'))
        : el('div', { class: 'hint' }, '이 세트는 리브릭에 브릭링크 가격이 아직 없어요. 위 버튼으로 브릭링크 가격 가이드를 바로 볼 수 있어요.'),
      cmp.length ? el('div', { class: 'cmp' }, cmp.map(t => el('div', {}, '👉 ' + t))) : '',
      el('div', { class: 'hint' }, `브릭링크 값은 ${window.BRICK_BL_DATE || ''} 기준으로, 브릭링크가 원화로 바꿔 보여 준 값이에요. 해외 배송비(보통 2~5만 원)는 빠져 있고, 물건값+배송비가 150달러를 넘으면 관세·부가세(약 18%)가 더 붙어요.`));
  };
  const [stats, { data: live }] = await Promise.all([
    soldStats([no]),
    sb.from('listings').select('*').eq('set_no', no).neq('status', 'sold').order('price').limit(30),
  ]);
  const box = (title, main, sub) => el('div', { class: 'pbox' }, el('b', {}, title), el('div', { class: 'pv' }, main), sub ? el('div', { class: 'small' }, sub) : '');
  const soldRows = Object.keys(COND).map(k => stats.find(s => s.cond === k)).filter(Boolean);
  show(el('section', { class: 'panel' },
      el('div', { class: 'sethead' },
        el('div', { class: 'thumb setimg' }, thumb({ set_no: no, name: c?.name, theme: c?.theme })),
        el('div', { class: 'sethead-txt' },
          el('div', { class: 'setno' }, `#${no}` + (c ? ` · ${c.theme}` : '') + (c?.year ? ` · ${c.year}년` : '')),
          el('h2', {}, c ? c.name : `세트 ${no}`),
          c?.alias ? el('div', { class: 'small' }, `이렇게도 불러요: ${c.alias}`) : '',
          c?.en ? el('div', { class: 'small' }, `역대 세트 목록(Rebrickable)에서 가져온 정보라 이름이 영어예요` + (c.pieces ? ` · ${c.pieces.toLocaleString('ko-KR')}${f ? '부품' : '피스'}` : '') + '.') : '')),
      c?.store ? el('div', { class: 'storebox' },
        el('div', { class: 'bar' }, badgeEl(no), el('b', {}, `레고 공식몰 ${won(c.store.price)}`), c.store.sale ? el('s', { class: 'small' }, won(c.msrp)) : '',
          el('span', { class: 'small' }, c.store.avail), el('span', { class: 'grow' }),
          el('a', { class: 'btn', href: legoUrl(no), target: '_blank', rel: 'noopener' }, /출시 예정|선주문/.test(c.store.avail) ? '공식몰에서 예약 ↗' : '공식몰에서 보기 ↗')),
        c.store.flags.includes('retiringSoon') ? el('div', { class: 'small' }, '⏳ 공식몰에 "곧 단종"으로 표시돼 있어요. 단종되면 중고 가격이 오르는 경우가 많아요.') : '',
        ...promosFor(no).map(p => el('div', { class: 'small' }, `🎁 이 세트를 사면 ${p.name}(#${p.gift}) 증정 · ${p.to ? p.to.slice(5).replace('-', '/') + '까지' : ''}`)))
        : f ? '' : el('div', { class: 'small' }, '지금 레고 공식몰에서 팔지 않는 세트예요 (단종 등). ', el('a', { href: legoUrl(no), target: '_blank', rel: 'noopener' }, '공식몰 검색 ↗')),
      el('div', { class: 'pboxes' },
        f ? box('공식몰 정가', '-', '미니피규어는 따로 팔지 않아요')
          : box('공식몰 정가', c?.msrp ? won(c.msrp) : '정보 없음', c?.msrp ? `${window.BRICK_CATALOG_DATE} 기준` + (c.pieces ? ` · 피스당 ${Math.round(c.msrp / c.pieces).toLocaleString('ko-KR')}원` : '') : '단종됐거나 공식몰에서 못 찾은 세트'),
        box(f ? '한국 새것' : '한국 미개봉 중고', mk?.sealed ? fmtRange(mk.sealed) : '-', mk?.sealed && c?.msrp ? `정가의 ${Math.round(mid(mk.sealed) / c.msrp * 100)}% 수준` : ''),
        box(f ? '한국 중고' : '한국 개봉 중고', mk?.used ? fmtRange(mk.used) : '-', mk?.used && mk?.sealed ? `미개봉의 ${Math.round(mid(mk.used) / mid(mk.sealed) * 100)}% 수준` : ''),
        // 명작·한정판: BrickEconomy 추정 가치
        (() => { const x = iconicOf(no) || LIMITED.find(l => l.no === no || l.id === no);
          return x?.value ? box('해외 시세 (새것)', won(x.value), (x.retail ? `당시 ${won(x.retail)}의 ${(x.value / x.retail).toFixed(1)}배 · ` : '') + `BrickEconomy ${window.BRICK_LIMITED_DATE}`) : ''; })()),
      mk ? el('div', { class: 'hint' }, `한국 가격은 ${window.BRICK_MARKET_DATE} 국내 중고 사이트 글 약 ${mk.n}개를 보고 정리한 참고값이에요 (대부분 올라온 가격). ` + (mk.note || ''))
         : el('div', { class: 'hint' }, '아직 한국 중고 시세 자료가 없어요. 리브릭에서 판매완료가 쌓이면 실거래 시세가 생겨요.'),
      blBox(),
      el('h3', {}, '리브릭 실거래 (최근 1년)'),
      soldRows.length ? el('div', { class: 'ref' }, soldRows.map(s => el('div', { class: 'refrow' }, el('span', { class: `cond ${s.cond}` }, COND[s.cond]),
          el('span', {}, `평균 ${won(s.avg_price)}`, el('span', { class: 'small' }, ` · ${s.n}건 · ${won(s.min_price)} ~ ${won(s.max_price)}`)), el('span', {}), el('span', {}))))
        : el('div', { class: 'hint' }, '아직 리브릭에서 팔린 기록이 없어요. 판매완료로 바꿀 때 실제 거래 가격을 적어 주시면 모두가 보는 시세가 돼요.'),
      el('div', { class: 'bar' }, el('a', { class: 'btn primary', href: `#/sell/${no}` }, f ? '이 미니피규어 팔기' : '이 세트 팔기'),
        el('a', { class: 'btn', href: me ? `#/collection/${no}` : '#/login' }, '🗂️ 내 컬렉션에 추가'),
        el('button', { type: 'button', onclick: () => shareLink(`${c?.name || no} 시세 | 리브릭`, `${location.origin}${location.pathname}#/set/${encodeURIComponent(no)}`) }, icon('share'), '시세 공유'))),
    el('section', { class: 'panel' }, el('h2', {}, `지금 리브릭에 올라온 매물 ${live?.length || 0}개`),
      live?.length ? el('div', { class: 'grid' }, live.map(it => el('a', { class: 'card', href: `#/item/${it.id}` },
        el('div', { class: 'thumb' }, thumb(it), it.status !== 'selling' ? el('span', { class: 'flag' }, STATUS[it.status]) : ''),
        el('div', { class: 'body' }, el('div', {}, el('span', { class: `cond ${it.cond}` }, COND[it.cond])), el('div', { class: 'price' }, won(it.price)),
          el('div', { class: 'small' }, it.region || '지역 미정')))))
        : el('div', { class: 'empty' }, '지금은 매물이 없어요.', el('a', { class: 'btn primary', href: `#/sell/${no}` }, '+ 첫 매물 올리기'))));
}

// ---- 내 컬렉션 --------------------------------------------------------------
async function renderCollection(presetSet = '') {
  if (!me) return needLogin();
  const { data: rows, error } = await sb.from('collections').select('*').order('created_at', { ascending: false });
  if (error) return show(el('section', { class: 'panel' }, el('h2', {}, '내 컬렉션'), status(needUpdate(error), true)));
  const stats = await soldStats([...new Set(rows.map(r => r.set_no))]);

  // 추가하기
  const fSet = el('input', { id: 'cSet', required: true, placeholder: '세트번호 (예: 10294) · 미니피규어 번호 (예: sw0515)', value: presetSet });
  const fName = el('input', { id: 'cName', placeholder: '이름 (목록에 있으면 자동)', maxlength: 100 });
  const fCond = el('select', { id: 'cCond' }, Object.entries(COND).map(([k, t]) => el('option', { value: k, selected: k === 'complete' }, t)));
  const fPaid = el('input', { id: 'cPaid', type: 'number', min: 0, step: 1000, placeholder: '산 가격 (선택)' });
  const found = el('div', { class: 'found', 'aria-live': 'polite' });
  const fill = () => { const c = CATALOG[fSet.value.trim()]; found.textContent = c ? `✓ ${c.name}` + (c.msrp ? ` · 정가 ${won(c.msrp)}` : '') : ''; if (c) fName.value = c.name; };
  fSet.oninput = fill;
  if (presetSet) fill();
  const st = status();
  const addBtn = el('button', { type: 'submit', class: 'primary' }, '추가');
  const form = el('form', { class: 'fields' }, el('label', { class: 'f' }, '세트번호', fSet), el('label', { class: 'f wide' }, '이름', fName),
    el('label', { class: 'f' }, '상태', fCond), el('label', { class: 'f' }, '산 가격 (원)', fPaid), el('div', { class: 'f', style: 'align-self:end' }, addBtn));
  form.onsubmit = async e => {
    e.preventDefault();
    const no = fSet.value.trim();
    if (!no) return;
    addBtn.disabled = true;
    const { error } = await sb.from('collections').insert({ set_no: no, name: fName.value.trim() || CATALOG[no]?.name || '', cond: fCond.value, paid: fPaid.value ? Number(fPaid.value) : null });
    addBtn.disabled = false;
    if (error) { st.className = 'status err'; st.textContent = needUpdate(error); return; }
    toast(`${fName.value.trim() || no} 을(를) 컬렉션에 넣었어요.`);
    if (presetSet) location.hash = '#/collection'; else renderCollection();
  };

  // 합계: 정가·추정 시세는 아는 세트만 더함
  let msrpSum = 0, estSum = 0, estN = 0, paidSum = 0;
  const list = rows.map(r => {
    const c = CATALOG[r.set_no], est = estimate(r.set_no, r.cond, stats);
    if (c?.msrp) msrpSum += c.msrp;
    if (est) { estSum += est.v; estN++; }
    if (r.paid) paidSum += r.paid;
    const del = el('button', { class: 'ghost', 'aria-label': `${r.name || r.set_no} 빼기` }, '빼기');
    del.onclick = async () => {
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '한 번 더'; return; }
      const { error } = await sb.from('collections').delete().eq('id', r.id);
      if (error) toast(errMsg(error), true); else renderCollection();
    };
    return el('div', { class: 'colrow' },
      el('div', { style: 'min-width:0' }, el('a', { class: 'setno', href: `#/set/${r.set_no}` }, `#${r.set_no}` + (c ? ` · ${c.theme}` : '')),
        el('div', { class: 'refname' }, r.name || c?.name || '이름 없음'), el('span', { class: `cond ${r.cond}` }, COND[r.cond])),
      el('div', { class: 'colval' }, est ? el('b', {}, won(est.v)) : el('span', { class: 'small' }, '시세 없음'),
        el('div', { class: 'small' }, est ? est.src : (c?.msrp ? `정가 ${won(c.msrp)}` : '')),
        r.paid ? el('div', { class: 'small' }, `산 가격 ${won(r.paid)}`) : ''),
      el('div', { class: 'bar' }, el('a', { class: 'btn', href: `#/sell/${r.set_no}` }, '팔기'), del));
  });
  const tile = (t, v, s) => el('div', { class: 'pbox' }, el('b', {}, t), el('div', { class: 'pv' }, v), s ? el('div', { class: 'small' }, s) : '');
  show(el('section', { class: 'panel' },
    el('h2', {}, '🗂️ 내 컬렉션'),
    el('p', { class: 'small', style: 'margin:0' }, '가진 세트를 넣어 두면 지금 중고 시세로 얼마쯤인지 계산해 드려요. 팔고 싶을 때 바로 판매 등록할 수 있어요. 내 컬렉션은 나만 볼 수 있어요.'),
    el('div', { class: 'pboxes' },
      tile('세트', `${rows.length}개`),
      tile('지금 시세로', estN ? won(estSum) : '-', estN ? `시세 아는 ${estN}개 기준` : '시세 자료가 있는 세트가 없어요'),
      tile('공식몰 정가 합계', msrpSum ? won(msrpSum) : '-', '정가 있는 세트만'),
      tile('산 가격 합계', paidSum ? won(paidSum) : '-')),
    form, found, st),
    el('section', { class: 'panel' }, el('h2', {}, `가진 세트 ${rows.length}개`),
      rows.length ? el('div', { class: 'ref' }, list) : el('div', { class: 'empty' }, '아직 넣은 세트가 없어요. 위에서 세트번호를 넣어 보세요.')));
  if (!presetSet) fSet.focus();
}

// ---- 상세 -----------------------------------------------------------------
async function renderItem(id) {
  const { data: it, error } = await sb.from('listings').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!it) return show(el('section', { class: 'panel' }, el('h2', {}, '없는 상품이에요'), el('a', { href: '#/' }, '목록으로')));
  const [{ data: seller }, { count: listed }, { count: sold }] = await Promise.all([
    sb.from('profiles').select('nickname, region, created_at').eq('id', it.seller_id).maybeSingle(),
    sb.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', it.seller_id),
    sb.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', it.seller_id).eq('status', 'sold'),
  ]);
  const mine = me && me.id === it.seller_id;
  const p = ppp(it), v = vsMsrp(it), m = msrpOf(it), mk = MARKET[it.set_no];
  const age = seller?.created_at ? daysSince(seller.created_at) : null;

  // 판매자·가격으로 본 주의 신호
  const risks = [];
  if (tooCheap(it)) risks.push(`공식몰 정가(${won(m)})의 절반도 안 되는 가격이에요. 시세보다 너무 싼 미개봉·완전체는 사기 미끼인 경우가 많아요.`);
  if (age !== null && age < 7) risks.push('가입한 지 일주일이 안 된 판매자예요. 처음 거래한다면 직거래를 추천해요.');
  if (it.trade_delivery && !it.trade_direct) risks.push('택배거래만 가능한 상품이에요. 돈을 보내기 전에 더치트에서 계좌·전화번호를 조회하고, 판매자에게 상품 옆에 오늘 날짜와 닉네임을 적은 쪽지를 놓고 찍은 사진을 요청하세요.');
  const riskBox = !mine && risks.length ? el('div', { class: 'risk', role: 'note' }, el('b', {}, '⚠️ 거래 전에 확인하세요'),
    el('ul', {}, risks.map(r => el('li', {}, r))), el('a', { href: '#/safety' }, '사기 유형 더 알아보기 →')) : '';
  const tradeFact = it.trade_direct === undefined ? '-' : [it.trade_direct ? '직거래' : '', it.trade_delivery ? '택배' : ''].filter(Boolean).join(' · ') || '-';

  const mainImg = el('div', { class: 'main' }, thumb(it));
  const gallery = el('div', { class: 'gallery' }, mainImg, it.photos.length > 1 ? el('div', { class: 'thumbs' }, it.photos.map((src, i) =>
    el('button', { 'aria-label': `사진 ${i + 1}`, onclick: () => mainImg.replaceChildren(el('img', { src, alt: `${it.name} 사진 ${i + 1}` })) }, el('img', { src, alt: '' })))) : '');

  const st = status();
  let actions;
  if (mine) {
    const sel = el('select', { id: 'statusSel', 'aria-label': '판매 상태', style: 'width:auto' }, Object.entries(STATUS).map(([k, t]) => el('option', { value: k, selected: it.status === k }, t)));
    // 판매완료로 바꿀 땐 실제로 팔린 가격을 받음 → 세트별 실거래 시세가 됨
    const soldIn = el('input', { id: 'soldPrice', type: 'number', min: 0, step: 1000, value: it.sold_price || it.price, style: 'width:140px' });
    const soldBtn = el('button', { type: 'button', class: 'primary' }, '판매완료 저장');
    const soldBox = el('div', { class: 'soldbox', hidden: true }, el('label', { class: 'f' }, '실제로 얼마에 팔렸나요? (시세 계산에만 쓰이고, 다른 사람에겐 세트별 평균으로만 보여요)', soldIn), soldBtn);
    soldBtn.onclick = async () => {
      soldBtn.disabled = true;
      const { error } = await sb.from('listings').update({ status: 'sold', sold_price: Number(soldIn.value) || null, sold_at: new Date().toISOString() }).eq('id', it.id);
      soldBtn.disabled = false;
      if (error) { st.className = 'status err'; st.textContent = needUpdate(error); return; }
      soldBox.hidden = true; st.className = 'status'; st.textContent = '판매완료로 바꿨어요. 시세에 반영돼요. 고마워요!';
    };
    sel.onchange = async () => {
      if (sel.value === 'sold') { soldBox.hidden = false; soldIn.focus(); return; }
      soldBox.hidden = true;
      const upd = { status: sel.value };
      if (it.status === 'sold' && 'sold_price' in it) Object.assign(upd, { sold_price: null, sold_at: null });
      const { error } = await sb.from('listings').update(upd).eq('id', it.id);
      st.textContent = error ? errMsg(error) : `${STATUS[sel.value]}(으)로 바꿨어요.`;
    };
    const del = el('button', { class: 'danger' }, '삭제');
    del.onclick = async () => {
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '한 번 더 누르면 지워져요'; return; }
      const paths = it.photos.map(u => u.split('/object/public/photos/')[1]).filter(Boolean);
      if (paths.length) await sb.storage.from('photos').remove(paths);
      const { error } = await sb.from('listings').delete().eq('id', it.id);
      if (error) { st.textContent = errMsg(error); return; }
      location.hash = '#/me';
    };
    actions = el('div', {}, el('div', { class: 'bar' }, sel, el('a', { class: 'btn', href: `#/edit/${it.id}` }, '수정'), del, el('a', { class: 'btn', href: '#/chats' }, '받은 채팅 보기')), soldBox,
      el('div', { class: 'offsite' }, el('div', {}, el('b', {}, '📣 더 빨리 팔고 싶다면'), el('div', { class: 'small' }, '당근·번개장터에도 올려 보세요. 리브릭 시세 링크가 붙은 판매글을 만들어 드려요.')),
        el('button', { type: 'button', class: 'primary', onclick: () => copyText(offsiteText(it), '판매글을 복사했어요. 당근·번개장터 글쓰기에 붙여 넣으세요.') }, '당근·번개용 글 복사')));
  } else {
    actions = el('div', { class: 'bar' }, el('a', { class: 'btn primary', href: me ? `#/chat/${it.id}/${me.id}` : '#/login' }, me ? '판매자에게 채팅' : '로그인하고 채팅하기'),
      el('button', { type: 'button', onclick: () => shareLink(`${it.name} ${won(it.price)} | 리브릭`, `${location.origin}${location.pathname}#/item/${it.id}`) }, icon('share'), '공유'),
      el('span', { class: 'grow' }), el('a', { class: 'btn ghost', href: me ? `#/report/${it.id}` : '#/login' }, '🚩 신고'));
  }

  show(el('div', { class: 'detail' }, gallery,
    el('section', { class: 'panel' },
      el('div', { class: 'setno' }, `#${it.set_no} · ${it.theme}`),
      el('h2', {}, it.name),
      el('div', { class: 'bar' }, el('span', { class: 'price' }, won(it.price)), el('span', { class: `cond ${it.cond}` }, COND[it.cond]),
        it.status !== 'selling' ? el('span', { class: 'cond missing' }, STATUS[it.status]) : ''),
      v ? el('div', { class: v.cls }, `${v.text} (공식몰 정가 ${won(m)}, ${window.BRICK_CATALOG_DATE} 기준)`) : '',
      mk ? el('div', { class: 'small' }, '중고 시세 참고: ' + [mk.sealed && `미개봉 ${fmtRange(mk.sealed)}`, mk.used && `개봉 ${fmtRange(mk.used)}`].filter(Boolean).join(' · ') + ' ',
        el('a', { href: `#/set/${it.set_no}` }, '시세 자세히 →')) : el('a', { class: 'small', href: `#/set/${it.set_no}` }, '이 세트 시세 보기 →'),
      (() => {   // 브릭링크(해외) 평균과 비교
        const b = ['sealed', 'complete'].includes(it.cond) ? blOf(it.set_no, it.cond) : null;
        return el('div', { class: 'small' }, '🌏 ', b && it.price ? `브릭링크 ${it.cond === 'sealed' ? '새것' : '중고'} 평균 ${won(b[1])} → 이 상품은 ${diffText(it.price, b[1], '브릭링크')} ` : '',
          el('a', { href: blLink(it.set_no), target: '_blank', rel: 'noopener' }, '브릭링크 가격 보기 ↗'));
      })(),
      riskBox,
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('b', {}, '거래 방식'), el('span', {}, tradeFact)),
        it.trade_direct && it.meet_place ? el('div', { class: 'fact' }, el('b', {}, '직거래 장소'), el('span', {}, it.meet_place)) : '',
        it.trade_delivery ? el('div', { class: 'fact' }, el('b', {}, '택배비'), el('span', {}, it.ship_fee ? won(it.ship_fee) : '가격에 포함')) : '',
        el('div', { class: 'fact' }, el('b', {}, '피스 수'), el('span', {}, it.pieces ? it.pieces.toLocaleString('ko-KR') : '-')),
        el('div', { class: 'fact' }, el('b', {}, '피스당 가격'), el('span', {}, p ? p.toLocaleString('ko-KR') + '원' : '-')),
        el('div', { class: 'fact' }, el('b', {}, '출시연도'), el('span', {}, it.year || '-')),
        el('div', { class: 'fact' }, el('b', {}, '거래 지역'), el('span', {}, it.region || '-')),
        it.status === 'sold' && it.sold_price ? el('div', { class: 'fact' }, el('b', {}, '실제 거래가'), el('span', {}, won(it.sold_price))) : ''),
      // 레고 상태 카드
      el('div', { class: 'condcard' }, el('b', {}, '🧱 상태 카드'),
        el('div', { class: 'checks' }, [['has_box', '박스'], ['has_manual', '설명서'], ['all_figs', '미니피규어 전부'], ['was_built', '조립 이력'], ...(it.has_tray ? [['has_tray', '내부 트레이']] : [])].map(([k, t]) =>
          el('span', { class: 'check' + (it[k] ? ' on' : '') }, (it[k] ? '✓ ' : '✕ ') + t))),
        el('div', { class: 'small' }, [
          it.figs_total != null ? `미니피규어 ${it.figs_have ?? '?'} / ${it.figs_total}개` : '',
          it.sticker ? `스티커: ${STICKER[it.sticker]}` : '',
          it.yellowed ? '⚠ 흰·회색 부품 변색 있음' : (it.yellowed === false && it.figs_total != null ? '변색 없음' : ''),
        ].filter(Boolean).join(' · '))),
      it.description ? el('div', { class: 'desc' }, it.description) : el('div', { class: 'hint' }, '설명이 없어요.'),
      el('div', { class: 'seller' }, el('div', { class: 'avatar', 'aria-hidden': 'true' }, (seller?.nickname || '?').slice(0, 1)),
        el('div', {}, el('b', {}, seller?.nickname || '판매자', age !== null && age < 7 ? el('span', { class: 'newbie' }, '새 판매자') : ''),
          el('div', { class: 'small' }, [seller?.region, age !== null ? `가입 ${age + 1}일째` : '', `등록 ${listed ?? 0}개 · 판매완료 ${sold ?? 0}개`].filter(Boolean).join(' · ')))),
      actions, st,
      el('div', { class: 'hint' }, '안전 거래: 가능하면 직접 만나 실물과 구성품을 확인한 뒤 결제하세요. ',
        el('a', { href: '#/guide/direct' }, '직거래 가이드'), ' · ', el('a', { href: '#/guide/delivery' }, '택배거래 가이드'), ' · ', el('a', { href: '#/safety' }, '사기 예방')))));
}

// ---- 등록 / 수정 ------------------------------------------------------------
async function resizeToJpeg(file) {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
}
async function renderForm(id, presetSet = '') {
  if (!me) return needLogin();
  let it = null;
  if (id) {
    const { data, error } = await sb.from('listings').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data || data.seller_id !== me.id) return show(el('section', { class: 'panel' }, el('h2', {}, '내 상품만 고칠 수 있어요')));
    it = data;
  }
  const { data: prof } = await sb.from('profiles').select('region').eq('id', me.id).maybeSingle();
  const v = (k, d = '') => it ? (it[k] ?? d) : d;
  const inp = (id, attrs) => el('input', { id, ...attrs });
  const fSet = inp('fSet', { required: true, placeholder: '예: 10294 · 미니피규어는 sw0515', value: v('set_no', presetSet) });
  const fName = inp('fName', { required: true, placeholder: '세트 이름', value: v('name') });
  const fTheme = el('select', { id: 'fTheme' }, Object.keys(THEMES).map(t => el('option', { value: t, selected: v('theme', '기타') === t }, t)));
  const fPieces = inp('fPieces', { type: 'number', min: 0, value: v('pieces') || '' });
  const fYear = inp('fYear', { type: 'number', min: 1949, max: 2100, value: v('year') || '' });
  const fCond = el('select', { id: 'fCond' }, Object.entries(COND).map(([k, t]) => el('option', { value: k, selected: v('cond', 'complete') === k }, t)));
  const fPrice = inp('fPrice', { type: 'number', min: 0, step: 1000, required: true, placeholder: '예: 650000', value: v('price') || '' });
  const fRegion = inp('fRegion', { placeholder: '예: 울산 동구', value: v('region', prof?.region || '') });
  const box = (k, t) => el('label', {}, el('input', { type: 'checkbox', id: 'f-' + k, checked: !!v(k, false) }), t);
  const fDesc = el('textarea', { id: 'fDesc', rows: 5, placeholder: '누락 부품, 변색, 스티커 상태 등을 적어 주세요' }, v('description'));
  // 레고 상태 카드 (구매자가 글을 안 읽어도 한눈에)
  const fFigsHave = inp('fFigsHave', { type: 'number', min: 0, placeholder: '있는 수', value: v('figs_have') ?? '' });
  const fFigsTotal = inp('fFigsTotal', { type: 'number', min: 0, placeholder: '원래 수', value: v('figs_total') ?? '' });
  const fSticker = el('select', { id: 'fSticker' }, Object.entries(STICKER).map(([k, t]) => el('option', { value: k, selected: v('sticker', '') === k }, t)));
  // 거래 방식
  const fDirect = el('input', { type: 'checkbox', id: 'fDirect', checked: it ? it.trade_direct !== false : true });
  const fDelivery = el('input', { type: 'checkbox', id: 'fDelivery', checked: !!v('trade_delivery', false) });
  const fMeet = inp('fMeet', { maxlength: 60, placeholder: '예: 울산 동구청 앞, 지하철역 개찰구 앞', value: v('meet_place') });
  const fShip = inp('fShip', { type: 'number', min: 0, step: 500, placeholder: '0 = 가격에 포함', value: v('ship_fee') || '' });
  const meetWrap = el('label', { class: 'f' }, '직거래 장소 (사람 많은 공공장소 추천)', fMeet);
  const shipWrap = el('label', { class: 'f' }, '택배비 (원)', fShip);
  const syncTrade = () => { meetWrap.hidden = !fDirect.checked; shipWrap.hidden = !fDelivery.checked; };
  fDirect.onchange = fDelivery.onchange = syncTrade;
  syncTrade();
  const found = el('div', { class: 'found', 'aria-live': 'polite' });
  const priceHint = el('div', { class: 'small', 'aria-live': 'polite' });

  const fillFromCatalog = overwrite => {
    const c = CATALOG[fSet.value.trim()];
    if (!c && isFig(fSet.value)) { if (overwrite) fTheme.value = '미니피규어'; found.textContent = '미니피규어 번호예요. 이름은 직접 적어 주세요.'; updatePriceHint(); return; }
    if (!c) { found.textContent = ''; return; }
    if (overwrite || !fName.value) fName.value = c.name;
    if (overwrite) { fTheme.value = c.theme; fPieces.value = c.pieces || ''; fYear.value = c.year || ''; }
    found.textContent = `✓ ${c.name}` + (c.pieces ? ` · ${c.pieces.toLocaleString('ko-KR')}피스` : '') + (c.msrp ? ` · 공식몰 정가 ${won(c.msrp)}` : '');
    updatePriceHint();
  };
  const updatePriceHint = () => {
    const no = fSet.value.trim(), m = CATALOG[no]?.msrp, pr = Number(fPrice.value), mk = MARKET[no];
    const r = mk && (fCond.value === 'sealed' ? mk.sealed : fCond.value === 'complete' ? mk.used : null);
    const b = ['sealed', 'complete'].includes(fCond.value) ? blOf(no, fCond.value) : null;
    priceHint.textContent = [m && pr ? `정가 ${won(m)} 대비 ${Math.round((pr / m) * 100)}%` : '', r ? `중고 시세 참고 ${fmtRange(r)}` : '',
      b ? `브릭링크 평균 ${won(b[1])}` : ''].filter(Boolean).join(' · ');
    // 추천 가격 버튼 (누르면 가격 칸에 들어감)
    const s = priceSuggest(no, fCond.value);
    sugg.replaceChildren(...(s ? [el('span', { class: 'small' }, '추천 가격'),
      ...[['quick', '⚡ 빨리 팔기'], ['fair', '👍 적정'], ['slow', '🕰️ 여유 있게']].map(([k2, t]) => el('button', { type: 'button', class: 'pbtn' + (pr === s[k2] ? ' on' : ''),
        onclick: () => { fPrice.value = s[k2]; updatePriceHint(); updateScore(); } }, el('span', {}, t), el('b', {}, won(s[k2])))),
      el('span', { class: 'hint' }, s.basis)] : []));
  };
  const sugg = el('div', { class: 'psugg' });
  // 판매글 점수: 잘 팔리는 판매글의 조건을 얼마나 채웠는지
  const scoreBox = el('div', { class: 'score', 'aria-live': 'polite' });
  const updateScore = () => {
    const no = fSet.value.trim(), pr = Number(fPrice.value), s = priceSuggest(no, fCond.value);
    const chk = id => form.querySelector('#' + id)?.checked;
    const items = [
      [photos.length >= 3 ? 25 : photos.length ? 12 : 0, 25, photos.length >= 3 ? `사진 ${photos.length}장` : `사진을 3장 이상 올리세요 (지금 ${photos.length}장) — 박스 앞·뒤, 미니피규어, 흠집`],
      [CATALOG[no] || isFig(no) ? 10 : no ? 5 : 0, 10, CATALOG[no] ? '세트번호 확인됨' : '세트번호를 넣으면 이름·정가가 자동으로 붙어요'],
      [!pr ? 0 : !s ? 12 : pr <= s.slow * 1.05 ? 20 : 8, 20, !pr ? '가격을 정하세요' : s && pr > s.slow * 1.05 ? `시세보다 높아요 (여유 있게 ${won(s.slow)}) — 오래 걸릴 수 있어요` : '가격이 시세 안에 있어요'],
      [fDesc.value.trim().length >= 60 ? 15 : fDesc.value.trim().length >= 15 ? 7 : 0, 15, fDesc.value.trim().length >= 60 ? '설명 충분' : '설명을 조금 더 — "설명 자동 작성"을 눌러 보세요'],
      [(chk('f-has_box') || chk('f-has_manual') || fFigsTotal.value !== '') ? 15 : 5, 15, fFigsTotal.value !== '' ? '상태 카드 작성됨' : '상태 카드에 미니피규어 수를 적으면 믿음이 커져요'],
      [(fDirect.checked && fMeet.value.trim()) || fDelivery.checked ? 10 : 4, 10, fDirect.checked && !fMeet.value.trim() && !fDelivery.checked ? '직거래 장소를 적어 주세요' : '거래 방법 확인됨'],
      [fRegion.value.trim() ? 5 : 0, 5, fRegion.value.trim() ? '지역 확인됨' : '거래 지역을 적어 주세요'],
    ];
    const sc = items.reduce((a, [p]) => a + p, 0);
    const todo = items.filter(([p, max]) => p < max);
    scoreBox.replaceChildren(
      el('div', { class: 'score-top' }, el('b', {}, '판매글 점수'), el('span', { class: 'score-n' + (sc >= 80 ? ' good' : sc >= 50 ? ' mid' : '') }, `${sc}점`),
        el('span', { class: 'small' }, sc >= 80 ? '잘 팔릴 준비가 됐어요!' : '조금만 채우면 더 빨리 팔려요')),
      el('div', { class: 'meter' }, el('i', { style: `width:${sc}%` })),
      todo.length ? el('ul', { class: 'small' }, todo.map(([, , t]) => el('li', {}, t))) : '');
  };
  // 설명 자동 작성: 입력한 칸으로 판매글 초안
  const autoDesc = () => {
    const c = CATALOG[fSet.value.trim()];
    const yn = (id, t) => `${t} ${form.querySelector('#' + id).checked ? 'O' : 'X'}`;
    const lines = [
      `레고 ${fSet.value.trim()} ${fName.value.trim()}` + (c?.pieces ? ` (${c.pieces.toLocaleString('ko-KR')}피스${c.year ? `, ${c.year}년` : ''})` : '') + ` 팝니다.`,
      `상태: ${COND[fCond.value]}`,
      `구성: ${yn('f-has_box', '박스')} · ${yn('f-has_manual', '설명서')}` + (fFigsTotal.value !== '' ? ` · 미니피규어 ${fFigsHave.value || '?'}/${fFigsTotal.value}개` : '') + (fSticker.value ? ` · 스티커 ${STICKER[fSticker.value]}` : ''),
      form.querySelector('#f-yellowed').checked ? '흰색·회색 부품에 변색이 조금 있어요 (사진 참고).' : '',
      form.querySelector('#f-was_built').checked ? '한 번 조립했다가 분해해서 보관했어요.' : '',
      [fDirect.checked ? `직거래: ${fMeet.value.trim() || fRegion.value.trim() || '장소 협의'}` : '', fDelivery.checked ? `택배: ${Number(fShip.value) ? won(fShip.value) + ' 별도' : '택배비 포함'}` : ''].filter(Boolean).join(' / '),
      '', '실물 사진이에요. 궁금한 점은 편하게 채팅 주세요, 확인하고 바로 답할게요!',
    ].filter(x => x !== null && x !== undefined && x !== false);
    fDesc.value = lines.filter((x, i) => x !== '' || i === lines.length - 2).join('\n');
    updateScore();
  };
  fSet.oninput = () => fillFromCatalog(true);
  fPrice.oninput = fCond.onchange = updatePriceHint;

  // 사진: 이미 올린 주소(수정할 때) + 새로 고른 파일
  const photos = (it?.photos || []).map(url => ({ url }));
  const previews = el('div', { class: 'previews' });
  const renderPreviews = () => { previews.replaceChildren(...photos.map((ph, i) => el('figure', {},
    el('img', { src: ph.url || ph.preview, alt: `사진 ${i + 1}` }),
    el('button', { type: 'button', 'aria-label': `사진 ${i + 1} 빼기`, onclick: () => { photos.splice(i, 1); renderPreviews(); } }, '✕'))));
    if (formReady) updateScore(); };
  let formReady = false;
  const addFiles = async files => {
    for (const f of files) {
      if (!f.type.startsWith('image/') || photos.length >= MAX_PHOTOS) continue;
      const blob = await resizeToJpeg(f);
      photos.push({ blob, preview: URL.createObjectURL(blob) });
    }
    renderPreviews();
  };
  const fileIn = el('input', { type: 'file', id: 'fPhotos', accept: 'image/*', multiple: true, hidden: true });
  fileIn.onchange = () => { addFiles([...fileIn.files]); fileIn.value = ''; };
  const drop = el('div', { class: 'photo-drop', tabindex: 0, role: 'button' }, `📷 사진을 끌어다 놓거나 눌러서 고르세요 (최대 ${MAX_PHOTOS}장, 첫 장이 대표 사진)`);
  drop.onclick = () => fileIn.click();
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } };
  drop.ondragover = e => e.preventDefault();
  drop.ondrop = e => { e.preventDefault(); addFiles([...e.dataTransfer.files]); };
  renderPreviews();

  const st = status();
  const submit = el('button', { type: 'submit', class: 'primary' }, it ? '고친 내용 저장' : '등록하기');
  const form = el('form', { class: 'panel' },
    el('h2', {}, it ? '상품 수정' : '판매 등록'),
    el('div', { class: 'fields' }, el('label', { class: 'f' }, '세트번호', fSet), el('label', { class: 'f wide' }, '이름', fName),
      el('label', { class: 'f' }, '테마', fTheme), el('label', { class: 'f' }, '피스 수', fPieces), el('label', { class: 'f' }, '출시연도', fYear)),
    found,
    el('div', { class: 'hint' }, '🧍 미니피규어는 브릭링크 번호(예: sw0515, sh0715)를 세트번호 칸에 넣어 주세요. 같은 캐릭터도 모양이 여러 가지라 번호가 있어야 시세를 정확히 비교할 수 있어요. ',
      el('a', { href: 'https://www.bricklink.com/catalogList.asp?catType=M', target: '_blank', rel: 'noopener' }, '브릭링크에서 번호 찾기 ↗')),
    el('div', { class: 'fields' }, el('label', { class: 'f' }, '상태', fCond), el('label', { class: 'f' }, '판매 가격 (원)', fPrice, priceHint),
      el('label', { class: 'f' }, '거래 지역', fRegion)),
    sugg,
    el('fieldset', { class: 'tradeset' }, el('legend', {}, '🧱 상태 카드'),
      el('div', { class: 'boxes', role: 'group', 'aria-label': '구성품' }, box('has_box', '박스 있음'), box('has_manual', '설명서 있음'), box('all_figs', '미니피규어 전부'), box('was_built', '조립했다 분해함'),
        box('yellowed', '흰·회색 부품 변색 있음'), box('has_tray', '내부 트레이 있음 (올드 레고)')),
      el('div', { class: 'fields' }, el('label', { class: 'f' }, '미니피규어 (있는 수)', fFigsHave), el('label', { class: 'f' }, '미니피규어 (원래 수)', fFigsTotal),
        el('label', { class: 'f' }, '스티커', fSticker))),
    el('fieldset', { class: 'tradeset' }, el('legend', {}, '거래 방식 (하나 이상)'),
      el('div', { class: 'boxes' }, el('label', {}, fDirect, '🤝 직거래'), el('label', {}, fDelivery, '📦 택배거래')),
      el('div', { class: 'fields' }, meetWrap, shipWrap)),
    el('label', { class: 'f wide' }, el('span', { class: 'bar' }, '설명', el('span', { class: 'grow' }),
      el('button', { type: 'button', class: 'ghost', style: 'padding:2px 8px;font-size:13px', onclick: autoDesc }, '✍️ 설명 자동 작성')), fDesc),
    drop, fileIn, previews,
    el('div', { class: 'photo-tips' }, el('b', {}, '📸 이렇게 찍으면 잘 팔려요'),
      el('ol', {}, el('li', {}, '박스 앞면 (대표 사진)'), el('li', {}, '박스 뒷면·봉인 테이프'), el('li', {}, '미니피규어 모아서'), el('li', {}, '설명서·스티커'), el('li', {}, '흠집·변색 부분'))),
    el('div', { class: 'hint' }, '💡 실제 상품 사진을 올려 주세요. 박스 옆에 닉네임과 날짜를 적은 쪽지를 함께 찍으면 구매자가 더 믿고 연락해요. 다른 곳에서 가져온 사진은 신고될 수 있어요. ',
      el('a', { href: '#/sellguide' }, '판매 꿀팁 더 보기 →')),
    scoreBox,
    el('div', { class: 'bar' }, el('span', { class: 'grow' }, st), submit));
  formReady = true;
  form.addEventListener('input', updateScore);
  form.addEventListener('change', updateScore);
  if (fSet.value) fillFromCatalog(!it);
  updatePriceHint(); updateScore();

  form.onsubmit = async e => {
    e.preventDefault();
    if (!fDirect.checked && !fDelivery.checked) { st.className = 'status err'; st.textContent = '거래 방식을 하나 이상 골라 주세요.'; return; }
    const figsHave = fFigsHave.value === '' ? null : Number(fFigsHave.value), figsTotal = fFigsTotal.value === '' ? null : Number(fFigsTotal.value);
    if (figsHave != null && figsTotal != null && figsHave > figsTotal) { st.className = 'status err'; st.textContent = '미니피규어 있는 수가 원래 수보다 많아요.'; return; }
    submit.disabled = true; st.className = 'status'; st.textContent = '저장하는 중…';
    try {
      const urls = [];
      for (const [i, ph] of photos.entries()) {
        if (ph.url) { urls.push(ph.url); continue; }
        const path = `${me.id}/${Date.now()}-${i}.jpg`;
        const { error } = await sb.storage.from('photos').upload(path, ph.blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        urls.push(sb.storage.from('photos').getPublicUrl(path).data.publicUrl);
      }
      const row = {
        set_no: fSet.value.trim(), name: fName.value.trim(), theme: fTheme.value, pieces: Number(fPieces.value) || 0,
        year: Number(fYear.value) || null, cond: fCond.value, price: Number(fPrice.value) || 0, region: fRegion.value.trim(),
        has_box: form.querySelector('#f-has_box').checked, has_manual: form.querySelector('#f-has_manual').checked,
        all_figs: form.querySelector('#f-all_figs').checked || (figsTotal > 0 && figsHave === figsTotal), was_built: form.querySelector('#f-was_built').checked,
        yellowed: form.querySelector('#f-yellowed').checked, has_tray: form.querySelector('#f-has_tray').checked,
        figs_have: figsHave, figs_total: figsTotal, sticker: fSticker.value,
        description: fDesc.value.trim(), photos: urls,
        trade_direct: fDirect.checked, trade_delivery: fDelivery.checked,
        meet_place: fDirect.checked ? fMeet.value.trim() : '', ship_fee: fDelivery.checked ? Number(fShip.value) || 0 : 0,
      };
      // 수정하면서 뺀 사진은 보관함에서도 지움
      if (it) {
        const gone = it.photos.filter(u => !urls.includes(u)).map(u => u.split('/object/public/photos/')[1]).filter(Boolean);
        if (gone.length) await sb.storage.from('photos').remove(gone);
      }
      const res = it ? await sb.from('listings').update(row).eq('id', it.id).select('id').single()
                     : await sb.from('listings').insert(row).select('id').single();
      if (res.error) throw res.error;
      location.hash = `#/item/${res.data.id}`;
    } catch (err) { st.className = 'status err'; st.textContent = needUpdate(err); submit.disabled = false; }
  };
  show(form);
  if (!it) (presetSet ? fPrice : fSet).focus();
}

// ---- 로그인 (이메일로 받은 링크를 누르면 로그인) ------------------------------
function renderLogin() {
  if (me) { location.hash = '#/'; return; }
  const email = el('input', { id: 'loginEmail', type: 'email', required: true, placeholder: 'you@example.com', autocomplete: 'email' });
  const st = status();
  const btn = el('button', { type: 'submit', class: 'primary' }, CFG.otpCode ? '인증 메일 받기' : '로그인 링크 받기');
  const form = el('form', { class: 'panel login' },
    el('h2', {}, '로그인 / 가입'),
    el('p', {}, CFG.otpCode ? '이메일로 인증번호를 보내 드려요. 처음이면 자동으로 가입돼요. 비밀번호는 필요 없어요.'
      : '이메일을 넣으면 로그인 링크를 보내 드려요. 처음이면 자동으로 가입돼요. 비밀번호는 필요 없어요.'),
    el('label', { class: 'f' }, '이메일', email), el('div', { class: 'bar' }, btn), st,
    el('ul', { class: 'tips small' },
      el('li', {}, '메일이 안 보이면 스팸함도 확인해 주세요.'),
      el('li', {}, CFG.otpCode ? '링크는 누른 기기에서만 로그인돼요. 컴퓨터로 로그인하려는데 메일을 휴대폰에서 봤다면 인증번호를 넣으세요.'
        : '링크는 누른 기기에서만 로그인돼요. 컴퓨터로 로그인하려면 컴퓨터에서 메일(네이버·지메일 웹)을 열어 링크를 눌러 주세요.'),
      el('li', {}, '번호와 링크는 한 번만 쓸 수 있어요. 안 되면 메일을 새로 받아 주세요.')));
  // 메일은 시간당 보낼 수 있는 수가 적어서, 보낸 뒤 60초 동안 다시 못 누르게 함
  const cooldown = sec => {
    btn.disabled = true;
    const tick = () => { if (sec <= 0) { btn.disabled = false; btn.textContent = '메일 다시 받기'; return; } btn.textContent = `다시 받기 (${sec--}초)`; setTimeout(tick, 1000); };
    tick();
  };
  // 인증번호 입력: 메일은 휴대폰으로 보고 로그인은 컴퓨터에서 할 때 (링크는 누른 기기에서만 로그인됨)
  // 칸 하나에 숫자 하나 (Supabase 인증번호 길이 = config otpLength, 지금 8자리). 붙여넣기·자동 이동·다 채우면 자동 로그인
  const N = CFG.otpLength || 8;
  const digits = Array.from({ length: N }, (_, i) => el('input', { class: 'otp-d', inputmode: 'numeric', maxlength: 1, 'aria-label': `인증번호 ${i + 1}번째 숫자`,
    autocomplete: i === 0 ? 'one-time-code' : 'off' }));
  const codeValue = () => digits.map(d => d.value).join('');
  const fill = (from, text) => {
    [...text.replace(/\D/g, '')].slice(0, N - from).forEach((ch, k) => { digits[from + k].value = ch; });
    const next = digits.findIndex(d => !d.value);
    (digits[next] || digits[N - 1]).focus();
    if (codeValue().length === N) verify();
  };
  digits.forEach((d, i) => {
    d.oninput = () => { const v = d.value; d.value = ''; if (v) fill(i, v); };
    d.onkeydown = e => {
      if (e.key === 'Backspace' && !d.value && i > 0) { e.preventDefault(); digits[i - 1].value = ''; digits[i - 1].focus(); }
      else if (e.key === 'ArrowLeft' && i > 0) digits[i - 1].focus();
      else if (e.key === 'ArrowRight' && i < N - 1) digits[i + 1].focus();
      else if (e.key === 'Enter') { e.preventDefault(); verify(); }
    };
    d.onpaste = e => { e.preventDefault(); digits.forEach(x => { x.value = ''; }); fill(0, e.clipboardData.getData('text')); };
    d.onfocus = () => d.select();
  });
  const sentTo = el('span', {});
  const codeSt = status();
  const codeBtn = el('button', { type: 'button', class: 'primary' }, '로그인');
  const codeBox = el('div', { class: 'codebox', hidden: true },
    el('div', { class: 'code-head' }, el('b', {}, `메일로 받은 인증번호 ${N}자리`), el('div', { class: 'small' }, sentTo, ' · 1시간 안에 넣어 주세요')),
    el('div', { class: 'otp', role: 'group', 'aria-label': '인증번호' }, digits.slice(0, N / 2), el('span', { class: 'otp-dash', 'aria-hidden': 'true' }, '–'), digits.slice(N / 2)),
    codeBtn, codeSt,
    el('div', { class: 'small code-help' }, '메일이 안 보이면 스팸함을 확인해 주세요 · 메일 속 버튼을 누르면 그 기기에서 바로 로그인돼요'));
  const code = { focus: () => digits[0].focus() };
  const verify = async () => {
    const token = codeValue();
    if (codeBtn.disabled) return;
    if (token.length < N) { codeSt.className = 'status err'; codeSt.textContent = `숫자 ${N}자리를 모두 넣어 주세요.`; return; }
    codeBtn.disabled = true; codeSt.className = 'status'; codeSt.textContent = '확인하는 중…';
    let { error } = await sb.auth.verifyOtp({ email: email.value.trim(), token, type: 'email' });
    // 처음 가입하는 사람은 가입 확인 번호라서 type이 다를 수 있음
    if (error && /expired|invalid/i.test(error.message)) ({ error } = await sb.auth.verifyOtp({ email: email.value.trim(), token, type: 'signup' }));
    codeBtn.disabled = false;
    if (error) { codeSt.className = 'status err'; codeSt.textContent = /expired|invalid/i.test(error.message) ? '번호가 틀렸거나 시간이 지났어요. 가장 최근 메일의 번호를 넣거나 새로 받아 주세요.' : errMsg(error); return; }
    toast('로그인했어요. 반가워요!');
    location.hash = '#/';
  };
  codeBtn.onclick = verify;
  form.insertBefore(codeBox, form.querySelector('.tips'));
  form.onsubmit = async e => {
    e.preventDefault();
    btn.disabled = true; st.className = 'status'; st.textContent = '보내는 중…';
    const { error } = await sb.auth.signInWithOtp({ email: email.value.trim(), options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) { st.className = 'status err'; st.textContent = errMsg(error); btn.disabled = false; return; }
    st.textContent = CFG.otpCode ? '' : `📬 ${email.value.trim()} 메일함을 확인해 주세요. 메일 속 링크는 누른 기기에서 로그인돼요 — 이 기기에서 메일을 열어 링크를 눌러 주세요.`;
    if (CFG.otpCode) { sentTo.textContent = `📬 ${email.value.trim()}(으)로 보냈어요`; codeBox.hidden = false; digits.forEach(d => { d.value = ''; }); codeSt.textContent = ''; code.focus(); }
    cooldown(60);
  };
  show(form);
}

// ---- 내 정보 ---------------------------------------------------------------
async function renderMe() {
  if (!me) return needLogin();
  const [{ data: prof }, { data: mine, error }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', me.id).maybeSingle(),
    sb.from('listings').select('*').eq('seller_id', me.id).order('created_at', { ascending: false }),
  ]);
  if (error) throw error;
  const nick = el('input', { id: 'meNick', maxlength: 20, value: prof?.nickname || '' });
  const region = el('input', { id: 'meRegion', maxlength: 30, placeholder: '예: 울산 동구', value: prof?.region || '' });
  const st = status();
  const form = el('form', { class: 'panel' }, el('h2', {}, '내 정보'), el('div', { class: 'small' }, me.email),
    el('div', { class: 'fields' }, el('label', { class: 'f' }, '닉네임', nick), el('label', { class: 'f' }, '기본 거래 지역', region)),
    el('div', { class: 'bar' }, el('button', { type: 'submit', class: 'primary' }, '저장'), st, el('span', { class: 'grow' }),
      el('button', { type: 'button', class: 'ghost', onclick: async () => { await sb.auth.signOut(); location.hash = '#/'; } }, '로그아웃')));
  form.onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.from('profiles').update({ nickname: nick.value.trim() || '브릭러', region: region.value.trim() }).eq('id', me.id);
    st.className = 'status' + (error ? ' err' : ''); st.textContent = error ? errMsg(error) : '저장했어요.';
  };
  show(form, el('section', { class: 'panel' }, el('h2', {}, `내 판매 상품 ${mine.length}개`),
    mine.length ? el('div', { class: 'grid' }, mine.map(it => el('a', { class: 'card' + (it.status === 'sold' ? ' sold' : ''), href: `#/item/${it.id}` },
      el('div', { class: 'thumb' }, thumb(it), el('span', { class: 'flag' }, STATUS[it.status])),
      el('div', { class: 'body' }, el('div', { class: 'name' }, it.name), el('div', { class: 'price' }, won(it.price))))))
      : el('div', { class: 'empty' }, '아직 올린 상품이 없어요.', el('a', { class: 'btn primary', href: '#/sell' }, '+ 판매 등록하기'))));
}

// ---- 채팅 목록 --------------------------------------------------------------
async function renderChats() {
  if (!me) return needLogin();
  const { data: msgs, error } = await sb.from('messages').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  const rooms = new Map();
  msgs.forEach(m => { const k = `${m.listing_id}/${m.buyer_id}`; if (!rooms.has(k)) rooms.set(k, m); });
  const listingIds = [...new Set([...rooms.values()].map(m => m.listing_id))];
  const { data: ls } = listingIds.length ? await sb.from('listings').select('id, name, set_no, theme, photos, seller_id').in('id', listingIds) : { data: [] };
  const byId = new Map((ls || []).map(l => [l.id, l]));
  const otherIds = [...new Set([...rooms.values()].map(m => { const l = byId.get(m.listing_id); return l && l.seller_id === me.id ? m.buyer_id : l?.seller_id; }).filter(Boolean))];
  const { data: ps } = otherIds.length ? await sb.from('profiles').select('id, nickname').in('id', otherIds) : { data: [] };
  const nick = new Map((ps || []).map(p => [p.id, p.nickname]));
  const rows = [...rooms.entries()].map(([k, m]) => {
    const l = byId.get(m.listing_id);
    if (!l) return null;
    const other = l.seller_id === me.id ? m.buyer_id : l.seller_id;
    return el('a', { class: 'room', href: `#/chat/${k}` }, el('div', { class: 't' }, thumb(l)),
      el('div', { style: 'min-width:0' }, el('b', {}, `${nick.get(other) || '상대방'} · ${l.name}`), el('div', { class: 'last' }, (m.sender_id === me.id ? '나: ' : '') + m.body)),
      el('span', { class: 'small' }, new Date(m.created_at).toLocaleDateString('ko-KR')));
  }).filter(Boolean);
  show(el('section', { class: 'panel' }, el('h2', {}, '채팅'),
    rows.length ? el('div', { class: 'rooms' }, rows) : el('div', { class: 'empty' }, '아직 채팅이 없어요. 마음에 드는 상품에서 "판매자에게 채팅"을 눌러 보세요.')));
}

// ---- 채팅방 ----------------------------------------------------------------
async function renderChat(listingId, buyerId) {
  if (!me) return needLogin();
  const { data: l, error } = await sb.from('listings').select('id, name, set_no, theme, photos, price, seller_id').eq('id', listingId).maybeSingle();
  if (error) throw error;
  if (!l) return show(el('section', { class: 'panel' }, el('h2', {}, '없는 상품이에요')));
  if (l.seller_id === me.id && buyerId === me.id) return show(el('section', { class: 'panel' }, el('h2', {}, '내 상품이에요'), el('p', {}, '구매 희망자가 채팅을 보내면 채팅 목록에 나타나요.')));
  if (me.id !== buyerId && me.id !== l.seller_id) return show(el('section', { class: 'panel' }, el('h2', {}, '이 대화는 볼 수 없어요')));
  const otherId = me.id === l.seller_id ? buyerId : l.seller_id;
  const { data: other } = await sb.from('profiles').select('nickname').eq('id', otherId).maybeSingle();

  const box = el('div', { class: 'msgs', role: 'log', 'aria-live': 'polite' });
  const seen = new Set();
  const add = m => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    box.append(el('div', { class: 'msg' + (m.sender_id === me.id ? ' me' : '') }, m.body,
      el('time', { datetime: m.created_at }, new Date(m.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))));
    // 상대가 보낸 말에 사기 신호가 있으면 바로 아래에 주의 안내
    if (m.sender_id !== me.id) riskOf(m.body).forEach(w => box.append(el('div', { class: 'msg-warn', role: 'note' }, '⚠️ ' + w)));
    box.scrollTop = box.scrollHeight;
  };
  const input = el('input', { id: 'chatInput', maxlength: 1000, placeholder: '메시지를 입력하세요', autocomplete: 'off' });
  const st = status();
  const form = el('form', { class: 'send' }, input, el('button', { type: 'submit', class: 'primary' }, '보내기'));
  form.onsubmit = async e => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    const { data, error } = await sb.from('messages').insert({ listing_id: l.id, buyer_id: buyerId, body }).select().single();
    if (error) { st.className = 'status err'; st.textContent = errMsg(error); input.value = body; return; }
    st.textContent = ''; add(data);
  };
  show(el('section', { class: 'panel chat' },
    el('a', { class: 'room', href: `#/item/${l.id}` }, el('div', { class: 't' }, thumb(l)),
      el('div', { style: 'min-width:0' }, el('b', {}, l.name), el('div', { class: 'small' }, `#${l.set_no} · ${won(l.price)}`)), el('span', { class: 'small' }, '상품 보기')),
    el('h2', {}, `${other?.nickname || '상대방'}님과의 대화`), box, form, st,
    el('details', { class: 'checklist' }, el('summary', {}, '🛡️ 거래 전 체크리스트'),
      el('ul', {},
        el('li', {}, '대화는 리브릭 채팅에서만 하세요. 카톡·텔레그램으로 옮기자고 하면 조심하세요.'),
        el('li', {}, '직거래는 사람 많은 공공장소에서, 실물과 구성품을 확인한 뒤 결제하세요.'),
        el('li', {}, '택배거래는 더치트(thecheat.co.kr)에서 계좌·전화번호를 먼저 조회하세요.'),
        el('li', {}, '판매자에게 상품 옆에 오늘 날짜·닉네임 쪽지를 놓고 찍은 사진을 요청하세요.'),
        el('li', {}, '예금주 이름과 판매자 이름이 다르면 거래하지 마세요.'),
        el('li', {}, '안전결제·결제 링크는 누르지 마세요. 리브릭에는 그런 기능이 없어요.')),
      el('a', { href: '#/safety' }, '안전거래 가이드 전체 보기 →'))));

  const { data: msgs, error: e2 } = await sb.from('messages').select('*').eq('listing_id', l.id).eq('buyer_id', buyerId).order('created_at');
  if (e2) throw e2;
  msgs.forEach(add);
  if (!msgs.length) box.append(el('div', { class: 'hint' }, '첫 메시지를 보내 보세요. 예: "아직 판매 중인가요?"'));
  channel = sb.channel(`room-${l.id}-${buyerId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `listing_id=eq.${l.id}` }, ({ new: m }) => { if (m.buyer_id === buyerId) add(m); })
    .subscribe();
  input.focus();
}

// ---- 거래 가이드 (직거래 / 택배거래) -------------------------------------------
function renderGuide(kind) {
  const tab = (k, t) => el('a', { class: 'chip', href: `#/guide/${k}`, 'aria-current': kind === k ? 'page' : null, 'aria-pressed': String(kind === k) }, t);
  const steps = list => el('ol', { class: 'steps' }, list.map(([t, d]) => el('li', {}, el('b', {}, t), el('div', { class: 'small' }, d))));
  const box = (title, items, cls = '') => el('div', { class: 'gbox ' + cls }, el('b', {}, title), el('ul', {}, items.map(i => el('li', {}, i))));
  const body = kind === 'direct' ? [
    el('p', {}, '직접 만나서 실물을 보고 사는 방식이에요. 중고 브릭은 구성품·변색·누락을 눈으로 확인할 수 있어서 ', el('b', {}, '가장 안전한 방법'), '이에요.'),
    steps([
      ['채팅으로 약속 잡기', '시간·장소·가격을 리브릭 채팅에 남겨 두세요. 나중에 문제가 생기면 증거가 돼요.'],
      ['공공장소에서 만나기', '지하철역·관공서·카페처럼 사람 많고 CCTV 있는 곳이 좋아요. 집 앞이나 외진 곳은 피하세요.'],
      ['실물 확인하기', '박스 상태, 봉지 개봉 여부(미개봉이면 테이프·씰), 설명서, 미니피규어 수를 확인하세요.'],
      ['결제하기', '확인이 끝난 뒤 현금이나 그 자리 계좌이체로 결제하세요. 만나기 전에 돈을 보내지 마세요.'],
      ['판매완료 표시', '판매자는 상품 화면에서 상태를 "판매완료"로 바꿔 주세요.'],
    ]),
    el('div', { class: 'gboxes' },
      box('✅ 만나서 꼭 볼 것', ['세트번호가 맞는지 (박스 옆면·설명서 표지)', '미니피규어 개수와 얼굴·몸통 프린트', '투명 부품 긁힘, 흰 부품 누렇게 변색', '스티커 붙였는지 여부', '정품 로고 — 스터드(동그란 돌기)마다 LEGO 글자']),
      box('🚫 이러면 거래 그만', ['장소를 계속 바꾸거나 외진 곳으로 부를 때', '"택배로 하자"며 선입금으로 바꾸려 할 때', '확인도 못 하게 서두를 때', '사진과 실물이 다를 때'], 'warn')),
  ] : [
    el('p', {}, '멀리 있는 사람과 택배로 주고받는 방식이에요. 편하지만 ', el('b', {}, '사기가 가장 많이 일어나는 방식'), '이라 아래 순서를 꼭 지켜 주세요.'),
    steps([
      ['판매자 확인하기', '상품 화면에서 가입일·판매완료 수를 보세요. 새로 가입했고 판매 기록이 없으면 더 조심하세요.'],
      ['인증 사진 받기', '상품 옆에 "오늘 날짜 + 리브릭 닉네임" 쪽지를 놓고 찍은 사진을 채팅으로 요청하세요. 다른 곳에서 가져온 사진은 이걸 못 해요.'],
      ['계좌·연락처 조회하기', '더치트(thecheat.co.kr)에서 받은 계좌번호와 전화번호를 조회하세요. 신고 이력이 있으면 거래하지 마세요.'],
      ['예금주 확인하기', '이체 화면에 뜨는 예금주 이름이 판매자가 말한 이름과 같은지 보세요. 다르면 거래하지 마세요.'],
      ['송장 받기', '보낸 뒤 운송장 번호를 채팅으로 받고, 택배사 홈페이지에서 직접 조회하세요. 판매자가 보낸 조회 링크는 누르지 마세요.'],
      ['받으면 바로 확인', '개봉 영상을 찍어 두면 누락·바꿔치기 분쟁 때 도움이 돼요.'],
    ]),
    el('div', { class: 'gboxes' },
      box('📦 판매자라면', ['뽁뽁이로 박스 모서리를 감싸고 단단한 상자에 넣으세요', '조립품은 봉지에 나눠 담고 구성품 사진을 남기세요', '포장 과정과 송장을 사진으로 남겨 두세요', '입금 확인 뒤에 보내세요']),
      box('🚫 이러면 거래 그만', ['"안전결제 링크"나 결제 페이지 주소를 보낼 때', '카톡·텔레그램으로 옮기자고 할 때', '예금주가 다르거나 "친구 계좌"라고 할 때', '"다른 사람도 산대요, 빨리 입금"처럼 서두를 때', '상품권·코인으로 달라고 할 때'], 'warn')),
  ];
  show(el('section', { class: 'panel guide' },
    el('div', { class: 'filters' }, tab('direct', '🤝 직거래'), tab('delivery', '📦 택배거래'), el('span', { class: 'grow' }), el('a', { href: '#/safety', class: 'small' }, '🛡️ 사기 예방 가이드')),
    el('h2', {}, kind === 'direct' ? '직거래 가이드' : '택배거래 가이드'), ...body,
    el('div', { class: 'bar' }, el('button', { class: 'primary', onclick: () => { filters.trade = kind; location.hash = '#/'; } },
      kind === 'direct' ? '직거래 가능한 상품 보기' : '택배 가능한 상품 보기'))));
}

// ---- 안전거래 (사기 예방) -----------------------------------------------------
function renderSafety() {
  const scam = (icon, title, how, tip) => el('div', { class: 'scam' }, el('div', { class: 'ico', 'aria-hidden': 'true' }, icon),
    el('div', {}, el('b', {}, title), el('div', {}, how), el('div', { class: 'small tip' }, '👉 ' + tip)));
  show(el('section', { class: 'panel guide' },
    el('h2', {}, '🛡️ 안전거래 가이드'),
    el('p', {}, '리브릭은 판매자와 구매자를 이어 주기만 하고, 돈을 대신 맡아 주지 않아요. 아래 사기 유형을 알고 있으면 대부분 피할 수 있어요.'),
    el('div', { class: 'scams' },
      scam('💸', '선입금 후 잠수', '돈을 보내면 연락이 끊겨요. 택배거래에서 가장 흔해요.', '처음 거래하는 사람이면 직거래를 고집하세요. 택배라면 더치트 조회와 인증 사진을 꼭 받으세요.'),
      scam('🔗', '가짜 안전결제 링크', '"안전결제로 할게요"라며 진짜 같은 결제 페이지 주소를 보내요. 돈은 사기꾼에게 가요.', '리브릭에는 안전결제 기능이 없어요. 채팅으로 온 결제 링크는 절대 누르지 마세요.'),
      scam('📱', '다른 메신저로 유도', '"카톡으로 얘기해요"라며 옮긴 뒤 사기를 쳐요. 리브릭 채팅 기록이 남지 않아 신고가 어려워져요.', '대화는 끝까지 리브릭 채팅에서 하세요.'),
      scam('🏷️', '너무 싼 가격', '인기 세트를 정가의 절반 이하로 올려서 급하게 입금하게 만들어요.', '리브릭은 정가보다 지나치게 싼 미개봉·완전체에 경고를 띄워요. 싸다고 서두르지 마세요.'),
      scam('🧱', '가품·호환 블록', '정품이 아닌 호환 블록을 정품처럼 팔아요. 박스까지 비슷하게 만든 것도 있어요.', '스터드마다 LEGO 글자가 있는지 보세요. 박스 바코드·세트번호도 확인하세요.'),
      scam('🔄', '부품 바꿔치기·누락', '희귀 미니피규어나 부품을 빼고 "완전체"라고 팔아요.', '미니피규어 수와 구성품을 공식 설명서와 비교하세요. 택배라면 개봉 영상을 찍어 두세요.'),
      scam('🧾', '가짜 송장', '보내지도 않고 운송장 번호만 보내거나, 가짜 조회 링크를 보내요.', '송장 번호는 택배사 홈페이지에서 직접 조회하세요.'),
      scam('👤', '명의 다른 계좌', '"친구 계좌예요", "사업자 계좌예요"라며 다른 사람 이름의 계좌로 받아요.', '예금주 이름이 판매자와 다르면 거래하지 마세요.')),
    el('div', { class: 'gbox' }, el('b', {}, '🔎 거래 전에 조회하기'),
      el('ul', {},
        el('li', {}, el('a', { href: 'https://thecheat.co.kr', target: '_blank', rel: 'noopener' }, '더치트 (thecheat.co.kr)'), ' — 계좌번호·전화번호 사기 피해 신고 이력 조회'),
        el('li', {}, '경찰청 사이버수사국 홈페이지의 사이버사기 조회에서도 계좌·전화번호를 확인할 수 있어요.'))),
    el('div', { class: 'gbox warn' }, el('b', {}, '😢 사기를 당했다면'),
      el('ol', {},
        el('li', {}, '바로 내 은행 고객센터에 전화해 상대 계좌 지급정지를 요청하세요. 빠를수록 돈을 찾을 가능성이 커요.'),
        el('li', {}, '채팅 화면·입금 내역·상품 화면을 캡처해 두세요.'),
        el('li', {}, '경찰청 사이버범죄 신고(ECRM) 또는 가까운 경찰서에 신고하세요. (긴급하면 112)'),
        el('li', {}, '리브릭 상품 화면의 🚩 신고 버튼으로 알려 주세요. 다른 사람의 피해를 막을 수 있어요.'))),
    el('div', { class: 'bar' }, el('a', { class: 'btn', href: '#/guide/direct' }, '🤝 직거래 가이드'), el('a', { class: 'btn', href: '#/guide/delivery' }, '📦 택배거래 가이드'))));
}

// ---- 신고 ------------------------------------------------------------------
async function renderReport(listingId) {
  if (!me) return needLogin();
  const { data: l, error } = await sb.from('listings').select('id, name, set_no, theme, photos, price, seller_id').eq('id', listingId).maybeSingle();
  if (error) throw error;
  if (!l) return show(el('section', { class: 'panel' }, el('h2', {}, '없는 상품이에요')));
  if (l.seller_id === me.id) return show(el('section', { class: 'panel' }, el('h2', {}, '내 상품은 신고할 수 없어요')));
  const reason = el('select', { id: 'rReason', required: true }, el('option', { value: '' }, '이유를 골라 주세요'),
    Object.entries(REPORT_REASONS).map(([k, t]) => el('option', { value: k }, t)));
  const detail = el('textarea', { id: 'rDetail', rows: 4, maxlength: 1000, placeholder: '어떤 일이 있었는지 적어 주세요. (예: 입금하라며 결제 링크를 보냈어요)' });
  const st = status();
  const btn = el('button', { type: 'submit', class: 'primary' }, '신고하기');
  const form = el('form', { class: 'panel', style: 'max-width:560px' },
    el('h2', {}, '🚩 신고하기'),
    el('a', { class: 'room', href: `#/item/${l.id}` }, el('div', { class: 't' }, thumb(l)),
      el('div', { style: 'min-width:0' }, el('b', {}, l.name), el('div', { class: 'small' }, `#${l.set_no} · ${won(l.price)}`)), el('span', { class: 'small' }, '상품 보기')),
    el('label', { class: 'f' }, '신고 이유', reason), el('label', { class: 'f' }, '자세한 내용', detail),
    el('div', { class: 'hint' }, '돈을 이미 보냈다면 신고와 함께 바로 은행에 지급정지를 요청하고 경찰에 신고하세요. ', el('a', { href: '#/safety' }, '피해 대처 방법')),
    el('div', { class: 'bar' }, btn, st));
  form.onsubmit = async e => {
    e.preventDefault();
    if (!reason.value) { st.className = 'status err'; st.textContent = '신고 이유를 골라 주세요.'; return; }
    btn.disabled = true;
    const { error } = await sb.from('reports').insert({ listing_id: l.id, seller_id: l.seller_id, reason: reason.value, detail: detail.value.trim() });
    if (error) { st.className = 'status err'; st.textContent = needUpdate(error); btn.disabled = false; return; }
    toast('신고가 접수됐어요. 알려 주셔서 고마워요.');
    location.hash = `#/item/${l.id}`;
  };
  show(form);
}

// ---- 시작 ------------------------------------------------------------------
(async () => {
  if (sb) {
    // 메일 링크로 돌아오면 주소 # 뒤에 로그인 열쇠나 오류가 붙어 옴 → 읽은 뒤 주소에서 지움
    const back = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
    const { data } = await sb.auth.getSession();
    me = data.session?.user || null;
    if (back.has('access_token') || back.has('error')) {
      history.replaceState(null, '', location.pathname + location.search + '#/');
      if (back.has('error')) toast(back.get('error_code') === 'otp_expired' ? '로그인 링크가 만료됐거나 이미 쓴 링크예요. 새 링크를 받아 주세요.' : `로그인하지 못했어요: ${back.get('error_description') || back.get('error')}`, true);
      else if (me) toast('로그인됐어요. 환영해요! 🧱');
    }
    sb.auth.onAuthStateChange((event, session) => {
      const was = me?.id;
      me = session?.user || null;
      renderNav();
      if (was !== me?.id) route();
    });
  }
  renderNav();
  route();
})();
