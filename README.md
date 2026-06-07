# (selah)

`(selah)`는 예배 준비, 콘티, 찬양 라이브러리, 말씀 본문, 악보, PPT 산출물을 한 흐름으로 맞추는 예배 준비 워크스페이스입니다.

예배 준비를 한 흐름으로 맞추는 예배 준비 워크스페이스입니다.

## 주요 기능

- 주차별 예배 준비 데이터 조회
- Discord 예배 준비 스레드 생성, 메시지 파싱, 역할 선택 연동
- 콘티 생성, 수정, YouTube playlist 기반 곡 가져오기
- 찬양 라이브러리, 악보, 프리셋, 키/템포/섹션/가사 관리
- 말씀 본문 미리보기와 예배 PPT 내보내기
- 콘티별 PPT/PDF 산출물 준비

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Drizzle ORM
- Neon / Turso
- Vercel Blob / Cloudflare R2
- Vercel Cron

## 시작하기

```bash
pnpm install
pnpm dev
```

개발 서버는 기본적으로 [http://localhost:3000](http://localhost:3000)에서 실행됩니다.

## 환경 변수

필요한 값은 `.env.example`을 기준으로 설정합니다. 서버에서 생성하는 Discord 알림 링크에는 `APP_BASE_URL`이 필요합니다.

```bash
cp .env.example .env.local
```

주요 환경 변수:

- `AUTH_PASSWORD`, `AUTH_SECRET`: 공유 비밀번호 로그인
- `APP_BASE_URL`: 배포된 앱의 canonical URL
- `DATABASE_PROVIDER`: `neon` 또는 `turso`
- `STORAGE_PROVIDER`: `vercel-blob` 또는 `cloudflare-r2`
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`, `GOOGLE_DRIVE_TEMPLATE_FOLDER_ID`: Google Sheets/Drive/PPTX 연동
- `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`, `DISCORD_GUILD_ID`, `DISCORD_PUBLIC_KEY`: Discord 연동
- `CRON_SECRET`: Vercel Cron 인증

## 명령어

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm db:turso:generate
pnpm db:turso:push
```

## 브랜딩

사용자-facing 제품명은 `(selah)`입니다. 기존 `storyboard` 이름은 일부 migration script와 내부 repository 경계에 남아 있을 수 있으며, 운영 리소스 rename이 필요한 시점에 별도 작업으로 정리합니다.
