# Telegram bot for Marathon Skills

Bot features:

- Step-by-step marathon registration
- BMI calculator
- Supabase database insert
- Participant count from Supabase
- Countdown to June 15
- Training tips

## Setup

1. Create a bot in Telegram via `@BotFather` and copy the bot token.
2. Copy `.env.example` to `.env`.
3. Fill:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SITE_URL`
4. Run `start-bot.bat`.

Keep `SUPABASE_SERVICE_ROLE_KEY` private. Do not commit `.env` to GitHub.

