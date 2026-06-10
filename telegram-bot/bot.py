import json
import os
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime


BTN_REGISTER = "Регистрация"
BTN_BMI = "BMI калькулятор"
BTN_STATS = "Участники"
BTN_COUNTDOWN = "До марафона"
BTN_TIP = "Совет"
BTN_SITE = "Сайт"
BTN_HELP = "Помощь"
BTN_CANCEL = "Отмена"
BTN_BACK = "Назад"

QUESTIONS = [
    ("first_name", "Как тебя зовут?", "Например: Анна"),
    ("last_name", "Какая у тебя фамилия?", "Например: Петрова"),
    ("age", "Сколько тебе лет?", "Возраст от 12 до 100"),
    ("gender", "Выбери пол", "Нажми одну из кнопок ниже"),
    ("country", "Из какой ты страны?", "Например: Казахстан"),
    ("distance", "Выбери дистанцию", "42.2 км, 21.1 км или 10 км"),
    ("email", "Напиши email для регистрации", "Например: name@example.com"),
    ("height", "Какой у тебя рост?", "В сантиметрах, например: 178"),
    ("weight", "Какой у тебя вес?", "В килограммах, например: 72.5"),
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


def reply_keyboard(rows, one_time=False):
    return {
        "keyboard": [[{"text": label} for label in row] for row in rows],
        "resize_keyboard": True,
        "one_time_keyboard": one_time,
        "input_field_placeholder": "Выбери действие",
    }


def inline_keyboard(rows):
    return {"inline_keyboard": rows}


def main_menu_keyboard():
    return reply_keyboard(
        [
            [BTN_REGISTER, BTN_BMI],
            [BTN_STATS, BTN_COUNTDOWN],
            [BTN_TIP, BTN_SITE],
            [BTN_HELP],
        ]
    )


def flow_keyboard(field=None, allow_back=True):
    rows = []
    if field == "gender":
        rows.extend([["Женский", "Мужской"], ["Не указан"]])
    elif field == "distance":
        rows.extend([["42.2 км"], ["21.1 км", "10 км"]])

    controls = []
    if allow_back:
        controls.append(BTN_BACK)
    controls.append(BTN_CANCEL)
    rows.append(controls)
    return reply_keyboard(rows, one_time=False)


def send_message(chat_id, text, reply_markup=None):
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    telegram("sendMessage", payload)


def send_main_menu(chat_id, text=None):
    send_message(
        chat_id,
        text
        or (
            "<b>Marathon Skills</b>\n"
            "Выбери действие в меню ниже. Бот поможет зарегистрироваться, "
            "посчитать BMI и посмотреть данные марафона."
        ),
        main_menu_keyboard(),
    )


def send_site_button(chat_id):
    site_url = os.environ.get("SITE_URL", "").strip()
    if not site_url:
        send_message(chat_id, "SITE_URL не заполнен в .env.", main_menu_keyboard())
        return
    send_message(
        chat_id,
        "<b>Сайт Marathon Skills</b>\nОткрой список участников и таймер марафона.",
        inline_keyboard([[{"text": "Открыть сайт", "url": site_url}]]),
    )


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


def normalize_choice(text):
    aliases = {
        "42.2": "42.2 км",
        "42": "42.2 км",
        "21.1": "21.1 км",
        "21": "21.1 км",
        "10": "10 км",
        "ж": "Женский",
        "женский": "Женский",
        "м": "Мужской",
        "мужской": "Мужской",
        "не указан": "Не указан",
    }
    return aliases.get(text.strip().lower(), text.strip())


def validate(field, text):
    text = normalize_choice(text)

    if field in {"first_name", "last_name", "country"} and len(text) < 2:
        return None, "Нужно минимум 2 символа."

    if field == "age":
        if not text.isdigit() or not 12 <= int(text) <= 100:
            return None, "Возраст должен быть числом от 12 до 100."

    if field == "gender" and text not in GENDERS:
        return None, "Выбери вариант кнопкой: Женский, Мужской или Не указан."

    if field == "distance" and text not in DISTANCES:
        return None, "Выбери дистанцию кнопкой: 42.2 км, 21.1 км или 10 км."

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


def progress_bar(step, total):
    done = "■" * step
    left = "□" * (total - step)
    return done + left


def ask_registration_question(chat_id):
    session = SESSIONS[chat_id]
    step = session["step"]
    field, question, hint = QUESTIONS[step]
    total = len(QUESTIONS)
    text = (
        f"<b>Регистрация</b>\n"
        f"Шаг {step + 1}/{total}: {progress_bar(step + 1, total)}\n\n"
        f"<b>{question}</b>\n"
        f"{hint}"
    )
    send_message(chat_id, text, flow_keyboard(field, allow_back=step > 0))


def start_registration(chat_id):
    SESSIONS[chat_id] = {"mode": "register", "step": 0, "data": {}}
    ask_registration_question(chat_id)


def handle_back(chat_id):
    session = SESSIONS.get(chat_id)
    if not session:
        send_main_menu(chat_id)
        return True
    if session["step"] > 0:
        session["step"] -= 1
        ask_current_question(chat_id)
    else:
        send_main_menu(chat_id, "Ты уже на первом шаге.")
    return True


def ask_current_question(chat_id):
    session = SESSIONS.get(chat_id)
    if not session:
        send_main_menu(chat_id)
    elif session.get("mode") == "register":
        ask_registration_question(chat_id)
    elif session.get("mode") == "quick_bmi":
        ask_bmi_question(chat_id)


def complete_registration(chat_id, user):
    data = SESSIONS[chat_id]["data"]
    bmi, category = calculate_bmi(data["height"], data["weight"])
    data["bmi"] = bmi
    data["bmi_category"] = category

    try:
        insert_runner(data, user)
    except urllib.error.HTTPError as error_response:
        message = error_response.read().decode("utf-8", errors="replace")
        send_message(
            chat_id,
            f"<b>Не смог сохранить в Supabase</b>\n\n<code>{message}</code>",
            main_menu_keyboard(),
        )
        return True
    except Exception as error:
        send_message(chat_id, f"Не смог сохранить в Supabase: {error}", main_menu_keyboard())
        return True

    SESSIONS.pop(chat_id, None)
    result = (
        "<b>Регистрация завершена</b>\n\n"
        f"Участник: <b>{data['first_name']} {data['last_name']}</b>\n"
        f"Дистанция: <b>{data['distance']}</b>\n"
        f"BMI: <b>{bmi}</b>\n"
        f"Категория: <b>{category}</b>\n\n"
        "Данные уже отправлены в Supabase и появятся на сайте."
    )
    send_message(
        chat_id,
        result,
        reply_keyboard([[BTN_SITE, BTN_REGISTER], [BTN_BMI, BTN_STATS], [BTN_HELP]]),
    )
    return True


def handle_registration(chat_id, text, user):
    session = SESSIONS.get(chat_id)
    if not session or session.get("mode") != "register":
        return False

    if text == BTN_CANCEL:
        SESSIONS.pop(chat_id, None)
        send_main_menu(chat_id, "Регистрация отменена.")
        return True

    if text == BTN_BACK:
        return handle_back(chat_id)

    field, _question, _hint = QUESTIONS[session["step"]]
    value, error = validate(field, text)
    if error:
        send_message(chat_id, error, flow_keyboard(field, allow_back=session["step"] > 0))
        return True

    session["data"][field] = value
    session["step"] += 1

    if session["step"] < len(QUESTIONS):
        ask_registration_question(chat_id)
        return True

    return complete_registration(chat_id, user)


def ask_bmi_question(chat_id):
    session = SESSIONS[chat_id]
    if session["step"] == 0:
        send_message(
            chat_id,
            "<b>BMI калькулятор</b>\n\nНапиши рост в сантиметрах.",
            flow_keyboard(allow_back=False),
        )
    else:
        send_message(
            chat_id,
            "<b>BMI калькулятор</b>\n\nТеперь напиши вес в килограммах.",
            flow_keyboard(allow_back=True),
        )


def start_quick_bmi(chat_id):
    SESSIONS[chat_id] = {"mode": "quick_bmi", "step": 0, "data": {}}
    ask_bmi_question(chat_id)


def handle_quick_bmi(chat_id, text):
    session = SESSIONS.get(chat_id)
    if not session or session.get("mode") != "quick_bmi":
        return False

    if text == BTN_CANCEL:
        SESSIONS.pop(chat_id, None)
        send_main_menu(chat_id, "BMI калькулятор закрыт.")
        return True

    if text == BTN_BACK:
        session["step"] = 0
        session["data"].pop("height", None)
        ask_bmi_question(chat_id)
        return True

    if session["step"] == 0:
        value, error = validate("height", text)
        if error:
            send_message(chat_id, error, flow_keyboard(allow_back=False))
            return True
        session["data"]["height"] = value
        session["step"] = 1
        ask_bmi_question(chat_id)
        return True

    value, error = validate("weight", text)
    if error:
        send_message(chat_id, error, flow_keyboard(allow_back=True))
        return True

    bmi, category = calculate_bmi(session["data"]["height"], value)
    SESSIONS.pop(chat_id, None)
    send_message(
        chat_id,
        f"<b>Результат BMI</b>\n\nBMI: <b>{bmi}</b>\nКатегория: <b>{category}</b>",
        reply_keyboard([[BTN_REGISTER, BTN_BMI], [BTN_SITE, BTN_HELP]]),
    )
    return True


def send_stats(chat_id):
    try:
        count = get_runner_count()
        send_message(
            chat_id,
            f"<b>Участники</b>\n\nСейчас в базе: <b>{count}</b>",
            reply_keyboard([[BTN_REGISTER, BTN_SITE], [BTN_BMI, BTN_HELP]]),
        )
    except Exception as error:
        send_message(chat_id, f"Не смог получить статистику: {error}", main_menu_keyboard())


def send_countdown(chat_id):
    days = next_marathon_days()
    send_message(
        chat_id,
        f"<b>До марафона</b>\n\nДо 15 июня осталось примерно <b>{days}</b> дней.",
        reply_keyboard([[BTN_REGISTER, BTN_TIP], [BTN_SITE, BTN_HELP]]),
    )


def send_tip(chat_id):
    tips = [
        "Не увеличивай недельный объём резко. Спокойный прогресс лучше резкого рывка.",
        "За день до старта проверь обувь, номер, воду и маршрут до места старта.",
        "На длинных пробежках тренируй питание, которое планируешь использовать на марафоне.",
        "Первые километры лучше начать чуть спокойнее, чем хочется.",
        "После тяжёлой тренировки запланируй восстановление так же серьёзно, как саму тренировку.",
        "Лучший темп на старте — тот, который ты сможешь уважать и после середины дистанции.",
    ]
    send_message(chat_id, f"<b>Совет для подготовки</b>\n\n{random.choice(tips)}", main_menu_keyboard())


def send_help(chat_id):
    send_message(
        chat_id,
        "<b>Что умеет бот</b>\n\n"
        "Регистрация — задаёт вопросы и сохраняет участника в Supabase.\n"
        "BMI калькулятор — быстро считает индекс массы тела.\n"
        "Участники — показывает количество записей в базе.\n"
        "До марафона — считает дни до 15 июня.\n"
        "Сайт — даёт ссылку на Vercel-страницу.\n\n"
        "Текстовые команды тоже работают: /register, /bmi, /stats, /countdown, /tip, /cancel.",
        main_menu_keyboard(),
    )


def cancel_flow(chat_id):
    SESSIONS.pop(chat_id, None)
    send_main_menu(chat_id, "Текущий диалог отменён.")


def handle_menu_action(chat_id, text):
    command_map = {
        "/start": BTN_HELP,
        "/help": BTN_HELP,
        "/register": BTN_REGISTER,
        "/bmi": BTN_BMI,
        "/stats": BTN_STATS,
        "/countdown": BTN_COUNTDOWN,
        "/tip": BTN_TIP,
        "/cancel": BTN_CANCEL,
    }
    action = command_map.get(text, text)

    if action == BTN_REGISTER:
        start_registration(chat_id)
        return True
    if action == BTN_BMI:
        start_quick_bmi(chat_id)
        return True
    if action == BTN_STATS:
        send_stats(chat_id)
        return True
    if action == BTN_COUNTDOWN:
        send_countdown(chat_id)
        return True
    if action == BTN_TIP:
        send_tip(chat_id)
        return True
    if action == BTN_SITE:
        send_site_button(chat_id)
        send_main_menu(chat_id, "Меню осталось здесь, можно продолжать.")
        return True
    if action == BTN_HELP:
        send_help(chat_id)
        return True
    if action == BTN_CANCEL:
        cancel_flow(chat_id)
        return True
    return False


def handle_callback_query(update):
    callback = update.get("callback_query") or {}
    if not callback:
        return False
    telegram("answerCallbackQuery", {"callback_query_id": callback["id"]})
    return True


def handle_update(update):
    if handle_callback_query(update):
        return

    message = update.get("message") or {}
    text = (message.get("text") or "").strip()
    chat = message.get("chat") or {}
    user = message.get("from") or {}
    chat_id = chat.get("id")
    if not chat_id or not text:
        return

    if handle_registration(chat_id, text, user):
        return
    if handle_quick_bmi(chat_id, text):
        return
    if handle_menu_action(chat_id, text):
        return

    send_message(
        chat_id,
        "Я не понял действие. Выбери кнопку из меню или нажми Помощь.",
        main_menu_keyboard(),
    )


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
