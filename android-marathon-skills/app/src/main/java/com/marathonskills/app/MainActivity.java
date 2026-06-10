package com.marathonskills.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

public class MainActivity extends Activity {
    private static final String SUPABASE_URL = "https://tnemuuatywkaafvhyeqg.supabase.co";
    private static final String SUPABASE_KEY = "sb_publishable_MuvoR47fRfof9h3S5nwWFw_VoqUvDc-";

    private static final int INK = Color.rgb(24, 32, 40);
    private static final int MUTED = Color.rgb(99, 112, 131);
    private static final int BG = Color.rgb(244, 247, 249);
    private static final int BLUE = Color.rgb(11, 111, 179);
    private static final int GREEN = Color.rgb(31, 138, 85);
    private static final int CORAL = Color.rgb(228, 95, 67);
    private static final int LINE = Color.rgb(216, 224, 231);

    private final Handler handler = new Handler(Looper.getMainLooper());
    private FrameLayout content;
    private TextView countdown;
    private final DecimalFormat bmiFormat = new DecimalFormat("0.0");

    private EditText firstNameInput;
    private EditText lastNameInput;
    private EditText ageInput;
    private EditText countryInput;
    private EditText emailInput;
    private EditText heightInput;
    private EditText weightInput;
    private Spinner genderSpinner;
    private Spinner distanceSpinner;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildShell();
        showHome();
        startCountdown();
    }

    private void buildShell() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(dp(20), dp(18), dp(20), dp(12));
        header.setBackgroundColor(INK);

        TextView title = text("Marathon Skills", 26, Color.WHITE, true);
        TextView subtitle = text("Samsung S25 FE ready • Supabase sync", 13, Color.rgb(206, 214, 224), false);
        header.addView(title);
        header.addView(subtitle);

        LinearLayout nav = new LinearLayout(this);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        nav.setGravity(Gravity.CENTER);
        nav.setPadding(dp(8), dp(10), dp(8), dp(10));
        nav.setBackgroundColor(Color.WHITE);
        nav.addView(navButton("Главная", v -> showHome()));
        nav.addView(navButton("Регистрация", v -> showRegistration()));
        nav.addView(navButton("BMI", v -> showBmiOnly()));
        nav.addView(navButton("Участники", v -> showParticipants()));

        content = new FrameLayout(this);
        LinearLayout.LayoutParams contentParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1
        );

        countdown = text("До марафона: --", 16, Color.WHITE, true);
        countdown.setGravity(Gravity.CENTER);
        countdown.setPadding(dp(16), dp(14), dp(16), dp(14));
        countdown.setBackgroundColor(INK);

        root.addView(header);
        root.addView(nav);
        root.addView(content, contentParams);
        root.addView(countdown);
        setContentView(root);
    }

    private Button navButton(String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(12);
        button.setTextColor(INK);
        button.setAllCaps(false);
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setOnClickListener(listener);
        button.setPadding(dp(2), 0, dp(2), 0);
        button.setSingleLine(false);
        button.setGravity(Gravity.CENTER);
        button.setLayoutParams(new LinearLayout.LayoutParams(0, dp(48), 1));
        return button;
    }

    private void setPage(View view) {
        content.removeAllViews();
        content.addView(view);
    }

    private ScrollView scrollPage() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(18), dp(18), dp(18), dp(24));
        scroll.addView(body);
        return scroll;
    }

    private LinearLayout scrollBody(ScrollView scroll) {
        return (LinearLayout) scroll.getChildAt(0);
    }

    private void showHome() {
        ScrollView scroll = scrollPage();
        LinearLayout body = scrollBody(scroll);
        body.addView(card(
                "15 июня каждый год",
                "Marathon Skills",
                "Регистрируйся на марафон, считай BMI и смотри общий список участников. Все данные синхронизируются с Supabase и сайтом."
        ));
        body.addView(statRow("42.2 км", "классическая дистанция"));
        body.addView(statRow("21.1 км", "полумарафон"));
        body.addView(statRow("10 км", "городской забег"));
        body.addView(primaryButton("Зарегистрироваться", v -> showRegistration()));
        body.addView(secondaryButton("Список участников", v -> showParticipants()));
        setPage(scroll);
    }

    private void showRegistration() {
        ScrollView scroll = scrollPage();
        LinearLayout body = scrollBody(scroll);
        body.addView(sectionTitle("Регистрация бегуна"));

        firstNameInput = input("Имя", InputType.TYPE_CLASS_TEXT);
        lastNameInput = input("Фамилия", InputType.TYPE_CLASS_TEXT);
        ageInput = input("Возраст", InputType.TYPE_CLASS_NUMBER);
        countryInput = input("Страна", InputType.TYPE_CLASS_TEXT);
        emailInput = input("Email", InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        heightInput = input("Рост, см", InputType.TYPE_CLASS_NUMBER);
        weightInput = input("Вес, кг", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        genderSpinner = spinner(new String[]{"Женский", "Мужской", "Не указан"});
        distanceSpinner = spinner(new String[]{"42.2 км", "21.1 км", "10 км"});

        body.addView(labeled("Имя", firstNameInput));
        body.addView(labeled("Фамилия", lastNameInput));
        body.addView(labeled("Возраст", ageInput));
        body.addView(labeled("Пол", genderSpinner));
        body.addView(labeled("Страна", countryInput));
        body.addView(labeled("Дистанция", distanceSpinner));
        body.addView(labeled("Email", emailInput));
        body.addView(labeled("Рост", heightInput));
        body.addView(labeled("Вес", weightInput));
        body.addView(primaryButton("Сохранить участника", v -> saveRegistration()));
        setPage(scroll);
    }

    private void saveRegistration() {
        try {
            String firstName = value(firstNameInput);
            String lastName = value(lastNameInput);
            int age = Integer.parseInt(value(ageInput));
            String country = value(countryInput);
            String email = value(emailInput);
            double height = Double.parseDouble(value(heightInput).replace(",", "."));
            double weight = Double.parseDouble(value(weightInput).replace(",", "."));

            if (firstName.length() < 2 || lastName.length() < 2 || country.length() < 2) {
                toast("Заполни имя, фамилию и страну.");
                return;
            }
            if (age < 12 || age > 100) {
                toast("Возраст должен быть от 12 до 100.");
                return;
            }
            if (!email.contains("@") || !email.contains(".")) {
                toast("Проверь email.");
                return;
            }
            if (height < 80 || height > 230 || weight < 25 || weight > 250) {
                toast("Проверь рост и вес.");
                return;
            }

            double bmi = calculateBmi(height, weight);
            JSONObject payload = new JSONObject();
            payload.put("user_id", JSONObject.NULL);
            payload.put("telegram_user_id", JSONObject.NULL);
            payload.put("telegram_username", JSONObject.NULL);
            payload.put("source", "android");
            payload.put("first_name", firstName);
            payload.put("last_name", lastName);
            payload.put("age", age);
            payload.put("gender", genderSpinner.getSelectedItem().toString());
            payload.put("country", country);
            payload.put("distance", distanceSpinner.getSelectedItem().toString());
            payload.put("email", email);
            payload.put("bmi", Double.parseDouble(bmiFormat.format(bmi).replace(",", ".")));
            payload.put("bmi_category", bmiCategory(bmi));

            postRunner(payload);
        } catch (Exception error) {
            toast("Проверь поля формы.");
        }
    }

    private void postRunner(JSONObject payload) {
        toast("Сохраняю в Supabase...");
        new Thread(() -> {
            try {
                request("POST", "/rest/v1/runners", payload.toString());
                runOnUiThread(() -> {
                    toast("Участник сохранён.");
                    showParticipants();
                });
            } catch (Exception error) {
                runOnUiThread(() -> showError("Ошибка сохранения в Supabase", error.getMessage()));
            }
        }).start();
    }

    private void showBmiOnly() {
        ScrollView scroll = scrollPage();
        LinearLayout body = scrollBody(scroll);
        body.addView(sectionTitle("BMI калькулятор"));
        EditText height = input("Рост, см", InputType.TYPE_CLASS_NUMBER);
        EditText weight = input("Вес, кг", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        TextView result = text("BMI: 0.0", 34, GREEN, true);
        result.setGravity(Gravity.CENTER);

        body.addView(labeled("Рост", height));
        body.addView(labeled("Вес", weight));
        body.addView(result);
        body.addView(primaryButton("Рассчитать", v -> {
            try {
                double h = Double.parseDouble(value(height).replace(",", "."));
                double w = Double.parseDouble(value(weight).replace(",", "."));
                double bmi = calculateBmi(h, w);
                result.setText("BMI: " + bmiFormat.format(bmi) + "\n" + bmiCategory(bmi));
            } catch (Exception error) {
                toast("Введи рост и вес.");
            }
        }));
        setPage(scroll);
    }

    private void showParticipants() {
        ScrollView scroll = scrollPage();
        LinearLayout body = scrollBody(scroll);
        body.addView(sectionTitle("Список участников"));
        TextView loading = text("Загружаю участников из Supabase...", 16, MUTED, false);
        body.addView(loading);
        setPage(scroll);

        new Thread(() -> {
            try {
                String query = "/rest/v1/runners?select=first_name,last_name,country,distance,bmi,bmi_category,source,created_at&order=created_at.desc";
                String response = request("GET", query, null);
                JSONArray rows = new JSONArray(response);
                runOnUiThread(() -> renderParticipants(body, loading, rows));
            } catch (Exception error) {
                runOnUiThread(() -> {
                    loading.setText("Ошибка загрузки участников.");
                    showError("Ошибка загрузки из Supabase", error.getMessage());
                });
            }
        }).start();
    }

    private void renderParticipants(LinearLayout body, TextView loading, JSONArray rows) {
        body.removeView(loading);
        if (rows.length() == 0) {
            body.addView(card("Пока пусто", "Нет участников", "Зарегистрируй первого бегуна в приложении или на сайте."));
            return;
        }
        for (int i = 0; i < rows.length(); i++) {
            JSONObject runner = rows.optJSONObject(i);
            if (runner == null) continue;
            String name = runner.optString("first_name") + " " + runner.optString("last_name");
            String meta = runner.optString("country") + " • " + runner.optString("distance") + " • " + runner.optString("source", "site");
            String bmi = "BMI " + runner.optString("bmi") + " • " + runner.optString("bmi_category");
            body.addView(card(meta, name, bmi));
        }
    }

    private String request(String method, String path, String body) throws Exception {
        URL url = new URL(SUPABASE_URL + path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("apikey", SUPABASE_KEY);
        connection.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
        connection.setRequestProperty("Content-Type", "application/json");
        if ("POST".equals(method)) {
            connection.setRequestProperty("Prefer", "return=minimal");
            connection.setDoOutput(true);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }

        int code = connection.getResponseCode();
        InputStream stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
        String response = readStream(stream);
        if (code < 200 || code >= 300) {
            throw new RuntimeException(code + " " + response);
        }
        return response;
    }

    private String readStream(InputStream stream) throws Exception {
        if (stream == null) return "";
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            builder.append(line);
        }
        return builder.toString();
    }

    private double calculateBmi(double heightCm, double weightKg) {
        double meters = heightCm / 100.0;
        return weightKg / (meters * meters);
    }

    private String bmiCategory(double bmi) {
        if (bmi < 18.5) return "Недостаточный вес";
        if (bmi >= 30) return "Ожирение";
        if (bmi >= 25) return "Избыточный вес";
        return "Норма";
    }

    private void startCountdown() {
        handler.post(new Runnable() {
            @Override
            public void run() {
                countdown.setText("До марафона: " + countdownText());
                handler.postDelayed(this, 1000);
            }
        });
    }

    private String countdownText() {
        Calendar now = Calendar.getInstance();
        Calendar target = Calendar.getInstance(TimeZone.getDefault(), Locale.getDefault());
        target.set(Calendar.MONTH, Calendar.JUNE);
        target.set(Calendar.DAY_OF_MONTH, 15);
        target.set(Calendar.HOUR_OF_DAY, 9);
        target.set(Calendar.MINUTE, 0);
        target.set(Calendar.SECOND, 0);
        if (target.before(now)) {
            target.add(Calendar.YEAR, 1);
        }
        long seconds = Math.max(0, (target.getTimeInMillis() - now.getTimeInMillis()) / 1000);
        long days = seconds / 86400;
        long hours = (seconds % 86400) / 3600;
        long minutes = (seconds % 3600) / 60;
        return days + " д " + two(hours) + ":" + two(minutes);
    }

    private String two(long value) {
        return value < 10 ? "0" + value : String.valueOf(value);
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setLineSpacing(0, 1.12f);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private TextView sectionTitle(String label) {
        TextView view = text(label, 28, INK, true);
        view.setPadding(0, 0, 0, dp(14));
        return view;
    }

    private View card(String eyebrow, String title, String description) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        card.setBackgroundColor(Color.WHITE);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(12));
        card.setLayoutParams(params);
        card.addView(text(eyebrow, 12, CORAL, true));
        TextView titleView = text(title, 22, INK, true);
        titleView.setPadding(0, dp(6), 0, dp(6));
        card.addView(titleView);
        card.addView(text(description, 15, MUTED, false));
        return card;
    }

    private View statRow(String value, String label) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(16), dp(14), dp(16), dp(14));
        row.setBackgroundColor(Color.WHITE);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(8));
        row.setLayoutParams(params);

        TextView left = text(value, 24, GREEN, true);
        TextView right = text(label, 15, MUTED, false);
        right.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        row.addView(left, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        row.addView(right, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        return row;
    }

    private EditText input(String hint, int type) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setSingleLine(true);
        input.setTextSize(16);
        input.setInputType(type);
        input.setPadding(dp(12), 0, dp(12), 0);
        return input;
    }

    private Spinner spinner(String[] values) {
        Spinner spinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, values);
        spinner.setAdapter(adapter);
        return spinner;
    }

    private View labeled(String label, View field) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(0, 0, 0, dp(12));
        TextView title = text(label, 13, MUTED, true);
        title.setPadding(0, 0, 0, dp(4));
        box.addView(title);
        box.addView(field, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(52)
        ));
        return box;
    }

    private Button primaryButton(String label, View.OnClickListener listener) {
        Button button = button(label, listener);
        button.setTextColor(Color.WHITE);
        button.setBackgroundColor(BLUE);
        return button;
    }

    private Button secondaryButton(String label, View.OnClickListener listener) {
        Button button = button(label, listener);
        button.setTextColor(INK);
        button.setBackgroundColor(Color.WHITE);
        return button;
    }

    private Button button(String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(16);
        button.setAllCaps(false);
        button.setOnClickListener(listener);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(52)
        );
        params.setMargins(0, dp(8), 0, 0);
        button.setLayoutParams(params);
        return button;
    }

    private String value(EditText input) {
        return input.getText().toString().trim();
    }

    private void toast(String text) {
        Toast.makeText(this, text, Toast.LENGTH_LONG).show();
    }

    private void showError(String title, String message) {
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setMessage(message == null ? "unknown error" : message)
                .setPositiveButton("Ок", null)
                .show();
    }

    private String shortError(Exception error) {
        String message = error.getMessage();
        if (message == null) return "unknown";
        return message.length() > 180 ? message.substring(0, 180) + "..." : message;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
