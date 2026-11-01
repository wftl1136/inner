# inner — только твои люди

Закрытая соцсеть-мессенджер: лента круга (до 150 человек), истории на 24 часа, посты с фото, лайки, комментарии, репосты и пересылка, личные чаты в реальном времени, голосовые и видеозвонки (LiveKit), светлая и тёмная тема, 5 языков (українська, русский, English, latviešu, български). Работает как приложение на iPhone, Android и ПК (PWA).

## Стек
- **Next.js** (веб + PWA), хостинг **Vercel**
- **Supabase** — регистрация, база Postgres с защитой на уровне строк (RLS), realtime, хранилище фото
- **LiveKit Cloud** — звонки: адаптивное качество, simulcast, кодек VP9, Opus с DTX/RED — экономно по трафику и батарее

## Запуск (один раз)
1. **Supabase → SQL Editor → New query** → вставь целиком `supabase/schema.sql` → **Run**.
2. **Supabase → Authentication → Sign In / Providers → Email** → выключи «Confirm email» (для теста).
3. **Supabase → Authentication → URL Configuration** → Site URL = адрес сайта на Vercel.
4. **Vercel → Add New → Project** → импортируй этот репозиторий → **Environment Variables**:
   - `LIVEKIT_API_KEY` — из LiveKit (Settings → API Keys)
   - `LIVEKIT_API_SECRET` — оттуда же
   
   Публичные значения уже лежат в `.env.production`.
5. **Deploy**. Готово — открывай ссылку.

## Как позвать друзей
Профиль → «Пригласить в круг» → отправь ссылку. Друг регистрируется по ней и сразу отправляет тебе запрос в круг. На iPhone: Safari → «Поделиться» → «На экран Домой».

## Локально
```bash
npm install
npm run dev
```
Для звонков локально создай `.env.local` с `LIVEKIT_API_KEY` и `LIVEKIT_API_SECRET`.

## Что дальше
- Нативные приложения iOS/Android (Expo) и пуш-уведомления о звонках
- Фото и голосовые в чатах, групповые чаты и групповые звонки
- Подписка inner+ (Stripe / App Store)
- Приватное хранилище фото с подписанными ссылками
