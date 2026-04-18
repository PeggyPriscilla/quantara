import sys
import os
import io
import csv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify
from flask_cors import CORS
from util import predict_material, predict_batch, predict_from_cif, get_parity_data

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return jsonify({"status": "Quantara API running", "version": "3.0"})


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


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
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {e}"}), 500


# ─── Batch prediction (CSV upload) ───────────────────────────────────────────
@app.route("/predict/batch", methods=["POST"])
def batch():
    # Accepts either a JSON list or a CSV file upload
    if request.content_type and "multipart" in request.content_type:
        file = request.files.get("file")
        if not file:
            return jsonify({"error": "No file uploaded."}), 400
        text     = file.read().decode("utf-8")
        reader   = csv.DictReader(io.StringIO(text))
        # Expect a column named "formula" or use the first column
        fieldnames = reader.fieldnames or []
        col = "formula" if "formula" in fieldnames else (fieldnames[0] if fieldnames else None)
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


# ─── Side-by-side comparison ─────────────────────────────────────────────────
@app.route("/compare", methods=["POST"])
def compare():
    data = request.get_json(silent=True) or {}
    a    = data.get("material_a", "").strip()
    b    = data.get("material_b", "").strip()
    if not a or not b:
        return jsonify({"error": "Provide both material_a and material_b."}), 400
    try:
        result_a = predict_material(a)
        result_b = predict_material(b)
        return jsonify({"a": result_a, "b": result_b})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── CIF file upload ──────────────────────────────────────────────────────────
@app.route("/predict/cif", methods=["POST"])
def predict_cif():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No CIF file uploaded."}), 400
    try:
        cif_text = file.read().decode("utf-8")
        result   = predict_from_cif(cif_text)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"CIF prediction failed: {e}"}), 500


# ─── Parity plot data ─────────────────────────────────────────────────────────
@app.route("/parity", methods=["GET"])
def parity():
    try:
        return jsonify(get_parity_data())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)