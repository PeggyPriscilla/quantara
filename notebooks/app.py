import streamlit as st
import numpy as np
import shap
from joblib import load
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "..", "models", "SiO2_model.pkl")

model = load(model_path)
explainer = shap.Explainer(model)

import streamlit as st

st.markdown("""
<style>
    .main {
        background-color: #0e1117;
        color: white;
    }
</style>
""", unsafe_allow_html=True)

if "page" not in st.session_state:
    st.session_state.page = "home"

if st.session_state.page == "home":

    st.title("🔬 AI-Powered Material Intelligence Platform")

    st.markdown("""
    ### Predict. Understand. Discover Materials.
    
    This platform analyzes crystal structures and predicts material properties
    using machine learning and explainable AI.
    """)

    # 🎥 VIDEO (you can replace with your own)
    st.video("https://www.youtube.com/watch?v=aircAruvnKk")

    st.markdown("---")

    if st.button("🚀 Explore Platform"):
        st.session_state.page = "features"

elif st.session_state.page == "features":

    st.title("⚙️ What This Platform Can Do")

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("🔬 Structure Prediction")
        st.write("Predict band gap from crystal structures.")
        if st.button("Use Prediction"):
            st.session_state.page = "tool"

    with col2:
        st.subheader("📈 Explainable AI")
        st.write("Understand how structural features affect prediction.")
        if st.button("View Explanation"):
            st.session_state.page = "tool"

    col3, col4 = st.columns(2)

    with col3:
        st.subheader("📊 Confidence Estimation")
        st.write("Know how reliable your prediction is.")
        if st.button("Check Confidence"):
            st.session_state.page = "tool"

    with col4:
        st.subheader("🧪 Material Classification")
        st.write("Classify materials based on band gap.")
        if st.button("Classify Material"):
            st.session_state.page = "tool"

    st.markdown("---")

    if st.button("⬅ Back to Home"):
        st.session_state.page = "home"
elif st.session_state.page == "tool":

    st.title("🔬 Run Prediction")

    # Your existing UI here 👇
    avg_dist = st.number_input("Avg M-O Distance", value=2.0)
    std_dist = st.number_input("Std M-O Distance", value=0.1)
    avg_angle = st.number_input("Avg M-O-M Angle", value=120.0)
    std_angle = st.number_input("Std M-O-M Angle", value=5.0)
    min_angle = st.number_input("Min M-O-M Angle", value=100.0)
    max_angle = st.number_input("Max M-O-M Angle", value=140.0)
    coord = st.number_input("Coordination", value=4.0)

    if st.button("Predict"):
        import numpy as np

        features = np.array([[avg_dist, std_dist, avg_angle, std_angle, min_angle, max_angle, coord]])

        prediction = model.predict(features)[0]
        shap_values = explainer(features)
        explanation = generate_insight(shap_values)

        st.subheader("Result")
        st.write(prediction)

        st.subheader("Explanation")
        st.write(explanation)

    if st.button("⬅ Back"):
        st.session_state.page = "features"