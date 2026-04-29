import os
import re
import json
import numpy as np
import joblib
import shap
from dotenv import load_dotenv
from pymatgen.analysis.local_env import CrystalNN
from pymatgen.core.periodic_table import Element
from pymatgen.core import Structure, Composition
from sklearn.neighbors import NearestNeighbors
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer

load_dotenv()
API_KEY  = os.getenv("MP_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY", "")

# ── Prediction correction constants ──────────────────────────────────────────
# METALLIC_THRESHOLD: a material is only labelled metallic when BOTH the
# classifier predicts metallic AND the regressor gives a band gap below this
# value.  Prevents the classifier from overriding a clearly non-zero band gap.
METALLIC_THRESHOLD = 0.5   # eV

# SCISSOR_CORRECTION: PBE DFT (the typical MP training source) systematically
# underestimates band gaps.  Add a uniform shift to non-metallic predictions.
# Set to 0.0 to disable; typical values for oxides are 0.5–1.0 eV.
# Tune this on your own validation set before enabling.
SCISSOR_CORRECTION = 0.0   # eV  ← change to e.g. 0.7 after calibration

cnn = CrystalNN()

_BASE        = os.path.join(os.path.dirname(__file__), "..")
_bundle      = joblib.load(os.path.join(_BASE, "models", "trained_model.pkl"))
reg_pipeline = _bundle["reg_pipeline"]
clf_pipeline = _bundle["clf_pipeline"]

_data     = np.load(os.path.join(_BASE, "data", "processed", "dataset.npz"), allow_pickle=True)
_X        = _data["X"]
_y_reg    = _data["y_reg"]
_y_clf    = _data["y_clf"]
_formulas = _data["formulas"] if "formulas" in _data else np.array([""] * len(_X))

# ── Safe module-level imputation ─────────────────────────────────────────────
def _impute(X):
    if "imputer" in reg_pipeline.named_steps:
        return reg_pipeline.named_steps["imputer"].transform(X)
    for step in reg_pipeline.named_steps.values():
        if hasattr(step, "transform"):
            try:
                return step.transform(X)
            except Exception:
                continue
    col_means = np.nanmean(X, axis=0)
    col_means  = np.where(np.isnan(col_means), 0, col_means)
    result = X.copy().astype(float)
    for j in range(result.shape[1]):
        mask = np.isnan(result[:, j])
        result[mask, j] = col_means[j]
    return result

_X_imp = _impute(_X)
_nn    = NearestNeighbors(n_neighbors=6, metric="euclidean").fit(_X_imp)

_q_low_pipeline  = None
_q_high_pipeline = None

def _get_quantile_pipelines():
    global _q_low_pipeline, _q_high_pipeline
    if _q_low_pipeline is not None:
        return _q_low_pipeline, _q_high_pipeline
    base_params = dict(n_estimators=100, learning_rate=0.05,
                       subsample=0.8, random_state=42, max_depth=3)
    # These pipelines include their own SimpleImputer so _X (with any NaNs)
    # is safe to pass directly.
    _q_low_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="mean")),
        ("model",   GradientBoostingRegressor(loss="quantile", alpha=0.10, **base_params)),
    ])
    _q_high_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="mean")),
        ("model",   GradientBoostingRegressor(loss="quantile", alpha=0.90, **base_params)),
    ])
    _q_low_pipeline.fit(_X, _y_reg)
    _q_high_pipeline.fit(_X, _y_reg)
    return _q_low_pipeline, _q_high_pipeline

_background = np.zeros((1, 11))
explainer   = shap.Explainer(lambda x: reg_pipeline.predict(x), _background)

FEATURE_NAMES = [
    "Bond Length (avg)", "Bond Length (std)", "Bond Angle (avg)",
    "Angle Std",         "Min Angle",         "Max Angle",
    "Coordination",      "Atomic Number",     "Electronegativity",
    "Oxidation State",   "Volume / Atom",
]


def _validate_oxide(formula: str) -> None:
    if re.search(r'[A-Za-z]0(\d|[A-Z]|$)', formula):
        suggestion = re.sub(r'(?<=[A-Za-z])0', 'O', formula)
        raise ValueError(
            f"'{formula}' looks like it contains the digit 0 instead of the letter O. "
            f"Did you mean '{suggestion}'? "
            "This system only supports oxide materials."
        )
    try:
        comp    = Composition(formula)
        symbols = {el.symbol for el in comp.elements}
    except Exception:
        raise ValueError(
            f"Could not parse formula '{formula}'. "
            "Please use standard chemical notation (e.g. TiO2, Fe2O3)."
        )
    from pymatgen.core.periodic_table import Element as PMGElement
    for el in comp.elements:
        try:
            e = PMGElement(el.symbol)
            if e.Z is None or e.Z == 0:
                raise ValueError(f"'{el.symbol}' is not a recognised chemical element.")
        except Exception:
            raise ValueError(
                f"'{el.symbol}' in '{formula}' is not a recognised chemical element. "
                "Please use standard chemical notation (e.g. TiO2, Fe2O3)."
            )
    if "O" not in symbols:
        raise ValueError(
            f"'{formula}' is not an oxide — this system is trained exclusively on "
            "oxide materials (compounds containing oxygen). "
            f"Detected elements: {', '.join(sorted(symbols))}. "
            "Examples of valid inputs: TiO2, Fe2O3, ZnO, SiO2, Al2O3."
        )
    non_oxygen = symbols - {"O"}
    if not non_oxygen:
        raise ValueError(
            f"'{formula}' contains only oxygen. "
            "Please enter a valid oxide formula like TiO2, Fe2O3, ZnO."
        )


def _validate_oxide_structure(structure: Structure) -> None:
    symbols = set()
    for site in structure:
        sp = site.specie
        symbol = sp.symbol if hasattr(sp, "symbol") else sp.element.symbol
        symbols.add(symbol)

    if "O" not in symbols:
        raise ValueError(
            f"The uploaded CIF structure does not contain oxygen. "
            "This system is trained exclusively on oxide materials. "
            f"Detected elements: {', '.join(sorted(symbols))}."
        )


def extract_features(structure):
    structure = structure.copy()
    try:
        structure.add_oxidation_state_by_guess()
    except Exception:
        pass

    m_o_distances, m_o_m_angles, coordination_numbers = [], [], []
    atomic_numbers, electronegativities, oxidation_states = [], [], []

    for i, site in enumerate(structure):
        sp = site.specie
        symbol = sp.symbol if hasattr(sp, "symbol") else sp.element.symbol
        if symbol == "O":
            continue
        central = sp if hasattr(sp, "X") else sp.element
        atomic_numbers.append(central.Z)
        if central.X:
            electronegativities.append(central.X)
        try:
            oxidation_states.append(site.specie.oxi_state)
        except Exception:
            oxidation_states.append(0)
        try:
            neighbors = cnn.get_nn_info(structure, i)
        except Exception:
            continue
        coordination_numbers.append(len(neighbors))
        o_neighbors = []
        for n in neighbors:
            nbr = n["site"]
            if nbr.specie.element.symbol == "O":
                m_o_distances.append(site.distance(nbr))
                o_neighbors.append(nbr)
        for j in range(len(o_neighbors)):
            for k in range(j + 1, len(o_neighbors)):
                v1 = o_neighbors[j].coords - site.coords
                v2 = o_neighbors[k].coords - site.coords
                cos_a = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
                m_o_m_angles.append(np.degrees(np.arccos(np.clip(cos_a, -1.0, 1.0))))

    vpa = structure.volume / len(structure) if len(structure) > 0 else 0

    def safe(arr, fn):
        return float(fn(arr)) if arr else 0.0

    return [
        safe(m_o_distances,        np.mean),
        safe(m_o_distances,        np.std),
        safe(m_o_m_angles,         np.mean),
        safe(m_o_m_angles,         np.std),
        safe(m_o_m_angles,         np.min),
        safe(m_o_m_angles,         np.max),
        safe(coordination_numbers, np.mean),
        safe(atomic_numbers,       np.mean),
        safe(electronegativities,  np.mean),
        safe(oxidation_states,     np.mean),
        vpa,
    ]


def _fetch_doc(formula: str):
    from mp_api.client import MPRester
    with MPRester(API_KEY) as mpr:
        results = mpr.materials.summary.search(
            formula=formula,
            fields=["structure", "band_gap",
                    "energy_above_hull", "formula_pretty", "material_id"],
        )
    results.sort(key=lambda d: getattr(d, "energy_above_hull",
                                        float("inf")) or float("inf"))

    print(f"Material ID: {results[0].material_id}")
    print(f"Formula: {results[0].formula_pretty}")
    print(f"Band gap: {results[0].band_gap}")
    print(f"E above hull: {results[0].energy_above_hull}")
    print(f"Formula: {formula}")
    print(f"Found {len(results)} structures")
    for r in results[:3]:
        print(f"  hull={r.energy_above_hull:.4f}  "
              f"band_gap={r.band_gap:.3f}  "
              f"formula={r.formula_pretty}")

    return results[0]


def _stability(e_hull):
    if e_hull is None: return "Unknown"
    if e_hull == 0:    return "Stable"
    if e_hull < 0.1:   return "Metastable"
    return "Unstable"


def _material_type(bandgap, is_metallic):
    if is_metallic:   return "Metal"
    if bandgap < 3.0: return "Semiconductor"
    return "Insulator"


def _reconcile_metallic(bandgap: float, clf_prediction: bool) -> bool:
    """
    FIX: Reconcile the binary classifier with the regressor.

    The classifier (clf_pipeline) is a separate model and can disagree with
    the regressor (reg_pipeline).  When the regressor predicts a band gap
    above METALLIC_THRESHOLD we trust the regressor — the material has a real
    band gap and should not be labelled metallic.  Only when the classifier
    AND the regressor both agree (bandgap < METALLIC_THRESHOLD) do we call it
    metallic.  This prevents the wrong "Metallic / no band gap" label showing
    for wide-gap oxides like TiO2 or SiO2.
    """
    return clf_prediction and (bandgap < METALLIC_THRESHOLD)


def _apply_scissor(bandgap: float, is_metallic: bool) -> float:
    """
    Apply an optional scissor correction for PBE DFT underestimation.
    Only applied to non-metallic materials.  Controlled by SCISSOR_CORRECTION.
    """
    if is_metallic or SCISSOR_CORRECTION == 0.0:
        return bandgap
    return max(0.0, bandgap + SCISSOR_CORRECTION)


def _element_info(formula: str):
    try:
        comp = Composition(formula)
        out  = []
        for el, amt in comp.items():
            e   = Element(el.symbol)
            cat = ("Transition Metal" if e.is_transition_metal else
                   "Metal"           if e.is_metal             else
                   "Oxygen"          if el.symbol == "O"       else
                   "Metalloid"       if e.is_metalloid         else "Non-metal")
            out.append({"symbol": el.symbol, "name": e.long_name,
                        "number": e.Z, "amount": float(amt), "category": cat})
        return out
    except Exception:
        return []


def _shap_data(X_raw):
    sv   = explainer(X_raw)
    data = [{"name": FEATURE_NAMES[i], "value": float(sv.values[0][i]),
              "raw": float(X_raw[0][i])} for i in range(len(FEATURE_NAMES))]
    data.sort(key=lambda d: abs(d["value"]), reverse=True)
    return data


def _similar(X_raw):
    X_imp       = _impute(X_raw)
    dists, idxs = _nn.kneighbors(X_imp)
    results = []
    for dist, idx in zip(dists[0][1:6], idxs[0][1:6]):
        formula_label = str(_formulas[idx]) if idx < len(_formulas) else ""
        results.append({
            "formula":     formula_label,
            "band_gap":    round(float(_y_reg[idx]), 3),
            "is_metallic": bool(_y_clf[idx]),
            "distance":    round(float(dist), 3),
        })
    return results


def _confidence_interval(X_raw):
    try:
        q_low, q_high = _get_quantile_pipelines()
        low  = float(q_low.predict(X_raw)[0])
        high = float(q_high.predict(X_raw)[0])
        if low > high:
            low, high = high, low
        return round(max(low, 0.0), 3), round(high, 3)
    except Exception:
        return None, None


def _insights(bandgap, is_metallic, stability, shap_data, mp_bandgap=None):
    out = []
    if is_metallic:
        out.append("Metallic conductor — no band gap present.")
    elif bandgap < 1.5:
        out.append(f"Narrow band gap ({bandgap:.2f} eV) — candidate for IR photodetectors or thermoelectrics.")
    elif bandgap < 3.0:
        out.append(f"Semiconductor ({bandgap:.2f} eV) — promising for photovoltaic or optoelectronic applications.")
    else:
        out.append(f"Wide band gap ({bandgap:.2f} eV) — insulating or UV-active material.")
    if stability == "Stable":
        out.append("Thermodynamically stable — confirmed on the convex hull.")
    elif stability == "Metastable":
        out.append("Metastable — may be synthesisable under controlled conditions.")
    elif stability == "Unstable":
        out.append("Thermodynamically unstable — likely to decompose.")
    if shap_data:
        top       = shap_data[0]
        direction = "increases" if top["value"] > 0 else "decreases"
        out.append(f"'{top['name']}' is the strongest predictor and {direction} the band gap.")
    # Underestimation note
    if not is_metallic and mp_bandgap is not None:
        out.append(
            f"PBE DFT reference (Materials Project): {mp_bandgap:.3f} eV. "
            "ML predictions are trained on PBE data and may underestimate the true band gap — "
            "experimental values are typically 0.5–1.5 eV higher."
        )
    elif not is_metallic:
        out.append(
            "Note: ML predictions are trained on PBE DFT data, which systematically "
            "underestimates band gaps. Experimental values are typically 0.5–1.5 eV higher."
        )
    return out


def _build_result(formula, doc_or_none, structure, X_raw):
    # ── Regressor band gap ───────────────────────────────────────────────────
    raw_bandgap = float(reg_pipeline.predict(X_raw)[0])

    # ── FIX: reconcile classifier with regressor ─────────────────────────────
    # Only trust the classifier's "metallic" label when the regressor also
    # gives a near-zero band gap.  This prevents wide-gap semiconductors like
    # TiO2 from being mislabelled as metals when the two models disagree.
    clf_says_metal = bool(clf_pipeline.predict(X_raw)[0])
    is_metallic    = _reconcile_metallic(raw_bandgap, clf_says_metal)

    # ── Optional scissor correction for PBE underestimation ──────────────────
    bandgap = _apply_scissor(raw_bandgap, is_metallic)

    e_hull    = getattr(doc_or_none, "energy_above_hull", None) if doc_or_none else None
    stability = _stability(e_hull)

    # ── MP DFT band gap for reference ────────────────────────────────────────
    mp_bandgap = None
    if doc_or_none is not None:
        raw_mp = getattr(doc_or_none, "band_gap", None)
        if raw_mp is not None:
            try:
                mp_bandgap = round(float(raw_mp), 3)
            except (TypeError, ValueError):
                mp_bandgap = None

    shap_data       = _shap_data(X_raw)
    ci_low, ci_high = _confidence_interval(X_raw)

    return {
        "formula":       formula,
        "bandgap":       round(bandgap, 3),
        "raw_bandgap":   round(raw_bandgap, 3),   # pre-scissor value
        "mp_bandgap":    mp_bandgap,               # DFT reference from MP
        "ci_low":        ci_low,
        "ci_high":       ci_high,
        "is_metallic":   is_metallic,
        "clf_raw":       clf_says_metal,           # raw classifier output for debugging
        "material_type": _material_type(bandgap, is_metallic),
        "stability":     stability,
        "e_above_hull":  round(e_hull, 4) if e_hull is not None else None,
        "shap":          shap_data,
        "elements":      _element_info(formula),
        "similar":       _similar(X_raw),
        "insights":      _insights(bandgap, is_metallic, stability, shap_data, mp_bandgap),
    }


def _groq_chat(prompt: str, max_tokens: int = 400) -> str:
    import urllib.request, urllib.error
    payload = json.dumps({
        "model": "llama3-8b-8192",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type":  "application/json",
            "Authorization": f"Bearer {GROQ_KEY}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"].strip()


def natural_language_query(query: str) -> dict:
    extraction_prompt = f"""You are a materials science assistant.
Extract search criteria from this oxide materials query as JSON with these optional fields:
  band_gap_min (float), band_gap_max (float),
  is_metallic (bool or null),
  material_type (one of: "Semiconductor","Insulator","Metal" or null),
  description (string — 1-sentence plain-English restatement)

Return ONLY valid JSON. No markdown, no explanation.

Query: {query}"""

    raw = _groq_chat(extraction_prompt, max_tokens=300)
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        criteria = json.loads(raw)
    except Exception:
        criteria = {}

    description = criteria.get("description", query)
    bg_min     = criteria.get("band_gap_min")
    bg_max     = criteria.get("band_gap_max")
    want_metal = criteria.get("is_metallic")
    want_type  = criteria.get("material_type")

    all_bg_raw  = reg_pipeline.predict(_X).astype(float)
    all_clf     = clf_pipeline.predict(_X).astype(bool)
    # Apply same reconciliation for NL query results
    all_metal   = np.array([_reconcile_metallic(bg, clf) for bg, clf in zip(all_bg_raw, all_clf)])
    all_bg      = np.array([_apply_scissor(bg, m) for bg, m in zip(all_bg_raw, all_metal)])
    all_mtype   = np.array([_material_type(bg, m) for bg, m in zip(all_bg, all_metal)])

    mask = np.ones(len(_X), dtype=bool)
    if bg_min     is not None: mask &= all_bg >= float(bg_min)
    if bg_max     is not None: mask &= all_bg <= float(bg_max)
    if want_metal is not None: mask &= all_metal == bool(want_metal)
    if want_type  is not None: mask &= all_mtype == want_type

    indices = np.where(mask)[0]
    if bg_min is not None and bg_max is not None:
        mid     = (float(bg_min) + float(bg_max)) / 2
        indices = indices[np.argsort(np.abs(all_bg[indices] - mid))]
    else:
        indices = indices[np.argsort(all_bg[indices])]

    top_n      = indices[:10]
    candidates = []
    for idx in top_n:
        formula = str(_formulas[idx]) if idx < len(_formulas) and str(_formulas[idx]) else f"Material #{int(idx)}"
        candidates.append({
            "formula":       formula,
            "bandgap":       round(float(all_bg[idx]), 3),
            "is_metallic":   bool(all_metal[idx]),
            "material_type": str(all_mtype[idx]),
        })

    summary_prompt = f"""You are a materials science assistant.
A researcher queried: "{query}"
The system found {len(indices)} matching oxide materials.
Top results: {json.dumps(candidates[:5])}

Write a 2-3 sentence plain-English summary. Mention band gap range and patterns. Be concise."""

    summary = _groq_chat(summary_prompt, max_tokens=200)

    return {
        "query":         query,
        "description":   description,
        "criteria":      criteria,
        "total_matches": int(len(indices)),
        "results":       candidates,
        "summary":       summary,
    }


def fallback_query(query: str) -> dict:
    q       = query.lower()
    filters = {}
    numbers = re.findall(r"\d+\.?\d*", q)

    if "between" in q and len(numbers) >= 2:
        filters["band_gap_min"] = float(numbers[0])
        filters["band_gap_max"] = float(numbers[1])
    elif "above" in q and numbers:
        filters["band_gap_min"] = float(numbers[0])
    elif "below" in q and numbers:
        filters["band_gap_max"] = float(numbers[0])

    if "metal" in q and "semi" not in q:
        filters.setdefault("band_gap_max", METALLIC_THRESHOLD)
    elif "semiconductor" in q:
        filters.setdefault("band_gap_min", METALLIC_THRESHOLD)
        filters.setdefault("band_gap_max", 3.0)
    elif "insulator" in q:
        filters.setdefault("band_gap_min", 3.0)

    all_bg_raw  = reg_pipeline.predict(_X).astype(float)
    all_clf     = clf_pipeline.predict(_X).astype(bool)
    all_metal   = np.array([_reconcile_metallic(bg, clf) for bg, clf in zip(all_bg_raw, all_clf)])
    all_bg      = np.array([_apply_scissor(bg, m) for bg, m in zip(all_bg_raw, all_metal)])
    all_mtype   = np.array([_material_type(bg, m) for bg, m in zip(all_bg, all_metal)])

    mask = np.ones(len(_X), dtype=bool)
    if "band_gap_min" in filters: mask &= all_bg >= filters["band_gap_min"]
    if "band_gap_max" in filters: mask &= all_bg <= filters["band_gap_max"]

    indices = np.where(mask)[0]
    indices = indices[np.argsort(all_bg[indices])][:20]

    candidates = []
    for idx in indices:
        formula = str(_formulas[idx]) if idx < len(_formulas) and str(_formulas[idx]) else f"Material #{int(idx)}"
        candidates.append({
            "formula":       formula,
            "bandgap":       round(float(all_bg[idx]), 3),
            "is_metallic":   bool(all_metal[idx]),
            "material_type": str(all_mtype[idx]),
        })

    return {
        "mode":          "fallback",
        "criteria":      filters,
        "total_matches": len(candidates),
        "results":       candidates,
        "summary":       f"Found {len(candidates)} materials matching your query (keyword mode — add GROQ_API_KEY to .env for AI search).",
    }


def predict_material(formula: str) -> dict:
    _validate_oxide(formula)
    doc   = _fetch_doc(formula)
    X_raw = np.array(extract_features(doc.structure)).reshape(1, -1)
    return _build_result(getattr(doc, "formula_pretty", formula), doc, doc.structure, X_raw)


def predict_batch(formulas: list) -> list:
    results = []
    for formula in formulas:
        formula = formula.strip()
        if not formula:
            continue
        try:
            _validate_oxide(formula)
            doc            = _fetch_doc(formula)
            X_raw          = np.array(extract_features(doc.structure)).reshape(1, -1)
            raw_bandgap    = float(reg_pipeline.predict(X_raw)[0])
            clf_says_metal = bool(clf_pipeline.predict(X_raw)[0])
            # FIX: reconcile classifier with regressor
            is_metallic    = _reconcile_metallic(raw_bandgap, clf_says_metal)
            bandgap        = _apply_scissor(raw_bandgap, is_metallic)
            e_hull         = getattr(doc, "energy_above_hull", None)
            ci_low, ci_high = _confidence_interval(X_raw)
            mp_bandgap     = None
            raw_mp = getattr(doc, "band_gap", None)
            if raw_mp is not None:
                try:
                    mp_bandgap = round(float(raw_mp), 3)
                except (TypeError, ValueError):
                    pass
            results.append({
                "formula":       getattr(doc, "formula_pretty", formula),
                "bandgap":       round(bandgap, 3),
                "mp_bandgap":    mp_bandgap,
                "ci_low":        ci_low,
                "ci_high":       ci_high,
                "material_type": _material_type(bandgap, is_metallic),
                "is_metallic":   is_metallic,
                "stability":     _stability(e_hull),
                "e_above_hull":  round(e_hull, 4) if e_hull is not None else None,
                "error":         None,
            })
        except Exception as e:
            results.append({
                "formula": formula, "error": str(e),
                "bandgap": None, "mp_bandgap": None,
                "ci_low": None, "ci_high": None,
                "material_type": None, "stability": None, "e_above_hull": None,
            })
    return results


def predict_from_cif(cif_text: str) -> dict:
    structure = Structure.from_str(cif_text, fmt="cif")
    _validate_oxide_structure(structure)
    formula   = structure.composition.reduced_formula
    X_raw     = np.array(extract_features(structure)).reshape(1, -1)
    result    = _build_result(formula, None, structure, X_raw)
    result["source"]    = "CIF upload"
    result["stability"] = "Unknown"
    return result


def get_parity_data() -> dict:
    _, X_test, _, y_test = train_test_split(_X, _y_reg, test_size=0.2, random_state=42)
    y_pred    = reg_pipeline.predict(X_test)
    residuals = y_pred - y_test
    rmse      = float(np.sqrt(np.mean(residuals ** 2)))
    r2        = float(1 - np.sum(residuals**2) / np.sum((y_test - np.mean(y_test))**2))
    points    = [{"actual": round(float(a), 3), "predicted": round(float(p), 3)}
                 for a, p in zip(y_test, y_pred)]
    return {"points": points, "rmse": round(rmse, 4), "r2": round(r2, 4), "n": len(points)}


def get_pca_data() -> dict:
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler

    MAX_POINTS = 2000
    total = len(_X_imp)
    rng     = np.random.default_rng(42)
    indices = np.sort(rng.choice(total, min(MAX_POINTS, total), replace=False))

    X_sub        = _X_imp[indices]
    formulas_sub = _formulas[indices] if len(_formulas) == total else np.array([""] * len(indices))

    X_sc   = StandardScaler().fit_transform(X_sub)
    pca    = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(X_sc)

    all_bg_raw  = reg_pipeline.predict(X_sub).astype(float)
    all_clf     = clf_pipeline.predict(X_sub).astype(bool)
    all_metal   = np.array([_reconcile_metallic(bg, clf) for bg, clf in zip(all_bg_raw, all_clf)])
    all_bg      = np.array([_apply_scissor(bg, m) for bg, m in zip(all_bg_raw, all_metal)])

    points = []
    for i in range(len(X_sub)):
        formula = str(formulas_sub[i])
        if formula in ("", "nan", "None"):
            formula = ""
        points.append({
            "x":             round(float(coords[i, 0]), 4),
            "y":             round(float(coords[i, 1]), 4),
            "formula":       formula,
            "bandgap":       round(float(all_bg[i]), 3),
            "is_metallic":   bool(all_metal[i]),
            "material_type": _material_type(float(all_bg[i]), bool(all_metal[i])),
        })

    return {
        "points":   points,
        "variance": [round(float(v), 4) for v in pca.explained_variance_ratio_],
        "total":    int(total),
        "sampled":  len(points),
    }


def predict_composition_curve(formula_a: str, formula_b: str, steps: int = 21) -> dict:
    _validate_oxide(formula_a)
    _validate_oxide(formula_b)

    doc_a  = _fetch_doc(formula_a)
    doc_b  = _fetch_doc(formula_b)
    feat_a = np.array(extract_features(doc_a.structure))
    feat_b = np.array(extract_features(doc_b.structure))

    raw_bg_a       = float(reg_pipeline.predict(feat_a.reshape(1, -1))[0])
    raw_bg_b       = float(reg_pipeline.predict(feat_b.reshape(1, -1))[0])
    clf_a          = bool(clf_pipeline.predict(feat_a.reshape(1, -1))[0])
    clf_b          = bool(clf_pipeline.predict(feat_b.reshape(1, -1))[0])
    metal_a        = _reconcile_metallic(raw_bg_a, clf_a)
    metal_b        = _reconcile_metallic(raw_bg_b, clf_b)
    bg_a           = _apply_scissor(raw_bg_a, metal_a)
    bg_b           = _apply_scissor(raw_bg_b, metal_b)
    pretty_a       = getattr(doc_a, "formula_pretty", formula_a)
    pretty_b       = getattr(doc_b, "formula_pretty", formula_b)

    curve = []
    for ratio in np.linspace(1.0, 0.0, steps):
        X_raw          = (ratio * feat_a + (1.0 - ratio) * feat_b).reshape(1, -1)
        raw_bandgap    = float(reg_pipeline.predict(X_raw)[0])
        clf_prediction = bool(clf_pipeline.predict(X_raw)[0])
        # FIX: reconcile classifier for each interpolated composition
        is_metallic    = _reconcile_metallic(raw_bandgap, clf_prediction)
        bandgap        = _apply_scissor(raw_bandgap, is_metallic)
        ci_low, ci_high = _confidence_interval(X_raw)
        pct_a = round(float(ratio) * 100, 1)
        curve.append({
            "pct_a": pct_a, "pct_b": round(100 - pct_a, 1),
            "bandgap": round(bandgap, 3), "ci_low": ci_low, "ci_high": ci_high,
            "is_metallic": is_metallic,
            "label": f"{pct_a}% {pretty_a} / {round(100-pct_a,1)}% {pretty_b}",
        })

    bandgaps  = [p["bandgap"] for p in curve]
    max_bg    = max(bandgaps); min_bg = min(bandgaps)
    max_point = curve[bandgaps.index(max_bg)]
    min_point = curve[bandgaps.index(min_bg)]
    bowing    = round(curve[steps // 2]["bandgap"] - (bg_a + bg_b) / 2, 3)

    return {
        "formula_a": pretty_a, "formula_b": pretty_b,
        "bandgap_a": round(bg_a, 3), "bandgap_b": round(bg_b, 3),
        "curve":     curve,
        "max_bandgap": {"value": max_bg, "composition": max_point["label"], "pct_a": max_point["pct_a"]},
        "min_bandgap": {"value": min_bg, "composition": min_point["label"], "pct_a": min_point["pct_a"]},
        "bowing": bowing,
        "note": ("Predictions are hypothetical interpolations between the two "
                 "ground-state structures. Treat as exploratory."),
    }