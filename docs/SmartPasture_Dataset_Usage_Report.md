# SmartPasture dataset usage report

Папка: `D:\smartpasture_dataset`

Дата аудита: 2026-06-02

## Короткий вывод

Датасет уже можно использовать для SmartPasture как полноценный demo/data sandbox:

- показать карту скважин;
- построить validation screen;
- сделать ML baseline;
- отладить pipeline признаков;
- обновить карточки участков, compare и scenario mode;
- подготовить методологию для презентации.

Но почти все табличные данные по скважинам и feature grids помечены как `SYNTHETIC_DEMO`. Поэтому их нельзя использовать как доказательство, что SmartPasture реально снижает риск бурения или повышает успешность выбора точек.

## Что внутри

### 1. Wells

Файлы:

- `wells/smartpasture_wells_demo.csv`
- `wells/smartpasture_features.csv`
- `wells/smartpasture_wells.geojson`
- `wells/smartpasture_regions_summary.geojson`
- `wells/ml_ready/*`

Состояние:

- 100 synthetic wells;
- 64 колонки в полном feature matrix;
- `success`: 62 успешные, 38 неуспешные;
- регионы: Кызылординская, Жамбылская, Туркестанская, Алматинская;
- все 100 записей помечены `SYNTHETIC_DEMO`;
- 11 пропусков в `tds_g_l`.

Как использовать:

- загрузить `smartpasture_wells.geojson` как слой исторических скважин;
- использовать `smartpasture_features.csv` для карточек скважин и compare mode;
- использовать `ml_ready` для ML-прототипа;
- использовать `regions_summary.geojson` для summary-карты по областям.

Ограничение:

Это не реальная validation база. Для судей нужно прямо писать: synthetic demo data for pipeline testing.

### 2. ML-ready

Файлы:

- `X_train.npy`, `X_val.npy`, `X_test.npy`;
- `y_binary_*`;
- `y_yield_*`;
- `y_depth_*`;
- `y_tds_*`;
- `feature_metadata.json`;
- `train.csv`, `val.csv`, `test.csv`.

Как использовать:

- обучить baseline-модели: Logistic Regression, Random Forest, XGBoost;
- показать, что SmartPasture поддерживает AI/ML architecture;
- отладить future pipeline на реальных данных.

Что осторожно:

- test split всего 15 строк, метрики нестабильны;
- текущая synthetic модель не должна попадать в claims типа `85% accuracy`;
- `feature_engineering.py` содержит leakage-признаки `precip_per_depth`, `yield_depth_ratio`, `high_tds_risk`. Их нельзя использовать для pre-drilling prediction, если depth/yield/TDS известны только после бурения.

### 3. Hydro

Файлы:

- `River network GIRES_v10.gpkg` — 191 569 river features;
- `lakes.gpkg` — 120 lake features;
- `ALL_watersheds_wgs84.gpkg` — 14 watershed basins;
- `Water management basins.gpkg` — 8 basins;
- `watershed_subbasins.gpkg` — 16 subbasins;
- `GLEAM_WaterBalanceAllBAsin.csv` — 4032 rows;
- `P_MSWEP_ALL.csv` — 4032 rows;
- CHIRPS monthly GeoTIFFs for selected 2025/2026 months;
- `kz_hydrography.geojson` — small demo hydro layer.

Как использовать:

- считать distance to river/lake/canal;
- считать drainage density;
- строить basin-level water balance;
- показать rainfall/water-balance context;
- добавить confidence по покрытию гидрослоя.

Важно:

CHIRPS GeoTIFFs покрывают global belt примерно `-50..50` latitude, то есть для южных пилотных областей подходят, но север Казахстана полностью не покрывают.

### 4. Climate

Файлы:

- `kz_climate_grid.csv` — 288 synthetic climate points;
- `kz_monthly_precip_stations.csv` — 112 rows, 8 stations x 14 years.

Как использовать:

- annual/summer/spring precipitation;
- aridity index;
- dry months;
- temperature;
- water deficit.

Ограничение:

Оба CSV помечены `SYNTHETIC_DEMO`, поэтому подходят для demo scoring, но не для научной валидации.

### 5. Soil

Файлы:

- `kz_soilgrids_grid.csv` — 162 synthetic soil points;
- `Soil_Moisture_ERA5.csv` — 4032 rows by watershed/date.

Как использовать:

- soil texture;
- sand/clay/silt;
- organic carbon;
- bulk density;
- available water capacity;
- soil moisture context.

### 6. Land cover

Файлы:

- `kz_land_cover_grid.csv` — 648 synthetic land-cover points;
- 3 large GeoTIFF files named `appRasterSelectAPIService...`.

Важное замечание:

GeoTIFFs в папке `landcover` выглядят не как обычная categorical land cover карта. Значения похожи на непрерывные raster values, а не на классы ESA WorldCover. Перед использованием нужно установить источник/семантику этих TIFF: land cover, elevation, NDVI или другой raster.

Как использовать после проверки:

- определить pasture/non-pasture;
- считать pasture area around point;
- исключать населенные пункты, воду и непригодные зоны;
- строить grazing pressure proxy.

### 7. Faults / geology proxy

Файлы:

- `gis/faults/kz_active_faults.geojson` — 10 LineString features.

Как использовать:

- distance to fault;
- fault density;
- structural risk/proxy.

Ограничение:

Это маленький representative/demo layer, не полноценная геологическая карта Казахстана.

## Что можно построить для SmartPasture

### A. Validation dashboard

На карте:

- успешные и неуспешные скважины;
- цвет по `success`;
- размер по `yield_lps`;
- tooltip: depth, TDS, yield, region, source_type.

В аналитике:

- success rate by region;
- mean depth / mean TDS / mean yield;
- top factors by feature importance;
- comparison with random baseline.

Статус: можно построить уже сейчас, но подписать как synthetic demo validation.

### B. SmartPasture ML baseline

Задачи:

- binary success classifier;
- depth regression;
- yield regression;
- TDS regression.

Лучший честный формат для презентации:

> We built an ML-ready pipeline on synthetic/demo data and will replace the well inventory with real historical wells for validation.

Не писать:

> Our AI already predicts wells with 85% accuracy.

### C. Candidate point ranking map

Использовать:

- hydro distance;
- DEM/terrain features;
- aridity;
- NDVI;
- soil;
- land cover;
- roads/settlements;
- confidence.

Итог:

- `Priority for Inspection`;
- `Risk`;
- `Confidence`;
- `Recommended action`.

Это напрямую усиливает существующий GIS Probe screen.

### D. Risk and confidence model

Risk:

- далеко от воды;
- высокая аридность;
- низкий NDVI;
- слабая почвенная влагоемкость;
- неблагоприятная геология;
- высокая дистанция до старых скважин;
- missing/low-confidence layers.

Confidence:

- есть DEM;
- есть гидрослой;
- есть климат;
- есть почвы;
- есть land cover;
- есть близкие исторические скважины;
- agreement between scoring and ML.

### E. Scientific methodology section

На основе датасета можно написать сильный methodology block:

- какие признаки используются;
- почему они физически осмысленны;
- какие признаки доступны до бурения;
- какие признаки являются post-drilling targets;
- как предотвращается data leakage;
- как будет проводиться validation на реальных исторических скважинах.

## Что нельзя делать

1. Нельзя выдавать `smartpasture_wells_demo.csv` за реальные скважины.
2. Нельзя показывать текущие ML-метрики как доказанную точность.
3. Нельзя использовать `depth_m`, `yield_lps`, `tds_g_l` как input features для выбора новой точки до бурения.
4. Нельзя использовать leakage-признаки из `feature_engineering.py` для pre-drilling success prediction.
5. Нельзя заявлять `60% -> 15%`, `3.8 млн ₸`, `85% accuracy` на основе этого пакета.

## Что сделать дальше

1. Подключить `wells/smartpasture_wells.geojson` в frontend как слой historical/demo wells.
2. Сделать Validation page: карта, таблица, region summary, model baseline.
3. Исправить `validate.py`: открыть GeoJSON через `open(..., encoding="utf-8")`, иначе Windows-консоль дает ошибку.
4. Добавить script `train_baselines.py`, который выводит ROC-AUC, PR-AUC, Top-k hit rate.
5. Подготовить `candidate_points.csv` для реальных пастбищных зон Кызылорды/Жамбыла.
6. Постепенно заменить `SYNTHETIC_DEMO` wells на реальные исторические скважины.
7. После реальных данных повторить ML и validation.

## Финальная рекомендация

Использовать текущий датасет как `SmartPasture Demo + Engineering Dataset`, а не как `Scientific Validation Dataset`.

Формулировка для команды:

> Эти данные позволяют нам показать, что SmartPasture технически готов работать с историческими скважинами, GIS-признаками и ML. Но победный уровень появится только после замены synthetic wells на реальные скважины и ретроспективной проверки.
