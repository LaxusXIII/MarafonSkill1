# Финальные доработки Marathon Skills

## 1. Telegram-уведомления

В Vercel добавьте переменные окружения:

- `TELEGRAM_BOT_TOKEN` - токен бота от BotFather
- `TELEGRAM_ADMIN_CHAT_ID` - chat id администратора или группы
- `TELEGRAM_WEBHOOK_SECRET` - любая длинная случайная строка
- `SUPABASE_URL` - URL проекта Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - service role key, только на сервере
- `TELEGRAM_STATS_SECRET` - секрет для ежедневной статистики

После деплоя в Supabase откройте Database Webhooks и создайте webhook:

- Table: `public.runners`
- Events: `Insert`, `Update`, `Delete`
- Method: `POST`
- URL: `https://YOUR-VERCEL-DOMAIN/api/telegram-notify`
- Header: `x-webhook-secret: значение TELEGRAM_WEBHOOK_SECRET`

Endpoint автоматически отправит админу сообщение о добавлении, изменении или удалении записи.

## 2. Ежедневная статистика

Для ручной проверки откройте endpoint:

```text
POST https://YOUR-VERCEL-DOMAIN/api/telegram-daily-stats
Authorization: Bearer значение TELEGRAM_STATS_SECRET
```

Для автоматической отправки раз в день можно подключить Vercel Cron, cron-job.org или Supabase Scheduled Edge Function, которая вызывает этот URL.

## 3. CSV экспорт и импорт

В админ-панели появились кнопки:

- `CSV` - выгружает текущий список с учетом фильтра источника
- `Импорт CSV` - загружает много участников одним файлом

Минимальные колонки для импорта:

```csv
first_name,last_name,age,gender,country,distance,email,bmi,bmi_category,source
Анна,Петрова,28,Женский,Казахстан,10 км,anna@example.com,22.4,Норма,site
```

Колонка `source` необязательна. Импорт из веб-админки сохраняет строки как `site`, чтобы они проходили текущие правила Supabase.

## 4. ИИ-чат

В Vercel добавьте:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` - необязательно, по умолчанию используется `gemini-1.5-flash`

На сайте появилась страница `ИИ-чат`. Браузер обращается к `/api/ai-chat`, поэтому ключ Gemini не попадает в клиентский код.
