import re
import fitz
import pandas as pd
import traceback
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import joblib
import numpy as np
import os
from flask_cors import CORS
from datetime import timedelta


app = Flask(__name__,template_folder=os.path.join(os.getcwd(), "webapp", "templates"),
            static_folder=os.path.join(os.getcwd(), 'webapp', 'static'))
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)
app.config['SECRET_KEY'] = '2458'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False


@app.before_request
def check_session():
    if app.debug:
        print(f"Session before {request.path}: {dict(session)}")

@app.after_request
def add_session_header(response):
    if app.debug:
        response.headers['X-Session-Status'] = str(session.get('username', 'anonymous'))
    return response
def add_no_cache(response):
    """Add headers to disable caching"""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

db = SQLAlchemy(app)
CORS(app, supports_credentials=True, origins=["http://127.0.0.1:5000"])

# User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

# Create database tables
with app.app_context():
    db.create_all()

# Load model and scaler
model = joblib.load("C:\\Users\\arish\\OneDrive\\Desktop\\Early-CKD-Detection\\models\\ckd_best_model.pkl")
scaler = joblib.load("C:\\Users\\arish\\OneDrive\\Desktop\\Early-CKD-Detection\\models\\scaler.pkl")

# Feature order
feature_order = ["age", "sg", "bp", "sc", "bgr", "bu", "sod", "pot", "hemo", "wbcc", "rbcc", "htn", "dm", "pe", "ane"]

def extract_value(text, keyword, alt_keywords=None):
    """Extract numerical values from text with multiple pattern matching"""
    patterns = [
        rf"{keyword}[\s:=-]+([\d.]+)",  # Keyword: 123
        rf"{keyword}.*?([\d.]+)\s*(mg/dl|mmol/l|g/dl|%)?",  # Keyword ... 123 mg/dl
        rf"(?:^|\n)\s*{keyword}[^\n\d]*?([\d.]+)",  # For table formats
        rf"{keyword}.*?([\d.]+)",  # Fallback
    ]
    # Try alternate keywords too
    keywords = [keyword] + (alt_keywords or [])
    for kw in keywords:
        for pattern in patterns:
            match = re.search(pattern.replace(keyword, kw), text, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1))
                except Exception:
                    continue
    return None

def extract_binary(text, keyword, alt_keywords=None):
    """Extract yes/no values from text"""
    patterns = [
        rf"{keyword}[\s:=-]+(yes|no|present|absent|positive|negative|1|0)",
        rf"{keyword}.*?(yes|no|present|absent|positive|negative|1|0)"
    ]
    keywords = [keyword] + (alt_keywords or [])
    for kw in keywords:
        for pattern in patterns:
            match = re.search(pattern.replace(keyword, kw), text, re.IGNORECASE)
            if match:
                val = match.group(1).strip().lower()
                return 1 if val in ["yes", "present", "positive", "1"] else 0
    return None

@app.route('/')
def home():
    if 'username' in session:
        return redirect(url_for('info'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            session['username'] = username
            return redirect(url_for('info'))
        else:
            flash('Invalid username or password')
            return redirect(url_for('login'))
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        # Validation checks
        if not all([username, email, password, confirm_password]):
            flash('All fields are required!', 'error')
            return redirect(url_for('register'))
            
        if password != confirm_password:
            flash('Passwords do not match!', 'error')
            return redirect(url_for('register'))
            
        if len(password) < 8:
            flash('Password must be at least 8 characters', 'error')
            return redirect(url_for('register'))
            
        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'error')
            return redirect(url_for('register'))
            
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'error')
            return redirect(url_for('register'))

        try:
            new_user = User(
                username=username,
                email=email,
                password=generate_password_hash(password, method='pbkdf2:sha256')
            )
            db.session.add(new_user)
            db.session.commit()
            
            flash('Registration successful! Please login.', 'success')
            return redirect(url_for('login'))
            
        except Exception as e:
            db.session.rollback()
            flash('Registration failed. Please try again.', 'error')
            app.logger.error(f'Registration error: {str(e)}')
            return redirect(url_for('register'))
    
    return render_template('register.html')
@app.route('/info')
def info():
    if 'username' not in session:
        return redirect(url_for('login'))
    return render_template('info.html')

@app.before_request
def check_session():
    print(f"Session before {request.path}: {dict(session)}")

@app.after_request
def add_session_header(response):
    response.headers['X-Session-Status'] = str(session.get('username', 'anonymous'))
    return response

@app.route('/predict', methods=['GET', 'POST'])
def predict():
    if 'username' not in session:
        if request.is_json:
            return jsonify({"error": "Unauthorized. Please log in."}), 401
        return redirect(url_for('login'))

    if request.method == 'GET':
        return render_template('index.html')

    if request.method == 'POST':
        try:
            data = request.get_json()
            print("Received data:", data)
            features = data["features"]

            feature_names = ["age", "sg", "bp", "sc", "bgr", "bu", "sod", "pot",
                             "hemo", "wbcc", "rbcc", "htn", "dm", "pe", "ane"]

            numerical_cols = ["age", "sg", "bp", "sc", "bgr", "bu", "sod", "pot", "hemo", "wbcc", "rbcc"]
            categorical_cols = ["htn", "dm", "pe", "ane"]

            input_df = pd.DataFrame([features], columns=feature_names)
            input_df[numerical_cols] = scaler.transform(input_df[numerical_cols].values)

            prediction = model.predict(input_df.values)
            if hasattr(model, 'predict_proba'):
                prob = model.predict_proba(input_df.values)[0][1]
            else:
                try:
                    d_scores = model.decision_function(input_df)
                    prob = 1 / (1 + np.exp(-d_scores))[0]
                except:
                    prob = 0.5

            return jsonify({
                "prediction": int(prediction[0]),
                "probability": float(prob)
            })

        except Exception as e:
            traceback.print_exc()
    
            return jsonify({"error": str(e)}), 400
    print("Session user before prediction:", session.get('username'))
    print("Headers:", dict(request.headers))


@app.route('/doctors', endpoint='doctor_list')
def doctors():
    print(f"[DEBUG] Accessing /doctors - Session: {session.get('username')}")
    if 'username' not in session:
        print("[DEBUG] Redirecting to login")
        return redirect(url_for('login'))
    print("[DEBUG] Rendering doctors.html")
    return render_template('doctors.html')


@app.route('/bloodtest', endpoint='bloodtest')
def bloodtest():
    print(f"[DEBUG] Accessing /bloodtest - Session: {session.get('username')}")
    if 'username' not in session:
        print("[DEBUG] Redirecting to login")
        return redirect(url_for('login'))
    print("[DEBUG] Rendering bloodtest.html")
    return render_template('bloodtest.html')

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))


@app.route('/extract', methods=['POST'])
def extract_from_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if not file.filename.endswith('.pdf'):
        return jsonify({"error": "Invalid file type"}), 400
    
    try:
        doc = fitz.open(stream=file.read(), filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        
        # Debug: Save extracted text for troubleshooting
        with open("debug_pdf_text.txt", "w", encoding="utf-8") as f:
            f.write(text)
        
        # Extraction with alternate keywords
        extracted_data = {
            # Numerical features (11)
            "age": extract_value(text, "Age", ["Patient Age", "Years"]),
            "sg": extract_value(text, "Specific Gravity", ["Sp. Gravity", "Urine SG"]),
            "bp": extract_value(text, "Blood Pressure", ["BP", "Systolic"]),
            "sc": extract_value(text, "Serum Creatinine", ["Creatinine", "Cr"]),
            "bgr": extract_value(text, "Blood Glucose", ["Glucose", "FBS", "RBS"]),
            "bu": extract_value(text, "Blood Urea", ["Urea", "BUN"]),
            "sod": extract_value(text, "Sodium", ["Na", "Na+"]),
            "pot": extract_value(text, "Potassium", ["K", "K+"]),
            "hemo": extract_value(text, "Hemoglobin", ["Hb", "Hgb"]),
            "wbcc": extract_value(text, "White Blood Cell", ["WBC", "Leukocytes"]),
            "rbcc": extract_value(text, "Red Blood Cell", ["RBC", "Erythrocytes"]),
            
            # Categorical features (4)
            "htn": extract_binary(text, "Hypertension", ["HTN", "High BP"]),
            "dm": extract_binary(text, "Diabetes Mellitus", ["Diabetes", "DM"]),
            "pe": extract_binary(text, "Pedal Edema", ["Edema"]),
            "ane": extract_binary(text, "Anemia")
        }
        
        # Identify missing fields
        missing = [k for k, v in extracted_data.items() if v is None]
        
        return jsonify({
            "extracted_features": extracted_data,
            "missing": missing
        })
    except Exception as e:
        return jsonify({"error": f"PDF processing error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)