from __future__ import annotations

import csv
import json
import math
import random
from pathlib import Path
from typing import Callable, Iterable


ROOT = Path(__file__).resolve().parents[1]
DATASET_ROOT = Path(r"D:\smartpasture_dataset\wells\ml_ready")
OUTPUT_PATH = ROOT / "public" / "data" / "ml" / "classic_water_model.json"
COMPARISON_OUTPUT_PATH = ROOT / "public" / "data" / "ml" / "model_comparison.json"

TRAINED_AT = "2026-06-02"
LEAKAGE_EXCLUDED = [
    "depth_m",
    "yield_lps",
    "tds_g_l",
    "water_quality_note",
    "success",
    "source_url",
    "source_type",
    "source_description",
    "data_status",
    "notes",
]

SIMPLE_FEATURES = [
    "slope_deg",
    "elevation_m",
    "dist_to_river_m",
    "dist_to_road_m",
    "is_pasture",
    "nearest_water_type_enc",
    "land_cover_class_enc",
]

RAW_V2_FEATURES = [
    "slope_deg",
    "curvature",
    "flow_accumulation",
    "twi",
    "elevation_m",
    "dist_to_river_m",
    "dist_to_lake_m",
    "dist_to_canal_m",
    "drainage_density_5km",
    "annual_precip_mm",
    "spring_precip_mm",
    "summer_precip_mm",
    "dry_months_count",
    "pet_mm",
    "aet_mm",
    "aridity_index",
    "water_deficit_mm",
    "annual_temp_c",
    "summer_temp_c",
    "ndvi_mean_growing_season",
    "ndvi_summer_min",
    "ndvi_anomaly",
    "vegetation_stability",
    "is_pasture",
    "pasture_area_5km",
    "grazing_pressure_proxy",
    "sand_pct",
    "clay_pct",
    "silt_pct",
    "organic_carbon",
    "bulk_density",
    "soil_water_capacity_proxy",
    "aquifer_proxy",
    "permeability_proxy",
    "carbonate_flag",
    "alluvial_flag",
    "dist_to_fault_m",
    "fault_density_10km",
    "near_fault_flag",
    "dist_to_road_m",
    "dist_to_settlement_m",
    "nearest_water_type_enc",
    "land_cover_class_enc",
    "soil_texture_class_enc",
    "lithology_class_enc",
    "geological_age_enc",
]

ENGINEERED_FEATURES = [
    "nearest_surface_water_m",
    "log_nearest_surface_water_m",
    "log_flow_accumulation",
    "log_dist_to_fault_m",
    "water_balance_mm",
    "soil_infiltration_index",
    "geology_water_index",
    "vegetation_moisture_index",
    "access_cost_index",
    "aridity_pressure_index",
]

INTERACTION_FEATURES = [
    "twi_x_alluvial",
    "aquifer_x_near_fault",
    "water_balance_x_soil_capacity",
    "pasture_x_water_access",
]

V2_FEATURES = RAW_V2_FEATURES + ENGINEERED_FEATURES
POLY_FEATURES = V2_FEATURES + INTERACTION_FEATURES

FEATURE_LABELS = {
    "slope_deg": "Уклон рельефа",
    "curvature": "Кривизна поверхности",
    "flow_accumulation": "Накопление стока",
    "twi": "Topographic Wetness Index",
    "elevation_m": "Высота точки",
    "dist_to_river_m": "Расстояние до реки",
    "dist_to_lake_m": "Расстояние до озера",
    "dist_to_canal_m": "Расстояние до канала",
    "drainage_density_5km": "Плотность дренажной сети",
    "annual_precip_mm": "Годовые осадки",
    "spring_precip_mm": "Весенние осадки",
    "summer_precip_mm": "Летние осадки",
    "dry_months_count": "Сухие месяцы",
    "pet_mm": "Потенциальная испаряемость",
    "aet_mm": "Фактическая испаряемость",
    "aridity_index": "Индекс засушливости",
    "water_deficit_mm": "Дефицит влаги",
    "annual_temp_c": "Среднегодовая температура",
    "summer_temp_c": "Летняя температура",
    "ndvi_mean_growing_season": "NDVI за сезон роста",
    "ndvi_summer_min": "Минимальный летний NDVI",
    "ndvi_anomaly": "Аномалия NDVI",
    "vegetation_stability": "Стабильность растительности",
    "is_pasture": "Пастбищный/степной контекст",
    "pasture_area_5km": "Площадь пастбищ вокруг",
    "grazing_pressure_proxy": "Прокси пастбищной нагрузки",
    "sand_pct": "Доля песка",
    "clay_pct": "Доля глины",
    "silt_pct": "Доля ила",
    "organic_carbon": "Органический углерод",
    "bulk_density": "Плотность почвы",
    "soil_water_capacity_proxy": "Водоудерживающая способность почвы",
    "aquifer_proxy": "Прокси водоносного потенциала",
    "permeability_proxy": "Прокси проницаемости пород",
    "carbonate_flag": "Карбонатные породы",
    "alluvial_flag": "Аллювиальные отложения",
    "dist_to_fault_m": "Расстояние до разлома",
    "fault_density_10km": "Плотность разломов",
    "near_fault_flag": "Разлом рядом",
    "dist_to_road_m": "Расстояние до дороги",
    "dist_to_settlement_m": "Расстояние до населенного пункта",
    "nearest_water_type_enc": "Тип ближайшей воды",
    "land_cover_class_enc": "Тип покрытия земли",
    "soil_texture_class_enc": "Тип почвы",
    "lithology_class_enc": "Литология",
    "geological_age_enc": "Геологический возраст",
    "nearest_surface_water_m": "Ближайшая поверхностная вода",
    "log_nearest_surface_water_m": "Лог-дистанция до воды",
    "log_flow_accumulation": "Лог-накопление стока",
    "log_dist_to_fault_m": "Лог-дистанция до разлома",
    "water_balance_mm": "Водный баланс",
    "soil_infiltration_index": "Индекс инфильтрации почвы",
    "geology_water_index": "Геологический водный индекс",
    "vegetation_moisture_index": "Индекс влажности по растительности",
    "access_cost_index": "Индекс стоимости доступа",
    "aridity_pressure_index": "Индекс аридного давления",
    "twi_x_alluvial": "TWI x аллювий",
    "aquifer_x_near_fault": "Водоносный потенциал x разлом",
    "water_balance_x_soil_capacity": "Водный баланс x емкость почвы",
    "pasture_x_water_access": "Пастбище x доступ к воде",
}

FEATURE_GROUPS = {
    "Рельеф": [
        "slope_deg",
        "curvature",
        "flow_accumulation",
        "twi",
        "elevation_m",
        "log_flow_accumulation",
        "twi_x_alluvial",
    ],
    "Вода": [
        "dist_to_river_m",
        "dist_to_lake_m",
        "dist_to_canal_m",
        "nearest_surface_water_m",
        "log_nearest_surface_water_m",
        "drainage_density_5km",
    ],
    "Климат": [
        "annual_precip_mm",
        "spring_precip_mm",
        "summer_precip_mm",
        "dry_months_count",
        "pet_mm",
        "aet_mm",
        "aridity_index",
        "water_deficit_mm",
        "water_balance_mm",
        "aridity_pressure_index",
        "annual_temp_c",
        "summer_temp_c",
    ],
    "Растительность": [
        "ndvi_mean_growing_season",
        "ndvi_summer_min",
        "ndvi_anomaly",
        "vegetation_stability",
        "vegetation_moisture_index",
        "is_pasture",
        "pasture_area_5km",
        "grazing_pressure_proxy",
        "pasture_x_water_access",
        "land_cover_class_enc",
    ],
    "Почвы": [
        "sand_pct",
        "clay_pct",
        "silt_pct",
        "organic_carbon",
        "bulk_density",
        "soil_water_capacity_proxy",
        "soil_infiltration_index",
        "soil_texture_class_enc",
        "water_balance_x_soil_capacity",
    ],
    "Геология": [
        "aquifer_proxy",
        "permeability_proxy",
        "carbonate_flag",
        "alluvial_flag",
        "dist_to_fault_m",
        "log_dist_to_fault_m",
        "fault_density_10km",
        "near_fault_flag",
        "geology_water_index",
        "aquifer_x_near_fault",
        "lithology_class_enc",
        "geological_age_enc",
    ],
    "Доступность": [
        "dist_to_road_m",
        "dist_to_settlement_m",
        "access_cost_index",
    ],
}


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def as_float(row: dict[str, str], key: str) -> float | None:
    value = row.get(key, "").strip()
    if not value:
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    return parsed if math.isfinite(parsed) else None


def safe_min(values: Iterable[float | None]) -> float | None:
    clean = [value for value in values if value is not None and value >= 0]
    return min(clean) if clean else None


def clamp(value: float, min_value = 0.0, max_value = 1.0) -> float:
    return max(min_value, min(max_value, value))


def log1p_or_none(value: float | None) -> float | None:
    if value is None or value < 0:
        return None
    return math.log1p(value)


def feature_group(feature: str) -> str:
    for group, features in FEATURE_GROUPS.items():
        if feature in features:
            return group
    return "Прочее"


def feature_value(row: dict[str, str], feature: str) -> float | None:
    if feature in RAW_V2_FEATURES or feature in SIMPLE_FEATURES:
        return as_float(row, feature)

    nearest_water = safe_min([
        as_float(row, "dist_to_river_m"),
        as_float(row, "dist_to_lake_m"),
        as_float(row, "dist_to_canal_m"),
    ])

    if feature == "nearest_surface_water_m":
        return nearest_water
    if feature == "log_nearest_surface_water_m":
        return log1p_or_none(nearest_water)
    if feature == "log_flow_accumulation":
        return log1p_or_none(as_float(row, "flow_accumulation"))
    if feature == "log_dist_to_fault_m":
        return log1p_or_none(as_float(row, "dist_to_fault_m"))
    if feature == "water_balance_mm":
        precip = as_float(row, "annual_precip_mm")
        pet = as_float(row, "pet_mm")
        return None if precip is None or pet is None else precip - pet
    if feature == "soil_infiltration_index":
        sand = as_float(row, "sand_pct")
        clay = as_float(row, "clay_pct")
        capacity = as_float(row, "soil_water_capacity_proxy")
        organic = as_float(row, "organic_carbon")
        if sand is None or clay is None or capacity is None:
            return None
        organic_term = 0 if organic is None else clamp(organic / 4)
        return clamp((sand / 100) * 0.45 + capacity * 0.35 + organic_term * 0.2 - (clay / 100) * 0.25)
    if feature == "geology_water_index":
        aquifer = as_float(row, "aquifer_proxy")
        permeability = as_float(row, "permeability_proxy")
        alluvial = as_float(row, "alluvial_flag") or 0
        near_fault = as_float(row, "near_fault_flag") or 0
        fault_density = as_float(row, "fault_density_10km") or 0
        if aquifer is None or permeability is None:
            return None
        return clamp(aquifer * 0.38 + permeability * 0.34 + alluvial * 0.12 + near_fault * 0.08 + clamp(fault_density, 0, 1) * 0.08)
    if feature == "vegetation_moisture_index":
        ndvi = as_float(row, "ndvi_mean_growing_season")
        summer_min = as_float(row, "ndvi_summer_min")
        anomaly = as_float(row, "ndvi_anomaly")
        stability = as_float(row, "vegetation_stability")
        if ndvi is None or summer_min is None:
            return None
        return ndvi * 0.42 + summer_min * 0.28 + (stability or 0) * 0.2 + (anomaly or 0) * 0.1
    if feature == "access_cost_index":
        road = as_float(row, "dist_to_road_m")
        settlement = as_float(row, "dist_to_settlement_m")
        if road is None and settlement is None:
            return None
        return log1p_or_none((road or 0) * 0.65 + (settlement or 0) * 0.35)
    if feature == "aridity_pressure_index":
        aridity = as_float(row, "aridity_index")
        dry_months = as_float(row, "dry_months_count")
        deficit = as_float(row, "water_deficit_mm")
        if aridity is None:
            return None
        return aridity * 0.55 + ((dry_months or 0) / 12) * 0.25 + clamp((deficit or 0) / 700) * 0.2
    if feature == "twi_x_alluvial":
        twi = as_float(row, "twi")
        alluvial = as_float(row, "alluvial_flag")
        return None if twi is None or alluvial is None else twi * alluvial
    if feature == "aquifer_x_near_fault":
        aquifer = as_float(row, "aquifer_proxy")
        near_fault = as_float(row, "near_fault_flag")
        return None if aquifer is None or near_fault is None else aquifer * near_fault
    if feature == "water_balance_x_soil_capacity":
        balance = feature_value(row, "water_balance_mm")
        capacity = as_float(row, "soil_water_capacity_proxy")
        return None if balance is None or capacity is None else balance * capacity
    if feature == "pasture_x_water_access":
        is_pasture = as_float(row, "is_pasture")
        if is_pasture is None or nearest_water is None:
            return None
        return is_pasture / (1 + nearest_water / 50_000)

    return as_float(row, feature)


def mean(values: Iterable[float]) -> float:
    data = list(values)
    return sum(data) / len(data) if data else 0.0


def compute_stats(rows: list[dict[str, str]], features: list[str]) -> dict[str, dict[str, float]]:
    stats: dict[str, dict[str, float]] = {}
    for feature in features:
        values = [value for row in rows if (value := feature_value(row, feature)) is not None]
        feature_mean = mean(values)
        variance = mean((value - feature_mean) ** 2 for value in values)
        std = math.sqrt(variance) if variance > 1e-12 else 1.0
        stats[feature] = {"mean": feature_mean, "std": std}
    return stats


def vectorize(row: dict[str, str], features: list[str], stats: dict[str, dict[str, float]]) -> list[float]:
    output: list[float] = []
    for feature in features:
        value = feature_value(row, feature)
        if value is None:
            value = stats[feature]["mean"]
        output.append((value - stats[feature]["mean"]) / stats[feature]["std"])
    return output


def sigmoid(value: float) -> float:
    if value >= 0:
        z = math.exp(-value)
        return 1 / (1 + z)
    z = math.exp(value)
    return z / (1 + z)


def train_logistic_regression(x: list[list[float]], y: list[int], l2 = 0.022) -> tuple[list[float], float]:
    random.seed(42)
    weights = [0.0 for _ in range(len(x[0]))]
    intercept = 0.0
    lr = 0.075

    for step in range(5200):
        grad_w = [0.0 for _ in weights]
        grad_b = 0.0
        for features, target in zip(x, y):
            prediction = sigmoid(sum(weight * value for weight, value in zip(weights, features)) + intercept)
            error = prediction - target
            grad_b += error
            for index, value in enumerate(features):
                grad_w[index] += error * value

        scale = 1 / len(x)
        decay = 1 / math.sqrt(1 + step * 0.0008)
        for index in range(len(weights)):
            grad = grad_w[index] * scale + l2 * weights[index]
            weights[index] -= lr * decay * grad
        intercept -= lr * decay * grad_b * scale

    return weights, intercept


def predict_logistic(features: list[float], weights: list[float], intercept: float) -> float:
    return sigmoid(sum(weight * value for weight, value in zip(weights, features)) + intercept)


def auc_score(y_true: list[int], y_score: list[float]) -> float:
    pairs = sorted(zip(y_score, y_true), key=lambda item: item[0])
    positives = sum(y_true)
    negatives = len(y_true) - positives
    if positives == 0 or negatives == 0:
        return 0.0

    rank_sum = 0.0
    for rank, (_, target) in enumerate(pairs, start=1):
        if target == 1:
            rank_sum += rank

    return (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)


def metrics_from_scores(y_true: list[int], y_score: list[float]) -> dict[str, object]:
    y_pred = [1 if score >= 0.5 else 0 for score in y_score]
    tp = sum(1 for actual, pred in zip(y_true, y_pred) if actual == 1 and pred == 1)
    tn = sum(1 for actual, pred in zip(y_true, y_pred) if actual == 0 and pred == 0)
    fp = sum(1 for actual, pred in zip(y_true, y_pred) if actual == 0 and pred == 1)
    fn = sum(1 for actual, pred in zip(y_true, y_pred) if actual == 1 and pred == 0)
    accuracy = (tp + tn) / len(y_true) if y_true else 0
    precision = tp / (tp + fp) if (tp + fp) else 0
    recall = tp / (tp + fn) if (tp + fn) else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "auc": round(auc_score(y_true, y_score), 4),
        "count": len(y_true),
        "positiveRate": round(sum(y_true) / len(y_true), 4) if y_true else 0,
        "confusionMatrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
    }


def labels(rows: list[dict[str, str]]) -> list[int]:
    return [int(as_float(row, "success") or 0) for row in rows]


def evaluate_logistic(
    rows: list[dict[str, str]],
    features: list[str],
    stats: dict[str, dict[str, float]],
    weights: list[float],
    intercept: float,
) -> dict[str, object]:
    scores = [predict_logistic(vectorize(row, features, stats), weights, intercept) for row in rows]
    return metrics_from_scores(labels(rows), scores)


def candidate_thresholds(values: list[float]) -> list[float]:
    unique_values = sorted(set(values))
    if len(unique_values) <= 1:
        return unique_values

    thresholds: list[float] = []
    for ratio in (0.2, 0.35, 0.5, 0.65, 0.8):
        index = min(len(unique_values) - 1, max(0, round((len(unique_values) - 1) * ratio)))
        thresholds.append(unique_values[index])
    return sorted(set(thresholds))


def train_stump_ensemble(x: list[list[float]], y: list[int], max_stumps = 18) -> list[dict[str, float | int]]:
    stumps: list[dict[str, float | int]] = []
    for feature_index in range(len(x[0])):
        values = [row[feature_index] for row in x]
        for threshold in candidate_thresholds(values):
            for polarity in (1, -1):
                predictions = [
                    1 if ((value >= threshold) if polarity == 1 else (value < threshold)) else 0
                    for value in values
                ]
                correct = sum(1 for actual, pred in zip(y, predictions) if actual == pred)
                accuracy = correct / len(y) if y else 0
                if accuracy < 0.5:
                    continue
                weight = math.log((accuracy + 1e-6) / (1 - accuracy + 1e-6))
                stumps.append({
                    "featureIndex": feature_index,
                    "threshold": round(threshold, 8),
                    "polarity": polarity,
                    "weight": round(weight, 8),
                    "trainAccuracy": round(accuracy, 4),
                })

    return sorted(stumps, key=lambda stump: float(stump["trainAccuracy"]), reverse=True)[:max_stumps]


def predict_stump_ensemble(features: list[float], stumps: list[dict[str, float | int]]) -> float:
    if not stumps:
        return 0.5
    logit = 0.0
    for stump in stumps:
        feature_index = int(stump["featureIndex"])
        threshold = float(stump["threshold"])
        polarity = int(stump["polarity"])
        weight = float(stump["weight"])
        passed = features[feature_index] >= threshold if polarity == 1 else features[feature_index] < threshold
        logit += weight if passed else -weight
    return sigmoid(logit / max(1, len(stumps) ** 0.5))


def evaluate_stumps(
    rows: list[dict[str, str]],
    features: list[str],
    stats: dict[str, dict[str, float]],
    stumps: list[dict[str, float | int]],
) -> dict[str, object]:
    scores = [predict_stump_ensemble(vectorize(row, features, stats), stumps) for row in rows]
    return metrics_from_scores(labels(rows), scores)


def train_gaussian_nb(x: list[list[float]], y: list[int]) -> dict[str, object]:
    classes = [0, 1]
    params: dict[int, dict[str, object]] = {}
    for cls in classes:
        rows = [features for features, target in zip(x, y) if target == cls]
        prior = len(rows) / len(y) if y else 0.5
        means = [mean(row[index] for row in rows) if rows else 0 for index in range(len(x[0]))]
        variances = []
        for index, feature_mean in enumerate(means):
            variance = mean((row[index] - feature_mean) ** 2 for row in rows) if rows else 1
            variances.append(max(variance, 1e-4))
        params[cls] = {"prior": prior, "means": means, "variances": variances}
    return {"classes": params}


def predict_gaussian_nb(features: list[float], model: dict[str, object]) -> float:
    scores: dict[int, float] = {}
    classes = model["classes"]  # type: ignore[index]
    for cls in (0, 1):
        params = classes[cls]  # type: ignore[index]
        log_prob = math.log(max(float(params["prior"]), 1e-6))  # type: ignore[index]
        means = params["means"]  # type: ignore[index]
        variances = params["variances"]  # type: ignore[index]
        for value, feature_mean, variance in zip(features, means, variances):  # type: ignore[arg-type]
            log_prob += -0.5 * math.log(2 * math.pi * variance) - ((value - feature_mean) ** 2) / (2 * variance)
        scores[cls] = log_prob
    return sigmoid(scores[1] - scores[0])


def evaluate_gaussian_nb(
    rows: list[dict[str, str]],
    features: list[str],
    stats: dict[str, dict[str, float]],
    model: dict[str, object],
) -> dict[str, object]:
    scores = [predict_gaussian_nb(vectorize(row, features, stats), model) for row in rows]
    return metrics_from_scores(labels(rows), scores)


def category_mapping(rows: list[dict[str, str]], raw_key: str, encoded_key: str) -> dict[str, float]:
    mapping: dict[str, float] = {}
    for row in rows:
        raw = row.get(raw_key, "").strip()
        encoded = as_float(row, encoded_key)
        if raw and encoded is not None:
            mapping[raw] = encoded
    return dict(sorted(mapping.items()))


def fit_logistic_model(name: str, features: list[str], train_rows: list[dict[str, str]], val_rows: list[dict[str, str]], test_rows: list[dict[str, str]], l2 = 0.022) -> dict[str, object]:
    stats = compute_stats(train_rows, features)
    x_train = [vectorize(row, features, stats) for row in train_rows]
    y_train = labels(train_rows)
    weights, intercept = train_logistic_regression(x_train, y_train, l2=l2)
    metrics = {
        "train": evaluate_logistic(train_rows, features, stats, weights, intercept),
        "val": evaluate_logistic(val_rows, features, stats, weights, intercept),
        "test": evaluate_logistic(test_rows, features, stats, weights, intercept),
    }
    return {
        "modelType": name,
        "browserInference": True,
        "features": features,
        "stats": stats,
        "weights": weights,
        "intercept": intercept,
        "metrics": metrics,
    }


def model_score(model: dict[str, object]) -> float:
    metrics = model["metrics"]  # type: ignore[index]
    train = metrics["train"]  # type: ignore[index]
    val = metrics["val"]  # type: ignore[index]
    train_auc = float(train["auc"])  # type: ignore[index]
    val_auc = float(val["auc"])  # type: ignore[index]
    val_f1 = float(val["f1"])  # type: ignore[index]
    return val_auc + val_f1 * 0.06 - abs(train_auc - val_auc) * 0.18


def feature_importance(features: list[str], weights: list[float]) -> list[dict[str, object]]:
    total = sum(abs(weight) for weight in weights) or 1
    return [
        {
            "feature": feature,
            "label": FEATURE_LABELS.get(feature, feature),
            "group": feature_group(feature),
            "weight": round(weight, 8),
            "importance": round(abs(weight) / total, 6),
            "direction": "positive" if weight >= 0 else "risk",
        }
        for feature, weight in sorted(zip(features, weights), key=lambda item: abs(item[1]), reverse=True)
    ]


def nb_feature_importance(features: list[str], model: dict[str, object]) -> list[dict[str, object]]:
    classes = model["classes"]  # type: ignore[index]
    class0 = classes[0]  # type: ignore[index]
    class1 = classes[1]  # type: ignore[index]
    means0 = class0["means"]  # type: ignore[index]
    means1 = class1["means"]  # type: ignore[index]
    variances0 = class0["variances"]  # type: ignore[index]
    variances1 = class1["variances"]  # type: ignore[index]
    raw = []
    for feature, mean0, mean1, variance0, variance1 in zip(features, means0, means1, variances0, variances1):  # type: ignore[arg-type]
        direction_value = float(mean1) - float(mean0)
        importance = abs(direction_value) / math.sqrt(float(variance0) + float(variance1))
        raw.append((feature, direction_value, importance))
    total = sum(item[2] for item in raw) or 1
    return [
        {
            "feature": feature,
            "label": FEATURE_LABELS.get(feature, feature),
            "group": feature_group(feature),
            "weight": round(direction_value, 8),
            "importance": round(importance / total, 6),
            "direction": "positive" if direction_value >= 0 else "risk",
        }
        for feature, direction_value, importance in sorted(raw, key=lambda item: item[2], reverse=True)
    ]


def main() -> None:
    train_rows = read_rows(DATASET_ROOT / "train.csv")
    val_rows = read_rows(DATASET_ROOT / "val.csv")
    test_rows = read_rows(DATASET_ROOT / "test.csv")
    all_rows = train_rows + val_rows + test_rows

    model_candidates = [
        fit_logistic_model("LogisticRegressionV1", SIMPLE_FEATURES, train_rows, val_rows, test_rows, l2=0.018),
        fit_logistic_model("LogisticRegressionV2", V2_FEATURES, train_rows, val_rows, test_rows, l2=0.026),
        fit_logistic_model("PolynomialLogisticRegressionV2", POLY_FEATURES, train_rows, val_rows, test_rows, l2=0.034),
    ]

    stump_stats = compute_stats(train_rows, POLY_FEATURES)
    x_train_poly = [vectorize(row, POLY_FEATURES, stump_stats) for row in train_rows]
    y_train = labels(train_rows)
    stumps = train_stump_ensemble(x_train_poly, y_train)
    stump_metrics = {
        "train": evaluate_stumps(train_rows, POLY_FEATURES, stump_stats, stumps),
        "val": evaluate_stumps(val_rows, POLY_FEATURES, stump_stats, stumps),
        "test": evaluate_stumps(test_rows, POLY_FEATURES, stump_stats, stumps),
    }
    model_candidates.append({
        "modelType": "DecisionStumpEnsemble",
        "browserInference": False,
        "features": POLY_FEATURES,
        "metrics": stump_metrics,
        "stumpCount": len(stumps),
    })

    nb_stats = compute_stats(train_rows, V2_FEATURES)
    nb_model = train_gaussian_nb([vectorize(row, V2_FEATURES, nb_stats) for row in train_rows], y_train)
    nb_metrics = {
        "train": evaluate_gaussian_nb(train_rows, V2_FEATURES, nb_stats, nb_model),
        "val": evaluate_gaussian_nb(val_rows, V2_FEATURES, nb_stats, nb_model),
        "test": evaluate_gaussian_nb(test_rows, V2_FEATURES, nb_stats, nb_model),
    }
    model_candidates.append({
        "modelType": "GaussianNaiveBayes",
        "browserInference": True,
        "features": V2_FEATURES,
        "stats": nb_stats,
        "gaussianParams": nb_model,
        "metrics": nb_metrics,
    })

    browser_safe = [model for model in model_candidates if model["browserInference"]]
    selected = max(browser_safe, key=model_score)
    selected_features = selected["features"]  # type: ignore[assignment]
    selected_stats = selected["stats"]  # type: ignore[assignment]
    selected_model_type = str(selected["modelType"])

    if selected_model_type == "GaussianNaiveBayes":
        gaussian_params = selected["gaussianParams"]  # type: ignore[assignment]
        selected_importance = nb_feature_importance(selected_features, gaussian_params)
        selected_weights = {item["feature"]: item["weight"] for item in selected_importance}
        selected_intercept = math.log(
            max(float(gaussian_params["classes"][1]["prior"]), 1e-6) /  # type: ignore[index]
            max(float(gaussian_params["classes"][0]["prior"]), 1e-6)  # type: ignore[index]
        )
    else:
        gaussian_params = None
        selected_weight_list = selected["weights"]  # type: ignore[assignment]
        selected_importance = feature_importance(selected_features, selected_weight_list)
        selected_weights = {
            feature: round(weight, 8)
            for feature, weight in zip(selected_features, selected_weight_list)
        }
        selected_intercept = float(selected["intercept"])

    comparison_models = []
    for item in model_candidates:
        comparison_models.append({
            "modelType": item["modelType"],
            "browserInference": item["browserInference"],
            "featureCount": len(item["features"]),  # type: ignore[arg-type]
            "metrics": item["metrics"],
            "selectionScore": round(model_score(item), 4) if item["browserInference"] else None,
        })

    comparison = {
        "version": "classic-ml-comparison-v2",
        "trainedAt": TRAINED_AT,
        "audience": "hydrogeological_services",
        "target": "success",
        "leakageExcluded": LEAKAGE_EXCLUDED,
        "chosenModel": selected["modelType"],
        "chosenReason": "Selected among browser-safe models by validation AUC, F1, and overfit penalty.",
        "models": comparison_models,
    }

    model = {
        "version": "classic-ml-v2-feature-engineered",
        "trainedAt": TRAINED_AT,
        "audience": "hydrogeological_services",
        "modelType": selected_model_type,
        "target": "success",
        "thresholds": {
            "likely": 0.62,
            "unlikely": 0.42,
        },
        "features": selected_features,
        "engineeredFeatures": [feature for feature in selected_features if feature in ENGINEERED_FEATURES or feature in INTERACTION_FEATURES],
        "featureLabels": {feature: FEATURE_LABELS.get(feature, feature) for feature in selected_features},
        "featureGroups": {feature: feature_group(feature) for feature in selected_features},
        "featureStats": {
            key: {"mean": round(value["mean"], 8), "std": round(value["std"], 8)}
            for key, value in selected_stats.items()
        },
        "weights": selected_weights,
        "intercept": round(selected_intercept, 8),
        "gaussianParams": gaussian_params,
        "featureImportance": selected_importance,
        "categoryMappings": {
            "nearest_water_type": category_mapping(all_rows, "nearest_water_type", "nearest_water_type_enc"),
            "land_cover_class": category_mapping(all_rows, "land_cover_class", "land_cover_class_enc"),
            "soil_texture_class": category_mapping(all_rows, "soil_texture_class", "soil_texture_class_enc"),
            "lithology_class": category_mapping(all_rows, "lithology_class", "lithology_class_enc"),
            "geological_age": category_mapping(all_rows, "geological_age", "geological_age_enc"),
        },
        "metrics": selected["metrics"],
        "modelComparison": {
            "chosenModel": comparison["chosenModel"],
            "chosenReason": comparison["chosenReason"],
            "models": comparison_models,
        },
        "selectedModelReason": comparison["chosenReason"],
        "leakageExcluded": LEAKAGE_EXCLUDED,
        "notes": [
            "Uses only pre-drilling GIS, climate, soil, geology, vegetation, and access features.",
            "Feature engineering includes surface-water proximity, water balance, terrain, soil infiltration, geology, vegetation, and access indices.",
            "Client-side map inference imputes missing layers with train means and lowers confidence when layers are absent.",
            "Final production calibration requires verified historical wells from hydrogeological services.",
        ],
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding="utf-8")
    COMPARISON_OUTPUT_PATH.write_text(json.dumps(comparison, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Wrote {COMPARISON_OUTPUT_PATH}")
    print(json.dumps({
        "selected": selected_model_type,
        "metrics": model["metrics"],
        "comparison": comparison_models,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
