import sys
import os
import io
import csv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify
from flask_cors import CORS
from util import (
    predict_material, predict_batch, predict_from_cif,
    get_parity_data, predict_composition_curve,
    natural_language_query, get_pca_data, fallback_query,
    GROQ_KEY,
    METALLIC_THRESHOLD,
    SCISSOR_CORRECTION,
)
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return jsonify({"status": "Quantara API running", "version": "4.0"})


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/config")
def config():
    """Expose prediction constants so the UI can display them."""
    return jsonify({
        "metallic_threshold":  METALLIC_THRESHOLD,
        "scissor_correction":  SCISSOR_CORRECTION,
        "groq_enabled":        bool(GROQ_KEY),
    })


# ─── Single prediction ────────────────────────────────────────────────────────
@app.route("/predict", methods=["POST"])
def predict():
    data    = request.get_json(silent=True) or {}
    formula = data.get("material", "").strip()
    if not formula:
        return jsonify({"error": "No material formula provided."}), 400
    try:
        return jsonify(predict_material(formula))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {e}"}), 500


# ─── Batch prediction ─────────────────────────────────────────────────────────
@app.route("/predict/batch", methods=["POST"])
def batch():
    if request.content_type and "multipart" in request.content_type:
        file = request.files.get("file")
        if not file:
            return jsonify({"error": "No file uploaded."}), 400
        text       = file.read().decode("utf-8")
        reader     = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []
        col        = "formula" if "formula" in fieldnames else (fieldnames[0] if fieldnames else None)
        if not col:
            return jsonify({"error": "CSV must have a 'formula' column."}), 400
        formulas = [row[col] for row in reader]
    else:
        data     = request.get_json(silent=True) or {}
        formulas = data.get("formulas", [])

    if not formulas:
        return jsonify({"error": "No formulas provided."}), 400
    if len(formulas) > 100:
        return jsonify({"error": "Maximum 100 formulas per batch."}), 400

    try:
        results = predict_batch(formulas)
        return jsonify({"results": results, "count": len(results)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Comparison ───────────────────────────────────────────────────────────────
@app.route("/compare", methods=["POST"])
def compare():
    data = request.get_json(silent=True) or {}
    a    = data.get("material_a", "").strip()
    b    = data.get("material_b", "").strip()
    if not a or not b:
        return jsonify({"error": "Provide both material_a and material_b."}), 400
    try:
        return jsonify({"a": predict_material(a), "b": predict_material(b)})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── CIF upload ───────────────────────────────────────────────────────────────
@app.route("/predict/cif", methods=["POST"])
def predict_cif():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No CIF file uploaded."}), 400
    try:
        result = predict_from_cif(file.read().decode("utf-8"))
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"CIF prediction failed: {e}"}), 500


# ─── Parity plot ──────────────────────────────────────────────────────────────
@app.route("/parity", methods=["GET"])
def parity():
    try:
        return jsonify(get_parity_data())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── PCA / Materials Map ──────────────────────────────────────────────────────
@app.route("/pca", methods=["GET"])
def pca():
    try:
        return jsonify(get_pca_data())
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# ─── Composition curve ────────────────────────────────────────────────────────
@app.route("/composition", methods=["POST"])
def composition():
    data = request.get_json(silent=True) or {}
    a    = data.get("formula_a", "").strip()
    b    = data.get("formula_b", "").strip()

    if not a or not b:
        return jsonify({"error": "Provide both formula_a and formula_b."}), 400
    if a.lower() == b.lower():
        return jsonify({"error": "formula_a and formula_b must be different."}), 400

    try:
        result = predict_composition_curve(a, b, steps=21)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Composition curve failed: {e}"}), 500


# ─── Natural language query ───────────────────────────────────────────────────
@app.route("/nlquery", methods=["POST"])
def nlquery():
    try:
        data  = request.get_json()
        query = data.get("query", "").strip()

        if not query:
            return jsonify({"error": "Empty query"}), 400

        if GROQ_KEY:
            try:
                return jsonify(natural_language_query(query))
            except Exception as e:
                print(f"Groq AI query failed, falling back to keyword search: {e}")

        result = fallback_query(query)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


for rule in app.url_map.iter_rules():
    print(rule)

if __name__ == "__main__":
    app.run(debug=True, port=10001)