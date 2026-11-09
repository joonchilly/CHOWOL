# 초월 (CHOWOL)

우리 여섯 명만 쓰는 작은 SNS. GitHub Pages에서 웹앱(PWA)으로 돌아가고, 데이터는 Firebase(구글 로그인 + Firestore)에 저장돼요.

- 주소: https://joonchilly.github.io/CHOWOL/
- 홈 화면에 추가하면 로고 아이콘으로, 주소창 없이 앱처럼 열려요.
- 친구 초대: 방장 계정으로 로그인 → 내 프로필 → 앱 꾸미기 → 맨 아래 "들어올 수 있는 친구"에 구글 이메일 추가.
- 보안 규칙: `firestore.rules` 내용을 Firebase 콘솔 → Firestore Database → 규칙에 붙여 넣고 게시.

파일: `index.html`(앱 전체), `intro.mp4`(인트로 영상), `manifest.webmanifest`·아이콘(홈 화면 앱), `sw.js`(오프라인 대비).
