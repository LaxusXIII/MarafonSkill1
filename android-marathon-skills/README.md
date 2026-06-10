# Marathon Skills Android

Native Android Studio app for Marathon Skills.

## What it does

- Shows marathon home screen and countdown
- Registers runners
- Calculates BMI
- Saves Android registrations to Supabase with `source = android`
- Loads participants from the same Supabase table used by the website and Telegram bot

## Setup

1. Open `android-marathon-skills` in Android Studio.
2. Let Gradle sync.
3. Run `supabase-android-migration.sql` in Supabase SQL Editor.
4. Run the app on an emulator or Samsung device.

Recommended Vercel/Supabase flow:

- Website writes `source = site`
- Telegram bot writes `source = telegram`
- Android app writes `source = android`

Do not put Supabase service-role keys into Android apps. This app uses the publishable key only.
