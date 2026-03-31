# GrantFlow Module — Інструкція встановлення

## Що це
Модуль моніторингу грантів для додатку «Контролі».
Темна тема (navy), Geologica, мобільна навігація — все як в Контролях.

## Файли (1179 рядків)
```
grantflow/
├── css/grantflow.css      — 181 рядок (стилі, scoped під #grantflowRoot)
├── js/
│   ├── gf-data.js         — 141 (Firestore CRUD + агрегація)
│   ├── gf-core.js         — 188 (навігація, стан, роутер)
│   ├── gf-overview.js     — 131 (екран «Огляд» — повний)
│   ├── gf-detected.js     — 223 (екран «Виявлено» — фільтри, пошук, картки)
│   ├── gf-sources.js      — 136 (екран «Джерела» — CRUD, швидке додавання)
│   └── gf-pages.js        — 134 (Можливості, Завдання, Контакти, Лог, Налаштування)
└── grantflow-block.html   — 45  (HTML для вставки)
```

## Реалізовані екрани
- **Огляд** — 8 метрик, статистика по періодах, причини відхилення з барами, топ-юзери, останні знахідки, швидкий стан джерел
- **Виявлено** — табки (Нові/Корисні/На ознайомленні/У базі/Дублікати/Відхилені/Усі), пошук, 2 режими відображення (список/компакт), пріоритетне сортування по ключових словах, зміна статусу
- **Джерела** — таби (Активні/Призупинені/Архів), пошук, швидке додавання з URL (авто-визначення Telegram/RSS/сайт), пауза/увімкнення, архівація
- **Можливості** — перелік перевірених записів
- **Завдання** — призначення + задачі (два панелі)
- **Контакти** — таблиця
- **Лог** — завантаження історії з Firestore
- **Налаштування** — пріоритетні слова, інформація про Firestore колекції

## Встановлення (3 кроки)

### 1. Скопіюй файли в C:\контроль\public\
```
public\
├── css\
│   ├── styles.css          (вже є)
│   └── grantflow.css       ← НОВИЙ
├── js\
│   ├── firebase.js         (вже є)
│   ├── core.js, auth.js... (вже є)
│   ├── gf-data.js          ← НОВИЙ
│   ├── gf-core.js          ← НОВИЙ
│   ├── gf-overview.js      ← НОВИЙ
│   ├── gf-detected.js      ← НОВИЙ
│   ├── gf-sources.js       ← НОВИЙ
│   └── gf-pages.js         ← НОВИЙ
└── index.html              ← РЕДАГУВАТИ
```

### 2. Редагуй index.html

**A) В `<head>` додай CSS (після styles.css):**
```html
<link rel="stylesheet" href="/css/grantflow.css">
```

**B) Перед `</body>` вставь HTML з файлу `grantflow-block.html`**

**C) Перед `</body>` додай JS (ПІСЛЯ скриптів Контролів, ПЕРЕД init.js):**
```html
<!-- GrantFlow Module -->
<script src="/js/gf-data.js"></script>
<script src="/js/gf-core.js"></script>
<script src="/js/gf-overview.js"></script>
<script src="/js/gf-detected.js"></script>
<script src="/js/gf-sources.js"></script>
<script src="/js/gf-pages.js"></script>
```

### 3. Деплой
```bash
cd C:\контроль
firebase deploy --only hosting
```

## Як працює
1. Логінишся в Контролі як зазвичай
2. В нижній навігації з'являється кнопка **«🔍 Гранти»**
3. Натискаєш → Контролі ховаються, відкривається GrantFlow зі своїм sidebar
4. **«← Повернутись до Контролів»** → назад
5. На мобільному — своя нижня навігація з 5 основних розділів

## Firestore колекції (створяться автоматично)
`gf_sources`, `gf_sources_archive`, `gf_detected`, `gf_opportunities`,
`gf_assignments`, `gf_tasks`, `gf_approvals`, `gf_notifications`,
`gf_history`, `gf_contacts`, `gf_settings`, `gf_scan_index`

## Що далі
- Cloud Functions для ScanEngine (парсинг зовнішніх сайтів)
- Редактор карток (повний, з preview оригінальної сторінки)
- Масове редагування джерел
- Каталог рекомендованих джерел
- Система сповіщень
