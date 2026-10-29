// Supabase 프로젝트 정보 — 대시보드 Project Settings → API 에서 복사해 넣으세요.
// anon(public) 키는 원래 공개용이라 사이트에 넣어도 돼요. service_role 키는 절대 여기 넣지 마세요.
window.BRICK_CONFIG = {
  url: 'https://yhxvcydpwrqsyrphhigs.supabase.co',
  anonKey: 'sb_publishable_EMC5DQR1ou2XFr4KoXsrrg_FS5zsrd1',
  // 로그인 메일에 인증번호({{ .Token }})를 넣은 뒤 true로 (메일 문구는 Supabase에서 SMTP를 설정해야 고칠 수 있음)
  otpCode: true,   // 2026-10-29 SMTP(rebrick02@gmail.com) + 메일 템플릿에 인증번호 넣음
  otpLength: 8,    // Supabase Sign In / Providers → Email → Email OTP length 와 같게
};
