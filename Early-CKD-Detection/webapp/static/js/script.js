const API_URL = 'http://127.0.0.1:5000';
    const NORMAL_RANGES = {
        age: { min: 0, max: 100, unit: 'years' },
        sg: { min: 1.005, max: 1.030, unit: '' },
        bp: { min: 90, max: 140, unit: 'mmHg' },
        sc: { min: 0.6, max: 1.2, unit: 'mg/dL' },
        bgr: { min: 70, max: 100, unit: 'mg/dL' },
        bu: { min: 7, max: 20, unit: 'mg/dL' },
        sod: { min: 135, max: 145, unit: 'mmol/L' },
        pot: { min: 3.5, max: 5.0, unit: 'mmol/L' },
        hemo: { min: 13.5, max: 17.5, unit: 'g/dL' },
        wbcc: { min: 4500, max: 11000, unit: '/μL' },
        rbcc: { min: 4.3, max: 5.9, unit: 'million/μL' }
    };

function initPage() {
    if (document.getElementById('ckdForm')) {
        // Prediction page specific code
        initTheme();
        setupEventListeners();
        setupInputValidation();
        updateGauge(0, false);
    }
    // Add other page-specific initializations here
}

document.addEventListener('DOMContentLoaded', initPage);
// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    setupInputValidation();
    updateGauge(0, false);
    document.getElementById('managementSection').style.display = 'none';
    document.getElementById('riskPercentage').classList.add('hidden');
    document.getElementById('riskLabel').classList.add('hidden');    
    
    // Add required field indicators
    document.querySelectorAll('[required]').forEach(el => {
        const label = el.closest('.parameter')?.querySelector('label');
        if (label && !label.innerHTML.includes('*')) label.innerHTML += ' *';
    });

    // Initialize all buttons
    initButtons();
    
    // Initialize modal handling for all pages
    initModal();
});

function initModal() {
    const modal = document.querySelector('.booking-modal');
    if (!modal) return;

    // Show modal
    document.addEventListener('click', (e) => {
        if (e.target.closest('.book-btn, .select-lab, .book-appointment')) {
            e.preventDefault();
            modal.classList.remove('hidden');
        }
    });

    // Hide modal
    modal.querySelector('.close-modal')?.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.add('hidden');
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}
// Add this new function to handle all button initializations
function initButtons() {
    console.log('[DEBUG] Initializing buttons...');  

    

    // Reset form button
    const resetFormBtn = document.getElementById('resetForm');
    console.log('[DEBUG] Reset button:', resetFormBtn);
    if (resetFormBtn) {
        resetFormBtn.addEventListener('click', resetForm);
    }

    // Print button
    const printBtn = document.getElementById('printReport');
    console.log('[DEBUG] Print button:', printBtn);
    if (printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }

    // Service buttons
    const consultationBtn = document.getElementById('bookConsultation');
    console.log('[DEBUG] Consultation button:', consultationBtn);
    if (consultationBtn) {
        consultationBtn.addEventListener('click', (e) => {
            console.log('[DEBUG] Consultation button clicked');
            e.preventDefault();
            window.location.href = 'http://127.0.0.1:5000/doctors';
            return false;
        });
    }

    const bloodTestBtn = document.getElementById('bookBloodTest');
    console.log('[DEBUG] Blood test button:', bloodTestBtn);
    if (bloodTestBtn) {
        bloodTestBtn.addEventListener('click', (e) => {
            console.log('[DEBUG] Blood test button clicked');
            e.preventDefault();
            window.location.href = 'http://127.0.0.1:5000/bloodtest';
            return false;
        });
    }
}

function resetForm() {
    document.getElementById('ckdForm').reset();
    updateGauge(0, false);
    document.getElementById('managementSection').style.display = 'none';
    document.getElementById('riskPercentage').classList.add('hidden');
    document.getElementById('riskLabel').classList.add('hidden');
    document.querySelectorAll('.parameter').forEach(el => {
        el.classList.remove('error', 'out-of-range');
    });
    document.getElementById('fileStatus').textContent = 'Choose File · No file chosen';
}



// Theme initialization
function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme === 'true' || (savedTheme === null && prefersDark)) {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function setupEventListeners() {

    const predictionPageElements = {
        ckdForm: document.getElementById('ckdForm'),
        pdfInput: document.getElementById('pdfInput'),
        confirmPdfBtn: document.getElementById('confirmPdfBtn')
    };

    // Only setup prediction page listeners if elements exist
    if (predictionPageElements.ckdForm) {
        predictionPageElements.ckdForm.addEventListener('submit', handleFormSubmit);
        predictionPageElements.pdfInput.addEventListener('change', handlePdfUpload);
        predictionPageElements.confirmPdfBtn.addEventListener('click', predictFromPdfData);
    }
    // Only add form submit listener if form exists
    const ckdForm = document.getElementById('ckdForm');
    if (ckdForm) {
        ckdForm.addEventListener('submit', handleFormSubmit);
    }

    // Only add PDF input listener if element exists
    const pdfInput = document.getElementById('pdfInput');
    if (pdfInput) {
        pdfInput.addEventListener('change', handlePdfUpload);
    }

    // Only add theme toggle listener if element exists
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Only add PDF confirm button listener if element exists
    const confirmPdfBtn = document.getElementById('confirmPdfBtn');
    if (confirmPdfBtn) {
        confirmPdfBtn.addEventListener('click', predictFromPdfData);
    }

    // Add input validation to all inputs and selects
    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', () => validateInput(el));
    });
}

// Toggle theme
function toggleTheme() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    document.getElementById('themeToggle').innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

// Validate individual input
function validateInput(input) {
    const id = input.id;
    const value = input.value;

    // Safely try to get the container for styling
    const container = input.closest('.parameter');
    if (!container) {
        console.warn(`⚠️ Skipping validation: No .parameter found for input with ID="${id}"`);
        return true; // Don't break form — just skip styling
    }

    // Reset styles
    container.classList.remove('error', 'out-of-range');

    // Required field empty
    if (input.required && !value) {
        container.classList.add('error');
        return false;
    }

    // Check value against normal range
    if (NORMAL_RANGES[id] && value) {
        const numValue = parseFloat(value);
        const { min, max } = NORMAL_RANGES[id];
        if (isNaN(numValue) || numValue < min || numValue > max) {
            container.classList.add('out-of-range');
            return false;
        }
    }

    return true;
}


// Set up input validation
function setupInputValidation() {
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('blur', () => {
            validateInput(input);
            updateReferenceRangeHighlight(input);
        });
    });
}

// Highlight reference ranges
function updateReferenceRangeHighlight(input) {
    const id = input.id;
    const value = parseFloat(input.value);
    const rangeSpan = input.nextElementSibling;
    if (rangeSpan && rangeSpan.classList.contains('reference-range') && NORMAL_RANGES[id]) {
        const { min, max } = NORMAL_RANGES[id];
        if (value < min || value > max) {
            rangeSpan.classList.add('out-of-range');
        } else {
            rangeSpan.classList.remove('out-of-range');
        }
    }
}

// Update the handleFormSubmit function:
async function handleFormSubmit(event) {
    event.preventDefault();
    let isValid = true;
    
    // Only validate required fields, not ranges
    document.querySelectorAll('[required]').forEach(el => {
        if (!el.value) {
            isValid = false;
            const container = el.closest('.parameter');
            if (container) container.classList.add('error');
        }
    });
    
    if (!isValid) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    document.getElementById('managementSection').style.display = 'none';
    showLoading(true);
    
    try {
        const { features } = collectFormData();
        console.log("Form data collected. Features:", features);

        const result = await predictCkd(features);
        if (result.error) throw new Error(result.error);
        updateGauge(result.probability, true);
        updateResultDisplay(result);
        showToast('Prediction completed successfully', 'success');
    } catch (error) {
        console.error('Prediction error:', error);
        showToast(`Prediction failed: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Collect form data with gender validation
function collectFormData() {
    return {
        features: [
            parseFloat(document.getElementById('age').value),
            parseFloat(document.getElementById('sg').value),
            parseFloat(document.getElementById('bp').value),
            parseFloat(document.getElementById('sc').value),
            parseFloat(document.getElementById('bgr').value),
            parseFloat(document.getElementById('bu').value) || 0,
            parseFloat(document.getElementById('sod').value) || 0,
            parseFloat(document.getElementById('pot').value) || 0,
            parseFloat(document.getElementById('hemo').value),
            parseFloat(document.getElementById('wbcc').value) || 0,
            parseFloat(document.getElementById('rbcc').value) || 0,
            parseInt(document.getElementById('htn').value) || 0,
            parseInt(document.getElementById('dm').value) || 0,
            parseInt(document.getElementById('pe').value) || 0,
            parseInt(document.getElementById('ane').value) || 0
        ]
        
    };
}

// Predict CKD
async function predictCkd(features) {
    const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ features,})
    });
    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Unauthorized. Please log in.");
        }
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'API request failed');
    }
    
    return await response.json();
}

// Update result display
function updateResultDisplay(result) {
    const managementSection = document.getElementById('managementSection');
    managementSection.style.display = 'block';
    if (result.egfr) {
        const egfrDiv = document.createElement('div');
        egfrDiv.className = 'egfr-result';
        egfrDiv.innerHTML = `<div class="egfr-value">${result.egfr} mL/min/1.73m²</div>`;
        managementSection.insertBefore(egfrDiv, managementSection.firstChild);
    }
    updateManagementAdvice(result.probability);
}

// Update the gauge visualization
function updateGauge(probability, showLabel = false) {
    const gaugeValue = document.getElementById('gaugeValue');
    const offset = 251 - (probability * 251);
    gaugeValue.style.strokeDashoffset = offset;
    let color;
    if (probability <= 0.3) {
        color = '#27ae60';
    } else if (probability <= 0.7) {
        color = '#f39c12';
    } else {
        color = '#e74c3c';
    }
    gaugeValue.setAttribute('stroke', color);
    const gaugeNeedle = document.getElementById('gaugeNeedle');
    const needleRotation = -90 + (probability * 180);
    gaugeNeedle.style.transform = `rotate(${needleRotation}deg)`;
    const riskLabel = document.getElementById('riskLabel');
    const riskPercentage = document.getElementById('riskPercentage');
    
    if (showLabel) {
        let riskText, riskClass, riskIcon;
        if (probability <= 0.3) {
            riskText = 'Low Risk';
            riskClass = 'low-risk';
            riskIcon = '<i class="fas fa-check-circle"></i>';
        } else if (probability <= 0.7) {
            riskText = 'Medium Risk';
            riskClass = 'med-risk';
            riskIcon = '<i class="fas fa-exclamation-circle"></i>';
        } else {
            riskText = 'High Risk';
            riskClass = 'high-risk';
            riskIcon = '<i class="fas fa-exclamation-triangle"></i>';
        }
        
        riskLabel.innerHTML = `${riskIcon} ${riskText}`;
        riskLabel.className = `gauge-label ${riskClass}`;
        riskPercentage.textContent = `${Math.round(probability * 100)}%`;
        
        // Show the labels only after prediction
        riskLabel.classList.remove('hidden');
        riskPercentage.classList.remove('hidden');
    } else {
        // Hide the labels initially
        riskLabel.classList.add('hidden');
        riskPercentage.classList.add('hidden');
    }
}
function updateManagementAdvice(probability) {
    const adviceContainer = document.getElementById('managementAdvice');
    let advice = '';
    
    const baseDietaryAdvice = `
        <li><i class="fas fa-utensils"></i> Limit sodium intake to &lt;2000mg/day</li>
        <li><i class="fas fa-glass-whiskey"></i> Maintain proper hydration (1.5-2L/day unless restricted)</li>
    `;
    
    const preventiveMeasures = `
        <li><i class="fas fa-calendar-check"></i> Regular health check-ups (every 6 months)</li>
        <li><i class="fas fa-heartbeat"></i> Monitor blood pressure weekly</li>
        <li><i class="fas fa-flask"></i> Annual kidney function tests</li>
    `;
    
    const lifestyleManagement = `
        <li><i class="fas fa-running"></i> 30 minutes of moderate exercise daily</li>
        <li><i class="fas fa-weight"></i> Maintain healthy BMI (18.5-24.9)</li>
        <li><i class="fas fa-spa"></i> Stress management techniques (meditation, yoga)</li>
        <li><i class="fas fa-smoking-ban"></i> Smoking cessation if applicable</li>
    `;
    
    const doctorRecommendation = `
        <li><i class="fas fa-user-md"></i> Consult your primary physician annually</li>
        <li><i class="fas fa-hospital"></i> Consider nephrology referral if risk persists</li>
    `;

    if (probability > 0.7) {
        advice = `
            <div class="advice-section">
                <h4><i class="fas fa-exclamation-triangle"></i> High Risk Management</h4>
                <div class="advice-category">
                    <h5><i class="fas fa-utensils"></i> Dietary Recommendations:</h5>
                    <ul>
                        ${baseDietaryAdvice}
                        <li><i class="fas fa-drumstick-bite"></i> Reduce protein to 0.6-0.8g/kg body weight</li>
                        <li><i class="fas fa-ban"></i> Limit potassium-rich foods (bananas, oranges, potatoes)</li>
                        <li><i class="fas fa-cheese"></i> Phosphate restriction (dairy, nuts, colas)</li>
                        <li><i class="fas fa-fish"></i> Increase omega-3 fatty acids (fish, flaxseeds)</li>
                    </ul>
                </div>
                <div class="advice-category">
                    <h5><i class="fas fa-user-md"></i> Medical Follow-up:</h5>
                    <ul>
                        ${doctorRecommendation}
                        <li><i class="fas fa-procedures"></i> Urgent nephrology consultation recommended</li>
                        <li><i class="fas fa-vial"></i> Quarterly kidney function monitoring</li>
                        <li><i class="fas fa-microscope"></i> Consider eGFR and urine albumin tests</li>
                    </ul>
                </div>
                <div class="advice-category">
                    <h5><i class="fas fa-heart"></i> Lifestyle Modifications:</h5>
                    <ul>
                        ${lifestyleManagement}
                        <li><i class="fas fa-tachometer-alt"></i> Strict blood pressure control (&lt;130/80 mmHg)</li>
                        <li><i class="fas fa-syringe"></i> Blood sugar monitoring if diabetic</li>
                    </ul>
                </div>
            </div>
        `;
    } else if (probability > 0.3) {
        advice = `
            <div class="advice-section">
                <h4><i class="fas fa-exclamation-circle"></i> Moderate Risk Management</h4>
                <div class="advice-category">
                    <h5><i class="fas fa-utensils"></i> Dietary Recommendations:</h5>
                    <ul>
                        ${baseDietaryAdvice}
                        <li><i class="fas fa-egg"></i> Moderate protein intake (0.8-1.0g/kg)</li>
                        <li><i class="fas fa-balance-scale"></i> Monitor potassium intake</li>
                        <li><i class="fas fa-leaf"></i> Increase antioxidant-rich foods (berries, leafy greens)</li>
                        <li><i class="fas fa-bread-slice"></i> Choose whole grains over refined carbohydrates</li>
                    </ul>
                </div>
                <div class="advice-category">
                    <h5><i class="fas fa-shield-alt"></i> Preventive Measures:</h5>
                    <ul>
                        ${preventiveMeasures}
                        <li><i class="fas fa-clipboard-check"></i> Bi-annual kidney function tests</li>
                    </ul>
                </div>
                <div class="advice-category">
                    <h5><i class="fas fa-heartbeat"></i> Lifestyle Management:</h5>
                    <ul>
                        ${lifestyleManagement}
                    </ul>
                </div>
            </div>
        `;
    } else {
        advice = `
            <div class="advice-section">
                <h4><i class="fas fa-check-circle"></i> Preventive Management</h4>
                <div class="advice-category">
                    <h5><i class="fas fa-utensils"></i> Dietary Recommendations:</h5>
                    <ul>
                        ${baseDietaryAdvice}
                        <li><i class="fas fa-drumstick-bite"></i> Balanced protein intake (1.0-1.2g/kg)</li>
                        <li><i class="fas fa-apple-alt"></i> Plenty of fruits and vegetables (5+ servings/day)</li>
                        <li><i class="fas fa-seedling"></i> Healthy fats (olive oil, avocados, nuts)</li>
                        <li><i class="fas fa-candy-cane"></i> Limit processed foods and added sugars</li>
                    </ul>
                </div>
                <div class="advice-category">
                    <h5><i class="fas fa-shield-alt"></i> Preventive Measures:</h5>
                    <ul>
                        ${preventiveMeasures}
                    </ul>
                </div>
                <div class="advice-category">
                    <h5><i class="fas fa-heart"></i> Healthy Lifestyle:</h5>
                    <ul>
                        ${lifestyleManagement}
                        <li><i class="fas fa-bed"></i> Maintain regular sleep patterns</li>
                    </ul>
                </div>
            </div>
        `;
    }
    
    adviceContainer.innerHTML = advice;
}
// Toast message utility
function showToast(message, type = 'success') {
    let toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// PDF handling and review functions would go here (as in your existing code)

// Handle PDF upload
async function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('fileStatus').textContent = `File selected: ${file.name}`;
    
    if (!file.name.endsWith('.pdf')) {
        showToast('Please select a valid PDF file', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_URL}/extract`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('PDF extraction failed');
        }
        
        const data = await response.json();
        
        if (data.extracted_features) {
            displayPdfReview(data.extracted_features, data.missing || []);
            
            if (data.missing && data.missing.length > 0) {
                showToast('Some fields could not be extracted. Please review and complete.', 'warning');
            } else {
                showToast('PDF data extracted successfully', 'success');
            }
        } else {
            throw new Error('Failed to extract data from PDF');
        }
    } catch (error) {
        console.error('PDF extraction error:', error);
        showToast(`PDF processing failed: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Display PDF review
function displayPdfReview(extractedData, missingFields) {
    const pdfReview = document.getElementById('pdfReview');
    const pdfDataContainer = document.getElementById('pdfData');
    
    pdfDataContainer.innerHTML = '';
    
    const fieldOrder = ["age", "sg", "bp", "sc", "bgr", "bu", "sod", "pot", "hemo", "wbcc", "rbcc", "htn", "dm", "pe", "ane"];
    
    fieldOrder.forEach(field => {
        const isMissing = missingFields.includes(field);
        const value = extractedData[field] !== null ? extractedData[field] : '';
        
        const fieldDiv = document.createElement('div');
        fieldDiv.className = `pdf-field ${isMissing ? 'missing' : ''}`;
        
        const label = document.createElement('label');
        label.textContent = formatFieldName(field);
        
        let input;
        if (field === 'htn' || field === 'dm' || field === 'pe' || field === 'ane' ) {
            input = document.createElement('select');
            input.innerHTML = `
                <option value="0" ${value === 0 ? 'selected' : ''}>No</option>
                <option value="1" ${value === 1 ? 'selected' : ''}>Yes</option>
            `;
        } else {
            input = document.createElement('input');
            input.type = 'number';
            input.value = value;
            input.step = field === 'sg' ? '0.001' : '0.1';
        }
        
        input.dataset.field = field;
        
        if (isMissing) {
            input.placeholder = 'Required';
            input.classList.add('error');
        }
        
        const status = document.createElement('span');
        status.className = 'extraction-status';
        status.textContent = isMissing ? 'Not found in PDF' : 'Extracted from PDF';
        
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(input);
        fieldDiv.appendChild(status);
        pdfDataContainer.appendChild(fieldDiv);
    });
    
    pdfReview.classList.remove('hidden');
}

// Format field names
function formatFieldName(fieldId) {
    const fieldNames = {
        age: 'Age',
        sg: 'Specific Gravity',
        bp: 'Blood Pressure',
        sc: 'Serum Creatinine',
        bgr: 'Blood Glucose',
        bu: 'Blood Urea',
        sod: 'Sodium',
        pot: 'Potassium',
        hemo: 'Hemoglobin',
        wbcc: 'WBC Count',
        rbcc: 'RBC Count',
        htn: 'Hypertension',
        dm: 'Diabetes',
        pe: 'Pedal Edema',
        ane: 'Anemia'
    };
    
    return fieldNames[fieldId] || fieldId;
}

// Predict from PDF data
async function predictFromPdfData() {
    const pdfInputs = document.querySelectorAll('#pdfData input, #pdfData select');
    let isValid = true;
    const features = [];
    
    pdfInputs.forEach(input => {
        if (!input.value) {
            input.classList.add('error');
            isValid = false;
        } else {
            input.classList.remove('error');
            features.push(parseFloat(input.value) || input.value);
        }
    });
    
    if (!isValid) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    document.getElementById('managementSection').style.display = 'none';
    showLoading(true);
    
    try {
        // Extract gender separately
        const genderInput = document.querySelector('#pdfData select[data-field="gender"]');
        const gender = genderInput ? parseInt(genderInput.value) : 1;
        
        // Remove gender from features if present
        const featureValues = features.filter((_, i) => 
            !document.querySelectorAll('#pdfData select')[i]?.dataset.field === 'gender'
        );
        
        const result = await predictCkd(featureValues, gender);
        updateGauge(result.probability, true);
        updateResultDisplay(result);
        document.getElementById('pdfReview').classList.add('hidden');
        showToast('Prediction completed successfully', 'success');
    } catch (error) {
        console.error('Prediction error:', error);
        showToast(`Prediction failed: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Show/hide loading indicator
function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.toggle('hidden', !show);
    
    if (show) {
        overlay.innerHTML = `
            <div class="spinner"></div>
            <span>Processing...</span>
            <div class="progress-bar">
                <div class="progress"></div>
            </div>
        `;
        
        // Animate progress bar
        const progress = overlay.querySelector('.progress');
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 100) {
                clearInterval(interval);
                return;
            }
            width += 2;
            progress.style.width = `${width}%`;
        }, 100);
        
        overlay.dataset.interval = interval;
    } else {
        clearInterval(overlay.dataset.interval);
    }
}