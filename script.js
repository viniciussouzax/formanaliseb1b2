// State management
let historyStack = [];

// Initialize state on load
document.addEventListener('DOMContentLoaded', () => {
    checkSavedProgress();
});

function checkSavedProgress() {
    const saved = localStorage.getItem('visaFormProgress');
    if (saved) {
        document.getElementById('resumeModal').classList.remove('hidden');
    }
}

function saveProgress() {
    const activeStep = document.querySelector('.step.active');
    if (!activeStep) return;

    // Collect all form data
    const formData = {};
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
        if (input.type === 'radio' || input.type === 'checkbox') {
            if (input.checked) {
                if (!formData[input.name]) {
                    formData[input.name] = [];
                }
                formData[input.name].push(input.value);
            }
        } else {
            formData[input.name] = input.value;
        }
    });

    const state = {
        stepId: activeStep.id,
        history: historyStack,
        data: formData
    };

    localStorage.setItem('visaFormProgress', JSON.stringify(state));
}

function resumeForm() {
    const saved = localStorage.getItem('visaFormProgress');
    if (!saved) return;

    const state = JSON.parse(saved);

    // Restore data
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        const val = state.data[input.name];
        if (val) {
            if (input.type === 'radio' || input.type === 'checkbox') {
                if (Array.isArray(val) && val.includes(input.value)) {
                    input.checked = true;
                }
            } else {
                input.value = val;
            }
        }
    });

    // Restore history
    historyStack = state.history || [];

    // Hide all steps
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

    // Show saved step
    const targetStep = document.getElementById(state.stepId);
    if (targetStep) {
        targetStep.classList.add('active');
    } else {
        // Fallback if ID invalid
        document.getElementById('step-1').classList.add('active');
    }

    document.getElementById('resumeModal').classList.add('hidden');
}

function restartForm() {
    localStorage.removeItem('visaFormProgress');
    document.getElementById('resumeModal').classList.add('hidden');
    document.getElementById('visaForm').reset();
    historyStack = [];
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-1').classList.add('active');
}



// Validation Logic
function validateStep() {
    const activeStep = document.querySelector('.step.active');
    if (!activeStep) return true;

    const inputs = activeStep.querySelectorAll('input, select, textarea');
    let isValid = true;
    let firstInvalid = null;

    // Clear existing messages
    activeStep.querySelectorAll('.error-message').forEach(el => el.remove());

    const showError = (input, message) => {
        isValid = false;
        input.classList.add('border-red-500', 'ring-2', 'ring-red-200');
        if (!firstInvalid) firstInvalid = input;

        const msg = document.createElement('p');
        msg.className = 'error-message text-red-500 text-xs mt-1 font-medium';
        msg.innerText = message;

        // Custom positioning for intl-tel-input
        if (input.id === 'telefone' && input.closest('.iti')) {
            input.closest('.iti').parentElement.appendChild(msg);
        } else {
            input.parentElement.appendChild(msg);
        }
    };

    // Check individual inputs
    inputs.forEach(input => {
        if (input.type === 'button' || input.type === 'submit' || input.type === 'hidden') return;
        input.classList.remove('border-red-500', 'ring-2', 'ring-red-200');

        if (input.id === 'telefone' && typeof iti !== 'undefined') {
            if (!iti.isValidNumber()) {
                showError(input, "Telefone inválido.");
            }
        } else if (input.tagName === 'SELECT') {
            if (!input.value || input.value === "") showError(input, "Selecione uma opção.");
        } else if (input.type === 'radio' || input.type === 'checkbox') {
            // Handled in groups below
            return;
        } else {
            if (!input.value.trim()) {
                showError(input, "Este campo é obrigatório.");
            } else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
                showError(input, "E-mail inválido.");
            }
        }
    });

    // Check Radio/Checkbox groups
    const groups = {};
    activeStep.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
        if (!groups[input.name]) groups[input.name] = [];
        groups[input.name].push(input);
    });

    for (const name in groups) {
        const group = groups[name];
        const isChecked = group.some(input => input.checked);
        if (!isChecked) {
            isValid = false;
            if (!firstInvalid) firstInvalid = group[0];

            // Visual feedback for group
            const container = group[0].closest('.flex-col, .grid') || group[0].parentElement;
            const msg = document.createElement('p');
            msg.className = 'error-message text-red-500 text-xs mt-2 font-medium bg-red-50 p-2 rounded border border-red-100';
            msg.innerText = group[0].type === 'radio' ? 'Selecione uma opção.' : 'Selecione pelo menos uma opção.';
            container.appendChild(msg);

            group.forEach(input => {
                let feedbackTarget = input.nextElementSibling; // For Card Radios (sibling div)
                if (!feedbackTarget || !feedbackTarget.classList.contains('border')) {
                    feedbackTarget = input.closest('.border'); // For Checkboxes (parent label)
                }
                if (!feedbackTarget) feedbackTarget = input.parentElement;

                if (feedbackTarget) {
                    feedbackTarget.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                    input.addEventListener('change', () => {
                        feedbackTarget.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
                        const m = container.querySelector('.error-message');
                        if (m) m.remove();
                    }, { once: true });
                }
            });
        }
    }

    if (!isValid && firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
    }

    return isValid;
}

function nextStep(targetId) {
    // Validate current step before proceeding
    if (!validateStep()) {
        // Optional: specific message
        // alert("Por favor, preencha todos os campos obrigatórios.");
        return;
    }

    const currentStep = document.querySelector('.step.active');

    // Push current step to history for "Back" button functionality
    historyStack.push(currentStep.id);

    // Hide current
    currentStep.classList.remove('active');

    let nextStepEl;
    if (targetId) {
        nextStepEl = document.getElementById(targetId);
    } else {
        console.error("No target ID specified for next step");
        return;
    }

    if (nextStepEl) {
        // Small delay for animation smoothness
        setTimeout(() => {
            currentStep.classList.remove('active');
            nextStepEl.classList.add('active');
            saveProgress(); // Save progress after navigation
        }, 300);
    }
}

function checkIncomeSourceAndRedirect() {
    // Pequeno delay para o usuário ver a seleção antes de trocar de tela
    setTimeout(() => {
        const selected = document.querySelector('input[name="fonte_renda"]:checked');
        const source = selected ? selected.value : null;

        if (source === 'empresario') {
            nextStep('branch-2-a-3-empresario');
        } else if (source === 'autonomo') {
            nextStep('branch-2-a-3-autonomo');
        } else {
            nextStep('step-3-1');
        }
    }, 200);
}

function formatCurrency(input) {
    let value = input.value.replace(/\D/g, "");
    if (value === "") {
        input.value = "";
        return;
    }
    value = (parseInt(value) / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    input.value = value;
}



function prevStep() {
    if (historyStack.length === 0) return;

    const currentStep = document.querySelector('.step.active');
    const prevStepId = historyStack.pop();
    const prevStepEl = document.getElementById(prevStepId);

    currentStep.classList.remove('active');

    setTimeout(() => {
        prevStepEl.classList.add('active');
        saveProgress(); // Update state on back navigation
    }, 100);
}

function toggleField(fieldId, shouldShow) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    if (shouldShow) {
        field.classList.remove('hidden');
        // Add animation class if you want
    } else {
        field.classList.add('hidden');
        // Clear value if hidden? Optional.
        // const inputs = field.querySelectorAll('input, textarea, select');
        // inputs.forEach(input => input.value = '');
    }
}

function submitForm() {
    const submitButton = document.querySelector('button[onclick="submitForm()"]');
    const originalText = submitButton ? submitButton.innerText : "";

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerText = "Enviando...";
    }

    // Coleta todos os dados
    const form = document.getElementById('visaForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Tratamento específico para o campo de renda (remover formatação para o envio)
    if (data.renda_mensal) {
        data.renda_mensal = data.renda_mensal.replace(/\./g, '').replace(',', '.');
    }
    data.session_id = sessionId; // Attach session ID to link with lead

    // Handle multiple checkboxes (like fonte_renda) correctly
    // Object.fromEntries only takes the last value for checking multiple boxes with same name
    // So we need to manually aggregate them
    const checkboxes = form.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach((checkbox) => {
        if (!data[checkbox.name]) {
            data[checkbox.name] = [];
        } else if (!Array.isArray(data[checkbox.name])) {
            data[checkbox.name] = [data[checkbox.name]];
        }
        if (Array.isArray(data[checkbox.name]) && !data[checkbox.name].includes(checkbox.value)) {
            data[checkbox.name].push(checkbox.value);
        }
    });

    console.log("Sending data:", data);

    fetch('https://team-sereno-club-sereno-361266c9.flowfuse.cloud/analise', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => {
            if (response.ok) {
                console.log("Success:", response);
                // Show final success screen
                const currentStep = document.querySelector('.step.active');
                if (currentStep) currentStep.classList.remove('active');

                document.getElementById('step-final').classList.add('active');
                localStorage.removeItem('visaFormProgress'); // Clear progress on success
            } else {
                console.error("Error:", response);
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerText = originalText;

                    // Show inline error
                    const errorPara = document.createElement('p');
                    errorPara.className = 'error-message text-red-500 text-sm mt-4 text-center';
                    errorPara.innerText = "Ocorreu um erro ao enviar. Tente novamente.";
                    submitButton.parentElement.appendChild(errorPara);
                } else {
                    alert("Ocorreu um erro ao enviar. Por favor, tente novamente.");
                }
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerText = originalText;

                const errorPara = document.createElement('p');
                errorPara.className = 'error-message text-red-500 text-sm mt-4 text-center';
                errorPara.innerText = "Erro de conexão. Verifique sua internet.";
                submitButton.parentElement.appendChild(errorPara);
            } else {
                alert("Erro de conexão. Verifique sua internet e tente novamente.");
            }
        });
}

// Helper to generate a simple Session ID
function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Ensure session ID exists
let sessionId = localStorage.getItem('visaFormSessionId');
if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem('visaFormSessionId', sessionId);
}

let iti; // Global variable for intl-tel-input instance

function submitLeadAndContinue() {
    // Lead continues using validateStep
    if (!validateStep()) return;

    const nome = document.getElementById('nome_completo');
    const email = document.getElementById('email');
    const telefoneFull = iti.getNumber();

    const leadData = {
        session_id: sessionId,
        status: 'started',
        nome_completo: nome.value,
        telefone: telefoneFull,
        email: email.value,
        timestamp: new Date().toISOString()
    };

    console.log("Sending lead data:", leadData);

    // Send to webhook (Lead Capture)
    fetch('https://team-sereno-club-sereno-361266c9.flowfuse.cloud/analise', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
    }).then(response => {
        console.log("Lead captured:", response.status);
    }).catch(err => {
        console.error("Error capturing lead:", err);
    });

    // Save locally
    saveProgress();

    // Move to next step (Passport Check)
    nextStep('step-3-0');
}


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkSavedProgress();

    // Initialize Phone Input
    const input = document.querySelector("#telefone");
    if (input) {
        iti = window.intlTelInput(input, {
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
            preferredCountries: ['br', 'us', 'pt'],
            separateDialCode: true,
        });
    }
});
