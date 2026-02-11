// ============================================================
// analise.js — Lógica da página de Análise (analise.html)
// Depende de: shared.js (carregado antes)
// ============================================================

// State management
let historyStack = [];
const MAX_HISTORY = 50;
let formHasData = false;
let formSubmitted = false;

// ===== Save / Resume Progress =====
function checkSavedProgress() {
    const saved = localStorage.getItem('visaFormProgress');
    if (saved) {
        const modal = document.getElementById('resumeModal');
        if (modal) modal.classList.remove('hidden');
    }
}

function saveProgress() {
    const activeStep = document.querySelector('.step.active');
    if (!activeStep) return;

    const formData = {};
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
        if (input.type === 'radio') {
            if (input.checked) {
                formData[input.name] = input.value;
            }
        } else if (input.type === 'checkbox') {
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

    // Incluir dados de contato do localStorage
    const contact = getContactData();
    if (contact) {
        formData.nome_completo = contact.nome_completo;
        formData.email = contact.email;
        formData.telefone = contact.telefone;
    }

    const state = {
        stepId: activeStep.id,
        history: historyStack,
        data: formData
    };

    localStorage.setItem('visaFormProgress', JSON.stringify(state));
    formHasData = Object.keys(formData).length > 0;
    syncToSupabase(activeStep.id, formData, formSubmitted);
}

function resumeForm() {
    const saved = localStorage.getItem('visaFormProgress');
    if (!saved) return;

    const state = JSON.parse(saved);

    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        const val = state.data[input.name];
        if (val) {
            if (input.type === 'radio') {
                if (val === input.value) {
                    input.checked = true;
                }
            } else if (input.type === 'checkbox') {
                if (Array.isArray(val) && val.includes(input.value)) {
                    input.checked = true;
                } else if (val === input.value) {
                    input.checked = true;
                }
            } else {
                input.value = val;
            }
        }
    });

    historyStack = state.history || [];

    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

    const targetStep = document.getElementById(state.stepId);
    if (targetStep) {
        targetStep.classList.add('active');
    } else {
        document.getElementById('step-0-address').classList.add('active');
    }

    const modal = document.getElementById('resumeModal');
    if (modal) modal.classList.add('hidden');
}

function restartForm() {
    localStorage.removeItem('visaFormProgress');
    const modal = document.getElementById('resumeModal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('visaForm').reset();
    historyStack = [];
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-0-address').classList.add('active');
}

// ===== Validation =====
function validateStep() {
    const activeStep = document.querySelector('.step.active');
    if (!activeStep) return true;

    const inputs = activeStep.querySelectorAll('input, select, textarea');
    let isValid = true;
    let firstInvalid = null;

    activeStep.querySelectorAll('.error-message').forEach(el => el.remove());

    const showError = (input, message) => {
        isValid = false;
        input.classList.add('border-red-500', 'ring-2', 'ring-red-200');
        if (!firstInvalid) firstInvalid = input;

        const msg = document.createElement('p');
        msg.className = 'error-message text-red-500 text-xs mt-1 font-medium';
        msg.innerText = message;

        if (input.parentElement) {
            input.parentElement.appendChild(msg);
        }
    };

    inputs.forEach(input => {
        if (input.type === 'button' || input.type === 'submit' || input.type === 'hidden') return;
        if (input.offsetParent === null) return;

        input.classList.remove('border-red-500', 'ring-2', 'ring-red-200');

        if (input.type === 'date' || input.type === 'month') {
            if (!input.value) {
                showError(input, "Selecione uma data.");
            } else {
                const selectedDate = new Date(input.value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (input.id === 'data_negativa' && selectedDate > today) {
                    showError(input, "Data da negativa não pode ser futura.");
                } else if (input.id === 'ultima_entrada' && selectedDate > today) {
                    showError(input, "Data de entrada não pode ser futura.");
                } else if (input.name === 'estudo_termino' && selectedDate <= today) {
                    showError(input, "Data de término deve ser futura.");
                }
            }
        } else if (input.tagName === 'SELECT') {
            if (!input.value || input.value === "") showError(input, "Selecione uma opção.");
        } else if (input.type === 'radio' || input.type === 'checkbox') {
            return;
        } else {
            const optionalFields = ['duvidas_principais', 'info_importante'];
            if (!input.value.trim() && !optionalFields.includes(input.name)) {
                showError(input, "Este campo é obrigatório.");
            } else if (input.type === 'email') {
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(input.value)) {
                    showError(input, "E-mail inválido. Ex: nome@email.com");
                }
            } else if (input.type === 'number' || input.inputMode === 'numeric') {
                const numValue = parseFloat(input.value);
                if (input.value === '') return;

                if (input.id === 'idade') {
                    if (isNaN(numValue) || numValue < 1 || numValue > 120) {
                        showError(input, "Idade deve estar entre 1 e 120 anos.");
                    }
                } else if (input.name === 'formacao_ano') {
                    const currentYear = new Date().getFullYear();
                    if (isNaN(numValue) || numValue < 1950 || numValue > currentYear) {
                        showError(input, `Ano deve estar entre 1950 e ${currentYear}.`);
                    }
                } else if (input.name === 'qtd_funcionarios') {
                    if (isNaN(numValue) || numValue < 0) {
                        showError(input, "Valor não pode ser negativo.");
                    }
                } else if (input.name === 'filhos_qtd') {
                    if (isNaN(numValue) || numValue < 1) {
                        showError(input, "Informe a quantidade de filhos (mínimo 1).");
                    }
                } else if (input.name === 'tempo_adicional') {
                    if (isNaN(numValue) || numValue < 1) {
                        showError(input, "Informe a quantidade de dias (mínimo 1).");
                    }
                } else if (input.name === 'tempo_empresa' || input.name === 'tempo_empresa_abertura') {
                    if (isNaN(numValue) || numValue < 0 || numValue > 50) {
                        showError(input, "Valor deve estar entre 0 e 50 anos.");
                    }
                }
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

            const container = group[0].closest('.flex-col, .grid') || group[0].parentElement;
            const msg = document.createElement('p');
            msg.className = 'error-message text-red-500 text-xs mt-2 font-medium bg-red-50 p-2 rounded border border-red-100';
            msg.innerText = group[0].type === 'radio' ? 'Selecione uma opção.' : 'Selecione pelo menos uma opção.';
            container.appendChild(msg);

            group.forEach(input => {
                let feedbackTarget = input.nextElementSibling;
                if (!feedbackTarget || !feedbackTarget.classList.contains('border')) {
                    feedbackTarget = input.closest('.border');
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

// ===== Navigation =====
function nextStep(targetId, skipValidation) {
    if (!skipValidation && !validateStep()) {
        return;
    }

    if (targetId && typeof handleStep43Navigation === 'function') {
        if (handleStep43Navigation(targetId)) return;
    }

    if (targetId && typeof handleStep4Navigation === 'function') {
        if (handleStep4Navigation(targetId)) return;
    }

    const currentStep = document.querySelector('.step.active');
    if (!currentStep) return;

    historyStack.push(currentStep.id);

    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
    }

    currentStep.classList.remove('active');

    let nextStepEl;
    if (targetId) {
        nextStepEl = document.getElementById(targetId);
    } else {
        console.error("No target ID specified for next step");
        return;
    }

    if (nextStepEl) {
        setTimeout(() => {
            nextStepEl.classList.add('active');
            saveProgress();
        }, 100);
    } else {
        console.error("Step not found:", targetId);
        currentStep.classList.add('active');
        historyStack.pop();
    }
}

function prevStep() {
    if (historyStack.length === 0) {
        // Se não tem histórico, voltar para o cadastro
        window.location.href = buildUrlWithOid('index.html');
        return;
    }

    const currentStep = document.querySelector('.step.active');
    const prevStepId = historyStack.pop();
    const prevStepEl = document.getElementById(prevStepId);

    if (!prevStepEl) return;

    const inputs = prevStepEl.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.classList.remove('border-red-500', 'bg-red-50');
    });

    const errorMsg = prevStepEl.querySelector('.status-msg');
    if (errorMsg) errorMsg.remove();

    if (currentStep) currentStep.classList.remove('active');

    setTimeout(() => {
        prevStepEl.classList.add('active');
        saveProgress();
    }, 100);
}

// ===== Business Logic =====
function handleFinalSelection() {
    setTimeout(() => {
        submitForm();
    }, 200);
}

function handleStep43Navigation(targetId) {
    if (targetId === 'step-4-3') {
        const incomeSource = document.querySelector('input[name="fonte_renda"]:checked');
        if (incomeSource && incomeSource.value === 'empresario') {
            console.log("[LOGIC] Skipping step-4-3 because user is entrepreneur");
            nextStep('step-duvidas', true);
            return true;
        }
    }
    return false;
}

function checkIncomeSourceAndRedirect() {
    setTimeout(() => {
        const selected = document.querySelector('input[name="fonte_renda"]:checked');
        const source = selected ? selected.value : null;

        if (source === 'empresario') {
            nextStep('branch-2-a-3-empresario', true);
        } else if (source === 'autonomo') {
            nextStep('branch-2-a-3-autonomo', true);
        } else {
            nextStep('step-3-1', true);
        }
    }, 200);
}

function handleStep4Navigation(targetId) {
    const activeStep = document.querySelector('.step.active');
    if (activeStep && activeStep.id === 'step-4-0-occupation') return false;

    if (targetId === 'step-4-1') {
        const payer = document.querySelector('input[name="pagador"]:checked');
        if (payer && (payer.value === 'patrocinador' || payer.value === 'empresa')) {
            console.log("[LOGIC] Redirecting to Occupation Question (Sponsored/Company)");
            nextStep('step-4-0-occupation', true);
            return true;
        }
    }
    return false;
}

function handleTravelHistoryExit() {
    const tipoSolicitacao = document.querySelector('input[name="solicitacao_tipo"]:checked')?.value;
    console.log("[NAV] Travel History Exit. Tipo:", tipoSolicitacao);

    switch (tipoSolicitacao) {
        case 'reaplicacao':
            nextStep('branch-1-b-1');
            break;
        case 'renovacao':
            nextStep('branch-1-c-1');
            break;
        case 'mudanca':
            nextStep('branch-1-d-1');
            break;
        case 'extensao':
            nextStep('branch-1-e-1');
            break;
        default:
            nextStep('step-2');
            break;
    }
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

function toggleField(fieldId, shouldShow) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    if (shouldShow) {
        field.classList.remove('hidden');
    } else {
        field.classList.add('hidden');
    }
}

function showStatus(message, isError = false) {
    const currentStep = document.querySelector('.step.active');
    if (!currentStep) return;

    const existing = currentStep.querySelector('.status-msg');
    if (existing) existing.remove();

    const msg = document.createElement('p');
    msg.className = `status-msg text-sm mt-4 text-center font-medium ${isError ? 'text-red-500' : 'text-gray-500 animate-pulse'}`;
    msg.innerText = message;

    const container = currentStep.querySelector('.flex.flex-col');
    if (container) {
        container.appendChild(msg);
    } else {
        currentStep.appendChild(msg);
    }
}

// ===== Submit Form =====
function submitForm() {
    if (window.isSubmitting) return;
    window.isSubmitting = true;

    const submitButton = document.querySelector('button[onclick="handleFinalSelection()"]');
    const originalText = submitButton ? submitButton.innerText : "";

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerText = "Enviando...";
    }

    if (!validateStep()) {
        window.isSubmitting = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerText = originalText;
        }
        return;
    }

    const form = document.getElementById('visaForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Incluir dados de contato do localStorage
    const contact = getContactData();
    if (contact) {
        data.nome_completo = contact.nome_completo;
        data.email = contact.email;
        data.telefone = contact.telefone;
    }

    // Converter renda_mensal de formato brasileiro (1.234,56) para número
    if (data.renda_mensal && typeof data.renda_mensal === 'string') {
        const numericValue = data.renda_mensal.replace(/[^\d,]/g, '').replace(',', '.');
        data.renda_mensal = parseFloat(numericValue);
    }

    if (data.renda_patrocinador && typeof data.renda_patrocinador === 'string') {
        const numericValue = data.renda_patrocinador.replace(/[^\d,]/g, '').replace(',', '.');
        data.renda_patrocinador = parseFloat(numericValue);
    }

    // Converter datas de yyyy-mm-dd para dd/mm/yyyy
    const dateFields = ['data_negativa', 'ultima_entrada', 'data_entrada_atual', 'formacao_data', 'estudo_termino', 'data_prevista_viagem', 'data_volta_viagem'];
    dateFields.forEach(field => {
        if (data[field] && typeof data[field] === 'string' && data[field].includes('-')) {
            const parts = data[field].split('-');
            if (parts.length === 3) {
                const [year, month, day] = parts;
                data[field] = `${day}/${month}/${year}`;
            } else if (parts.length === 2) {
                const [year, month] = parts;
                data[field] = `${month}/${year}`;
            }
        }
    });

    data.session_id = getSessionId();
    data.oid = getOid();
    data.status = 'completed';
    data.timestamp = new Date().toISOString();

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

    // Sanitização e Limpeza
    Object.keys(data).forEach(key => {
        if (data[key] == null || data[key] === "") {
            delete data[key];
        } else if (typeof data[key] === 'string') {
            data[key] = sanitizeString(data[key]);
        }
    });

    formSubmitted = true;
    syncToSupabase('step-final', data, true);

    console.log("Sending data:", data);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch('https://team-sereno-club-sereno-361266c9.flowfuse.cloud/analise', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal
    })
        .then(response => {
            clearTimeout(timeoutId);
            console.log("Success:", response);
            goToThankYouPage();
        })
        .catch((error) => {
            clearTimeout(timeoutId);
            console.error('Error:', error);
            // Mesmo com erro, redirecionar (dados já foram salvos no Supabase)
            goToThankYouPage();
        });
}

function goToThankYouPage() {
    clearAllFormData();
    window.isSubmitting = false;
    window.location.href = buildUrlWithOid('obrigado.html');
}

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se o usuário já fez o cadastro
    const contact = getContactData();
    if (!contact || !contact.nome_completo) {
        console.warn('[ANALISE] Sem dados de contato. Redirecionando para cadastro.');
        window.location.href = buildUrlWithOid('index.html');
        return;
    }

    console.log('[ANALISE] Contato carregado:', contact.nome_completo);
    console.log('[ANALISE] OID:', getOid());
    console.log('[ANALISE] Session:', getSessionId());

    // Configurar datas máximas para inputs de data
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (input.id === 'data_negativa' || input.id === 'ultima_entrada' || input.id === 'data_entrada_atual') {
            input.setAttribute('max', today);
        }
    });

    // Verificar progresso salvo
    checkSavedProgress();

    // Interceptar radio buttons com onclick
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        const onclickAttr = radio.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes('nextStep')) {
            radio.removeAttribute('onclick');

            const match = onclickAttr.match(/nextStep\s*\(\s*['"]([^'"]+)['"]/);
            if (match) {
                const targetId = match[1];
                const skipValidation = onclickAttr.includes(', true');
                radio.addEventListener('change', function () {
                    setTimeout(() => {
                        nextStep(targetId, skipValidation);
                    }, 150);
                });
            }
        }

        if (onclickAttr && onclickAttr.includes('checkIncomeSourceAndRedirect')) {
            radio.removeAttribute('onclick');
            radio.addEventListener('change', function () {
                checkIncomeSourceAndRedirect();
            });
        }

        if (onclickAttr && onclickAttr.includes('handleFinalSelection')) {
            radio.removeAttribute('onclick');
            radio.addEventListener('change', function () {
                handleFinalSelection();
            });
        }
    });

    // === PIXELS DE ANÁLISE ===
    // Meta Pixel: fbq('track', 'ViewContent');
    // Google Ads: gtag('event', 'page_view', { page_title: 'Analise' });
});
