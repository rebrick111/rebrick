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
const badgeEl = no => { const b = storeBadge(no); if (!b) return ''; const [label, tone] = fancyLabel(b.text); return el('span', { class: `sbadge tone-${tone}` }, label); };
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
// 박스 상태 등급 (2026-10-30, StockX 레고 상태 기준 참고: 실링 풀림·작은 흠은 미개봉으로 봄)
const BOX_GRADE = { '': '고르지 않음', S: 'S · 새것 같음 (찍힘·실링 이상 없음)', A: 'A · 실링 풀림·아주 작은 흠', B: 'B · 모서리 찍힘·눌림', C: 'C · 찢어짐·큰 손상' };
// 카드에 붙는 작은 구성품 딱지: 박스 S · 미피 4/4 · 누락 2
const kitChips = it => [
  it.box_grade ? el('span', { class: 'kchip grade-' + it.box_grade }, `박스 ${it.box_grade}`) : '',
  it.figs_total ? el('span', { class: 'kchip' + (it.figs_have === it.figs_total ? ' ok' : '') }, `미피 ${it.figs_have ?? '?'}/${it.figs_total}`) : '',
  it.missing_parts ? el('span', { class: 'kchip warn' }, `누락 ${it.missing_parts}`) : it.missing_parts === 0 ? el('span', { class: 'kchip ok' }, '누락 없음') : ''];
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
const filters = { theme: '', cond: '', trade: '', kit: '', sort: 'new', q: '', showSold: false };
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
// (2026-10-30) 이미지 후보를 차례로: ①레고 공식몰(legoimg.js) ②Rebrickable ③브릭링크 이미지 서버(코믹콘 한정판·옛 세트까지 거의 다 있음)
const LEGO_IMG = Object.fromEntries((window.BRICK_LEGO_IMG || '').trim().split('\n').filter(Boolean).map(l => {
  const [no, id, file] = l.split('|');
  return [no, `https://www.lego.com/cdn/cs/set/assets/blt${id}/${file || no + '_Prod.png'}?format=webply&fit=bounds&quality=75&width=480`];
}));
function imgsOf(no) {
  no = String(no || '').trim();
  if (!no) return [];
  const base = no.replace(/-1$/, ''), f = isFig(base);
  const bl = `https://img.bricklink.com/ItemImage/${f ? 'MN' : 'SN'}/0/${encodeURIComponent(BL[base]?.id || (f ? base : /-\d+$/.test(no) ? no : no + '-1'))}.png`;
  return [...new Set([LEGO_IMG[base], imgOf(no), bl].filter(Boolean))];
}
// 이미지 칸에 후보를 하나씩 넣어 보고, 다 안 되면 fail()
function chainImg(img, list, fail) {
  let i = 0;
  const next = () => { if (i < list.length) img.src = list[i++]; else fail?.(); };
  img.onerror = next;
  next();
  return img;
}
const pic = (no, attrs, fail) => chainImg(el('img', { alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', ...attrs }), imgsOf(no), fail);
// 표 한 줄용 작은 이미지 + 세트번호
function miniThumb(no) {
  const img = imgsOf(no).length ? pic(no, {}, () => img.replaceWith(el('i', {}))) : el('i', {});
  return el('a', { class: 'refthumb', href: `#/set/${encodeURIComponent(no)}`, 'aria-label': `${no} 시세` }, img, el('span', { class: 'setno' }, `#${no}`));
}
const placeholder = it => el('div', { class: 'ph', style: `--c:${THEMES[it.theme] || THEMES['기타']}`, role: 'img', 'aria-label': `${it.name || it.set_no || ''} 사진 없음` },
  el('small', {}, it.theme || ''), el('span', { class: String(it.set_no || '').length > 6 ? 'long' : null },
    it.set_no || (it.cond === 'parts' ? 'BULK' : it.theme === '미니피규어' ? 'FIG' : 'LEGO')));
// 판매자 사진 → 없으면 공식 이미지(판매 글이면 '공식 이미지' 표시) → 그것도 없으면 테마색 자리표시
function thumb(it) {
  if (it.photos?.length) return el('img', { src: it.photos[0], alt: `${it.name} 사진`, loading: 'lazy' });
  if (!imgsOf(it.set_no).length) return placeholder(it);
  const box = el('div', { class: 'catimg' });
  box.append(pic(it.set_no, { alt: `${it.name || it.set_no} 공식 이미지` }, () => box.replaceWith(placeholder(it))));
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
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z',
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
const isHome = () => !filters.q.trim() && !filters.theme && !filters.cond && !filters.trade && !filters.kit;
// update_2.sql / update_3.sql 을 아직 안 돌렸으면 새 칸이 없음 → 안내
const needUpdate = e => /trade_|ship_fee|meet_place|reports/.test(e?.message || '')
  ? '저장소 설계도가 예전 버전이에요. Supabase SQL Editor에서 update_2.sql 을 한 번 실행해 주세요.'
  : /sold_|figs_|sticker|yellowed|has_tray|collections|set_prices/.test(e?.message || '')
  ? '저장소 설계도가 예전 버전이에요. Supabase SQL Editor에서 update_3.sql 을 한 번 실행해 주세요.'
  : /notifications|saved_searches|offers|reviews|box_grade|missing_|answer_offer/.test(e?.message || '')
  ? '저장소 설계도가 예전 버전이에요. Supabase SQL Editor에서 update_6.sql 을 한 번 실행해 주세요.' : errMsg(e);

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
  renderTabbar();
  paintBell();
}
// ---- 휴대폰 아래 탭 바 (당근·번개처럼) ----------------------------------------
// 홈 · 시세 · 테마 · 채팅 · 내 정보. 판매는 오른쪽 아래 떠 있는 둥근 버튼(#sellFab, 당근식). PC(720px 넘음)에선 둘 다 숨김
const TABS = [['#/', 'home', '홈'], ['#/prices', 'chart', '시세'], ['#/themes', 'grid', '테마'], ['#/chats', 'chat', '채팅'], ['#/me', 'user', '내 정보']];
function renderTabbar() {
  const bar = document.getElementById('tabbar');
  if (!bar) return;
  bar.replaceChildren(...TABS.map(([href, ic, label]) =>
    el('a', { class: 'tab', href: href === '#/me' && !me ? '#/login' : href }, icon(ic), el('span', {}, href === '#/me' && !me ? '로그인' : label))));
  bar.querySelectorAll('a[href="#/"]').forEach(a => a.addEventListener('click', goHome));
  markTabbar();
  paintUnread();
}

// ---- 안 읽은 채팅 (2026-10-30) ----------------------------------------------
// 채팅방을 마지막으로 연 시각: DB(chat_reads, update_5.sql — 기기끼리 같음, 상대 화면의 '읽음'에도 씀) + 이 기기(localStorage) 중 늦은 쪽
// 상대가 그 뒤에 보낸 말이 있으면 안 읽음
const SEEN_KEY = 'chatSeen';
const seenMap = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; } };
async function seenAll() {
  const m = seenMap();
  if (sb && me) {
    const { data } = await sb.from('chat_reads').select('listing_id, buyer_id, read_at').eq('user_id', me.id);
    (data || []).forEach(r => { const k = `${r.listing_id}/${r.buyer_id}`; if (!m[k] || new Date(r.read_at) > new Date(m[k])) m[k] = r.read_at; });
  }
  return m;
}
const isNewer = (m, seen) => m.sender_id !== me?.id && (!seen || new Date(m.created_at) > new Date(seen));
function markSeen(room) {
  const m = seenMap(); m[room] = new Date().toISOString();
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch (e) {}
  if (unread.delete(room)) paintUnread();
  const [l, b] = room.split('/');
  if (sb && me) sb.rpc('mark_read', { l: +l, b }).then(() => {}, () => {});
}
let unread = new Set(), inbox = null;
async function checkUnread() {
  unread = new Set();
  if (sb && me) {
    const [{ data }, seen] = await Promise.all([
      sb.from('messages').select('listing_id, buyer_id, sender_id, created_at').order('created_at', { ascending: false }).limit(300), seenAll()]);
    const last = new Map();
    (data || []).forEach(m => { const k = `${m.listing_id}/${m.buyer_id}`; if (!last.has(k)) last.set(k, m); });
    last.forEach((m, k) => { if (isNewer(m, seen[k])) unread.add(k); });
  }
  paintUnread();
}
// 아래 탭 바·위 머리띠의 채팅 아이콘에 빨간 숫자
function paintUnread() {
  const n = unread.size;
  document.querySelectorAll('#tabbar a[href="#/chats"], #nav a[href="#/chats"]').forEach(a => {
    a.querySelector('.badge')?.remove();
    if (n) a.append(el('span', { class: 'badge', 'aria-label': `안 읽은 채팅 ${n}개` }, n > 9 ? '9+' : String(n)));
  });
}
// 새 메시지가 오면 바로 빨간 점 (채팅방 안에서 보고 있으면 읽음으로)
function watchInbox() {
  if (inbox) { sb.removeChannel(inbox); inbox = null; }
  if (!sb || !me) return;
  inbox = sb.channel('inbox-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: m }) => {
    if (m.sender_id === me.id) return;
    const k = `${m.listing_id}/${m.buyer_id}`;
    if (location.hash === `#/chat/${k}`) return;   // 보고 있는 방은 renderChat이 읽음 처리
    unread.add(k); paintUnread();
    if (location.hash === '#/chats') route();
  }).subscribe();
}

// ---- 찜 (♡) (2026-10-30, likes 표 = update_4.sql) ----------------------------
// 내가 찜한 것만 나에게 보이고, 다른 사람에겐 개수만 (like_counts 함수)
let myLikes = new Set();
async function loadLikes() {
  myLikes = new Set();
  if (sb && me) {
    const { data } = await sb.from('likes').select('listing_id');
    (data || []).forEach(r => myLikes.add(r.listing_id));
  }
  document.querySelectorAll('[data-like]').forEach(paintLike);
}
function paintLike(b) {
  const on = myLikes.has(+b.dataset.like);
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? '찜 취소' : '찜하기');
  const t = b.querySelector('.t'); if (t) t.textContent = on ? '찜함' : '찜하기';
}
// big = 상품 화면의 글자 있는 버튼, 아니면 사진 위 동그란 하트 (번개장터처럼)
function likeBtn(it, big) {
  const b = el('button', { type: 'button', class: big ? 'like big' : 'like', 'data-like': it.id }, icon('heart'), big ? el('span', { class: 't' }) : '');
  b.onclick = async e => {
    e.preventDefault(); e.stopPropagation();
    if (!me) { toast('로그인하면 찜할 수 있어요.'); location.hash = '#/login'; return; }
    const on = !myLikes.has(it.id);
    const paint = () => document.querySelectorAll(`[data-like="${it.id}"]`).forEach(paintLike);
    on ? myLikes.add(it.id) : myLikes.delete(it.id); paint();
    const { error } = on ? await sb.from('likes').insert({ listing_id: it.id })
      : await sb.from('likes').delete().eq('listing_id', it.id).eq('user_id', me.id);
    if (error) { on ? myLikes.delete(it.id) : myLikes.add(it.id); paint(); toast(needUpdate(error), true); return; }
    if (on) toast('찜했어요 ♥ 내 정보에서 모아 볼 수 있어요.');
  };
  paintLike(b);
  return b;
}
// 찜 개수 채우기: [data-likes="상품id"] 자리에 "♥ 3"
async function fillLikeCounts(ids) {
  if (!sb || !ids.length) return;
  const { data, error } = await sb.rpc('like_counts', { ids });
  if (error) return;
  const n = new Map((data || []).map(r => [Number(r.listing_id), Number(r.n)]));
  document.querySelectorAll('[data-likes]').forEach(s => { const v = n.get(+s.dataset.likes) || 0; s.textContent = v ? `♥ ${v}` : ''; });
}

// ---- 닉네임 (2026-10-30, update_7.sql) ------------------------------------------
// 2~12자 한글·영문·숫자·_ / 겹치면 안 됨(대소문자 무시) — DB 고유 색인이 최종으로 막고, 여기선 입력하는 동안 미리 알려 줌
// 가입하면 임시 닉네임 '브릭러+6자리' → 판매·채팅 전에 꼭 정하게, 다른 화면엔 위쪽 안내 띠
const NICK_RE = /^[가-힣A-Za-z0-9_]{2,12}$/;
const isDefaultNick = n => n === '브릭러' || /^브릭러[0-9a-f]{6,8}$/.test(n || '');
let myNick = '', needNick = false;
// 처음 열 때는 화면을 그리기 전에 기다림 (판매·채팅 화면이 먼저 그려져 닉네임 화면을 덮지 않게)
async function loadMyNick() {
  myNick = ''; needNick = false;
  if (sb && me) {
    const { data } = await sb.from('profiles').select('nickname').eq('id', me.id).maybeSingle();
    myNick = data?.nickname || '';
    needNick = isDefaultNick(myNick);
  }
  paintNickBanner();
}
const NICK_PAGES = ['sell', 'edit', 'chat'];
function paintNickBanner() {
  document.getElementById('nickBanner')?.remove();
  if (!me || !needNick || location.hash.startsWith('#/nickname')) return;
  document.querySelector('main').prepend(el('a', { id: 'nickBanner', class: 'nickbanner', href: '#/nickname' },
    el('span', {}, `👋 지금은 임시 닉네임(${myNick})이에요. 거래 상대가 알아볼 수 있게 나만의 닉네임을 정해 주세요`), el('b', {}, '정하기 →')));
}
function nickField(initial, onSaved) {
  const RULE = '2~12자 · 한글·영문·숫자·_ · 다른 사람과 겹치면 안 돼요';
  const inp = el('input', { id: 'nickInput', maxlength: 12, value: isDefaultNick(initial) ? '' : initial, placeholder: '예: 브릭왕, lego_kim', autocomplete: 'off', 'aria-describedby': 'nickMsg' });
  const msg = el('div', { id: 'nickMsg', class: 'small nickmsg', 'aria-live': 'polite' }, RULE);
  const btn = el('button', { type: 'submit', class: 'primary' }, '닉네임 저장');
  const say = (t, cls = '') => { msg.textContent = t; msg.className = 'small nickmsg ' + cls; };
  let timer, last = '';
  const check = async () => {
    const n = inp.value.trim(); last = n;
    if (!n) return say(RULE);
    if (!NICK_RE.test(n)) return say('✕ 2~12자, 한글(완성된 글자)·영문·숫자·_ 만 쓸 수 있어요. 띄어쓰기·특수문자는 안 돼요.', 'bad');
    if (n === initial) return say('지금 쓰는 닉네임이에요.', 'ok');
    const { data, error } = await sb.rpc('nickname_check', { n });
    if (n !== last) return;   // 그 사이 또 고쳤으면 무시
    if (error) return say(needUpdate(error), 'bad');
    say({ ok: '✓ 쓸 수 있는 닉네임이에요!', taken: '✕ 이미 다른 사람이 쓰고 있어요.', reserved: '✕ 운영자로 오해할 수 있는 이름은 쓸 수 없어요.', format: '✕ 2~12자, 한글·영문·숫자·_ 만 돼요.' }[data] || RULE, data === 'ok' ? 'ok' : 'bad');
  };
  inp.oninput = () => { clearTimeout(timer); timer = setTimeout(check, 300); };
  const form = el('form', { class: 'nickform' }, el('label', { class: 'f' }, '닉네임', inp), msg, el('div', { class: 'bar' }, btn));
  form.onsubmit = async e => {
    e.preventDefault();
    const n = inp.value.trim();
    if (!NICK_RE.test(n)) { await check(); inp.focus(); return; }
    if (n === initial) return say('지금 쓰는 닉네임이에요.', 'ok');
    btn.disabled = true;
    const { error } = await sb.from('profiles').update({ nickname: n }).eq('id', me.id);
    btn.disabled = false;
    if (error) return say(error.code === '23505' || /duplicate|unique/i.test(error.message) ? '✕ 방금 다른 사람이 이 닉네임을 가져갔어요. 다른 걸로 해 주세요.'
      : /nickname_format|check constraint/i.test(error.message) ? '✕ 쓸 수 없는 닉네임이에요. (2~12자, 한글·영문·숫자·_, 운영자로 오해할 이름 금지)' : needUpdate(error), 'bad');
    initial = n; myNick = n; needNick = false; paintNickBanner();
    say('✓ 저장했어요!', 'ok');
    toast(`이제 "${n}"(으)로 보여요.`);
    onSaved?.(n);
  };
  return { form, inp };
}
// 닉네임 정하기 화면 (처음 로그인 · 판매·채팅 전에). 정하면 원래 가려던 곳으로
function renderNickSetup(next = '#/') {
  if (!me) return needLogin();
  const { form, inp } = nickField(myNick, () => { if (location.hash === next) route(); else location.hash = next; });
  show(el('section', { class: 'panel login' }, el('h2', {}, '👋 닉네임을 정해 주세요'),
    el('p', {}, '채팅·후기·상품 화면에 이 이름으로 보여요. 다른 사람과 겹치지 않는 나만의 이름이에요. 나중에 내 정보에서 바꿀 수 있어요.'),
    myNick ? el('div', { class: 'small' }, `지금: ${myNick}${isDefaultNick(myNick) ? ' (임시)' : ''}`) : '', form,
    next !== '#/' ? el('a', { class: 'small', href: '#/' }, '나중에 할게요 (판매·채팅은 닉네임을 정해야 할 수 있어요)') : ''));
  inp.focus();
}

// ---- 🔔 알림 · ⭐ 키워드 즐겨찾기 (2026-10-30, update_6.sql) -----------------------
// 알림은 DB 트리거가 notifications 표에 넣음 (즐겨찾기 키워드 새 상품·찜한 상품 가격 인하·가격 제안·후기·신고 결과)
// → 여기선 읽고, 실시간으로 받아서 머리띠 🔔에 빨간 숫자
const NOTIF_ICON = { keyword: '⭐', price: '💸', offer: '💰', offer_reply: '💬', review: '📝', report: '🚩' };
let notifs = [], notifCh = null, saved = new Map();
async function loadNotifs() {
  notifs = [];
  if (sb && me) {
    const { data } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
    notifs = data || [];
  }
  paintBell();
}
function paintBell() {
  const b = document.getElementById('bellBtn');
  if (!b) return;
  b.hidden = !me;
  const n = notifs.filter(x => !x.read).length;
  b.querySelector('.badge')?.remove();
  if (n) b.append(el('span', { class: 'badge', 'aria-label': `안 읽은 알림 ${n}개` }, n > 9 ? '9+' : String(n)));
}
function watchNotifs() {
  if (notifCh) { sb.removeChannel(notifCh); notifCh = null; }
  if (!sb || !me) return;
  notifCh = sb.channel('notif-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.id}` }, ({ new: n }) => {
    notifs.unshift(n); paintBell();
    toast(`${n.title} — ${n.body}`);
    // 다른 탭·창을 보고 있으면 컴퓨터 알림으로도 (즐겨찾기할 때 허락한 경우만, 안 되는 브라우저는 그냥 넘어감)
    try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('리브릭 · ' + n.title, { body: n.body }); } catch (e) {}
    if (location.hash.startsWith('#/alerts')) route();
  }).subscribe();
}
async function loadSaved() {
  saved = new Map();
  if (sb && me) {
    const { data } = await sb.from('saved_searches').select('*').order('created_at', { ascending: false });
    (data || []).forEach(s => saved.set(s.keyword.toLowerCase(), s));
  }
  document.querySelectorAll('[data-star]').forEach(paintStar);
}
const normKw = k => String(k || '').trim().replace(/\s+/g, ' ').slice(0, 40);
function paintStar(b) {
  const on = saved.has(b.dataset.star.toLowerCase());
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  b.querySelector('.st').textContent = on ? '★' : '☆';
  b.querySelector('.t').textContent = on ? '즐겨찾기 중' : (b.dataset.label || '즐겨찾기');
}
// ⭐ 버튼 한 번 = 그 키워드 즐겨찾기 → 맞는 새 상품이 올라오면 🔔 (한 번 더 누르면 끔)
function starBtn(keyword, label = '') {
  const kw = normKw(keyword);
  const b = el('button', { type: 'button', class: 'star', 'data-star': kw, 'data-label': label, title: `'${kw}' 새 상품 알림 받기` },
    el('span', { class: 'st', 'aria-hidden': 'true' }), el('span', { class: 't' }));
  b.onclick = async e => {
    e.preventDefault(); e.stopPropagation();
    if (!me) { toast('로그인하면 즐겨찾기하고 새 상품 알림을 받을 수 있어요.'); location.hash = '#/login'; return; }
    const k = kw.toLowerCase(), cur = saved.get(k);
    if (cur) {
      const { error } = await sb.from('saved_searches').delete().eq('id', cur.id);
      if (error) return toast(needUpdate(error), true);
      saved.delete(k); toast(`'${kw}' 즐겨찾기를 껐어요.`);
    } else {
      const { data, error } = await sb.from('saved_searches').insert({ keyword: kw }).select().single();
      if (error) return toast(needUpdate(error), true);
      saved.set(k, data);
      toast(`⭐ '${kw}' 즐겨찾기! 새 상품이 올라오면 🔔로 알려 드려요. 가격·상태 조건은 알림 화면에서 정할 수 있어요.`);
      try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
    }
    document.querySelectorAll('[data-star]').forEach(paintStar);
  };
  paintStar(b);
  return b;
}
async function renderAlerts(tab = 'list') {
  if (!me) return needLogin();
  await Promise.all([loadNotifs(), loadSaved()]);
  const tabs = el('div', { class: 'seg seg2', role: 'group', 'aria-label': '알림 보기' }, [['list', `🔔 알림 ${notifs.length}`], ['star', `⭐ 즐겨찾기 ${saved.size}`]].map(([k, t]) =>
    el('a', { class: 'seg-b', href: k === 'list' ? '#/alerts' : '#/alerts/star', 'aria-pressed': String(tab === k) }, t)));
  let body;
  if (tab === 'star') {
    const add = el('input', { id: 'starAdd', placeholder: '예: 75192, 밀레니엄 팔콘, 해리포터', maxlength: 40, 'aria-label': '즐겨찾기할 키워드' });
    const addForm = el('form', { class: 'bar' }, add, el('button', { type: 'submit', class: 'primary' }, '⭐ 추가'));
    addForm.onsubmit = async e => {
      e.preventDefault();
      const kw = normKw(add.value);
      if (!kw) return;
      const { error } = await sb.from('saved_searches').insert({ keyword: kw });
      if (error) return toast(/duplicate|unique/i.test(error.message) ? '이미 즐겨찾기한 키워드예요.' : needUpdate(error), true);
      toast(`⭐ '${kw}' 즐겨찾기!`);
      route();
    };
    const rows = [...saved.values()].map(s => {
      const mx = el('input', { type: 'number', min: 0, step: 1000, placeholder: '최고 가격 (선택)', value: s.max_price ?? '', 'aria-label': `${s.keyword} 최고 가격` });
      const cd = el('select', { 'aria-label': `${s.keyword} 상태` }, el('option', { value: '' }, '모든 상태'), Object.entries(COND).map(([k, t]) => el('option', { value: k, selected: s.cond === k }, t)));
      mx.onchange = cd.onchange = async () => {
        const { error } = await sb.from('saved_searches').update({ max_price: mx.value === '' ? null : Number(mx.value), cond: cd.value || null }).eq('id', s.id);
        toast(error ? needUpdate(error) : '조건을 저장했어요.', !!error);
      };
      const del = el('button', { type: 'button', class: 'ghost' }, '끄기');
      del.onclick = async () => { await sb.from('saved_searches').delete().eq('id', s.id); route(); };
      const look = el('a', { class: 'small', href: '#/' }, '지금 매물 보기 →');
      look.onclick = e => { e.preventDefault(); filters.q = s.keyword; document.getElementById('q').value = s.keyword; if (location.hash === '#/') renderList(); else location.hash = '#/'; };
      return el('div', { class: 'srow' }, el('div', { class: 'srow-k' }, el('b', {}, '★ ' + s.keyword), look), el('div', { class: 'srow-c' }, mx, cd, del));
    });
    body = [addForm,
      el('div', { class: 'hint' }, '세트번호·이름·테마를 즐겨찾기하면, 조건에 맞는 새 상품이 올라올 때 🔔 알림이 와요. 최고 가격·상태를 정해 두면 그 조건에 맞는 것만 알려 드려요.'),
      rows.length ? el('div', { class: 'srows' }, rows) : el('div', { class: 'empty' }, '아직 즐겨찾기가 없어요. 검색 결과·세트 화면·테마 화면의 ☆ 버튼을 눌러 보세요.')];
  } else {
    const rows = notifs.map(n => el('a', { class: 'nrow' + (n.read ? '' : ' new'), href: n.link || '#/alerts' },
      el('span', { class: 'nic', 'aria-hidden': 'true' }, NOTIF_ICON[n.kind] || '🔔'),
      el('span', { class: 'ntxt' }, el('b', {}, n.title), el('span', { class: 'small' }, n.body)), el('span', { class: 'small when' }, ago(n.created_at))));
    const clear = el('button', { type: 'button', class: 'ghost' }, '모두 지우기');
    clear.onclick = async () => {
      if (clear.dataset.armed !== '1') { clear.dataset.armed = '1'; clear.textContent = '한 번 더 누르면 지워져요'; return; }
      await sb.from('notifications').delete().eq('user_id', me.id);
      route();
    };
    body = [rows.length ? el('div', { class: 'nrows' }, rows) : el('div', { class: 'empty' }, '아직 알림이 없어요. ⭐ 즐겨찾기를 해 두면 새 상품이 올라올 때 알려 드려요.'),
      rows.length ? el('div', { class: 'bar' }, el('span', { class: 'grow' }), clear) : ''];
    // 알림 화면을 열면 모두 읽음
    if (notifs.some(n => !n.read)) sb.from('notifications').update({ read: true }).eq('user_id', me.id).eq('read', false).then(() => { notifs.forEach(n => { n.read = true; }); paintBell(); });
  }
  show(el('section', { class: 'panel' }, el('h2', {}, '알림'), tabs, ...body));
}

// ---- 💰 가격 제안 (2026-10-30) --------------------------------------------------
// 구매자: 판매가보다 낮게 제안 → offers 표 + 채팅방에도 한 줄 / 판매자: 수락·거절(answer_offer) → 구매자에게 알림 + 채팅 한 줄
const OFFER_ST = { pending: '답 기다리는 중', accepted: '✅ 수락됨 — 채팅으로 거래하세요', declined: '거절됨' };
function offerBox(it) {
  const box = el('div', { class: 'offerbox' });
  const draw = async () => {
    let last = null;
    if (me) {
      const { data } = await sb.from('offers').select('*').eq('listing_id', it.id).eq('buyer_id', me.id).order('created_at', { ascending: false }).limit(1);
      last = data?.[0] || null;
    }
    const inp = el('input', { type: 'number', min: 1000, step: 1000, placeholder: `예: ${(Math.round(it.price * 0.9 / 1000) * 1000).toLocaleString('ko-KR')}`, 'aria-label': '제안할 가격' });
    const send = el('button', { type: 'submit', class: 'primary' }, '제안 보내기');
    const f = el('form', { class: 'bar offer-form', hidden: true }, inp, el('span', { class: 'small' }, '원'), send);
    const open = el('button', { type: 'button' }, '💰 가격 제안');
    open.onclick = () => { if (!me) { location.hash = '#/login'; return; } f.hidden = !f.hidden; if (!f.hidden) inp.focus(); };
    f.onsubmit = async e => {
      e.preventDefault();
      const p = Number(inp.value);
      if (!p) return toast('제안할 가격을 넣어 주세요.', true);
      if (p >= it.price) return toast(`판매 가격(${won(it.price)})보다 낮게 제안해 주세요.`, true);
      send.disabled = true;
      const { error } = await sb.from('offers').insert({ listing_id: it.id, price: p });
      if (!error) await sb.from('messages').insert({ listing_id: it.id, buyer_id: me.id, body: `💰 가격 제안: ${won(p)} (판매가 ${won(it.price)})` });
      send.disabled = false;
      if (error) return toast(needUpdate(error), true);
      toast('가격 제안을 보냈어요. 판매자가 답하면 🔔 알림이 와요.');
      draw();
    };
    box.replaceChildren(el('div', { class: 'bar' }, open,
      last ? el('span', { class: 'small offer-st ' + last.status }, `내 제안 ${won(last.price)} · ${OFFER_ST[last.status]}`) : el('span', { class: 'small' }, '원하는 가격을 판매자에게 제안해 보세요')), f);
  };
  draw();
  return box;
}
async function offersFor(it) {
  const box = el('div', { class: 'offers' });
  const { data, error } = await sb.from('offers').select('*').eq('listing_id', it.id).order('created_at', { ascending: false }).limit(20);
  if (error || !data?.length) return box;
  const { data: ps } = await sb.from('profiles').select('id, nickname').in('id', [...new Set(data.map(o => o.buyer_id))]);
  const nick = new Map((ps || []).map(p => [p.id, p.nickname]));
  box.append(el('b', {}, `💰 받은 가격 제안 ${data.length}개`), ...data.map(o => {
    const row = el('div', { class: 'orow' }, el('span', {}, el('b', {}, won(o.price)), el('span', { class: 'small' }, ` · ${nick.get(o.buyer_id) || '구매자'} · ${ago(o.created_at)}`)), el('span', { class: 'grow' }));
    if (o.status === 'pending') {
      const ans = async accept => {
        const { error } = await sb.rpc('answer_offer', { o: o.id, accept });
        if (error) return toast(errMsg(error), true);
        await sb.from('messages').insert({ listing_id: it.id, buyer_id: o.buyer_id, body: accept ? `✅ ${won(o.price)} 제안을 수락했어요. 거래 방법을 정해요!` : `${won(o.price)} 제안은 어려워요. 미안해요 🙏` });
        toast(accept ? '수락했어요. 채팅방에도 알려 드렸어요.' : '거절했어요.');
        box.replaceWith(await offersFor(it));
      };
      row.append(el('button', { type: 'button', class: 'primary', onclick: () => ans(true) }, '수락'), el('button', { type: 'button', class: 'ghost', onclick: () => ans(false) }, '거절'),
        el('a', { class: 'btn', href: `#/chat/${it.id}/${o.buyer_id}` }, '채팅'));
    } else row.append(el('span', { class: 'small offer-st ' + o.status }, o.status === 'accepted' ? '✅ 수락함' : '거절함'));
    return row;
  }));
  return box;
}

// ---- 📝 거래 후기 · 신뢰 점수 (2026-10-30) ------------------------------------------
// 판매완료된 상품에서, 그 상품으로 채팅한 두 사람끼리만 (채팅방 안에서 남김). 후기는 누구나 볼 수 있음
const RATING = { 2: ['😍', '최고예요'], 1: ['🙂', '좋아요'], '-1': ['😕', '별로예요'] };
const REVIEW_TAGS = ['약속을 잘 지켜요', '설명과 같아요', '응답이 빨라요', '친절해요', '포장이 꼼꼼해요', '구성품이 다 있어요'];
async function reviewSummary(uid) {
  const { data } = await sb.from('reviews').select('rating, tags').eq('target_id', uid);
  const r = data || [], good = r.filter(x => x.rating > 0).length, tags = {};
  r.forEach(x => (x.tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; }));
  return { n: r.length, good, best: r.filter(x => x.rating === 2).length, pct: r.length ? Math.round(good / r.length * 100) : null, tags: Object.entries(tags).sort((a, b) => b[1] - a[1]) };
}
const trustText = s => s.n ? `후기 ${s.n}개 · 👍 ${s.pct}%` : '아직 후기 없음';
async function reviewBox(l, targetId, targetNick) {
  const wrap = el('div', { class: 'reviewbox' });
  const { data: done } = await sb.from('reviews').select('rating').eq('listing_id', l.id).eq('reviewer_id', me.id).maybeSingle();
  if (done) { wrap.append(el('div', { class: 'small' }, `✔ ${targetNick}님에게 후기를 남겼어요 (${RATING[done.rating][1]}). 고마워요!`)); return wrap; }
  let rating = 0;
  const picked = new Set();
  const rBtns = [2, 1, -1].map(k => el('button', { type: 'button', class: 'rbtn', 'aria-pressed': 'false', onclick: ev => {
    rating = k; rBtns.forEach(b => b.setAttribute('aria-pressed', String(b === ev.currentTarget))); } }, el('span', { 'aria-hidden': 'true' }, RATING[k][0]), RATING[k][1]));
  const tBtns = REVIEW_TAGS.map(t => el('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: ev => {
    picked.has(t) ? picked.delete(t) : picked.add(t); ev.currentTarget.setAttribute('aria-pressed', String(picked.has(t))); } }, t));
  const body = el('textarea', { rows: 2, maxlength: 300, placeholder: '한 줄 후기 (선택)', 'aria-label': '한 줄 후기' });
  const send = el('button', { type: 'button', class: 'primary' }, '후기 남기기');
  send.onclick = async () => {
    if (!rating) return toast('최고예요·좋아요·별로예요 중 하나를 골라 주세요.', true);
    send.disabled = true;
    const { error } = await sb.from('reviews').insert({ listing_id: l.id, target_id: targetId, rating, tags: [...picked], body: body.value.trim() });
    send.disabled = false;
    if (error) return toast(/row-level|policy/i.test(error.message) ? '판매완료된 상품에서, 채팅한 상대에게만 후기를 남길 수 있어요.' : needUpdate(error), true);
    toast('후기를 남겼어요. 고마워요!');
    wrap.replaceWith(await reviewBox(l, targetId, targetNick));
  };
  wrap.append(el('b', {}, `📝 ${targetNick}님과의 거래는 어땠나요?`), el('div', { class: 'rbtns' }, rBtns), el('div', { class: 'filters' }, tBtns), body,
    el('div', { class: 'bar' }, el('span', { class: 'small' }, '후기는 상대 프로필에 모두에게 보여요.'), el('span', { class: 'grow' }), send));
  return wrap;
}
// 프로필 공통: 닉네임 첫 글자 동그라미 (닉네임마다 색이 조금씩 다름) · 신뢰 막대 (👍 비율을 브릭 5칸으로)
const nickHue = n => [...String(n || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const avatarEl = (nick, size = '') => el('div', { class: 'avatar ' + size, style: `--h:${nickHue(nick)}`, 'aria-hidden': 'true' }, String(nick || '?').slice(0, 1));
// ---- 매너 등급 SS~F (2026-10-30, 당근 '온도' 대신 등급) --------------------------------
// (2026-10-30 2차, 사용자 "너무 쉽게 올라가지 않게") 모두 50점(B)에서 시작
// 거래 후기 😍최고예요 +2 / 🙂좋아요 +1 / 😕별로예요 −5 · 판매완료 1건 +0.5 (최대 +5) · 0~100점
// 높은 등급은 점수 + 후기 수 + 👍 비율까지 채워야 함 → 최고예요만 받아도 A까지 후기 10개, S 15개, SS는 20개 + 후기 30개·👍 95%
// [등급, 최소 점수, 설명, 최소 후기 수, 최소 👍%]
const GRADES = [['SS', 90, '최고의 매너', 30, 95], ['S', 80, '아주 믿을 만해요', 15, 90], ['A', 70, '믿을 만해요', 5, 80], ['B', 50, '보통', 0, 0],
  ['C', 40, '조금 주의', 0, 0], ['D', 25, '주의가 필요해요', 0, 0], ['F', 0, '거래 주의', 0, 0]];
function brickGrade(s, soldN = 0) {
  const raw = 50 + s.best * 2 + (s.good - s.best) - (s.n - s.good) * 5 + Math.min(5, soldN * 0.5);
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const pct = s.n ? s.good / s.n * 100 : 0;
  const ok = ([, min, , minN, minPct]) => score >= min && s.n >= minN && (!minPct || pct >= minPct);
  const i = GRADES.findIndex(ok);
  const [g, min, label] = GRADES[i], up = GRADES[i - 1];
  // 다음 등급까지 모자란 것: 점수 · 후기 수 · 👍 비율
  const lack = up ? [score < up[1] ? `${up[1] - score}점` : '', s.n < up[3] ? `후기 ${up[3] - s.n}개 더` : '', up[4] && pct < up[4] ? `👍 ${up[4]}% 이상` : ''].filter(Boolean) : [];
  return { score, g, label, min, next: up?.[0], nextMin: up?.[1], lack };
}
const gradeChip = gr => el('span', { class: 'gchip g-' + gr.g, title: `매너 등급 ${gr.g} · ${gr.label} (${gr.score}점)` }, gr.g);
// 프로필용 큰 등급 카드: 등급 배지 · 다음 등급까지 막대 · 계산 방법
function gradeCard(s, soldN) {
  const gr = brickGrade(s, soldN);
  const pct = gr.next ? Math.round(Math.min(1, Math.max(0, (gr.score - gr.min) / (gr.nextMin - gr.min))) * 100) : 100;
  return el('div', { class: 'gcard' },
    el('div', { class: 'gbadge g-' + gr.g, role: 'img', 'aria-label': `매너 등급 ${gr.g}` }, el('b', {}, gr.g), el('small', {}, '등급')),
    el('div', { class: 'ginfo' },
      el('div', {}, el('b', {}, `매너 등급 ${gr.g}`), el('span', { class: 'small' }, ` · ${gr.label} · ${gr.score}점`)),
      el('div', { class: 'gbar', role: 'img', 'aria-label': gr.next ? `${gr.next}등급까지 ${gr.lack.join(', ')}` : '최고 등급' }, el('i', { class: 'g-' + gr.g, style: `width:${Math.max(4, pct)}%` })),
      el('div', { class: 'small' }, gr.next ? `${gr.next}등급까지 ${gr.lack.join(' · ')}` : '최고 등급이에요 🏆', s.n ? ` · 받은 후기 ${s.n}개 · 👍 ${s.pct}%` : ' · 아직 받은 후기가 없어요'),
      el('details', { class: 'ghelp' }, el('summary', {}, '등급은 어떻게 정해지나요?'),
        el('p', { class: 'small' }, '모두 50점(B등급)에서 시작해요. 거래가 끝난 뒤 받은 후기에 따라 😍최고예요 +2점, 🙂좋아요 +1점, 😕별로예요 −5점, 판매완료 1건마다 +0.5점(최대 +5점)이 더해져요. 높은 등급은 점수뿐 아니라 받은 후기 수와 👍 비율도 채워야 해서, 오래 꾸준히 좋은 거래를 한 사람만 올라갈 수 있어요.'),
        el('div', { class: 'gscale' }, GRADES.map(([g, min, l, n, p]) => el('span', {}, el('span', { class: 'gchip g-' + g }, g),
          ` ${min ? min + '점↑' : '25점 미만'}${n ? ` · 후기 ${n}개↑` : ''}${p ? ` · 👍 ${p}%↑` : ''} — ${l}`))))));
}
// 상점 화면 (번개장터 '내 상점'처럼): 색 띠 + 큰 동그라미 → 통계 줄 → 신뢰도·후기 태그 → [판매 상품 | 거래 후기] 탭
async function renderUser(uid, tab = 'items') {
  const [{ data: p }, s, { data: items }, { data: revs }] = await Promise.all([
    sb.from('profiles').select('nickname, region, created_at').eq('id', uid).maybeSingle(),
    reviewSummary(uid),
    sb.from('listings').select('*').eq('seller_id', uid).order('created_at', { ascending: false }).limit(60),
    sb.from('reviews').select('*').eq('target_id', uid).order('created_at', { ascending: false }).limit(30)]);
  if (!p) return show(el('section', { class: 'panel' }, el('h2', {}, '없는 사용자예요')));
  const { data: rp } = revs?.length ? await sb.from('profiles').select('id, nickname').in('id', [...new Set(revs.map(r => r.reviewer_id))]) : { data: [] };
  const rnick = new Map((rp || []).map(x => [x.id, x.nickname]));
  const all = items || [], selling = all.filter(x => x.status !== 'sold'), sold = all.filter(x => x.status === 'sold');
  const mine = me && me.id === uid;
  const body = el('div', {});
  const tabs = el('div', { class: 'seg seg3', role: 'tablist' });
  const draw = t => {
    tab = t;
    tabs.replaceChildren(...[['items', `판매 중 ${selling.length}`], ['sold', `판매완료 ${sold.length}`], ['reviews', `거래 후기 ${s.n}`]].map(([k, label]) =>
      el('button', { type: 'button', class: 'seg-b', role: 'tab', 'aria-selected': String(t === k), 'aria-pressed': String(t === k), onclick: () => draw(k) }, label)));
    const list = t === 'items' ? selling : sold;
    body.replaceChildren(t === 'reviews'
      ? (revs?.length ? el('div', { class: 'rvlist' }, revs.map(r => el('div', { class: 'rv' },
          el('div', { class: 'rv-head' }, avatarEl(rnick.get(r.reviewer_id), 'sm'), el('b', {}, rnick.get(r.reviewer_id) || '거래 상대'), el('span', { class: 'small' }, ago(r.created_at)),
            el('span', { class: 'rv-rate r' + r.rating }, `${RATING[r.rating][0]} ${RATING[r.rating][1]}`)),
          r.tags?.length ? el('div', { class: 'rv-tags' }, r.tags.map(x => el('span', {}, x))) : '', r.body ? el('div', { class: 'rv-body' }, r.body) : '')))
        : el('div', { class: 'empty' }, '아직 받은 거래 후기가 없어요.'))
      : (list.length ? el('div', { class: 'grid' }, list.map(listingCard)) : el('div', { class: 'empty' }, t === 'items' ? '지금 판매 중인 상품이 없어요.' : '아직 판매완료된 상품이 없어요.')));
    if (t !== 'reviews') fillLikeCounts(list.map(it => it.id));
  };
  const stat = (n, label, t) => el('button', { type: 'button', class: 'stat-b', onclick: () => t && draw(t) }, el('b', {}, n), el('span', {}, label));
  show(el('section', { class: 'panel shop' },
      el('div', { class: 'shop-cover', style: `--h:${nickHue(p.nickname)}` }),
      el('div', { class: 'shop-head' }, avatarEl(p.nickname, 'xl'),
        el('div', { class: 'shop-name' }, el('h2', {}, p.nickname, gradeChip(brickGrade(s, sold.length)), daysSince(p.created_at) < 7 ? el('span', { class: 'newbie' }, '새 판매자') : ''),
          el('div', { class: 'small' }, [p.region || '지역 미정', `가입 ${daysSince(p.created_at) + 1}일째`].join(' · '))),
        mine ? el('a', { class: 'btn', href: '#/me/settings' }, '⚙️ 프로필 수정')
          : el('button', { type: 'button', onclick: () => shareLink(`${p.nickname}님의 상점 | 리브릭`, `${location.origin}${location.pathname}#/user/${uid}`) }, icon('share'), '공유')),
      el('div', { class: 'stats4' }, stat(selling.length, '판매 중', 'items'), stat(sold.length, '판매완료', 'sold'), stat(s.n, '거래 후기', 'reviews'), stat(s.pct == null ? '-' : `${s.pct}%`, '👍 좋았어요', 'reviews')),
      gradeCard(s, sold.length),
      s.tags.length ? el('div', { class: 'rv-tags big' }, s.tags.slice(0, 6).map(([t, n]) => el('span', {}, `${t} `, el('b', {}, n)))) : ''),
    el('section', { class: 'panel' }, tabs, body));
  draw(tab);
}

// ---- 📈 실거래가 그래프 (2026-10-30) -------------------------------------------------
// 판매완료 때 적은 가격을 달마다 평균 (한 건씩은 안 보여 줌 — 판매완료 화면 약속대로 평균만), 선 하나 = 한 축
async function soldChart(no) {
  const since = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data } = await sb.from('listings').select('sold_price, sold_at').eq('set_no', no).eq('status', 'sold').not('sold_price', 'is', null).gte('sold_at', since).order('sold_at');
  const byM = new Map();
  (data || []).forEach(r => { const k = r.sold_at.slice(0, 7); const m = byM.get(k) || { s: 0, n: 0 }; m.s += r.sold_price; m.n++; byM.set(k, m); });
  const pts = [...byM].map(([k, m]) => ({ k, v: Math.round(m.s / m.n), n: m.n }));
  if (!pts.length) return '';
  const W = 400, H = 190, L = 48, R = 14, T = 20, B = 26;   // 휴대폰 폭에서도 글자가 작아지지 않게 작게 그림
  const mi = k => { const [y, m] = k.split('-').map(Number); return y * 12 + m; };
  const x0 = mi(pts[0].k), x1 = Math.max(mi(pts[pts.length - 1].k), x0 + 1);
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  const pad = Math.max((hi - lo) * 0.15, hi * 0.05); lo = Math.max(0, lo - pad); hi += pad;
  const X = k => L + (mi(k) - x0) / (x1 - x0) * (W - L - R), Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const short = v => v >= 10000 ? `${Math.round(v / 1000) / 10}만` : v.toLocaleString('ko-KR');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'schart'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `리브릭 실거래 월 평균: ` + pts.map(p => `${p.k} ${won(p.v)}`).join(', '));
  const ticks = [0, 1, 2, 3].map(i => lo + (hi - lo) * i / 3);
  let s = ticks.map(t => `<line class="g" x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${L - 8}" y="${Y(t) + 4}" text-anchor="end">${short(Math.round(t))}</text>`).join('');
  const lbl = k => `${k.slice(2, 4)}.${+k.slice(5)}`;
  s += [pts[0], pts[pts.length - 1]].filter((p, i, a) => i === 0 || p !== a[0]).map(p => `<text class="ax" x="${X(p.k)}" y="${H - 8}" text-anchor="middle">${lbl(p.k)}</text>`).join('');
  if (pts.length > 1) s += `<path class="ln" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.k)},${Y(p.v)}`).join('')}"/>`;
  s += pts.map(p => `<circle class="pt" cx="${X(p.k)}" cy="${Y(p.v)}" r="4"/>`).join('');
  const last = pts[pts.length - 1];
  s += `<text class="dl" x="${Math.min(X(last.k), W - R - 4)}" y="${Y(last.v) - 12}" text-anchor="${X(last.k) > W - 60 ? 'end' : 'middle'}">${short(last.v)}</text>`;
  svg.innerHTML = s;
  // 마우스·손가락을 점 가까이 대면 말풍선 (점보다 큰 투명 원)
  const tip = el('div', { class: 'ctip', hidden: true });
  pts.forEach(p => {
    const hit = document.createElementNS(NS, 'circle');
    hit.setAttribute('cx', X(p.k)); hit.setAttribute('cy', Y(p.v)); hit.setAttribute('r', 16); hit.setAttribute('class', 'hit');
    const on = () => { tip.textContent = `${p.k.slice(0, 4)}년 ${+p.k.slice(5)}월 · 평균 ${won(p.v)} · ${p.n}건`; tip.hidden = false;
      const fx = X(p.k) / W;   // 양 끝 점은 말풍선이 화면 밖으로 안 나가게 안쪽으로 붙임
      tip.style.left = `${fx * 100}%`; tip.style.top = `${Y(p.v) / H * 100}%`;
      tip.style.transform = `translate(${fx < 0.3 ? '-12px' : fx > 0.7 ? 'calc(-100% + 12px)' : '-50%'}, calc(-100% - 12px))`; };
    hit.addEventListener('pointerenter', on); hit.addEventListener('pointerdown', on); hit.addEventListener('pointerleave', () => { tip.hidden = true; });
    svg.append(hit);
  });
  return el('figure', { class: 'chartbox' }, el('figcaption', { class: 'small' }, `월 평균 거래가 · ${pts.reduce((a, p) => a + p.n, 0)}건 · 점에 대면 자세히`), el('div', { class: 'chartwrap' }, svg, tip));
}
function markTabbar() {
  const h = location.hash || '#/', page = h.replace(/^#\/?/, '').split('/')[0];
  // 탭과 같은 묶음의 화면이면 그 탭을 표시 (세트 시세 화면은 '시세', 채팅방은 '채팅')
  const which = { '': '#/', item: '#/', prices: '#/prices', set: '#/prices', compare: '#/prices', themes: '#/themes', theme: '#/themes',
    chats: '#/chats', chat: '#/chats', me: '#/me', login: '#/me', collection: '#/me' }[page];
  document.querySelectorAll('#tabbar a').forEach(a => {
    const on = which && (a.getAttribute('href') === which || (which === '#/me' && a.getAttribute('href') === '#/login'));
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  // 채팅방 안에서는 입력칸을 가리지 않게 탭 바를 숨김 (당근·번개도 같음)
  document.body.classList.toggle('no-tabbar', page === 'chat');
  // 판매 버튼은 글 쓰는 중·채팅·상품 화면(사기·채팅 버튼이 아래에 있음)에선 숨김
  document.body.classList.toggle('no-fab', ['sell', 'edit', 'chat', 'item', 'login', 'report', 'nickname'].includes(page));
}
// 오른쪽 아래 "＋ 판매하기": 아래로 내리면 동그라미로 작아지고, 올리면 다시 글자 (당근 '글쓰기' 버튼처럼)
(() => {
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const fab = document.getElementById('sellFab'), y = scrollY;
    if (fab && Math.abs(y - lastY) > 6) { fab.classList.toggle('mini', y > lastY && y > 80); lastY = y; }
  }, { passive: true });
})();
// 화이트 / 다크 모드: 기본 화이트, 고른 것은 이 브라우저에 기억
function setTheme(dark, save = true) {
  if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', dark ? 'dark' : 'only light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e1116' : '#ffffff');
  const b = document.getElementById('themeBtn'), d = document.getElementById('drawerTheme');
  b.textContent = dark ? '☀️' : '🌙';
  b.setAttribute('aria-label', dark ? '화이트 모드로 바꾸기' : '다크 모드로 바꾸기');
  d.textContent = dark ? '☀️ 화이트 모드' : '🌙 다크 모드';
  if (save) try { dark ? localStorage.setItem('theme', 'dark') : localStorage.removeItem('theme'); } catch (e) {}
}
const isDark = () => document.documentElement.dataset.theme === 'dark';
setTheme(isDark(), false);
document.getElementById('themeBtn').onclick = () => setTheme(!isDark());
document.getElementById('drawerTheme').onclick = e => { e.stopPropagation(); setTheme(!isDark()); };
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
function goHome() {
  Object.assign(filters, { q: '', theme: '', cond: '', trade: '', kit: '', sort: 'new', showSold: false });
  document.getElementById('q').value = '';
  if (location.hash === '#/' || !location.hash) { window.scrollTo(0, 0); renderList(); }
}
document.querySelectorAll('.logo, #menu a[href="#/"], #drawer a[href="#/"]').forEach(a => a.addEventListener('click', goHome));
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
// 휴대폰은 검색칸이 좁아서 안내 글을 짧게
if (matchMedia('(max-width: 720px)').matches) document.getElementById('q').placeholder = '번호·이름 검색';
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
  markTabbar();
  paintNickBanner();
  try {
    // 처음 닉네임 정하기(임시 닉네임일 때)만 바로, 이미 정한 사람이 바꾸는 건 계정 설정(비밀번호 확인)에서
    if (page === 'nickname') return me && !needNick ? (location.hash = '#/me/settings') : renderNickSetup(a ? decodeURIComponent(a) : '#/');
    // 임시 닉네임이면 판매·채팅 전에 먼저 닉네임부터
    if (me && needNick && NICK_PAGES.includes(page)) return renderNickSetup(location.hash);
    if (page === 'item' && a) return await renderItem(+a);
    if (page === 'sell') return await renderForm(null, a ? decodeURIComponent(a) : '');
    if (page === 'edit' && a) return await renderForm(+a);
    if (page === 'login') return renderLogin();
    if (page === 'me') return a === 'settings' ? await renderSettings() : await renderMe();
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
    if (page === 'alerts') return await renderAlerts(a === 'star' ? 'star' : 'list');
    if (page === 'user' && a) return await renderUser(a);
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
  // 구성품으로 거르기 (상태 카드 칸)
  const kit = el('select', { id: 'fKitSel', 'aria-label': '구성품' }, [['', '모든 구성품'], ['figs', '미니피규어 전부 있음'], ['boxman', '박스·설명서 있음'], ['nomiss', '누락 부품 없음']]
    .map(([v, t]) => el('option', { value: v, selected: filters.kit === v }, t)));
  kit.onchange = () => { filters.kit = kit.value; renderList(); };
  const sold = el('input', { type: 'checkbox', id: 'fSold', checked: filters.showSold, style: 'width:auto' });
  sold.onchange = () => { filters.showSold = sold.checked; renderList(); };
  const summary = el('span', { class: 'summary' }, '불러오는 중…');
  // 검색 결과는 휴대폰에서 3열로 촘촘하게 (번개장터처럼 한 화면에 많이)
  const grid = el('div', { class: filters.q.trim() ? 'grid g3' : 'grid', 'aria-label': '상품 목록', 'aria-busy': 'true' },
    Array.from({ length: 5 }, () => el('div', { class: 'card skel', 'aria-hidden': 'true' }, el('div', { class: 'thumb' }),
      el('div', { class: 'body' }, el('i', {}), el('i', {}), el('i', { class: 'short' })))));
  const home = isHome();
  const q0 = filters.q.trim();
  // 리브릭의 주인공은 중고거래 → 첫 화면은 얇은 배너 바로 아래 매물, 바로가기·소식·시세는 그 아래
  show(home ? renderHero('banner') : '',
    home ? themeRail() : '',
    el('section', { class: 'section' },
      el('div', { class: 'sec-head' }, el('h2', {}, q0 ? `'${q0}' 검색 결과` : home ? '방금 올라온 세트' : '상품'), summary,
        // 검색어가 있으면 ⭐ 한 번으로 그 검색어 새 상품 알림
        q0 ? starBtn(q0) : el('a', { class: 'more', href: '#/sell' }, '+ 내 세트 팔기')),
      chips,
      el('div', { class: 'filters scroll' }, cond, kit, trade, sort, el('label', { class: 'small', style: 'display:inline-flex;gap:6px;align-items:center;flex:none' }, sold, '판매완료도 보기')),
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
    home ? renderPriceGuide() : '');

  let qy = sb.from('listings').select('*').limit(120);
  if (!filters.showSold) qy = qy.neq('status', 'sold');
  if (filters.theme) qy = qy.eq('theme', filters.theme);
  if (filters.cond) qy = qy.eq('cond', filters.cond);
  if (filters.trade) qy = qy.eq(`trade_${filters.trade}`, true);
  if (filters.kit === 'figs') qy = qy.eq('all_figs', true);
  if (filters.kit === 'boxman') qy = qy.eq('has_box', true).eq('has_manual', true);
  if (filters.kit === 'nomiss') qy = qy.in('cond', ['sealed', 'complete']);
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
    const any = q || filters.theme || filters.cond || filters.trade || filters.kit;
    grid.append(el('div', { class: 'empty', style: 'grid-column:1/-1' },
      (() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'big'); s.innerHTML = '<use href="#mark"/>'; return s; })(),
      el('b', {}, any ? '조건에 맞는 상품이 없어요' : '첫 번째 판매자가 되어 주세요'),
      any ? '다른 이름이나 세트번호로 찾아보세요.' : '세트번호만 넣으면 이름·피스 수·공식몰 정가가 자동으로 채워져요.',
      el('a', { class: 'btn primary', href: '#/sell' }, icon('plus'), '내 세트 팔기')));
    return;
  }
  grid.append(...list.map(listingCard));
  fillLikeCounts(list.map(it => it.id));
}
// 상품 카드: 정사각 사진 → 이름 → 가격 → 정가 대비 → 상태·거래 방식 → 세트번호·지역
function listingCard(it) {
  const p = ppp(it), v = vsMsrp(it);
  return el('a', { class: 'card' + (it.status === 'sold' ? ' sold' : ''), href: `#/item/${it.id}` },
    el('div', { class: 'thumb' }, thumb(it), it.status !== 'selling' ? el('span', { class: 'flag' }, STATUS[it.status]) : '', likeBtn(it)),
    el('div', { class: 'body' },
      el('div', { class: 'name' }, it.name),
      el('div', { class: 'price' }, won(it.price)),
      v ? el('div', { class: v.cls }, v.text) : '',
      el('div', { class: 'tags' }, el('span', { class: `cond ${it.cond}` }, COND[it.cond]), kitChips(it), tradeBadges(it)),
      el('div', { class: 'meta' }, [it.set_no ? `#${it.set_no}` : '', it.region || '지역 미정', p ? `피스당 ${p.toLocaleString('ko-KR')}원` : ''].filter(Boolean).join(' · '),
        el('span', { class: 'likes', 'data-likes': it.id }))));
}
// 공식몰 세트 카드 (상품이 아직 없을 때도 첫 화면이 비어 보이지 않게)
function setCard([no, c], flagText) {
  return el('a', { class: 'card', href: `#/set/${no}` },
    el('div', { class: 'thumb' }, thumb({ set_no: no, theme: c.theme, name: c.name }), flagText ? fancyFlag(flagText) : ''),
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
// 자동 넘김은 '동작 줄이기' 설정이어도 계속함 (사용자 요청 2026-10-29) — 대신 그때는 미끄러지는 효과 없이 바로 넘김
function autoSlide(rail, ms = 3500) {
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
  if (items.length <= show) return box;
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
// part = 'banner' (맨 위 슬라이드, 매물 위) / 'extras' (바로가기·안내 띠, 매물 아래)
// (2026-10-30 개편, 사용자 "배너가 초라해 보임") 쇼핑몰식 큰 배너: 색 그라데이션 + 점무늬 질감 + 공식몰 제품 사진(배경 없는 PNG)을 크게,
// 아래 왼쪽에 '01 / 05' 번호 + 5초 진행 막대(막대가 다 차면 다음 장, 마우스·손가락 올리면 멈춤)
// 슬라이드: 리브릭 소개(인기 세트 3개 콜라주) → 곧 단종 → 신제품 → 코믹콘 D-day → 공식몰 프로모션
function heroSlide({ tone, href, eyebrow, title, desc, cta, art }) {
  return el(href ? 'a' : 'div', { class: `hs ${tone}`, ...(href ? { href } : {}) },
    el('div', { class: 'hs-txt' }, el('span', { class: 'hs-eyebrow' }, eyebrow), el('h2', {}, title), desc ? el('p', {}, desc) : '', cta ? el('div', { class: 'hs-cta' }, cta) : ''),
    el('div', { class: 'hs-art', 'aria-hidden': 'true' }, art || ''));
}
// 제품 사진 (안 뜨면 그 자리만 비움)
const hsImg = (no, cls = 'hs-img') => { const im = pic(no, { class: cls, loading: null }, () => im.remove()); return im; };
function heroCarousel() {
  const store = Object.entries(CATALOG).filter(([no, c]) => c.store && LEGO_IMG[no]);
  const top = (flag, n) => store.filter(([, c]) => !flag || c.store.flags.includes(flag)).sort((a, b) => b[1].msrp - a[1].msrp).slice(0, n);
  const slides = [];
  // 1) 리브릭 소개: 공식몰 최고가 세트 3개를 겹쳐서
  const trio = top('', 3);
  const brand = heroSlide({ tone: 'navy', eyebrow: '레고 중고거래 · 시세 비교', title: ['레고만큼은,', el('br'), el('em', {}, '리브릭')],
    desc: '세트번호 하나로 정가·중고 시세·브릭링크 가격까지. 비싸게 사지도, 싸게 팔지도 마세요.',
    cta: [el('a', { class: 'btn primary', href: '#/sell' }, '내 세트 팔기'), el('a', { class: 'btn glass', href: '#/prices' }, '시세 찾아보기')],
    art: trio.length === 3 ? el('div', { class: 'hs-collage' }, trio.map(([no], k) => hsImg(no, 'c' + (k + 1)))) : '' });
  if (trio.length < 3) brand.querySelector('.hs-art').insertAdjacentHTML('beforeend', BANNER_ART);
  slides.push(brand);
  // 2) 곧 단종 (가장 비싼 세트)
  const [retire] = top('retiringSoon', 1);
  if (retire) {
    const [no, c] = retire;
    slides.push(heroSlide({ tone: 'amber', href: `#/set/${no}`, eyebrow: '⏳ 단종 임박', title: c.name,
      desc: `단종되면 중고 시세가 오르는 경우가 많아요. 지금 공식몰 가격과 중고 시세를 비교해 보세요.`,
      cta: el('span', { class: 'btn primary' }, '시세 보기 →'),
      art: [hsImg(no), el('span', { class: 'hs-chip' }, el('small', {}, `#${no} 공식몰`), won(c.msrp))] }));
  }
  // 3) 신제품 (가장 비싼 새 세트)
  const [fresh] = top('new', 1);
  if (fresh) {
    const [no, c] = fresh;
    slides.push(heroSlide({ tone: 'violet', href: `#/set/${no}`, eyebrow: 'NEW · 이달의 신제품', title: c.name,
      desc: `${c.theme} · ${c.pieces ? c.pieces.toLocaleString('ko-KR') + '피스 · ' : ''}공식몰 새로 나온 세트예요.`,
      cta: el('span', { class: 'btn primary' }, '자세히 보기 →'),
      art: [hsImg(no), el('span', { class: 'hs-chip' }, el('small', {}, `#${no} 공식몰`), won(c.store.price || c.msrp))] }));
  }
  // 4) 코믹콘 D-day: 한정판 미니피규어 두 장
  if (SDCC) slides.push(heroSlide({ tone: 'night', href: '#/limited', eyebrow: '한정판의 성지, 코믹콘', title: [`${SDCC.name}까지 `, el('em', {}, `D-${daysUntil(SDCC.from)}`)],
    desc: `역대 코믹콘 한정판 ${LIMITED.length}개의 지금 시세를 확인해 보세요.`, cta: el('span', { class: 'btn primary' }, '한정판 시세 보기 →'),
    art: el('div', { class: 'hs-figs' }, ['comcon029', 'comcon014'].map((no, k) => el('span', { class: 'hs-fig' }, hsImg(no, ''), el('small', {}, k ? "SDCC '11" : "SDCC '13")))) }));
  // 5) 공식몰 프로모션 (사은품 사진)
  const p = PROMOS.find(x => promoState(x) === 'now' && x.gift) || PROMOS.find(x => promoState(x) === 'soon');
  if (p) slides.push(heroSlide({ tone: 'emerald', href: '#/promos', eyebrow: '🎁 공식몰 프로모션 ' + (promoState(p) === 'now' ? '진행 중' : '예정'), title: p.name,
    desc: p.note || '레고 공식몰 사은품·할인 소식이에요.', cta: el('span', { class: 'btn primary' }, '프로모션 보기 →'), art: p.gift ? hsImg(p.gift) : '' }));

  const N = slides.length, pad = n => String(n).padStart(2, '0');
  const track = el('div', { class: 'hc-track' }, slides.map((s, k) => el('div', { class: 'hc-slide', role: 'group', 'aria-roledescription': '슬라이드', 'aria-label': `${k + 1} / ${N}` }, s)));
  const count = el('span', { class: 'hc-count' });
  const prog = el('div', { class: 'hc-prog' }, slides.map((_, k) => el('button', { type: 'button', 'aria-label': `${k + 1}번째 배너 보기`, onclick: () => go(k) }, el('i', {}))));
  let i = 0;
  function go(n) {
    i = (n + N) % N;
    track.style.transform = `translateX(-${i * 100}%)`;
    count.replaceChildren(el('b', {}, pad(i + 1)), ` / ${pad(N)}`);
    const bs = [...prog.children];
    bs.forEach((b, k) => { b.classList.remove('on'); b.classList.toggle('done', k < i); b.setAttribute('aria-current', String(k === i)); });
    void prog.offsetWidth;   // 막대 애니메이션을 처음부터 다시
    bs[i].classList.add('on');
  }
  const box = el('section', { class: 'hc', 'aria-roledescription': '배너', 'aria-label': '리브릭 소식' }, track,
    el('div', { class: 'hc-ctrl' }, count, prog,
      el('div', { class: 'hc-nav' }, el('button', { type: 'button', 'aria-label': '이전 배너', onclick: () => go(i - 1) }, '‹'),
        el('button', { type: 'button', 'aria-label': '다음 배너', onclick: () => go(i + 1) }, '›'))));
  // 진행 막대(5초)가 다 차면 다음 장 — 멈춤은 CSS(.paused)가 막대를 세우는 것으로
  box.addEventListener('animationend', e => { if (e.animationName === 'hcfill') go(i + 1); });
  const pause = on => box.classList.toggle('paused', on);
  box.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') pause(true); });
  box.addEventListener('pointerleave', () => pause(false));
  box.addEventListener('focusin', () => pause(true));
  box.addEventListener('focusout', () => pause(false));
  document.addEventListener('visibilitychange', () => box.classList.toggle('hidden-tab', document.hidden));
  // 휴대폰: 손가락으로 밀어서 넘기기 (만지는 동안 멈춤)
  let x0 = null;
  box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; pause(true); }, { passive: true });
  box.addEventListener('touchend', e => {
    pause(false);
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
    x0 = null;
  }, { passive: true });
  go(0);
  return box;
}
function renderHero(part) {
  if (part === 'banner') return heroCarousel();
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
    el('div', { class: 'thumb' }, thumb({ set_no: x.no, theme: x.theme === 'DC' ? 'DC' : x.theme, name: x.name }), fancyFlag(`${x.event} ${x.year}`)),
    el('div', { class: 'body' },
      el('div', { class: 'name' }, x.name),
      el('div', { class: 'price' }, x.value ? won(x.value) : '시세 정보 없음'),
      el('div', { class: 'tags' }, el('span', { class: 'cond complete' }, LIM_KIND[x.kind]), x.qty ? el('span', { class: 'cond missing' }, `${x.qty.toLocaleString('ko-KR')}개 한정`) : ''),
      el('div', { class: 'meta' }, multText(x.value, x.retail) || '행사장 배포·추첨')));
}
// 코믹콘 배너 오른쪽에 한정판 미니피규어 사진 카드 2장 (로고는 상표라 안 씀) — 블랙 슈트 슈퍼맨(SDCC '13), 배트맨(SDCC '11)
function sdccFigs(banner) {
  const cards = el('div', { class: 'sdcc-figs', 'aria-hidden': 'true' }, ['comcon029', 'comcon014'].map((no, i) => {
    const src = imgOf(no);
    if (!src) return '';
    const im = el('img', { src, alt: '', referrerpolicy: 'no-referrer' });
    im.onerror = () => im.parentNode?.remove();
    return el('span', { class: 'sdcc-fig' }, im, el('small', {}, i ? "SDCC '11" : "SDCC '13"));
  }));
  banner.append(cards);
  return banner;
}
function sdccHero() {
  const d = daysUntil(SDCC.from), nextReg = SDCC.reg.find(([dt]) => daysUntil(dt) >= 0);
  return sdccFigs(el('section', { class: 'banner dark' },
    el('span', { class: 'eyebrow' }, '한정판의 성지, 코믹콘'),
    el('h2', {}, d > 0 ? el('span', {}, `${SDCC.name}까지 `, el('em', {}, `D-${d}`)) : `${SDCC.name} 진행 중`),
    el('p', {}, `${SDCC.from.replace(/-/g, '.')} ~ ${SDCC.to.slice(5).replace('-', '.')} (프리뷰 나이트 ${SDCC.preview.slice(5).replace('-', '.')}) · 미국 샌디에이고` +
      (nextReg ? ` · ${nextReg[0].slice(5).replace('-', '/')} ${nextReg[1]}` : '')),
    el('div', { class: 'bar' }, el('a', { class: 'btn primary', href: '#/limited' }, '역대 한정판 시세 보기'),
      el('a', { class: 'btn glass', href: 'https://www.comic-con.org/', target: '_blank', rel: 'noopener' }, '코믹콘 공식 사이트 ↗'))));
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
// 테마 대표 세트 (상표 로고 대신 Rebrickable 제품 사진, 흰 바탕은 multiply로 지워 누끼처럼)
const THEME_PIC = { '스타워즈': '75192', '테크닉': '42115', '아이콘즈': '10276', '시티': '60271', '해리포터': '71043', '마블': '76269', '아이디어': '21309',
  '아키텍처': '21054', '보태니컬': '10311', '스피드 챔피언': '76916', '프렌즈': '41704', '닌자고': '71741', '올드 레고': '6080', '미니피규어': ['col340', 'col378', 'col465'],   // 동물 옷 미피 3인방 (펭귄·퍼그·개구리)
  '디즈니': '43222', '마인크래프트': '21178', '크리에이터': '31109', '슈퍼 마리오': '71411', 'DC': '76240', '쥬라기 월드': '76956', '포켓몬': '72153', '듀플로': '10988' };
const themeTile = (t, n) => {
  const pic = THEME_PIC[t];
  const one = no => { const src = imgOf(no); if (!src) return ''; const im = el('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }); im.onerror = () => im.remove(); return im; };
  // 여러 개면 나란히 (미니피규어 3인방)
  const img = Array.isArray(pic) ? el('div', { class: 'trio' }, pic.map(one)) : pic ? one(pic) : '';
  return el('a', { class: 'ttile' + (img ? ' pic' : ''), href: `#/theme/${encodeURIComponent(t)}`, style: `--c:${THEMES[t]}` },
    img, el('b', {}, t), el('span', {}, n ? `${n.toLocaleString('ko-KR')}개` : ''));
};
// (2026-10-30, 사용자 "테마가 많은데 8개만, 맨 아래라 불편") 테마 22개를 묶음으로 — 홈 위쪽 동그라미 줄과 전체 테마 화면이 같은 순서
const THEME_GROUPS = [
  ['인기 라이선스', ['스타워즈', '해리포터', '마블', 'DC', '디즈니', '쥬라기 월드', '마인크래프트', '슈퍼 마리오', '포켓몬', '스피드 챔피언']],
  ['어른을 위한 레고', ['아이콘즈', '테크닉', '아이디어', '아키텍처', '보태니컬']],
  ['레고 오리지널', ['시티', '닌자고', '프렌즈', '크리에이터', '듀플로']],
  ['수집·클래식', ['미니피규어', '올드 레고']]];
// 테마 동그라미: 테마색을 옅게 깐 원 안에 대표 세트 사진 (번개·쿠팡 카테고리 아이콘처럼)
function themeCircle(t) {
  const p = THEME_PIC[t], no = Array.isArray(p) ? p[1] : p;
  const im = no ? pic(no, { alt: '' }, () => im.remove()) : '';
  return el('a', { class: 'tcirc', href: `#/theme/${encodeURIComponent(t)}`, style: `--c:${THEMES[t]}` }, el('span', { class: 'tc-pic' }, im), el('b', {}, t));
}
// 홈: 배너 바로 아래 '테마로 찾기' (PC 2줄에 전부, 휴대폰은 2줄 가로 밀기)
function themeRail() {
  const all = THEME_GROUPS.flatMap(([, ts]) => ts);
  return el('section', { class: 'section' },
    el('div', { class: 'sec-head' }, el('h2', {}, '테마로 찾기'), el('span', { class: 'summary' }, `${all.length}개 테마`), el('a', { class: 'more', href: '#/themes' }, '전체 테마 →')),
    el('nav', { class: 'trail', 'aria-label': '테마' }, all.map(themeCircle)));
}
// 전체 테마 화면: 검색 + 묶음별 큰 타일
function renderThemes() {
  const { n } = themeCounts();
  const q = el('input', { type: 'search', class: 'tsearch', placeholder: '테마 이름으로 찾기 (예: 스타워즈, 테크닉)', 'aria-label': '테마 찾기' });
  const body = el('div', { class: 'tgroups' });
  const draw = () => {
    const k = q.value.trim().toLowerCase();
    const parts = THEME_GROUPS.map(([g, ts]) => {
      const list = ts.filter(t => !k || t.toLowerCase().includes(k));
      return list.length ? el('section', { class: 'section' }, el('h3', { class: 'tg-h' }, g, el('span', {}, `${list.length}`)), el('div', { class: 'ttiles' }, list.map(t => themeTile(t, n[t])))) : null;
    }).filter(Boolean);
    body.replaceChildren(...(parts.length ? parts : [el('div', { class: 'empty' }, `'${q.value.trim()}' 테마가 없어요. 세트 이름은 위쪽 검색칸에서 찾아 주세요.`)]));
  };
  q.oninput = draw;
  show(el('section', { class: 'section' },
    el('div', { class: 'sec-head' }, el('div', {}, el('h2', {}, '테마별로 둘러보기'), el('p', {}, '테마를 고르면 명작 세트 시세, 곧 단종, 신제품, 올라온 매물을 한 번에 볼 수 있어요.'))),
    q), body);
  draw();
}
function iconCard(x) {
  const c = CATALOG[x.no] || {};
  const v = x.value || BL[x.no]?.new?.[1] || 0;
  return el('a', { class: 'card', href: `#/set/${x.no}` },
    el('div', { class: 'thumb' }, thumb({ set_no: x.no, theme: c.theme, name: c.name }), v && x.retail ? fancyFlag(`${(v / x.retail).toFixed(1)}배`) : badgeFlag(x.no)),
    el('div', { class: 'body' },
      el('div', { class: 'name' }, (c.store ? c.name : (window.BRICK_ICONIC_NAMES || {})[x.no]) || c.name || `세트 ${x.no}`),
      el('div', { class: 'price' }, v ? won(v) : c.msrp ? won(c.msrp) : '-'),
      el('div', { class: 'meta' }, v ? multText(v, x.retail) || '새것 시세' : c.msrp ? '공식몰 정가' : ''),
      el('div', { class: 'small' }, x.note)));
}
const badgeFlag = no => { const b = storeBadge(no); return b ? fancyFlag(b.text) : ''; };
// 사진 위 딱지: 짧은 말 + 색 점 (어두운 반투명 알약). 공식몰 표시·행사·×배 문구를 세련된 짧은 말로 바꿈
function fancyFlag(text) {
  const [label, tone] = fancyLabel(text);
  return el('span', { class: `flag store tone-${tone}` }, label);
}
function fancyLabel(text) {
  const t = String(text || '').replace(/^[^\w가-힣']+\s*/, '');   // 앞 이모지 떼기
  let m, label = t, tone = 'gray';
  if (/곧 단종/.test(t)) [label, tone] = ['단종 임박', 'orange'];
  else if (/신제품/.test(t)) [label, tone] = ['NEW', 'blue'];
  else if ((m = t.match(/(\d+)월 (\d+)일.*(출시|출고)/))) [label, tone] = [`${m[1]}.${m[2]} ${m[3]}`, 'purple'];
  else if (/선주문|출고 예정|출시 예정/.test(t)) [label, tone] = ['예약 판매', 'purple'];
  else if ((m = t.match(/(\d+)% 할인/))) [label, tone] = [`SALE ${m[1]}%`, 'red'];
  else if (/품절/.test(t)) [label, tone] = ['SOLD OUT', 'gray'];
  else if ((m = t.match(/^(SDCC|NYCC) (\d{4})/))) [label, tone] = [`${m[1]} '${m[2].slice(2)}`, 'gold'];
  else if ((m = t.match(/^([\d.]+)배$/))) [label, tone] = [`×${m[1]}`, 'gold'];
  return [label, tone];
}
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
        el('span', { class: 'stat' }, el('b', {}, s[t] || 0), '공식몰 판매 중'), el('span', { class: 'stat' }, el('b', {}, r[t] || 0), '곧 단종'),
        starBtn(t, `${t} 새 매물 알림`))),
    rail('명작 세트 시세', '단종된 명작이 지금 얼마인지, 정가보다 몇 배 올랐는지', (ICONIC[t] || []).map(iconCard)),
    (() => {   // 지금 공식몰에서 파는 이 테마 세트 전부 (비싼 순, 12개씩 더 보기)
      if (!store.length) return '';
      const rows = [...store].sort((a, b) => (b[1].store.price || b[1].msrp) - (a[1].store.price || a[1].msrp));
      const grid = el('div', { class: 'grid' });
      let shown = 0;
      const more = el('button', { type: 'button', class: 'btn', style: 'justify-self:center' });
      const add = () => {
        grid.append(...rows.slice(shown, shown + 12).map(x => setCard(x, storeBadge(x[0])?.text || '')));
        shown = Math.min(rows.length, shown + 12);
        more.hidden = shown >= rows.length;
        more.textContent = `더 보기 (${rows.length - shown}개 남음)`;
      };
      more.onclick = add;
      add();
      return el('section', { class: 'section' },
        el('div', { class: 'sec-head' }, el('div', {}, el('h2', {}, `공식몰에서 파는 중 ${rows.length}개`), el('p', {}, `레고 공식몰 판매가 기준 (${window.BRICK_STORE_DATE || window.BRICK_CATALOG_DATE}) · 누르면 중고 시세까지`)),
          el('a', { class: 'more', href: `#/prices/${encodeURIComponent(t)}` }, '정가표로 보기 →')),
        grid, more);
    })(),
    rail('코믹콘 한정판', '행사장에서만 나온 한정판', lim.map(limCard), null, '#/limited'),
    rail('곧 단종', '단종 전에 공식몰 정가로 살 마지막 기회', store.filter(([, c]) => c.store.flags.includes('retiringSoon')).sort((a, b) => b[1].msrp - a[1].msrp).slice(0, 12).map(x => setCard(x, '곧 단종')), null, '#/new/retire'),
    rail('신제품·예약', '', store.filter(([, c]) => c.store.flags.includes('new') || /출시 예정|선주문/.test(c.store.avail)).sort((a, b) => b[1].msrp - a[1].msrp).slice(0, 12).map(x => setCard(x, storeBadge(x[0])?.text || '신제품')), null, '#/new/soon'),
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
  return [`[레고${it.set_no ? ' ' + it.set_no : ''}] ${it.name} (${COND[it.cond]})`,
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
  const chartSlot = el('div', {});
  soldChart(no).then(c => { if (c) chartSlot.replaceWith(c); });
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
      chartSlot,
      soldRows.length ? el('div', { class: 'ref' }, soldRows.map(s => el('div', { class: 'refrow' }, el('span', { class: `cond ${s.cond}` }, COND[s.cond]),
          el('span', {}, `평균 ${won(s.avg_price)}`, el('span', { class: 'small' }, ` · ${s.n}건 · ${won(s.min_price)} ~ ${won(s.max_price)}`)), el('span', {}), el('span', {}))))
        : el('div', { class: 'hint' }, '아직 리브릭에서 팔린 기록이 없어요. 판매완료로 바꿀 때 실제 거래 가격을 적어 주시면 모두가 보는 시세가 돼요.'),
      el('div', { class: 'bar' }, el('a', { class: 'btn primary', href: `#/sell/${no}` }, f ? '이 미니피규어 팔기' : '이 세트 팔기'),
        starBtn(no, '매물 알림 받기'),
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
const pctText = (now, base) => { const p = Math.round((now - base) / base * 100); return `${p > 0 ? '+' : ''}${p}%`; };
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

  // 합계: 정가·추정 시세는 아는 세트만 더함. 수익률은 산 가격과 시세가 둘 다 있는 세트끼리만
  let msrpSum = 0, estSum = 0, estN = 0, paidSum = 0, gainPaid = 0, gainEst = 0;
  const list = rows.map(r => {
    const c = CATALOG[r.set_no], est = estimate(r.set_no, r.cond, stats);
    if (c?.msrp) msrpSum += c.msrp;
    if (est) { estSum += est.v; estN++; }
    if (r.paid) paidSum += r.paid;
    if (r.paid && est) { gainPaid += r.paid; gainEst += est.v; }
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
        r.paid ? el('div', { class: 'small' }, `산 가격 ${won(r.paid)}`, est ? el('span', { class: est.v >= r.paid ? 'up-g' : 'down-g' }, ` ${pctText(est.v, r.paid)}`) : '') : ''),
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
      tile('산 가격 합계', paidSum ? won(paidSum) : '-'),
      gainPaid ? tile('산 가격 대비', pctText(gainEst, gainPaid), `${won(Math.abs(gainEst - gainPaid))} ${gainEst >= gainPaid ? '올랐어요 📈' : '내렸어요 📉'} (산 가격 적은 세트만)`) : ''),
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
  const [{ data: seller }, { count: listed }, { count: sold }, trust] = await Promise.all([
    sb.from('profiles').select('nickname, region, created_at').eq('id', it.seller_id).maybeSingle(),
    sb.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', it.seller_id),
    sb.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', it.seller_id).eq('status', 'sold'),
    reviewSummary(it.seller_id),
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
    // 가격 바로 바꾸기 — 내리면 찜한 사람에게 💸 알림 (DB 트리거)
    const priceIn = el('input', { type: 'number', min: 0, step: 1000, value: it.price, 'aria-label': '새 가격', style: 'width:140px' });
    const priceBtn = el('button', { type: 'button' }, '가격 바꾸기');
    priceBtn.onclick = async () => {
      const np = Number(priceIn.value);
      if (!np || np === it.price) return;
      priceBtn.disabled = true;
      const { error } = await sb.from('listings').update({ price: np }).eq('id', it.id);
      priceBtn.disabled = false;
      if (error) return toast(errMsg(error), true);
      toast(np < it.price ? '가격을 내렸어요. 찜한 사람들에게 💸 알림이 갔어요.' : '가격을 바꿨어요.');
      route();
    };
    const offersSlot = el('div', {});
    offersFor(it).then(b => offersSlot.replaceWith(b));
    actions = el('div', {}, el('div', { class: 'bar' }, sel, el('a', { class: 'btn', href: `#/edit/${it.id}` }, '수정'), del, el('a', { class: 'btn', href: '#/chats' }, '받은 채팅 보기')), soldBox,
      it.status !== 'sold' ? el('div', { class: 'bar' }, el('span', { class: 'small' }, '💸 가격'), priceIn, priceBtn, el('span', { class: 'small' }, '내리면 찜한 사람에게 알림이 가요')) : '',
      offersSlot,
      el('div', { class: 'offsite' }, el('div', {}, el('b', {}, '📣 더 빨리 팔고 싶다면'), el('div', { class: 'small' }, '당근·번개장터에도 올려 보세요. 리브릭 시세 링크가 붙은 판매글을 만들어 드려요.')),
        el('button', { type: 'button', class: 'primary', onclick: () => copyText(offsiteText(it), '판매글을 복사했어요. 당근·번개장터 글쓰기에 붙여 넣으세요.') }, '당근·번개용 글 복사')));
  } else {
    actions = el('div', {}, el('div', { class: 'bar' }, likeBtn(it, true), el('a', { class: 'btn primary', href: me ? `#/chat/${it.id}/${me.id}` : '#/login' }, me ? '판매자에게 채팅' : '로그인하고 채팅하기'),
      el('span', { class: 'small likes', 'data-likes': it.id }),
      el('button', { type: 'button', onclick: () => shareLink(`${it.name} ${won(it.price)} | 리브릭`, `${location.origin}${location.pathname}#/item/${it.id}`) }, icon('share'), '공유'),
      el('span', { class: 'grow' }), el('a', { class: 'btn ghost', href: me ? `#/report/${it.id}` : '#/login' }, '🚩 신고')),
      it.status !== 'sold' ? offerBox(it) : '');
  }

  show(el('div', { class: 'detail' }, gallery,
    el('section', { class: 'panel' },
      el('div', { class: 'setno' }, [it.set_no ? `#${it.set_no}` : (it.cond === 'parts' ? '벌크·부품' : it.theme === '미니피규어' ? '미니피규어' : '묶음·기타'), it.theme].join(' · ')),
      el('h2', {}, it.name),
      el('div', { class: 'bar' }, el('span', { class: 'price' }, won(it.price)), el('span', { class: `cond ${it.cond}` }, COND[it.cond]),
        it.status !== 'selling' ? el('span', { class: 'cond missing' }, STATUS[it.status]) : ''),
      v ? el('div', { class: v.cls }, `${v.text} (공식몰 정가 ${won(m)}, ${window.BRICK_CATALOG_DATE} 기준)`) : '',
      !it.set_no ? '' : mk ? el('div', { class: 'small' }, '중고 시세 참고: ' + [mk.sealed && `미개봉 ${fmtRange(mk.sealed)}`, mk.used && `개봉 ${fmtRange(mk.used)}`].filter(Boolean).join(' · ') + ' ',
        el('a', { href: `#/set/${it.set_no}` }, '시세 자세히 →')) : el('a', { class: 'small', href: `#/set/${it.set_no}` }, '이 세트 시세 보기 →'),
      !it.set_no ? '' : (() => {   // 브릭링크(해외) 평균과 비교 (번호 있을 때만)
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
        ].filter(Boolean).join(' · ')),
        it.box_grade ? el('div', { class: 'small' }, el('span', { class: 'kchip grade-' + it.box_grade }, `박스 ${it.box_grade}`), ' ', BOX_GRADE[it.box_grade].replace(/^\w · /, '')) : '',
        it.missing_parts != null ? el('div', { class: 'small' }, it.missing_parts ? `⚠ 누락 부품 ${it.missing_parts}개` + (it.missing_note ? ` — ${it.missing_note}` : '') : '✓ 누락 부품 없음') : ''),
      it.description ? el('div', { class: 'desc' }, it.description) : el('div', { class: 'hint' }, '설명이 없어요.'),
      el('div', { class: 'seller' }, el('div', { class: 'avatar', 'aria-hidden': 'true' }, (seller?.nickname || '?').slice(0, 1)),
        el('div', {}, el('a', { class: 'seller-name', href: `#/user/${it.seller_id}` }, el('b', {}, seller?.nickname || '판매자'), gradeChip(brickGrade(trust, sold ?? 0)), age !== null && age < 7 ? el('span', { class: 'newbie' }, '새 판매자') : ''),
          el('div', { class: 'small' }, [seller?.region, age !== null ? `가입 ${age + 1}일째` : '', `등록 ${listed ?? 0}개 · 판매완료 ${sold ?? 0}개`].filter(Boolean).join(' · ')),
          el('div', { class: 'small trust' }, `매너 등급 ${brickGrade(trust, sold ?? 0).g} (${brickGrade(trust, sold ?? 0).label}) · `, trustText(trust), trust.tags[0] ? ` · "${trust.tags[0][0]}"` : '', ' ',
            el('a', { href: `#/user/${it.seller_id}` }, '프로필·후기 보기 →')))),
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
  // 번호는 선택: 알면 이름·정가·시세 자동, 몰라도 이름만 쓰면 등록 (벌크·묶음은 번호 칸 숨김)
  const fSet = inp('fSet', { placeholder: '예: 10294 (모르면 비워 두세요)', value: v('set_no', presetSet) });
  const fName = inp('fName', { required: true, maxlength: 100, placeholder: '예: 밀레니엄 팔콘', value: v('name') });
  // 무엇을 파나요? (DB엔 따로 칸 없이: 미니피규어 = 테마 '미니피규어', 벌크 = 상태 '부품·벌크', 묶음 = 번호 없는 세트)
  const KINDS = {
    set: ['🧱 세트', '세트번호 (선택)', '예: 10294 (모르면 비워 두세요)', '예: 밀레니엄 팔콘'],
    fig: ['🧍 미니피규어', '미니피규어 번호 (선택)', '예: sw0515 (모르면 비워 두세요)', '예: 스타워즈 클론 트루퍼 미니피규어 3개'],
    bulk: ['🪣 벌크·부품', '', '', '예: 레고 벌크 2kg (시티·테크닉 섞임)'],
    lot: ['📦 여러 개 묶음', '', '', '예: 닌자고 세트 5개 일괄'],
  };
  let kind = it ? (it.cond === 'parts' ? 'bulk' : it.theme === '미니피규어' ? 'fig' : !it.set_no ? 'lot' : 'set') : (isFig(presetSet) ? 'fig' : 'set');
  const setLabel = el('span', {});
  const setWrap = el('label', { class: 'f' }, setLabel, fSet);
  const kindBox = el('div', { class: 'kinds', role: 'radiogroup', 'aria-label': '무엇을 파나요?' });
  const applyKind = (first = false) => {
    const [, lab, ph, nameph] = KINDS[kind];
    setWrap.hidden = !lab;
    setLabel.textContent = lab;
    if (ph) fSet.placeholder = ph;
    fName.placeholder = nameph;
    figHint.hidden = kind !== 'fig';
    if (!lab && !first) { fSet.value = ''; found.textContent = ''; }
    if (!first) {
      if (kind === 'bulk') fCond.value = 'parts';
      else if (fCond.value === 'parts') fCond.value = 'complete';
      if (kind === 'fig') fTheme.value = '미니피규어';
      else if (fTheme.value === '미니피규어') fTheme.value = '기타';
    }
    kindBox.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.k === kind)));
    if (formReady) { updatePriceHint(); updateScore(); }
  };
  Object.entries(KINDS).forEach(([k, [t]]) => kindBox.append(el('button', { type: 'button', role: 'radio', class: 'kind', 'data-k': k, 'aria-checked': 'false',
    onclick: () => { kind = k; applyKind(); } }, t)));
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
  // 박스 등급(미개봉이거나 박스 있을 때) · 누락 부품(개봉일 때)
  const fGrade = el('select', { id: 'fGrade' }, Object.entries(BOX_GRADE).map(([k, t]) => el('option', { value: k, selected: v('box_grade', '') === k }, t)));
  const fMissing = inp('fMissing', { type: 'number', min: 0, placeholder: '0 = 없음, 모르면 비움', value: v('missing_parts') ?? '' });
  const fMissNote = inp('fMissNote', { maxlength: 200, placeholder: '예: 1x2 회색 플레이트 2개, 투명 파랑 조각 1개', value: v('missing_note') });
  const gradeWrap = el('label', { class: 'f' }, '박스 상태 등급', fGrade);
  const missWrap = el('label', { class: 'f' }, '누락 부품 수', fMissing), missNoteWrap = el('label', { class: 'f wide' }, '누락 부품 메모 (선택)', fMissNote);
  const syncKit = () => {
    gradeWrap.hidden = !(fCond.value === 'sealed' || document.getElementById('f-has_box')?.checked);
    missWrap.hidden = missNoteWrap.hidden = ['sealed', 'parts'].includes(fCond.value);
  };
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
      kind === 'bulk' || kind === 'lot' ? [fName.value.trim().length >= 6 ? 10 : 4, 10, fName.value.trim().length >= 6 ? '제목 확인됨' : '제목에 무엇이 들었는지 적어 주세요 (예: 벌크 2kg, 세트 5개)']
        : [CATALOG[no] || isFig(no) ? 10 : fName.value.trim() ? 7 : 0, 10, CATALOG[no] ? '번호 확인됨' : '번호를 알면 넣어 주세요 — 이름·정가·시세가 자동으로 붙어요 (선택)'],
      [!pr ? 0 : !s ? 12 : pr <= s.slow * 1.05 ? 20 : 8, 20, !pr ? '가격을 정하세요' : s && pr > s.slow * 1.05 ? `시세보다 높아요 (여유 있게 ${won(s.slow)}) — 오래 걸릴 수 있어요` : '가격이 시세 안에 있어요'],
      [fDesc.value.trim().length >= 60 ? 15 : fDesc.value.trim().length >= 15 ? 7 : 0, 15, fDesc.value.trim().length >= 60 ? '설명 충분' : '설명을 조금 더 — "설명 자동 작성"을 눌러 보세요'],
      [(fFigsTotal.value !== '' && (fGrade.value || fMissing.value !== '')) ? 15 : (chk('f-has_box') || chk('f-has_manual') || fFigsTotal.value !== '') ? 10 : 5, 15,
        fFigsTotal.value !== '' && (fGrade.value || fMissing.value !== '') ? '구성품 체크 완료' : '상태 카드에 미니피규어 수와 박스 등급(미개봉)·누락 부품 수(개봉)를 적으면 믿음이 커져요'],
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
      !gradeWrap.hidden && fGrade.value ? `박스 상태: ${BOX_GRADE[fGrade.value]}` : '',
      !missWrap.hidden && fMissing.value !== '' ? (Number(fMissing.value) ? `누락 부품 ${fMissing.value}개` + (fMissNote.value.trim() ? ` (${fMissNote.value.trim()})` : '') : '누락 부품 없어요 (부품 목록과 맞춰 봤어요).') : '',
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
  const figHint = el('div', { class: 'hint' }, '🧍 브릭링크 번호(예: sw0515)를 알면 넣어 주세요. 같은 캐릭터도 모양이 여러 가지라 번호가 있으면 시세를 정확히 비교할 수 있어요. 몰라도 괜찮아요. ',
    el('a', { href: 'https://www.bricklink.com/catalogList.asp?catType=M', target: '_blank', rel: 'noopener' }, '브릭링크에서 번호 찾기 ↗'));
  const form = el('form', { class: 'panel' },
    el('h2', {}, it ? '상품 수정' : '판매 등록'),
    el('div', { class: 'f' }, el('b', { class: 'small', style: 'color:var(--fg)' }, '무엇을 파나요?'), kindBox),
    el('div', { class: 'fields' }, setWrap, el('label', { class: 'f wide' }, '제목 (이름)', fName),
      el('label', { class: 'f' }, '테마', fTheme), el('label', { class: 'f' }, '피스 수 (선택)', fPieces), el('label', { class: 'f' }, '출시연도 (선택)', fYear)),
    found,
    figHint,
    el('div', { class: 'fields' }, el('label', { class: 'f' }, '상태', fCond), el('label', { class: 'f' }, '판매 가격 (원)', fPrice, priceHint),
      el('label', { class: 'f' }, '거래 지역', fRegion)),
    sugg,
    el('fieldset', { class: 'tradeset' }, el('legend', {}, '🧱 상태 카드'),
      el('div', { class: 'boxes', role: 'group', 'aria-label': '구성품' }, box('has_box', '박스 있음'), box('has_manual', '설명서 있음'), box('all_figs', '미니피규어 전부'), box('was_built', '조립했다 분해함'),
        box('yellowed', '흰·회색 부품 변색 있음'), box('has_tray', '내부 트레이 있음 (올드 레고)')),
      el('div', { class: 'fields' }, el('label', { class: 'f' }, '미니피규어 (있는 수)', fFigsHave), el('label', { class: 'f' }, '미니피규어 (원래 수)', fFigsTotal),
        el('label', { class: 'f' }, '스티커', fSticker)),
      el('div', { class: 'fields' }, gradeWrap, missWrap, missNoteWrap),
      el('div', { class: 'hint' }, '📦 박스 등급: S 새것 같음 · A 실링 풀림·아주 작은 흠 · B 모서리 찍힘·눌림 · C 찢어짐. 누락 부품을 정확히 적으면 구매자가 믿고 사요 (설명서 뒤 부품 목록과 맞춰 보세요).')),
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
  form.addEventListener('change', syncKit);
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
        box_grade: gradeWrap.hidden ? '' : fGrade.value,
        missing_parts: missWrap.hidden || fMissing.value === '' ? null : Number(fMissing.value),
        missing_note: missWrap.hidden ? '' : fMissNote.value.trim(),
        description: fDesc.value.trim(), photos: urls,
        trade_direct: fDirect.checked, trade_delivery: fDelivery.checked,
        meet_place: fDirect.checked ? fMeet.value.trim() : '', ship_fee: fDelivery.checked ? Number(fShip.value) || 0 : 0,
      };
      // 수정하면서 뺀 사진은 보관함에서도 지움
      if (it) {
        const gone = it.photos.filter(u => !urls.includes(u)).map(u => u.split('/object/public/photos/')[1]).filter(Boolean);
        if (gone.length) await sb.storage.from('photos').remove(gone);
      }
      if (row.missing_parts > 0 && row.cond === 'complete') row.cond = 'missing';   // 누락이 있으면 '일부 누락'으로
      const res = it ? await sb.from('listings').update(row).eq('id', it.id).select('id').single()
                     : await sb.from('listings').insert(row).select('id').single();
      if (res.error) throw res.error;
      location.hash = `#/item/${res.data.id}`;
    } catch (err) { st.className = 'status err'; st.textContent = needUpdate(err); submit.disabled = false; }
  };
  show(form);
  applyKind(true);
  syncKit();
  if (!it) (presetSet ? fPrice : setWrap.hidden ? fName : fSet).focus();
}

// ---- 비밀번호 규칙 (2026-10-30): 8자 이상 + 영문·숫자·특수기호 각각 1개 이상 ----------------
// Supabase 서버 설정은 '8자 이상 + 영문·숫자'까지만 고를 수 있어서, 특수기호는 여기서 확인
const PW_RULES = [['8자 이상', p => p.length >= 8], ['영문', p => /[A-Za-z]/.test(p)], ['숫자', p => /\d/.test(p)], ['특수기호', p => /[^A-Za-z0-9\s]/.test(p)]];
const pwMsg = p => { const miss = PW_RULES.filter(([, f]) => !f(p)).map(([t]) => t); return miss.length ? `비밀번호 조건이 부족해요: ${miss.join(' · ')} (8자 이상, 영문·숫자·특수기호 모두 넣어 주세요)` : ''; };
// 입력하는 동안 조건 4개에 ✓
function pwChecklist(input) {
  const box = el('div', { class: 'pwrules', 'aria-live': 'polite' });
  const paint = () => box.replaceChildren(...PW_RULES.map(([t, f]) => el('span', { class: f(input.value) ? 'ok' : '' }, (f(input.value) ? '✓ ' : '○ ') + t)));
  input.addEventListener('input', paint);
  paint();
  return box;
}

// ---- 로그인 (2026-10-30: 이메일+비밀번호가 기본. 가입할 때만 메일 인증번호 한 번, 비밀번호 잊으면 인증번호로) ----
function renderLogin() {
  if (me) { location.hash = '#/'; return; }
  let mode = 'login';   // login = 이메일+비밀번호 / signup = 회원가입 / code = 메일 인증번호로 로그인
  const email = el('input', { id: 'loginEmail', type: 'email', required: true, placeholder: 'you@example.com', autocomplete: 'email' });
  const pw = el('input', { id: 'loginPw', type: 'password', placeholder: '비밀번호', autocomplete: 'current-password' });
  const pw2 = el('input', { id: 'loginPw2', type: 'password', placeholder: '한 번 더 입력', autocomplete: 'new-password' });
  const pwRules = pwChecklist(pw);
  const pwWrap = el('label', { class: 'f' }, '비밀번호', pw), pw2Wrap = el('label', { class: 'f' }, '비밀번호 확인', pw2, pwRules);
  const st = status();
  const btn = el('button', { type: 'submit', class: 'primary' }, '로그인');
  const intro = el('p', {});
  const segs = [['login', '로그인'], ['signup', '회원가입'], ['code', '인증번호로']].map(([k, t]) =>
    el('button', { type: 'button', class: 'seg-b', 'data-k': k, onclick: () => setMode(k) }, t));
  const forgot = el('button', { type: 'button', class: 'linkbtn', onclick: () => setMode('code') }, '비밀번호를 잊었거나 아직 안 정했어요 →');
  const form = el('form', { class: 'panel login' },
    el('h2', {}, '로그인 / 가입'),
    el('div', { class: 'seg', role: 'group', 'aria-label': '로그인 방법' }, segs), intro,
    el('label', { class: 'f' }, '이메일 (아이디)', email), pwWrap, pw2Wrap, el('div', { class: 'bar' }, btn), st, forgot,
    el('ul', { class: 'tips small' },
      el('li', {}, '메일이 안 보이면 스팸함도 확인해 주세요.'),
      el('li', {}, CFG.otpCode ? '링크는 누른 기기에서만 로그인돼요. 컴퓨터로 로그인하려는데 메일을 휴대폰에서 봤다면 인증번호를 넣으세요.'
        : '링크는 누른 기기에서만 로그인돼요. 컴퓨터로 로그인하려면 컴퓨터에서 메일(네이버·지메일 웹)을 열어 링크를 눌러 주세요.'),
      el('li', {}, '번호와 링크는 한 번만 쓸 수 있어요. 안 되면 메일을 새로 받아 주세요.')));
  // 메일은 시간당 보낼 수 있는 수가 적어서, 보낸 뒤 60초 동안 다시 못 누르게 함
  const cooldown = sec => {
    btn.disabled = true;
    const m = mode;
    const tick = () => { if (mode !== m) return; if (sec <= 0) { btn.disabled = false; btn.textContent = '메일 다시 받기'; return; } btn.textContent = `다시 받기 (${sec--}초)`; setTimeout(tick, 1000); };
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
  const tips = form.querySelector('.tips');
  form.insertBefore(codeBox, tips);
  const showCode = () => { sentTo.textContent = `📬 ${email.value.trim()}(으)로 보냈어요`; codeBox.hidden = false; digits.forEach(d => { d.value = ''; }); codeSt.textContent = ''; code.focus(); };
  function setMode(k) {
    mode = k;
    segs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
    pwWrap.hidden = k === 'code'; pw2Wrap.hidden = k !== 'signup';
    pw.required = k !== 'code'; pw2.required = k === 'signup';
    pw.autocomplete = k === 'signup' ? 'new-password' : 'current-password';
    pw.placeholder = k === 'signup' ? '8자 이상 · 영문·숫자·특수기호 포함' : '비밀번호';
    forgot.hidden = k !== 'login'; tips.hidden = k !== 'code'; codeBox.hidden = true;
    btn.disabled = false; st.className = 'status'; st.textContent = '';
    btn.textContent = { login: '로그인', signup: '가입하기', code: CFG.otpCode ? '인증 메일 받기' : '로그인 링크 받기' }[k];
    intro.textContent = {
      login: '가입할 때 정한 이메일과 비밀번호로 로그인해요. 한 번 로그인하면 이 기기에서는 계속 로그인돼 있어요.',
      signup: '이메일과 비밀번호만 정하면 돼요. 진짜 내 메일인지 확인하려고 처음 한 번만 인증번호를 보내 드려요.',
      code: '비밀번호를 잊었거나 아직 안 정했다면 메일 인증번호로 로그인한 뒤, 내 정보에서 비밀번호를 정해 주세요.',
    }[k];
  }
  form.onsubmit = async e => {
    e.preventDefault();
    const addr = email.value.trim();
    const fail = msg => { st.className = 'status err'; st.textContent = msg; btn.disabled = false; };
    if (mode === 'login') {
      btn.disabled = true; st.className = 'status'; st.textContent = '확인하는 중…';
      const { error } = await sb.auth.signInWithPassword({ email: addr, password: pw.value });
      if (error) return fail(/invalid login/i.test(error.message) ? '이메일이나 비밀번호가 틀렸어요. 예전에 인증번호로만 로그인했다면 아직 비밀번호가 없어요 — 아래 "비밀번호를 잊었거나…"를 눌러 주세요.'
        : /not confirmed/i.test(error.message) ? '아직 메일 인증을 안 했어요. 회원가입 탭에서 같은 메일로 다시 가입하면 인증번호를 새로 보내 드려요.' : errMsg(error));
      toast('로그인했어요. 반가워요!'); location.hash = '#/'; return;
    }
    if (mode === 'signup') {
      if (pwMsg(pw.value)) return fail(pwMsg(pw.value));
      if (pw.value !== pw2.value) return fail('비밀번호 두 개가 서로 달라요.');
      btn.disabled = true; st.className = 'status'; st.textContent = '가입하는 중…';
      const { data, error } = await sb.auth.signUp({ email: addr, password: pw.value, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) return fail(/already/i.test(error.message) ? '이미 가입한 메일이에요. 로그인 탭에서 로그인해 주세요.' : /password/i.test(error.message) ? '비밀번호가 너무 쉬워요. 더 길게 정해 주세요.' : errMsg(error));
      // 이미 가입된 메일이면 Supabase가 identities 빈 사용자를 돌려줌 (메일은 안 감)
      if (data.user && !(data.user.identities || []).length) return fail('이미 가입한 메일이에요. 로그인 탭에서 로그인하거나, 비밀번호를 모르면 "인증번호로"를 눌러 주세요.');
      if (data.session) { toast('가입했어요. 반가워요!'); location.hash = '#/'; return; }   // 메일 확인을 끈 경우
      st.textContent = '가입 확인 메일을 보냈어요. 메일 속 인증번호를 아래에 넣으면 가입이 끝나요.';
      showCode(); cooldown(60); return;
    }
    btn.disabled = true; st.className = 'status'; st.textContent = '보내는 중…';
    const { error } = await sb.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) return fail(errMsg(error));
    st.textContent = CFG.otpCode ? '' : `📬 ${addr} 메일함을 확인해 주세요. 메일 속 링크는 누른 기기에서 로그인돼요 — 이 기기에서 메일을 열어 링크를 눌러 주세요.`;
    if (CFG.otpCode) showCode();
    cooldown(60);
  };
  setMode('login');
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
  // 찜한 상품 · 신뢰도 · 내 신고 (update_6 전이면 조용히 빈 값)
  const [{ data: liked }, trust, { data: reps }] = await Promise.all([
    sb.from('likes').select('created_at, listings(*)').order('created_at', { ascending: false }),
    reviewSummary(me.id),
    sb.from('reports').select('*').order('created_at', { ascending: false }).limit(20)]);
  const likedItems = (liked || []).map(r => r.listings).filter(Boolean);
  const selling = mine.filter(x => x.status !== 'sold'), sold = mine.filter(x => x.status === 'sold');
  const REPORT_ST = { received: '접수됨', reviewing: '검토 중', done: '처리 완료' };
  const nick = prof?.nickname || '';

  // 내 상품·찜: 탭 하나씩 (길게 늘어놓지 않게)
  const body = el('div', {});
  const tabs = el('div', { class: 'seg seg3', role: 'tablist' });
  const draw = t => {
    tabs.replaceChildren(...[['selling', `판매 중 ${selling.length}`], ['sold', `판매완료 ${sold.length}`], ['liked', `찜 ${likedItems.length}`]].map(([k, label]) =>
      el('button', { type: 'button', class: 'seg-b', role: 'tab', 'aria-selected': String(t === k), 'aria-pressed': String(t === k), onclick: () => draw(k) }, label)));
    const list = t === 'selling' ? selling : t === 'sold' ? sold : likedItems;
    body.replaceChildren(list.length ? el('div', { class: 'grid' }, list.map(listingCard))
      : el('div', { class: 'empty' }, t === 'liked' ? '마음에 드는 상품 사진의 ♡를 누르면 여기 모여요.' : t === 'sold' ? '아직 판매완료된 상품이 없어요.' : '지금 판매 중인 상품이 없어요.',
          t === 'selling' ? el('a', { class: 'btn primary', href: '#/sell' }, '+ 판매 등록하기') : ''));
    fillLikeCounts(list.map(it => it.id));
  };
  const stat = (n, label, onclick) => el('button', { type: 'button', class: 'stat-b', onclick }, el('b', {}, n), el('span', {}, label));
  // 메뉴 한 줄: 아이콘 · 이름 · 오른쪽 작은 글 · ›
  const row = (ic, label, right, href, cls = '') => el(href ? 'a' : 'button', { class: 'mrow ' + cls, ...(href ? { href } : { type: 'button' }) },
    el('span', { class: 'mic', 'aria-hidden': 'true' }, ic), el('span', { class: 'ml' }, label), el('span', { class: 'mr small' }, right || ''), el('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));
  const unreadN = notifs.filter(n => !n.read).length;
  const repBox = el('div', { class: 'replist', hidden: true }, (reps || []).map(r => el('div', { class: 'small' }, `${new Date(r.created_at).toLocaleDateString('ko-KR')} · `,
    r.listing_id ? el('a', { href: `#/item/${r.listing_id}` }, `상품 #${r.listing_id}`) : '삭제된 상품', ` · ${REPORT_ST[r.status] || '접수됨'}`, r.result ? ` — ${r.result}` : '')));
  const repRow = row('🚩', '내 신고', reps?.length ? `${reps.length}건 · ${REPORT_ST[reps[0].status] || '접수됨'}` : '없음');
  repRow.onclick = () => { if (reps?.length) repBox.hidden = !repBox.hidden; };
  const logout = row('↩', '로그아웃', '', null, 'danger');
  logout.onclick = async () => { await sb.auth.signOut(); location.hash = '#/'; };

  show(
    // 1) 프로필 카드 (당근 '나의 당근'처럼 맨 위)
    el('section', { class: 'panel myhead' },
      el('a', { class: 'myhead-top', href: `#/user/${me.id}` }, avatarEl(nick, 'lg'),
        el('div', { class: 'shop-name' }, el('h2', {}, nick || '닉네임 없음'), el('div', { class: 'small' }, [prof?.region || '지역 미정', `가입 ${daysSince(prof?.created_at || Date.now()) + 1}일째`].join(' · '))),
        el('span', { class: 'small more-link' }, '내 상점 ›')),
      isDefaultNick(nick) ? el('a', { class: 'nickbanner', href: '#/nickname', style: 'margin:0' }, el('span', {}, '👋 임시 닉네임이에요. 나만의 닉네임을 정해 주세요'), el('b', {}, '정하기 →')) : '',
      gradeCard(trust, sold.length),
      el('div', { class: 'stats4' }, stat(selling.length, '판매 중', () => draw('selling')), stat(sold.length, '판매완료', () => draw('sold')),
        stat(likedItems.length, '찜', () => draw('liked')), stat(saved.size, '즐겨찾기', () => { location.hash = '#/alerts/star'; }))),
    // 2) 내 상품·찜
    el('section', { class: 'panel' }, tabs, body),
    // 3) 메뉴 목록
    el('section', { class: 'panel mlist' },
      el('h3', {}, '나의 거래'),
      row('🔔', '알림', unreadN ? `새 알림 ${unreadN}` : '', '#/alerts'),
      row('⭐', '키워드 즐겨찾기', saved.size ? `${saved.size}개` : '', '#/alerts/star'),
      row('💬', '채팅', unread.size ? `안 읽음 ${unread.size}` : '', '#/chats'),
      row('🗂️', '내 컬렉션', '가진 세트·시세', '#/collection'),
      repRow, repBox,
      el('h3', {}, '설정'),
      row('⚙️', '계정 설정', '🔒 닉네임·지역·비밀번호', '#/me/settings'),
      row('💡', '판매 꿀팁', '', '#/sellguide'),
      row('🛡️', '안전거래·사기 예방', '', '#/safety'),
      logout));
  draw('selling');
}

// ---- 계정 설정 (2026-10-30): 비밀번호를 한 번 더 확인해야 들어감 ----------------------
// 확인하면 10분 동안 열림 (휴대폰을 잠깐 남이 만져도 닉네임·비밀번호를 못 바꾸게)
// 비밀번호가 없는 옛 계정(인증번호로만 가입)은 메일 인증번호로 확인
let reauthUntil = 0, reauthFails = 0, reauthLockUntil = 0;
async function renderSettings() {
  if (!me) return needLogin();
  if (Date.now() > reauthUntil) return renderReauth();
  const { data: prof } = await sb.from('profiles').select('*').eq('id', me.id).maybeSingle();
  const { form: nickForm } = nickField(prof?.nickname || '');
  const region = el('input', { id: 'meRegion', maxlength: 30, placeholder: '예: 울산 동구', value: prof?.region || '' });
  const st = status();
  const regionForm = el('form', { class: 'nickform' }, el('label', { class: 'f' }, '기본 거래 지역', region), el('div', { class: 'bar' }, el('button', { type: 'submit' }, '지역 저장'), st));
  regionForm.onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.from('profiles').update({ region: region.value.trim() }).eq('id', me.id);
    st.className = 'status' + (error ? ' err' : ''); st.textContent = error ? errMsg(error) : '저장했어요.';
  };
  const np = el('input', { type: 'password', minlength: 8, placeholder: '8자 이상 · 영문·숫자·특수기호 포함', autocomplete: 'new-password' });
  const np2 = el('input', { type: 'password', placeholder: '한 번 더 입력', autocomplete: 'new-password' });
  const pst = status();
  const pwForm = el('form', { class: 'nickform' }, el('label', { class: 'f' }, '새 비밀번호', np, pwChecklist(np)), el('label', { class: 'f' }, '새 비밀번호 확인', np2),
    el('div', { class: 'bar' }, el('button', { type: 'submit' }, '비밀번호 바꾸기'), pst));
  pwForm.onsubmit = async e => {
    e.preventDefault();
    const bad = pwMsg(np.value) || (np.value !== np2.value ? '비밀번호 두 개가 서로 달라요.' : '');
    if (bad) { pst.className = 'status err'; pst.textContent = bad; return; }
    pst.className = 'status'; pst.textContent = '저장하는 중…';
    const { error } = await sb.auth.updateUser({ password: np.value });
    pst.className = 'status' + (error ? ' err' : '');
    pst.textContent = error ? (/different from the old/i.test(error.message) ? '지금 비밀번호와 같아요.' : /password/i.test(error.message) ? '비밀번호가 너무 쉬워요. 더 길게 정해 주세요.' : errMsg(error))
      : '비밀번호를 바꿨어요. 다음부터 새 비밀번호로 로그인하세요.';
    if (!error) { np.value = ''; np2.value = ''; }
  };
  const left = Math.max(1, Math.round((reauthUntil - Date.now()) / 60000));
  const lock = el('button', { type: 'button', class: 'ghost' }, '🔒 지금 잠그기');
  lock.onclick = () => { reauthUntil = 0; location.hash = '#/me'; };
  show(el('section', { class: 'panel settings' },
    el('div', { class: 'bar' }, el('a', { class: 'small', href: '#/me' }, '‹ 나의 리브릭'), el('span', { class: 'grow' }), el('span', { class: 'small' }, `🔓 확인됨 · ${left}분 뒤 다시 잠겨요`), lock),
    el('h2', {}, '⚙️ 계정 설정'),
    el('div', { class: 'set-sec' }, el('h3', {}, '닉네임'), nickForm),
    el('div', { class: 'set-sec' }, el('h3', {}, '거래 지역'), regionForm),
    el('div', { class: 'set-sec' }, el('h3', {}, '비밀번호'), el('p', { class: 'small' }, `로그인 아이디는 이메일(${me.email})이에요.`), pwForm)));
}
function renderReauth() {
  const pw = el('input', { type: 'password', id: 'reauthPw', autocomplete: 'current-password', placeholder: '지금 비밀번호', 'aria-label': '지금 비밀번호' });
  const st = status();
  const btn = el('button', { type: 'submit', class: 'primary' }, '확인');
  const unlock = () => { reauthUntil = Date.now() + 10 * 60000; reauthFails = 0; toast('확인됐어요. 10분 동안 계정 설정을 바꿀 수 있어요.'); renderSettings(); };
  const form = el('form', { class: 'nickform' }, el('label', { class: 'f' }, '비밀번호', pw), el('div', { class: 'bar' }, btn), st);
  form.onsubmit = async e => {
    e.preventDefault();
    if (Date.now() < reauthLockUntil) { st.className = 'status err'; st.textContent = `여러 번 틀려서 잠깐 잠겼어요. ${Math.ceil((reauthLockUntil - Date.now()) / 1000)}초 뒤에 다시 해 주세요.`; return; }
    if (!pw.value) return pw.focus();
    btn.disabled = true; st.className = 'status'; st.textContent = '확인하는 중…';
    const { error } = await sb.auth.signInWithPassword({ email: me.email, password: pw.value });   // 같은 계정으로 다시 로그인 = 본인 확인
    btn.disabled = false;
    if (!error) return unlock();
    if (++reauthFails >= 5) { reauthLockUntil = Date.now() + 60000; reauthFails = 0; }
    st.className = 'status err';
    st.textContent = /invalid login/i.test(error.message) ? '비밀번호가 맞지 않아요. 비밀번호가 없는 계정이면 아래 메일 인증번호로 확인해 주세요.' : errMsg(error);
    pw.select();
  };
  // 비밀번호가 없거나 잊었을 때: 메일 인증번호
  const code = el('input', { inputmode: 'numeric', maxlength: 10, placeholder: '메일로 받은 인증번호', autocomplete: 'one-time-code', 'aria-label': '인증번호' });
  const cst = status();
  const codeForm = el('form', { class: 'nickform', hidden: true }, el('label', { class: 'f' }, '인증번호', code), el('div', { class: 'bar' }, el('button', { type: 'submit', class: 'primary' }, '인증번호 확인')), cst);
  codeForm.onsubmit = async e => {
    e.preventDefault();
    const token = code.value.replace(/\D/g, '');
    if (!token) return code.focus();
    cst.className = 'status'; cst.textContent = '확인하는 중…';
    const { error } = await sb.auth.verifyOtp({ email: me.email, token, type: 'email' });
    if (error) { cst.className = 'status err'; cst.textContent = '번호가 틀렸거나 시간이 지났어요. 메일을 새로 받아 주세요.'; return; }
    unlock();
  };
  const sendBtn = el('button', { type: 'button', class: 'linkbtn' }, '비밀번호가 없거나 잊었어요 → 메일 인증번호로 확인');
  sendBtn.onclick = async () => {
    sendBtn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email: me.email, options: { shouldCreateUser: false } });
    if (error) { sendBtn.disabled = false; toast(errMsg(error), true); return; }
    codeForm.hidden = false; code.focus();
    toast(`${me.email}(으)로 인증번호를 보냈어요.`);
    setTimeout(() => { sendBtn.disabled = false; sendBtn.textContent = '인증번호 다시 받기'; }, 60000);
  };
  show(el('section', { class: 'panel login' },
    el('a', { class: 'small', href: '#/me' }, '‹ 나의 리브릭'),
    el('h2', {}, '🔒 본인 확인'),
    el('p', {}, '닉네임·거래 지역·비밀번호를 바꾸려면 비밀번호를 한 번 더 입력해 주세요. 다른 사람이 내 휴대폰으로 정보를 바꾸지 못하게 하려는 거예요.'),
    el('div', { class: 'small' }, `계정: ${me.email}`),
    form, sendBtn, codeForm));
  pw.focus();
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
  const seen = await seenAll();
  unread = new Set([...rooms].filter(([k, m]) => isNewer(m, seen[k])).map(([k]) => k));
  paintUnread();
  const rows = [...rooms.entries()].map(([k, m]) => {
    const l = byId.get(m.listing_id);
    if (!l) return null;
    const other = l.seller_id === me.id ? m.buyer_id : l.seller_id;
    const isNew = unread.has(k);
    return el('a', { class: 'room' + (isNew ? ' new' : ''), href: `#/chat/${k}` }, el('div', { class: 't' }, thumb(l)),
      el('div', { style: 'min-width:0' }, el('b', {}, `${nick.get(other) || '상대방'} · ${l.name}`), el('div', { class: 'last' }, (m.sender_id === me.id ? '나: ' : '') + m.body)),
      el('span', { class: 'when' }, el('span', { class: 'small' }, new Date(m.created_at).toLocaleDateString('ko-KR')), isNew ? el('span', { class: 'newdot', 'aria-label': '안 읽음' }) : ''));
  }).filter(Boolean);
  show(el('section', { class: 'panel' }, el('h2', {}, '채팅'),
    rows.length ? el('div', { class: 'rooms' }, rows) : el('div', { class: 'empty' }, '아직 채팅이 없어요. 마음에 드는 상품에서 "판매자에게 채팅"을 눌러 보세요.')));
}

// ---- 채팅방 ----------------------------------------------------------------
async function renderChat(listingId, buyerId) {
  if (!me) return needLogin();
  const { data: l, error } = await sb.from('listings').select('id, name, set_no, theme, photos, price, seller_id, status').eq('id', listingId).maybeSingle();
  if (error) throw error;
  if (!l) return show(el('section', { class: 'panel' }, el('h2', {}, '없는 상품이에요')));
  if (l.seller_id === me.id && buyerId === me.id) return show(el('section', { class: 'panel' }, el('h2', {}, '내 상품이에요'), el('p', {}, '구매 희망자가 채팅을 보내면 채팅 목록에 나타나요.')));
  if (me.id !== buyerId && me.id !== l.seller_id) return show(el('section', { class: 'panel' }, el('h2', {}, '이 대화는 볼 수 없어요')));
  const otherId = me.id === l.seller_id ? buyerId : l.seller_id;
  const { data: other } = await sb.from('profiles').select('nickname').eq('id', otherId).maybeSingle();

  const room = `${l.id}/${buyerId}`;
  const box = el('div', { class: 'msgs', role: 'log', 'aria-live': 'polite' });
  // 상대가 입력 중일 때: 리브릭 로고 3개가 차례로 통통 (Realtime broadcast 'typing', DB 안 씀)
  const typing = el('div', { class: 'typing', hidden: true, role: 'status', 'aria-label': `${other?.nickname || '상대방'}님이 입력 중이에요` },
    [0, 1, 2].map(() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<use href="#mark"/>'; return s; }));
  let typingTimer = 0;
  const showTyping = on => {
    clearTimeout(typingTimer);
    typing.hidden = !on;
    if (on) { box.append(typing); box.scrollTop = box.scrollHeight; typingTimer = setTimeout(() => { typing.hidden = true; }, 4000); }
  };
  // 내가 보낸 말 옆 '읽음 / 안읽음' (상대의 chat_reads.read_at 이전에 보낸 말 = 읽음)
  // 상대가 그 뒤에 답장했으면 읽은 것으로 봄 (읽음 기록이 생기기 전 대화도 맞게)
  const mine = [];
  let otherRead = null, otherLast = null;
  const paintReads = () => mine.forEach(x => {
    const at = new Date(x.at), r = (otherRead && at <= otherRead) || (otherLast && at <= otherLast);
    x.tag.textContent = r ? '읽음' : '안읽음';
    x.tag.classList.toggle('unread', !r);
  });
  const seen = new Set();
  const add = m => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    const mineMsg = m.sender_id === me.id;
    const tag = mineMsg ? el('span', { class: 'rd' }) : '';
    box.append(el('div', { class: 'msg' + (mineMsg ? ' me' : '') }, m.body,
      el('time', { datetime: m.created_at }, new Date(m.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }), tag)));
    if (mineMsg) { mine.push({ at: m.created_at, tag }); paintReads(); }
    // 상대가 보낸 말에 사기 신호가 있으면 바로 아래에 주의 안내
    else {
      riskOf(m.body).forEach(w => box.append(el('div', { class: 'msg-warn', role: 'note' }, '⚠️ ' + w)));
      showTyping(false);
      otherLast = new Date(m.created_at); paintReads();
    }
    if (!typing.hidden) box.append(typing);
    box.scrollTop = box.scrollHeight;
  };
  const input = el('input', { id: 'chatInput', maxlength: 1000, placeholder: '메시지를 입력하세요', autocomplete: 'off' });
  let ch = null, lastTyping = 0;
  const sendTyping = stop => ch?.send({ type: 'broadcast', event: 'typing', payload: { u: me.id, stop } });
  input.oninput = () => {
    const now = Date.now();
    if (!input.value.trim()) { if (lastTyping) { sendTyping(true); lastTyping = 0; } return; }
    if (now - lastTyping > 2000) { lastTyping = now; sendTyping(false); }   // 2초에 한 번만
  };
  const st = status();
  const form = el('form', { class: 'send' }, input, el('button', { type: 'submit', class: 'primary' }, '보내기'));
  form.onsubmit = async e => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    lastTyping = 0; sendTyping(true);
    const { data, error } = await sb.from('messages').insert({ listing_id: l.id, buyer_id: buyerId, body }).select().single();
    if (error) { st.className = 'status err'; st.textContent = errMsg(error); input.value = body; return; }
    st.textContent = ''; add(data);
  };
  show(el('section', { class: 'panel chat' },
    el('a', { class: 'room', href: `#/item/${l.id}` }, el('div', { class: 't' }, thumb(l)),
      el('div', { style: 'min-width:0' }, el('b', {}, l.name), el('div', { class: 'small' }, `#${l.set_no} · ${won(l.price)}`)), el('span', { class: 'small' }, '상품 보기')),
    el('h2', {}, el('a', { class: 'seller-name', href: `#/user/${otherId}` }, `${other?.nickname || '상대방'}님`), '과의 대화'),
    // 판매완료된 상품이면 서로 거래 후기
    (() => { if (l.status !== 'sold') return ''; const slot = el('div', {}); reviewBox(l, otherId, other?.nickname || '상대방').then(b => slot.replaceWith(b)); return slot; })(),
    box, form, st,
    el('details', { class: 'checklist' }, el('summary', {}, '🛡️ 거래 전 체크리스트'),
      el('ul', {},
        el('li', {}, '대화는 리브릭 채팅에서만 하세요. 카톡·텔레그램으로 옮기자고 하면 조심하세요.'),
        el('li', {}, '직거래는 사람 많은 공공장소에서, 실물과 구성품을 확인한 뒤 결제하세요.'),
        el('li', {}, '택배거래는 더치트(thecheat.co.kr)에서 계좌·전화번호를 먼저 조회하세요.'),
        el('li', {}, '판매자에게 상품 옆에 오늘 날짜·닉네임 쪽지를 놓고 찍은 사진을 요청하세요.'),
        el('li', {}, '예금주 이름과 판매자 이름이 다르면 거래하지 마세요.'),
        el('li', {}, '안전결제·결제 링크는 누르지 마세요. 리브릭에는 그런 기능이 없어요.')),
      el('a', { href: '#/safety' }, '안전거래 가이드 전체 보기 →'))));

  const [{ data: msgs, error: e2 }, { data: rd }] = await Promise.all([
    sb.from('messages').select('*').eq('listing_id', l.id).eq('buyer_id', buyerId).order('created_at'),
    sb.from('chat_reads').select('read_at').eq('listing_id', l.id).eq('buyer_id', buyerId).eq('user_id', otherId).maybeSingle()]);
  if (e2) throw e2;
  if (rd) otherRead = new Date(rd.read_at);
  msgs.forEach(add);
  markSeen(room);   // 이 방은 읽음
  if (!msgs.length) box.append(el('div', { class: 'hint' }, '첫 메시지를 보내 보세요. 예: "아직 판매 중인가요?"'));
  // 보고 있는 중에 온 말: 화면이 켜져 있으면 바로 읽음, 다른 탭·앱에 가 있으면 돌아왔을 때 읽음
  const readWhenVisible = () => {
    if (!document.hidden) return markSeen(room);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && location.hash === `#/chat/${room}`) markSeen(room); }, { once: true });
  };
  ch = channel = sb.channel(`room-${l.id}-${buyerId}`, { config: { broadcast: { self: false } } })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `listing_id=eq.${l.id}` }, ({ new: m }) => {
      if (m.buyer_id !== buyerId) return;
      add(m);
      if (m.sender_id !== me.id) readWhenVisible();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reads', filter: `listing_id=eq.${l.id}` }, ({ new: r }) => {
      if (r?.buyer_id === buyerId && r.user_id === otherId) { otherRead = new Date(r.read_at); paintReads(); }
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => { if (payload?.u === otherId) showTyping(!payload.stop); })
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
      if (was !== me?.id) {
        route(); checkUnread(); watchInbox(); loadLikes(); loadNotifs(); watchNotifs(); loadSaved();
        // 방금 로그인했는데 임시 닉네임이면 닉네임 정하기 화면으로
        loadMyNick().then(() => { if (!was && me && needNick) location.hash = '#/nickname/' + encodeURIComponent(location.hash && location.hash !== '#/login' ? location.hash : '#/'); });
      }
    });
  }
  renderNav();
  await loadMyNick();
  route();
  checkUnread(); watchInbox(); loadLikes(); loadNotifs(); watchNotifs(); loadSaved();
})();
