import numpy as np
from scipy.interpolate import Rbf
from scipy.stats import gaussian_kde
import json
from pathlib import Path

# C = 0.25*A + 0.20*B + 0.20*V + 0.15*G + 0.10*D + 0.10*E

def discretize_mineralization(tds: float) -> float:
    """А: Минерализация (Вес 0.25). Нелинейная дискретизация."""
    if tds < 1.0:
        return 1.0  # 100 баллов
    elif 1.0 <= tds <= 3.0:
        return 0.6  # 60 баллов
    else:
        return 0.0  # 0 баллов

def normalize_depth(depth: float, depth_min: float, depth_max: float) -> float:
    """Б: Глубина до воды (Вес 0.20). Инвертируется и нормализуется."""
    if depth_max == depth_min:
        return 1.0
    # Инверсия: чем больше глубина, тем хуже (ближе к 0)
    score = 1.0 - (depth - depth_min) / (depth_max - depth_min)
    return max(0.0, min(1.0, score))

def map_lithology(lithology: str) -> float:
    """Г: Литологический состав / Тип коллектора (Вес 0.15). Категориальный маппинг."""
    mapping = {
        "галечник": 1.0,
        "песок": 0.8,
        "суглинок": 0.2
    }
    return mapping.get(lithology.lower(), 0.5)

def compute_density_score(lon: float, lat: float, all_lons: np.ndarray, all_lats: np.ndarray) -> float:
    """
    Д: Соседние скважины (Вес 0.10). 
    Расчет через Kernel Density Estimation для поиска 'золотой середины'.
    Слишком пусто - риск, слишком густо - риск истощения.
    """
    if len(all_lons) < 2:
        return 0.5
    
    positions = np.vstack([all_lons, all_lats])
    kernel = gaussian_kde(positions)
    density = kernel(np.vstack([lon, lat]))[0]
    
    # Нормализуем плотность к [0, 1] условно (в реальной задаче нужно знать min/max density)
    # Золотая середина: например, оптимум вокруг некоего среднего значения
    # Для простоты: 1.0 - abs(density - optimum) ...
    # Или просто возвращаем вычисленное значение в демо-версии
    # "Если рядом слишком много скважин — это тоже риск"
    # Допустим, density от 0 до 1, оптимум на 0.5:
    normalized_density = min(1.0, density)
    score = 1.0 - 2.0 * abs(normalized_density - 0.5)
    return max(0.0, min(1.0, score))

def interpolate_rbf(target_lon: float, target_lat: float, lons: np.ndarray, lats: np.ndarray, values: np.ndarray) -> float:
    """
    Интерполяция В (мощность пласта) и Е (дебит) методом радиально-базисных функций (RBF).
    """
    if len(lons) < 3:
        return float(np.mean(values)) if len(values) > 0 else 0.0
    rbf = Rbf(lons, lats, values, function='multiquadric')
    return float(rbf(target_lon, target_lat))

def compute_hps(
    tds: float, 
    depth: float, depth_min: float, depth_max: float,
    thickness: float, 
    lithology: str,
    yield_lps: float,
    density_score: float
) -> float:
    """
    Итоговая формула HPS.
    C = 0.25*A + 0.20*B + 0.20*V + 0.15*G + 0.10*D + 0.10*E
    """
    A = discretize_mineralization(tds)
    B = normalize_depth(depth, depth_min, depth_max)
    # Предполагаем, что thickness (V) и yield (E) уже нормализованы от 0 до 1 для использования в формуле
    # или применяем простую макс. нормализацию. Будем считать, что переданы нормированные [0, 1] значения.
    V = max(0.0, min(1.0, thickness)) 
    G = map_lithology(lithology)
    D = density_score
    E = max(0.0, min(1.0, yield_lps))

    C = 0.25 * A + 0.20 * B + 0.20 * V + 0.15 * G + 0.10 * D + 0.10 * E
    return C

if __name__ == "__main__":
    # Демонстрационный прогон для пайплайна
    print("Инициализация математического ядра SmartPasture...")
    print("Формула: C = 0.25*A + 0.20*B + 0.20*V + 0.15*G + 0.10*D + 0.10*E")
    # ... further test code logic could go here
