import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime


QUESTIONS = [
    ("first_name", "Как тебя зовут?"),
    ("last_name", "Какая у тебя фамилия?"),
    ("age", "Сколько тебе лет?"),
    ("gender", "Укажи пол: Женский, Мужской или Не указан"),
    ("country", "Из какой ты страны?"),
    ("distance", "Выбери дистанцию: 42.2 км, 21.1 км или 10 км"),
    ("email", "Напиши email для регистрации."),
    ("height", "Какой у тебя рост в сантиметрах?"),
    ("weight", "Какой у тебя вес в килограммах?"),
]

DISTANCES = {"42.2 км", "21.1 км", "10 км"}
GENDERS = {"Женский", "Мужской", "Не указан"}
SESSIONS = {}


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
      with open(env_path, "r", encoding="utf-8-sig") as file:
          for line in file:
              line = line.strip()
              if not line or line.startswith("#") or "=" not in line:
                  continue
              key, value = line.split("=", 1)
              os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_env(name):
    value = os.environ.get(name, "").strip()
    if not value or value.startswith("paste_"):
        raise RuntimeError(f"Не заполнена переменная {name} в telegram-bot/.env")
    return value


def validate_env():
    token = require_env("TELEGRAM_BOT_TOKEN")
    require_env("SUPABASE_URL")
    require_env("SUPABASE_SERVICE_ROLE_KEY")
    if not re.match(r"^\d+:[A-Za-z0-9_-]{20,}$", token):
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN выглядит неверно. Вставь токен от BotFather целиком, "
            "без лишнего префикса из примера."
        )


def request_json(url, payload=None, headers=None, method=None):
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method or ("POST" if payload is not None else "GET"),
        headers={
            "Content-Type": "application/json",
            **(headers or {}),
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read().decode("utf-8")
        return json.loads(body) if body else None


def telegram(method, payload=None):
    token = require_env("TELEGRAM_BOT_TOKEN")
    return request_json(f"https://api.telegram.org/bot{token}/{method}", payload)


def send_message(chat_id, text, keyboard=None):
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if keyboard:
        payload["reply_markup"] = {
            "keyboard": keyboard,
            "resize_keyboard": True,
            "one_time_keyboard": True,
        }
    else:
        payload["reply_markup"] = {"remove_keyboard": True}
    telegram("sendMessage", payload)


def supabase_headers():
    key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Prefer": "return=representation",
    }


def supabase_url(path, query=""):
    base = require_env("SUPABASE_URL").rstrip("/")
    return f"{base}/rest/v1/{path}{query}"


def insert_runner(data, user):
    payload = {
        "user_id": None,
        "telegram_user_id": user.get("id"),
        "telegram_username": user.get("username"),
        "source": "telegram",
        "first_name": data["first_name"],
        "last_name": data["last_name"],
        "age": int(data["age"]),
        "gender": data["gender"],
        "country": data["country"],
        "distance": data["distance"],
        "email": data["email"],
        "bmi": float(data["bmi"]),
        "bmi_category": data["bmi_category"],
    }
    return request_json(supabase_url("runners"), [payload], supabase_headers())


def get_runner_count():
    headers = {
        **supabase_headers(),
        "Range": "0-0",
        "Prefer": "count=exact",
    }
    req = urllib.request.Request(
        supabase_url("runners", "?select=id"),
        headers=headers,
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        content_range = response.headers.get("content-range", "0-0/0")
        return content_range.rsplit("/", 1)[-1]


def calculate_bmi(height_cm, weight_kg):
    value = float(weight_kg) / ((float(height_cm) / 100) ** 2)
    category = "Норма"
    if value < 18.5:
        category = "Недостаточный вес"
    if value >= 25:
        category = "Избыточный вес"
    if value >= 30:
        category = "Ожирение"
    return round(value, 1), category


def next_marathon_days():
    now = datetime.now()
    target = datetime(now.year, 6, 15, 9, 0, 0)
    if target <= now:
        target = datetime(now.year + 1, 6, 15, 9, 0, 0)
    return (target - now).days


def validate(field, text):
    text = text.strip()
    if field in {"first_name", "last_name", "country"} and len(text) < 2:
        return None, "Нужно минимум 2 символа."
    if field == "age":
        if not text.isdigit() or not 12 <= int(text) <= 100:
            return None, "Возраст должен быть числом от 12 до 100."
    if field == "gender" and text not in GENDERS:
        return None, "Выбери вариант: Женский, Мужской или Не указан."
    if field == "distance" and text not in DISTANCES:
        return None, "Выбери дистанцию: 42.2 км, 21.1 км или 10 км."
    if field == "email":
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", text):
            return None, "Похоже, это не email. Напиши в формате name@example.com."
    if field == "height":
        if not text.isdigit() or not 80 <= int(text) <= 230:
            return None, "Рост должен быть числом от 80 до 230 см."
    if field == "weight":
        try:
            weight = float(text.replace(",", "."))
        except ValueError:
            return None, "Вес должен быть числом."
        if not 25 <= weight <= 250:
            return None, "Вес должен быть от 25 до 250 кг."
        text = str(weight)
    return text, None


def question_keyboard(field):
    if field == "gender":
        return [["Женский", "Мужской"], ["Не указан"]]
    if field == "distance":
        return [["42.2 км"], ["21.1 км", "10 км"]]
    return None


def start_registration(chat_id):
    SESSIONS[chat_id] = {"step": 0, "data": {}}
    field, question = QUESTIONS[0]
    send_message(chat_id, f"Отлично, начнём регистрацию.\n\n{question}", question_keyboard(field))


def handle_registration(chat_id, text, user):
    session = SESSIONS.get(chat_id)
    if not session:
        return False

    field, _question = QUESTIONS[session["step"]]
    value, error = validate(field, text)
    if error:
        send_message(chat_id, error, question_keyboard(field))
        return True

    session["data"][field] = value
    session["step"] += 1

    if session["step"] < len(QUESTIONS):
        next_field, question = QUESTIONS[session["step"]]
        send_message(chat_id, question, question_keyboard(next_field))
        return True

    data = session["data"]
    bmi, category = calculate_bmi(data["height"], data["weight"])
    data["bmi"] = bmi
    data["bmi_category"] = category

    try:
        insert_runner(data, user)
    except urllib.error.HTTPError as error_response:
        message = error_response.read().decode("utf-8", errors="replace")
        send_message(chat_id, f"Не смог сохранить в Supabase.\n\n<code>{message}</code>")
        return True
    except Exception as error:
        send_message(chat_id, f"Не смог сохранить в Supabase: {error}")
        return True

    SESSIONS.pop(chat_id, None)
    site_url = os.environ.get("SITE_URL", "").strip()
    site_line = f"\n\nСписок участников: {site_url}" if site_url else ""
    send_message(
        chat_id,
        "Готово, ты зарегистрирован!\n\n"
        f"BMI: <b>{bmi}</b>\n"
        f"Категория: <b>{category}</b>\n"
        f"Дистанция: <b>{data['distance']}</b>"
        f"{site_line}",
    )
    return True


def handle_command(chat_id, text):
    if text in {"/start", "/help"}:
        send_message(
            chat_id,
            "Привет! Я бот Marathon Skills.\n\n"
            "/register - регистрация на марафон\n"
            "/bmi - быстрый калькулятор BMI\n"
            "/countdown - сколько дней до марафона\n"
            "/stats - сколько участников в базе\n"
            "/tip - короткий совет для подготовки\n"
            "/cancel - отменить текущий диалог",
        )
        return True
    if text == "/register":
        start_registration(chat_id)
        return True
    if text == "/bmi":
        SESSIONS[chat_id] = {"mode": "quick_bmi", "step": 0, "data": {}}
        send_message(chat_id, "Быстрый BMI. Напиши рост в сантиметрах.")
        return True
    if text == "/countdown":
        send_message(chat_id, f"До марафона осталось примерно <b>{next_marathon_days()}</b> дней.")
        return True
    if text == "/stats":
        try:
            count = get_runner_count()
            send_message(chat_id, f"Сейчас в базе <b>{count}</b> участников.")
        except Exception as error:
            send_message(chat_id, f"Не смог получить статистику: {error}")
        return True
    if text == "/tip":
        tips = [
            "Не увеличивай недельный объём резко. Спокойный прогресс лучше героического рывка.",
            "За день до старта проверь обувь, номер, воду и маршрут до места старта.",
            "На длинных пробежках тренируй питание, которое планируешь использовать на марафоне.",
            "Первые километры лучше начать чуть спокойнее, чем хочется.",
        ]
        send_message(chat_id, tips[int(time.time()) % len(tips)])
        return True
    if text == "/cancel":
        SESSIONS.pop(chat_id, None)
        send_message(chat_id, "Ок, текущий диалог отменён.")
        return True
    return False


def handle_quick_bmi(chat_id, text):
    session = SESSIONS.get(chat_id)
    if not session or session.get("mode") != "quick_bmi":
        return False
    if session["step"] == 0:
        value, error = validate("height", text)
        if error:
            send_message(chat_id, error)
            return True
        session["data"]["height"] = value
        session["step"] = 1
        send_message(chat_id, "Теперь напиши вес в килограммах.")
        return True
    value, error = validate("weight", text)
    if error:
        send_message(chat_id, error)
        return True
    bmi, category = calculate_bmi(session["data"]["height"], value)
    SESSIONS.pop(chat_id, None)
    send_message(chat_id, f"Твой BMI: <b>{bmi}</b>\nКатегория: <b>{category}</b>")
    return True


def handle_update(update):
    message = update.get("message") or {}
    text = (message.get("text") or "").strip()
    chat = message.get("chat") or {}
    user = message.get("from") or {}
    chat_id = chat.get("id")
    if not chat_id or not text:
        return

    if text.startswith("/") and handle_command(chat_id, text.split()[0]):
        return
    if handle_quick_bmi(chat_id, text):
        return
    if handle_registration(chat_id, text, user):
        return
    send_message(chat_id, "Я не понял команду. Напиши /help, чтобы увидеть возможности.")


def main():
    load_env()
    validate_env()
    print("Telegram bot started. Press Ctrl+C to stop.")
    offset = 0
    while True:
        try:
            result = telegram("getUpdates", {"timeout": 30, "offset": offset})
            for update in result.get("result", []):
                offset = update["update_id"] + 1
                handle_update(update)
        except KeyboardInterrupt:
            print("Stopped.")
            break
        except Exception as error:
            print(f"Bot error: {error}")
            time.sleep(5)


if __name__ == "__main__":
    main()
