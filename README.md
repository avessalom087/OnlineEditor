# DayZ Expansion & Server Suite Online Editor (Project Zero)

Комплексный веб-инструментарий для визуального редактирования, настройки и валидации конфигураций сервера **DayZ Standalone** (DayZ Expansion, MPG Spawner, SearchForLoot, AI Bots, Quests).

---

## 🚀 Архитектурная карта проекта

```
online-editor/
├── src/
│   ├── components/                 # Автономные модули редактора
│   │   ├── EconomyEditor.jsx       # Редактор рынка, торговцев, матрица связей, аудит коллизий
│   │   ├── TacticalMap.jsx         # Интерактивная 2D/3D карта с синхронизацией объектов
│   │   ├── MPGSpawnerEditor.jsx    # Редактор спавнов и патрулей мода MPG Spawner
│   │   ├── SearchForLootEditor.jsx # Редактор зон лута SearchForLoot
│   │   ├── AIBotsEditor.jsx        # Редактор фракций, патрулей и пресетов eAI / Expansion AI
│   │   ├── QuestGraph.jsx          # Визуальный граф цепочек квестов (DAG)
│   │   └── SettingsEditor.jsx     # Глобальные настройки путей и префиксов
│   │
│   ├── utils/                      # Бизнес-логика, парсеры и валидаторы
│   │   ├── marketAuditUtils.js     # Глубокий аудит рынка и 1-Click устранение дубликатов
│   │   ├── traderHealthUtils.js    # Инспектор здоровья и автоисцеление торговцев (m_Version 13)
│   │   ├── traderMapUtils.js       # Парсер и генератор строк спавна .map миссии + пресеты одежды
│   │   ├── pathUtils.js            # Автоопределение префиксов и канонических путей
│   │   ├── exportValidator.js      # Предэкспортная проверка фатальных ошибок и циклов
│   │   ├── classnamesParser.js     # Токенизатор и парсер класснеймов предметов
│   │   └── typesXmlParser.js       # Потоковый парсер серверного types.xml
│   │
│   ├── services/
│   │   └── fileService.js          # File System Access API, ротация бэкапов (.pz_tool), экспорт в ZIP
│   │
│   ├── App.jsx                     # Главный контроллер, единый стейт configs, горячие клавиши
│   └── main.jsx                    # Точка входа React 18
│
└── scratch/
    └── run_production_tests.js     # Автономный набор тестов (40/40 тестов)
```

---

## 📋 Канонические стандарты DayZ Expansion

### 1. Торговцы (`profiles/ExpansionMod/Traders/<TraderName>.json`)
- **Стандарт схемы**: `m_Version: 13`.
- **Обязательные поля**: `DisplayName`, `MinRequiredReputation`, `MaxRequiredReputation`, `RequiredFaction`, `RequiredCompletedQuestID`, `Currencies`, `Categories`, `Items`.

### 2. Рынок (`profiles/ExpansionMod/Market/<CategoryName>.json`)
- **Стандарт схемы**: `m_Version: 12`.
- **Критическое правило Expansion**: **Один и тот же предмет (или его вариант из `Variants[]`) НЕ МОЖЕТ находиться в нескольких категориях одновременно!** При наличии дубликатов сервер выдает фатальную ошибку `MARKET CONFIGURATION ERROR`. Для очистки используется `marketAuditUtils.js`.

### 3. Спавн торговцев в миссии (`mpmissions/<миссия>/expansion/traders/<Zone>_Traders.map`)
- **Формат**: Обычный текстовый файл (raw UTF-8 plain-text, **без кавычек JSON!**).
- **Синтаксис NPC**: `NPCModel.TraderName|X Y Z|Yaw Pitch Roll|Cloth1,Cloth2,Cloth3...`
- **Синтаксис Объектов**: `ExpansionExchangeMachine.Exchange|X Y Z|Yaw Pitch Roll` (без завершающего `|`).

### 4. Безопасные зоны (`mpmissions/<миссия>/expansion/traderzones/<Zone>_zone.json`)
- **Стандарт схемы**: `m_Version: 6`.
- **Поля**: `Position: [X, Y, Z]`, `Radius: 100.0`, `BuyPricePercent`, `SellPricePercent`.

---

## 🧪 Тестирование и Сборка

```bash
# Запуск полного набора автотестов:
node scratch/run_production_tests.js

# Сборка проекта для продакшена:
npm run build
```
