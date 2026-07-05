# SmartPasture: план сбора данных, валидации и распределения ролей

Цель документа: превратить SmartPasture из красивой explainable scoring-системы в проверяемый гидрогеологический продукт. Главный критерий успеха: показать на исторических скважинах Казахстана, что SmartPasture ранжирует точки лучше случайного выбора и лучше простого GIS-бейзлайна.

Важное позиционирование: SmartPasture не должен обещать точное нахождение воды и не должен использовать слово AI до появления обученной модели и валидации. Сейчас честная формулировка: explainable decision-support system для предварительной приоритизации точек проверки.

## 1. Самый важный датасет

Исторические скважины с координатами и результатами бурения.

Минимальные поля:

| Поле | Зачем нужно |
| --- | --- |
| `id` | уникальный идентификатор |
| `lat`, `lon` | координаты |
| `region`, `district` | региональная разбивка |
| `year` | год бурения / обследования |
| `depth_m` | глубина |
| `yield_lps` | дебит, л/с |
| `tds_g_l` | минерализация / TDS |
| `water_quality_note` | пригодность для скота / тех. примечания |
| `success` | итоговая метка: 1/0 |
| `source_url` | откуда взята запись |
| `source_type` | отчет, статья, госорган, компания, интервью |

Важно: глубину и TDS нельзя бездумно использовать как входные признаки для предсказания новой точки, если эти значения известны только после бурения. Иначе будет data leakage. Для модели можно использовать только признаки, которые доступны до бурения: рельеф, расстояние до воды, климат, геология, почвы, NDVI, land cover, расстояние до старых скважин и агрегаты по соседним старым скважинам.

## 2. Где брать данные по скважинам

### Приоритет 1: партнерские и официальные данные

1. Министерство водных ресурсов и ирригации РК  
   Сайт: https://www.gov.kz/memleket/entities/water  
   Новость про цифровизацию и систему Water Base: https://www.gov.kz/memleket/entities/water/press/news/details/1149723?lang=ru  
   Новость про утвержденные запасы подземных вод: https://www.gov.kz/memleket/entities/water/press/news/details/701487?lang=ru  
   Что просить: выгрузку или обезличенную выборку по скважинам в пилотных областях: координаты, глубина, дебит, минерализация, год, назначение, статус.

2. Национальная гидрогеологическая служба / Казгидрогеология  
   Сайт программы: https://hydrogeology.kz/ru/nauchno-tehnicheskaja-programma-mjegpr-rk/  
   Что просить: доступ к материалам инвентаризации самоизливающихся, разведочных и эксплуатационных скважин, хотя бы для Жамбылской и Кызылординской областей.

3. Национальная геологическая служба  
   Сайт: https://geology.kz/ru/  
   Геологический портал: https://gis.geology.gov.kz/  
   Единая платформа недропользования: https://e.geology.kz/  
   Что просить: геологические карты, гидрогеологические материалы, контакты ответственных специалистов по подземным водам.

4. Институт геологических наук имени К.И. Сатпаева  
   Сайт: https://satbayev.university/ru/institutes/institute-of-geological-sciences  
   Что просить: экспертную консультацию и доступ к опубликованным/архивным материалам по подземным водам юга и запада Казахстана.

### Приоритет 2: научные статьи и приложения

1. MDPI Water, статья по подземным водам Казахстана: https://www.mdpi.com/2073-4441/15/3/482  
   Проверить текст, таблицы и supplementary materials. Если координаты не опубликованы, написать авторам.

2. MDPI Water, remote sensing / groundwater-related Казахстан: https://www.mdpi.com/2073-4441/15/24/4240  
   Использовать как методологическую базу и источник признаков.

3. MDPI Sustainability, Казахстан и водные/земельные ресурсы: https://www.mdpi.com/2071-1050/16/11/4597  
   Использовать для контекста и поиска источников в references.

Задача: не просто читать статьи, а вытаскивать из них таблицы, координаты, названия районов, упоминания скважин, дебит, минерализацию и ссылки на первичные отчеты.

### Приоритет 3: экологические отчеты и общественные слушания

Портал общественных слушаний: https://hearings.ndbecology.gov.kz/Public/PubHearings  

Что искать:

- "скважина", "бурение водозаборной скважины";
- "подземные воды";
- "дебит";
- "минерализация";
- "Кызылординская область", "Жамбылская область", "Мойынкум", "Приаралье".

Почему это важно: в PDF-проектах часто есть координаты проектируемых или существующих скважин, глубина, ожидаемый дебит, данные по качеству воды. Это грязный, но реальный источник.

### Приоритет 4: прямые интервью и письма

Саид и Санжар должны написать гидрогеологическим компаниям и институтам. Цель не "спонсорство", а 30-минутное интервью и 5-20 примеров скважин с обезличенными данными.

Минимальная просьба:

> Нам не нужны коммерческие тайны. Нужна обезличенная таблица по историческим точкам: координаты или район, глубина, дебит, минерализация, успешная/неуспешная, год. Мы используем это только для ретроспективной валидации школьно-исследовательского проекта.

## 3. Уровень 1: обязательные открытые слои

### 3.1 DEM / рельеф

Основной источник:

- Copernicus DEM 30m через OpenTopography API: https://portal.opentopography.org/apidocs/  
- Copernicus DEM description: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM

Альтернатива:

- NASADEM / SRTM через NASA Earthdata: https://search.earthdata.nasa.gov/search?q=NASADEM  
- USGS EarthExplorer: https://earthexplorer.usgs.gov/

Что извлечь:

- `elevation_m`;
- `slope_deg`;
- `aspect_deg`;
- `curvature`;
- `flow_accumulation`;
- `twi`.

Ответственный: Надыр. Санжар проверяет физический смысл признаков.

### 3.2 Гидрография

Источники:

- WaterBalance Kazakhstan spatial data: https://waterbalance.org.kz/spatialData_ru.html  
- River network GPKG: https://waterbalance.org.kz/input_data/River%20network%20GIRES_v10.gpkg  
- Lakes GPKG: https://waterbalance.org.kz/input_data/lakes.gpkg  
- OpenStreetMap Kazakhstan через Geofabrik: https://download.geofabrik.de/asia/kazakhstan.html  
- HydroRIVERS: https://www.hydrosheds.org/products/hydrorivers  
- HydroLAKES: https://www.hydrosheds.org/products/hydrolakes

Что извлечь:

- `dist_to_river_m`;
- `dist_to_lake_m`;
- `dist_to_canal_m`;
- `dist_to_reservoir_m`;
- `drainage_density_5km`;
- `nearest_water_type`.

Ответственный: Надыр. Ербосын подключает слой в GIS-пайплайн.

### 3.3 Осадки

Источники:

- WaterBalance Kazakhstan MSWEP precipitation CSV: https://waterbalance.org.kz/input_data/P_MSWEP_ALL.csv  
- CHIRPS precipitation: https://www.chc.ucsb.edu/data/chirps  
- CHIRPS monthly GeoTIFF directory: https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_monthly/tifs/  
- WorldClim climate data: https://www.worldclim.org/data/worldclim21.html  
- ERA5-Land monthly means: https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land-monthly-means?tab=overview

Что извлечь:

- `annual_precip_mm`;
- `spring_precip_mm`;
- `summer_precip_mm`;
- `precip_seasonality`;
- `dry_months_count`.

Ответственный: Надыр. Санжар описывает, почему осадки важны для recharge potential.

### 3.4 Землепользование / пастбища

Источники:

- ESA WorldCover 10m: https://esa-worldcover.org/en/data-access  
- Dynamic World V1: https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1  
- Copernicus Global Land Cover: https://land.copernicus.eu/en/products/global-dynamic-land-cover  
- OpenStreetMap Kazakhstan: https://download.geofabrik.de/asia/kazakhstan.html  
- Бюро национальной статистики РК: https://stat.gov.kz/

Что извлечь:

- `land_cover_class`;
- `is_pasture`;
- `pasture_area_5km`;
- `distance_to_settlement_m`;
- `distance_to_road_m`;
- `grazing_pressure_proxy`.

Ответственный: Надыр собирает слой. Саид ищет статистику по скоту и районам.

## 4. Уровень 2: слои, которые сильно усилят проект

### 4.1 Почвы

Источники:

- SoilGrids / ISRIC: https://soilgrids.org/  
- SoilGrids API docs: https://docs.isric.org/globaldata/soilgrids/  
- SoilGrids point API: https://rest.isric.org/soilgrids/v2.0/properties/query  
- FAO Harmonized World Soil Database: https://www.fao.org/soils-portal/data-hub/soil-maps-and-databases/harmonized-world-soil-database-v12/en/

Что извлечь:

- `sand_pct`;
- `silt_pct`;
- `clay_pct`;
- `soil_texture_class`;
- `organic_carbon`;
- `bulk_density`;
- `soil_water_capacity_proxy`.

Ответственный: Надыр. Санжар формулирует связь с инфильтрацией.

### 4.2 Геология

Источники:

- Национальная геологическая служба: https://geology.kz/ru/  
- Геологический портал РК: https://gis.geology.gov.kz/  
- Единая платформа недропользования: https://e.geology.kz/  
- OneGeology portal: https://portal.onegeology.org/  
- GLiM Global Lithological Map: https://www.geo.uni-hamburg.de/en/geologie/forschung/aquatische-geochemie/glim.html

Что извлечь:

- `lithology_class`;
- `geological_age`;
- `aquifer_proxy`;
- `permeability_proxy`;
- `carbonate_or_sedimentary_flag`;
- `alluvial_deposit_flag`.

Ответственный: Санжар как Chief Scientist. Надыр помогает с GIS-форматом.

### 4.3 NDVI

Источники:

- Sentinel-2 L2A через Copernicus Data Space Browser: https://browser.dataspace.copernicus.eu/  
- Sentinel-2 L2A collection: https://dataspace.copernicus.eu/explore-data/data-collections/sentinel-data/sentinel-2  
- MODIS MOD13Q1 NDVI 250m: https://lpdaac.usgs.gov/products/mod13q1v061/  
- MOD13Q1 in Google Earth Engine: https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1

Что извлечь:

- `ndvi_mean_growing_season`;
- `ndvi_min_summer`;
- `ndvi_anomaly`;
- `vegetation_stability`.

Ответственный: Надыр. Ербосын может автоматизировать через Google Earth Engine или локальный raster pipeline.

### 4.4 Температура и испаряемость

Источники:

- TerraClimate: https://www.climatologylab.org/terraclimate.html  
- TerraClimate downloads: https://climate.northwestknowledge.net/TERRACLIMATE/index_directDownloads.php  
- ERA5-Land monthly means: https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land-monthly-means?tab=overview  
- WorldClim temperature: https://www.worldclim.org/data/worldclim21.html  
- WaterBalance GLEAM water balance CSV: https://waterbalance.org.kz/input_data/GLEAM_WaterBalanceAllBAsin.csv

Что извлечь:

- `annual_temp_c`;
- `summer_temp_c`;
- `potential_evapotranspiration_mm`;
- `actual_evapotranspiration_mm`;
- `aridity_index`;
- `water_deficit_mm`.

Ответственный: Надыр. Санжар описывает water balance logic.

## 5. Уровень 3: признаки для сильной научной части

### 5.1 Разломы

Источники:

- GEM Global Active Faults: https://github.com/GEMScienceTools/gem-global-active-faults  
- OneGeology portal: https://portal.onegeology.org/  
- Геологический портал РК: https://gis.geology.gov.kz/

Что извлечь:

- `dist_to_fault_m`;
- `fault_density_10km`;
- `near_fault_flag`.

Ответственный: Санжар. Важно: не утверждать, что близость к разлому всегда означает воду. Формулировка должна быть аккуратной: это потенциальный структурный фактор, который надо валидировать.

### 5.2 Drainage Density

Считается из речной сети.

Формула:

`drainage_density = total_stream_length_km / buffer_area_km2`

Буферы: 2 км, 5 км, 10 км.

Ответственный: Надыр.

### 5.3 Flow Accumulation

Считается из DEM.

Инструменты:

- QGIS Processing Toolbox;
- GRASS GIS;
- WhiteboxTools: https://www.whiteboxgeo.com/manual/wbt_book/available_tools/hydrological_analysis.html

Ответственный: Надыр. Ербосын автоматизирует, если нужно встроить в backend.

### 5.4 Curvature

Считается из DEM. Нужна как прокси формы рельефа: где вода потенциально накапливается или быстрее стекает.

Ответственный: Надыр.

### 5.5 Topographic Wetness Index

Формула:

`TWI = ln(a / tan(beta))`

где `a` - upslope contributing area, `beta` - угол склона.

Инструменты:

- SAGA GIS / QGIS;
- WhiteboxTools;
- GRASS GIS.

Ответственный: Санжар объясняет смысл, Надыр считает.

## 6. Как должна выглядеть финальная таблица

Целевая структура к сентябрю:

| Field | Type | Comment |
| --- | --- | --- |
| `id` | string | ID точки |
| `lat`, `lon` | float | WGS84 |
| `region`, `district` | string | область / район |
| `depth_m` | float | результат скважины |
| `yield_lps` | float | результат скважины |
| `tds_g_l` | float | результат лаборатории |
| `success` | int | итоговая метка |
| `elevation_m` | float | DEM |
| `slope_deg` | float | DEM |
| `aspect_deg` | float | DEM |
| `curvature` | float | DEM |
| `flow_accumulation` | float | DEM |
| `twi` | float | DEM |
| `dist_to_river_m` | float | гидрография |
| `dist_to_lake_m` | float | гидрография |
| `drainage_density_5km` | float | гидрография |
| `annual_precip_mm` | float | климат |
| `summer_precip_mm` | float | климат |
| `pet_mm` | float | испаряемость |
| `aridity_index` | float | климат |
| `ndvi_mean` | float | Sentinel/MODIS |
| `ndvi_summer_min` | float | Sentinel/MODIS |
| `land_cover_class` | string | ESA/Dynamic World |
| `soil_texture` | string | SoilGrids/FAO |
| `sand_pct`, `clay_pct` | float | SoilGrids |
| `lithology_class` | string | геология |
| `dist_to_fault_m` | float | разломы |
| `dist_to_road_m` | float | доступность |
| `dist_to_settlement_m` | float | практический фактор |
| `source_url` | string | ссылка на источник |

## 7. Правило для success label

Нужно утвердить с гидрогеологом, но базовая версия:

`success = 1`, если:

- вода найдена;
- дебит достаточный для выбранного сценария;
- TDS/минерализация допустима для скота или технического использования;
- глубина экономически приемлема.

`success = 0`, если:

- воды нет;
- дебит слишком низкий;
- TDS слишком высокий;
- глубина делает бурение экономически нецелесообразным;
- скважина заброшена из-за качества/количества воды.

Важно: threshold нельзя придумывать командой. Его должен подтвердить гидрогеолог или источник: ГОСТ, FAO, национальные нормы, лабораторные рекомендации.

## 8. Как проводить валидацию

### Minimum viable validation

1. Собрать 50 исторических скважин.
2. Для каждой скважины посчитать признаки, доступные до бурения.
3. Скрыть `success`.
4. Запустить SmartPasture scoring.
5. Проверить: попадают ли успешные скважины выше в рейтинге.
6. Сравнить с random baseline.

Метрики:

- Top-10 / Top-20 hit rate;
- ROC-AUC;
- PR-AUC, если успешных скважин мало;
- nDCG или MAP для качества ранжирования;
- calibration plot, если появляется ML-модель.

### Правильная проверка без leakage

Если используем соседние исторические скважины как признак, то для каждой проверяемой скважины нужно исключать ее саму из расчетов. Иначе модель будет "угадывать" результат по собственным данным.

Правильная формулировка:

> We used leave-one-out spatial validation: when evaluating a historical well, its own post-drilling depth, yield and TDS were excluded from the features.

### Baselines для судей

Сравнить SmartPasture минимум с тремя baseline:

1. Random site selection.
2. Simple distance-to-water heuristic.
3. GIS weighted overlay без Risk/Confidence.

Если SmartPasture лучше всех трех, проект становится намного сильнее.

## 9. Распределение по команде

### Ербосын - CTO / Lead Engineer

Результат: рабочая система и воспроизводимый pipeline.

Задачи:

- подготовить структуру репозитория для данных;
- сделать CSV/GeoJSON schema;
- реализовать импорт слоев;
- реализовать расчет признаков или интеграцию готовых признаков;
- сделать экспорт `smartpasture_dataset.csv`;
- сделать demo-страницу Validation: карта успешных/неуспешных скважин и рейтинг SmartPasture.

KPI к сентябрю:

- pipeline запускается одной командой;
- есть датасет с 100+ точками;
- есть графики качества модели;
- фронтенд показывает не только карту, но и validation result.

### Надыр - Head of Data & Validation

Результат: чистый датасет и доказательство, что система работает.

Задачи:

- собрать таблицу исторических скважин;
- собрать DEM, гидрографию, осадки, land cover;
- посчитать признаки для каждой скважины;
- вести data log: откуда каждая строка;
- провести baseline validation;
- подготовить таблицы и графики для презентации.

KPI к сентябрю:

- 100+ скважин, лучше 200+;
- 15-20 признаков;
- `source_url` у каждой строки;
- ROC-AUC / Top-k / comparison with random baseline.

### Санжар - Chief Scientist / Modeling Lead

Результат: научная методология и защита модели.

Задачи:

- объяснить, почему выбранные факторы физически осмысленны;
- убрать искусственные веса без обоснования;
- подготовить методологию HPS/PNS/Risk/Confidence;
- составить literature review;
- предложить ML baseline: Logistic Regression, Random Forest, XGBoost;
- объяснить feature importance и ошибки модели;
- найти гидрогеолога или научного консультанта.

KPI к сентябрю:

- 30+ источников изучено;
- 1 literature review;
- 1 methodology document;
- 1 scientific validation section;
- объяснение каждого признака и каждого веса;
- участие в проверке 100+ скважин.

### Саид - COO / Business Lead

Результат: партнерства, интервью, бизнес-логика.

Задачи:

- провести 20 интервью: гидрогеологи, фермеры, акиматы, буровые компании;
- получить 3-5 писем поддержки или экспертных комментариев;
- выяснить, кто реально платит: гидрогеологические компании, акиматы, фермеры или агрохолдинги;
- собрать цены на бурение, выезд, геофизику, лабораторные анализы;
- убрать недоказанные экономические claims до появления данных;
- подготовить competitor comparison: ArcGIS/QGIS/Google Earth Engine/HydroGeoAnalyst.

KPI к сентябрю:

- 20 интервью;
- 5 партнерских контактов;
- 3 письма/отзыва;
- понятная бизнес-модель;
- доказанный customer segment.

## 10. Месячный план

### Июнь

Цель: собрать основу.

- 50+ исторических скважин;
- DEM 30m;
- реки/озера/каналы;
- осадки;
- land cover;
- первые 10 интервью;
- один гидрогеолог-консультант.

### Июль

Цель: сделать GIS-признаки.

- 100+ скважин;
- elevation, slope, aspect;
- distance to water;
- NDVI;
- rainfall;
- land cover;
- первая версия validation;
- первая версия scientific methodology.

### Август

Цель: усилить научность.

- 150-200 скважин, если реально;
- geology;
- soil;
- faults;
- TWI;
- flow accumulation;
- ML baseline;
- графики качества;
- обновленная презентация без недоказанных claims.

## 11. Что немедленно убрать или переписать в презентации

Убрать до валидации:

- "60% неэффективных скважин";
- "снижение риска до 15%";
- "экономия 3.8 млн тенге";
- "точность 85%";
- "AI", если нет обученной модели.

Заменить:

> SmartPasture снижает риск бурения с 60% до 15%.

На:

> SmartPasture проверяется на исторических скважинах: мы сравниваем ранжирование системы с реальными результатами бурения и random/GIS baselines.

Заменить:

> AI predicts water.

На:

> Explainable GIS + hydrogeographic scoring ranks candidate sites for professional inspection.

После валидации можно вернуть сильные цифры, но только если они подтверждены.

## 12. Текст, который можно отправить Санжару / Надыру

Санжар, твоя роль в SmartPasture теперь не "искать статьи", а отвечать за научную достоверность модели. Нам нужно доказать, что факторы в HPS/PNS/Risk/Confidence не придуманы, а физически и статистически обоснованы.

Главная задача на июнь-август: вместе с Надыром собрать датасет исторических скважин и open-source GIS-признаки, а затем проверить, ранжирует ли SmartPasture успешные скважины выше неуспешных.

Минимум к сентябрю:

- 100+ исторических скважин с координатами, глубиной, дебитом, TDS и success label;
- DEM, гидрография, осадки, land cover, NDVI;
- дополнительные слои: почвы, геология, разломы, TWI, flow accumulation;
- literature review на 30+ источников;
- методология, почему каждый признак влияет на гидропотенциал;
- сравнение SmartPasture с random baseline и simple GIS baseline;
- графики: ROC-AUC, Top-k hit rate, карта successful wells vs predicted priority.

Ключевые источники данных:

- WaterBalance Kazakhstan: https://waterbalance.org.kz/spatialData_ru.html
- River network: https://waterbalance.org.kz/input_data/River%20network%20GIRES_v10.gpkg
- Lakes: https://waterbalance.org.kz/input_data/lakes.gpkg
- Copernicus/OpenTopography DEM: https://portal.opentopography.org/apidocs/
- Copernicus DEM: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- CHIRPS precipitation: https://www.chc.ucsb.edu/data/chirps
- WorldClim: https://www.worldclim.org/data/worldclim21.html
- ESA WorldCover: https://esa-worldcover.org/en/data-access
- SoilGrids: https://soilgrids.org/
- SoilGrids API: https://rest.isric.org/soilgrids/v2.0/properties/query
- National Geological Service: https://geology.kz/ru/
- Geological GIS portal: https://gis.geology.gov.kz/
- GEM faults: https://github.com/GEMScienceTools/gem-global-active-faults
- MODIS NDVI: https://lpdaac.usgs.gov/products/mod13q1v061/
- Sentinel-2 browser: https://browser.dataspace.copernicus.eu/
- Public environmental hearings: https://hearings.ndbecology.gov.kz/Public/PubHearings

Самое важное: не доказываем, что SmartPasture "точно находит воду". Доказываем более сильную и честную вещь: SmartPasture помогает выбрать, какие точки стоит проверять первыми, и делает это лучше случайного выбора.
