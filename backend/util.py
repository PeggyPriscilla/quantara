import os
import numpy as np
import joblib
import shap
from dotenv import load_dotenv
from pymatgen.analysis.local_env import CrystalNN
from pymatgen.core.periodic_table import Element
from pymatgen.core import Structure
from sklearn.neighbors import NearestNeighbors
from sklearn.model_selection import train_test_split

load_dotenv()
API_KEY = os.getenv("MP_API_KEY")

# ─── CrystalNN ───────────────────────────────────────────────────────────────
cnn = CrystalNN()

# ─── Load pipelines ──────────────────────────────────────────────────────────
_BASE        = os.path.join(os.path.dirname(__file__), "..")
_bundle      = joblib.load(os.path.join(_BASE, "models", "trained_model.pkl"))
reg_pipeline = _bundle["reg_pipeline"]
clf_pipeline = _bundle["clf_pipeline"]

# ─── Load dataset (for parity plot + similar materials) ──────────────────────
_data  = np.load(os.path.join(_BASE, "data", "processed", "dataset.npz"))
_X     = _data["X"]
_y_reg = _data["y_reg"]
_y_clf = _data["y_clf"]

_X_imp = reg_pipeline.named_steps["imputer"].transform(_X)
_nn    = NearestNeighbors(n_neighbors=6, metric="euclidean").fit(_X_imp)

# ─── SHAP ────────────────────────────────────────────────────────────────────
_background = np.zeros((1, 11))
explainer   = shap.Explainer(lambda x: reg_pipeline.predict(x), _background)

FEATURE_NAMES = [
    "Bond Length (avg)", "Bond Length (std)", "Bond Angle (avg)",
    "Angle Std",         "Min Angle",         "Max Angle",
    "Coordination",      "Atomic Number",     "Electronegativity",
    "Oxidation State",   "Volume / Atom",
]


# ═══════════════════════════════════════════════════════════
# FEATURE EXTRACTION
# ═══════════════════════════════════════════════════════════
def extract_features(structure):
    structure = structure.copy()
    try:
        structure.add_oxidation_state_by_guess()
    except Exception:
        pass

    m_o_distances, m_o_m_angles, coordination_numbers = [], [], []
    atomic_numbers, electronegativities, oxidation_states = [], [], []

    for i, site in enumerate(structure):
        if site.specie.element.symbol == "O":
            continue
        central = site.specie.element
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


# ═══════════════════════════════════════════════════════════
# PRIVATE HELPERS
# ═══════════════════════════════════════════════════════════
def _fetch_doc(formula: str):
    from mp_api.client import MPRester
    with MPRester(API_KEY) as mpr:
        results = mpr.materials.summary.search(
            formula=formula,
            fields=["structure", "band_gap", "energy_above_hull", "formula_pretty"],
        )
    if not results:
        raise ValueError(f"'{formula}' not found in Materials Project.")
    return results[0]


def _stability(e_hull):
    if e_hull is None:  return "Unknown"
    if e_hull == 0:     return "Stable"
    if e_hull < 0.1:    return "Metastable"
    return "Unstable"


def _material_type(bandgap, is_metallic):
    if is_metallic:     return "Metal"
    if bandgap < 3.0:   return "Semiconductor"
    return "Insulator"


def _element_info(formula: str):
    from pymatgen.core import Composition
    try:
        comp = Composition(formula)
        out = []
        for el, amt in comp.items():
            e = Element(el.symbol)
            cat = ("Transition Metal" if e.is_transition_metal else
                   "Metal"           if e.is_metal else
                   "Oxygen"          if el.symbol == "O" else
                   "Metalloid"       if e.is_metalloid else "Non-metal")
            out.append({"symbol": el.symbol, "name": e.long_name,
                        "number": e.Z, "amount": float(amt), "category": cat})
        return out
    except Exception:
        return []


def _shap_data(X_raw):
    sv = explainer(X_raw)
    data = [{"name":  FEATURE_NAMES[i],
              "value": float(sv.values[0][i]),
              "raw":   float(X_raw[0][i])}
            for i in range(len(FEATURE_NAMES))]
    data.sort(key=lambda d: abs(d["value"]), reverse=True)
    return data


def _similar(X_raw):
    X_imp = reg_pipeline.named_steps["imputer"].transform(X_raw)
    dists, idxs = _nn.kneighbors(X_imp)
    return [{"band_gap":    round(float(_y_reg[idx]), 3),
             "is_metallic": bool(_y_clf[idx]),
             "distance":    round(float(dist), 3)}
            for dist, idx in zip(dists[0][1:6], idxs[0][1:6])]


def _insights(bandgap, is_metallic, stability, shap_data):
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
        out.append("Thermodynamically stable on the convex hull.")
    elif stability == "Metastable":
        out.append("Metastable — may be synthesisable under controlled conditions.")
    elif stability == "Unstable":
        out.append("Thermodynamically unstable — likely to decompose.")
    if shap_data:
        top = shap_data[0]
        direction = "increases" if top["value"] > 0 else "decreases"
        out.append(f"'{top['name']}' is the strongest predictor and {direction} the band gap.")
    return out


def _build_result(formula, doc_or_none, structure, X_raw):
    bandgap     = float(reg_pipeline.predict(X_raw)[0])
    is_metallic = bool(clf_pipeline.predict(X_raw)[0])
    e_hull      = getattr(doc_or_none, "energy_above_hull", None) if doc_or_none else None
    stability   = _stability(e_hull)
    shap_data   = _shap_data(X_raw)
    return {
        "formula":       formula,
        "bandgap":       round(bandgap, 3),
        "is_metallic":   is_metallic,
        "material_type": _material_type(bandgap, is_metallic),
        "stability":     stability,
        "e_above_hull":  round(e_hull, 4) if e_hull is not None else None,
        "shap":          shap_data,
        "elements":      _element_info(formula),
        "similar":       _similar(X_raw),
        "insights":      _insights(bandgap, is_metallic, stability, shap_data),
    }


# ═══════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════
def predict_material(formula: str) -> dict:
    doc       = _fetch_doc(formula)
    X_raw     = np.array(extract_features(doc.structure)).reshape(1, -1)
    pretty    = getattr(doc, "formula_pretty", formula)
    result    = _build_result(pretty, doc, doc.structure, X_raw)
    return result


def predict_batch(formulas: list) -> list:
    results = []
    for formula in formulas:
        formula = formula.strip()
        if not formula:
            continue
        try:
            doc         = _fetch_doc(formula)
            X_raw       = np.array(extract_features(doc.structure)).reshape(1, -1)
            bandgap     = float(reg_pipeline.predict(X_raw)[0])
            is_metallic = bool(clf_pipeline.predict(X_raw)[0])
            e_hull      = getattr(doc, "energy_above_hull", None)
            results.append({
                "formula":       getattr(doc, "formula_pretty", formula),
                "bandgap":       round(bandgap, 3),
                "material_type": _material_type(bandgap, is_metallic),
                "is_metallic":   is_metallic,
                "stability":     _stability(e_hull),
                "e_above_hull":  round(e_hull, 4) if e_hull is not None else None,
                "error":         None,
            })
        except Exception as e:
            results.append({"formula": formula, "error": str(e),
                            "bandgap": None, "material_type": None,
                            "stability": None})
    return results


def predict_from_cif(cif_text: str) -> dict:
    structure = Structure.from_str(cif_text, fmt="cif")
    formula   = structure.composition.reduced_formula
    X_raw     = np.array(extract_features(structure)).reshape(1, -1)
    result    = _build_result(formula, None, structure, X_raw)
    result["source"] = "CIF upload"
    result["stability"] = "Unknown"   # no MP lookup
    return result


def get_parity_data() -> dict:
    _, X_test, _, y_test = train_test_split(
        _X, _y_reg, test_size=0.2, random_state=42
    )
    y_pred    = reg_pipeline.predict(X_test)
    residuals = y_pred - y_test
    rmse      = float(np.sqrt(np.mean(residuals ** 2)))
    ss_res    = np.sum(residuals ** 2)
    ss_tot    = np.sum((y_test - np.mean(y_test)) ** 2)
    r2        = float(1 - ss_res / ss_tot)
    points    = [{"actual":    round(float(a), 3),
                  "predicted": round(float(p), 3)}
                 for a, p in zip(y_test, y_pred)]
    return {"points": points, "rmse": round(rmse, 4),
            "r2": round(r2, 4), "n": len(points)}