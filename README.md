# SmartPasture

SmartPasture — веб-интерфейс для предварительного гидрогеологического скрининга, ранжирования кандидатных точек и расчёта достаточности воды для стада.

## Быстрый деплой в Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ferbosyn-modern-ml-engineer%2FSmartPasture-)

Для публичного деплоя переменные окружения не обязательны. Репозиторий уже содержит `vercel.json` с настройками Vite, папкой результата `dist` и SPA rewrite для прямого открытия маршрутов вроде `/map`, `/ranking` и `/calculator`.

### Через сайт Vercel

1. Откройте Vercel и выберите **Add New → Project**.
2. Импортируйте репозиторий `erbosyn-modern-ml-engineer/SmartPasture-`.
3. Оставьте Root Directory равным корню репозитория.
4. Vercel автоматически использует:
   - Install Command: `npm ci`
   - Build Command: `npm run vercel-build`
   - Output Directory: `dist`
5. Нажмите **Deploy**.

### Через Vercel CLI

```bash
npm install
npm run quality
npx vercel
npx vercel --prod
```

## Локальный запуск

Для обычного веб-интерфейса:

```bash
npm ci
npm run dev:web
```

Для режима с локальным AI-сервером:

```bash
npm run dev
```

## Проверка перед публикацией

```bash
npm run quality
```

Команда запускает ESLint, TypeScript typecheck и production build.

## Публичные разделы

- Главная
- Карта
- Точки и ранжирование
- Калькулятор воды для стада
- Сравнение сохранённых точек
- Отчёт и методология

Экспериментальные экраны ML-валидации сохранены в исходном коде, но выключены для публичных пользователей, потому что текущая модель не подтверждена полноценной валидацией на реальных исторических скважинах.

Для внутренней разработки их можно временно включить при сборке:

```env
VITE_ENABLE_EXPERIMENTAL_ML_UI=true
```

Не включайте этот флаг на публичном Vercel-проекте до появления честно провалидированной модели.

## Опциональные переменные окружения

```env
VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
VITE_PUBLIC_SITE_URL=https://your-project.vercel.app
VITE_ANALYTICS_ENABLED=false
```

`VITE_BASE_PATH` для Vercel должен оставаться `/`.
