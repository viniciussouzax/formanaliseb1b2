// State management
let historyStack = [];
const MAX_HISTORY = 50;
let formHasData = false;
let formSubmitted = false;
let iti = null;
let itiInitialized = false;

// Supabase Configuration
const SUPABASE_URL = 'https://zcpvknzktfmotvrybxdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjcHZrbnprdGZtb3R2cnlieGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDk2MjIsImV4cCI6MjA4NjM4NTYyMn0.XaJG4V6NsQTYoU8I_wxHLyDEkVdPosqfJNm8nRHVjxg';
// Verifica se supabase já existe (declarado pelo CDN) ou cria uma nova instância
let supabaseClient = null;
if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else if (typeof supabase !== 'undefined') {
    supabaseClient = supabase;
}

// Session ID Management
let sessionId = localStorage.getItem('visaFormSessionId') || 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
localStorage.setItem('visaFormSessionId', sessionId);

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
        if (input.type === 'radio' || input.type === 'checkbox') {
            if (input.checked) {
                if (!formData[input.name]) {
                    formData[input.name] = [];
                }
                formData[input.name].push(input.value);
            }
        } else {
            if (input.id === 'telefone' && iti && itiInitialized) {
                formData[input.name] = iti.getNumber() || input.value;
                console.log("[SAVE] Telefone salvo:", formData[input.name]);
            } else {
                formData[input.name] = input.value;
            }
        }
    });

    const state = {
        stepId: activeStep.id,
        history: historyStack,
        data: formData
    };

    localStorage.setItem('visaFormProgress', JSON.stringify(state));
    formHasData = Object.keys(formData).length > 0;
    syncToSupabase(activeStep.id, formData);
}

async function syncToSupabase(stepId, data) {
    if (!supabaseClient) {
        console.warn('[SUPABASE] Cliente não inicializado');
        return;
    }

    try {
        const payload = {
            session_id: sessionId,
            nome_completo: data.nome_completo || null,
            email: data.email || null,
            telefone: data.telefone || null,
            current_step: stepId,
            dados_completos: data,
            status: formSubmitted ? 'completed' : 'in_progress',
            updated_at: new Date().toISOString()
        };

        console.log('[SUPABASE] Sync telefone:', payload.telefone);

        const { error } = await supabaseClient
            .from('analise_visto')
            .upsert(payload, { onConflict: 'session_id' });

        if (error) {
            console.error('[SUPABASE] Erro:', error);
        } else {
            console.log('[SUPABASE] Sync OK');
        }
    } catch (err) {
        console.error('[SUPABASE] Exceção:', err);
    }
}

function resumeForm() {
    const saved = localStorage.getItem('visaFormProgress');
    if (!saved) return;

    const state = JSON.parse(saved);

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

    historyStack = state.history || [];

    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

    const targetStep = document.getElementById(state.stepId);
    if (targetStep) {
        targetStep.classList.add('active');
    } else {
        document.getElementById('step-0').classList.add('active');
    }

    const modal = document.getElementById('resumeModal');
    if (modal) modal.classList.add('hidden');
    
    setTimeout(() => {
        if (!itiInitialized) initializeITI();
    }, 100);
}

function restartForm() {
    localStorage.removeItem('visaFormProgress');
    const modal = document.getElementById('resumeModal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('visaForm').reset();
    historyStack = [];
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-0').classList.add('active');
    
    if (iti && itiInitialized) {
        iti.destroy();
        iti = null;
        itiInitialized = false;
    }
    setTimeout(initializeITI, 100);
}

// Validation Logic
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

        if (input.id === 'telefone' && input.closest('.iti')) {
            input.closest('.iti').parentElement.appendChild(msg);
        } else {
            if (input.parentElement) {
                input.parentElement.appendChild(msg);
            }
        }
    };

    inputs.forEach(input => {
        if (input.type === 'button' || input.type === 'submit' || input.type === 'hidden') return;
        input.classList.remove('border-red-500', 'ring-2', 'ring-red-200');

        if (input.id === 'telefone') {
            if (iti && itiInitialized) {
                if (!iti.isValidNumber()) {
                    showError(input, "Telefone inválido.");
                }
            } else {
                const phoneValue = input.value.replace(/\D/g, '');
                if (phoneValue.length < 10) {
                    showError(input, "Telefone inválido.");
                }
            }
        } else if (input.type === 'date' || input.type === 'month') {
            // Validação de datas
            if (!input.value) {
                showError(input, "Selecione uma data.");
            } else {
                const selectedDate = new Date(input.value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // Para data de negativa, não pode ser data futura
                if (input.id === 'data_negativa' && selectedDate > today) {
                    showError(input, "Data da negativa não pode ser futura.");
                }
                // Para última entrada, não pode ser data futura
                else if (input.id === 'ultima_entrada' && selectedDate > today) {
                    showError(input, "Data de entrada não pode ser futura.");
                }
                // Para data de término do curso, deve ser data futura
                else if (input.name === 'estudo_termino' && selectedDate <= today) {
                    showError(input, "Data de término deve ser futura.");
                }
            }
        } else if (input.tagName === 'SELECT') {
            if (!input.value || input.value === "") showError(input, "Selecione uma opção.");
        } else if (input.type === 'radio' || input.type === 'checkbox') {
            return;
        } else {
            if (!input.value.trim()) {
                showError(input, "Este campo é obrigatório.");
            } else if (input.type === 'email') {
                // Validação mais robusta de email
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(input.value)) {
                    showError(input, "E-mail inválido. Ex: nome@email.com");
                }
            } else if (input.type === 'number' || input.inputMode === 'numeric') {
                // Validações específicas para campos numéricos
                const numValue = parseFloat(input.value);
                
                if (input.id === 'idade') {
                    if (isNaN(numValue) || numValue < 1 || numValue > 120) {
                        showError(input, "Idade deve estar entre 1 e 120 anos.");
                    }
                } else if (input.name === 'formacao_ano') {
                    const currentYear = new Date().getFullYear();
                    if (isNaN(numValue) || numValue < 1950 || numValue > currentYear) {
                        showError(input, `Ano deve estar entre 1950 e ${currentYear}.`);
                    }
                } else if (input.name === 'qtd_funcionarios' || input.name === 'filhos_qtd') {
                    if (isNaN(numValue) || numValue < 0) {
                        showError(input, "Valor não pode ser negativo.");
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

function updateProgress() {
    const activeStep = document.querySelector('.step.active');
    if (!activeStep) return;

    const stepAttr = activeStep.getAttribute('data-step');
    if (!stepAttr) return;

    const currentStep = parseInt(stepAttr);
    const totalSteps = 4;

    const progress = Math.min(100, Math.round((currentStep / totalSteps) * 100));

    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressPercent = document.getElementById('progress-percent');

    if (progressBar) progressBar.style.width = progress + '%';
    if (progressText) progressText.textContent = `Etapa ${currentStep + 1} de ${totalSteps + 1}`;
    if (progressPercent) progressPercent.textContent = progress + '%';
}

function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function nextStep(targetId, skipValidation) {
    if (!skipValidation && !validateStep()) {
        return;
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

function handleFinalSelection() {
    setTimeout(() => {
        submitForm();
    }, 200);
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

    if (!prevStepEl) return;

    const inputs = prevStepEl.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type === 'radio' || input.type === 'checkbox') {
            input.checked = false;
        } else {
            input.value = '';
        }
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

function toggleField(fieldId, shouldShow) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    if (shouldShow) {
        field.classList.remove('hidden');
    } else {
        field.classList.add('hidden');
    }
}

function submitForm() {
    if (window.isSubmitting) return;
    window.isSubmitting = true;

    const submitButton = document.querySelector('button[onclick="submitForm()"]');
    const originalText = submitButton ? submitButton.innerText : "";

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerText = "Enviando...";
    }

    const form = document.getElementById('visaForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // CORREÇÃO: Pegar telefone com DDI completo via intl-tel-input
    if (iti && itiInitialized) {
        const telefoneCompleto = iti.getNumber();
        console.log("[SUBMIT] Telefone com DDI:", telefoneCompleto);
        data.telefone = telefoneCompleto;
    } else {
        console.warn("[SUBMIT] ITI não disponível, telefone sem DDI:", data.telefone);
    }

    // Converter renda_mensal de formato brasileiro (1.234,56) para número
    if (data.renda_mensal) {
        // Remove pontos de milhar e troca vírgula decimal por ponto
        data.renda_mensal = parseFloat(data.renda_mensal.replace(/\./g, '').replace(',', '.'));
    }
    
    // Converter datas de yyyy-mm-dd para dd/mm/yyyy
    const dateFields = ['data_negativa', 'ultima_entrada', 'data_entrada_atual'];
    dateFields.forEach(field => {
        if (data[field] && data[field].includes('-')) {
            const [year, month, day] = data[field].split('-');
            data[field] = `${day}/${month}/${year}`;
        }
    });
    
    // Converter data de término do curso de yyyy-mm-dd para dd/mm/yyyy
    if (data.estudo_termino && data.estudo_termino.includes('-')) {
        const [year, month, day] = data.estudo_termino.split('-');
        data.estudo_termino = `${day}/${month}/${year}`;
    }

    data.session_id = sessionId;
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

    formSubmitted = true;
    syncToSupabase('step-final', data);

    Object.keys(data).forEach(key => {
        if (data[key] == null || data[key] === "") {
            delete data[key];
        } else if (typeof data[key] === 'string') {
            data[key] = sanitizeString(data[key]);
        }
    });

    console.log("Sending data:", data);

    const goToFinalScreen = () => {
        const currentStep = document.querySelector('.step.active');
        if (currentStep) currentStep.classList.remove('active');
        const finalStep = document.getElementById('step-final');
        if (finalStep) finalStep.classList.add('active');
        localStorage.removeItem('visaFormProgress');
        window.isSubmitting = false;
        formSubmitted = true;
    };

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
            goToFinalScreen();
        })
        .catch((error) => {
            clearTimeout(timeoutId);
            console.error('Error:', error);
            goToFinalScreen();
        });
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

function submitLeadAndContinue() {
    if (!validateStep()) return;

    const nome = document.getElementById('nome_completo');
    const email = document.getElementById('email');
    
    let telefoneFull = '';
    if (iti && itiInitialized) {
        telefoneFull = iti.getNumber();
        console.log("[LEAD] Telefone com DDI:", telefoneFull);
    } else {
        const telefoneInput = document.getElementById('telefone');
        telefoneFull = telefoneInput ? telefoneInput.value : '';
        console.warn("[LEAD] ITI não disponível, telefone:", telefoneFull);
    }

    const leadData = {
        session_id: sessionId,
        status: 'started',
        nome_completo: nome ? nome.value : '',
        telefone: telefoneFull,
        email: email ? email.value : '',
        timestamp: new Date().toISOString()
    };

    console.log("Sending lead data:", leadData);

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

    saveProgress();
    nextStep('step-0-truth');
}

// ===== INTL-TEL-INPUT - VERSÃO SIMPLIFICADA =====
function initializeITI() {
    const input = document.querySelector("#telefone");
    
    if (!input) {
        console.warn("[ITI] Input não encontrado");
        return;
    }
    
    // Evitar reinicialização
    if (itiInitialized || input.dataset.intlTelInputId) {
        return;
    }
    
    // Verificar biblioteca
    const intlFunc = window.intlTelInput || (typeof intlTelInput !== 'undefined' ? intlTelInput : null);
    if (!intlFunc) {
        console.warn("[ITI] Biblioteca não carregada");
        setTimeout(initializeITI, 300);
        return;
    }
    
    try {
        console.log("[ITI] Inicializando...");
        
        iti = intlFunc(input, {
            utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@18.5.3/build/js/utils.js",
            preferredCountries: ['br', 'us', 'pt'],
            initialCountry: 'br',
            separateDialCode: true,
            nationalMode: false,
        });
        
        itiInitialized = true;
        console.log("[ITI] OK! DDI deve estar visível.");
        
        // Verificar elementos e configurar dropdown
        setTimeout(() => {
            const flagContainer = document.querySelector('.iti__selected-flag');
            const arrow = document.querySelector('.iti__arrow');
            const countryList = document.querySelector('.iti__country-list');
            const itiContainer = document.querySelector('.iti');
            const input = document.querySelector('#telefone');
            
            if (countryList && input) {
                // Posicionar dropdown logo abaixo do input
                const positionDropdown = () => {
                    const rect = input.getBoundingClientRect();
                    countryList.style.cssText = `
                        position: fixed !important;
                        top: ${rect.bottom + 4}px !important;
                        left: ${rect.left}px !important;
                        z-index: 2147483647 !important;
                        max-height: 300px !important;
                        width: ${rect.width}px !important;
                        min-width: 280px !important;
                        overflow-y: auto !important;
                        background-color: #ffffff !important;
                        border: 1px solid #d1d5db !important;
                        border-radius: 8px !important;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
                        list-style: none !important;
                        padding: 4px 0 !important;
                        margin: 0 !important;
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                    `;
                };
                
                // Função para toggle
                const toggleDropdown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const isHidden = countryList.style.display === 'none' || 
                                   countryList.classList.contains('iti__hide') ||
                                   window.getComputedStyle(countryList).display === 'none';
                    
                    if (isHidden) {
                        positionDropdown();
                        countryList.classList.remove('iti__hide');
                        console.log("[ITI] Dropdown ABERTO em:", input.getBoundingClientRect());
                    } else {
                        countryList.style.display = 'none';
                        countryList.classList.add('iti__hide');
                        console.log("[ITI] Dropdown FECHADO");
                    }
                };
                
                // Adicionar listener
                if (flagContainer) {
                    flagContainer.addEventListener('click', toggleDropdown);
                    flagContainer.style.cursor = 'pointer';
                }
                
                // Atualizar posição no scroll/resize
                window.addEventListener('scroll', () => {
                    if (countryList.style.display !== 'none') {
                        positionDropdown();
                    }
                }, true);
                
                window.addEventListener('resize', () => {
                    if (countryList.style.display !== 'none') {
                        positionDropdown();
                    }
                });
            }
            
            console.log("[ITI] Elementos:", {
                itiContainer: !!itiContainer,
                flagContainer: !!flagContainer,
                arrow: !!arrow,
                countryList: !!countryList,
                countries: countryList ? countryList.querySelectorAll('.iti__country').length : 0
            });
        }, 500);
        
    } catch (e) {
        console.error("[ITI] Erro:", e);
    }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Configurar datas máximas para inputs de data (não permitir datas futuras)
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (input.id === 'data_negativa' || input.id === 'ultima_entrada' || input.id === 'data_entrada_atual') {
            input.setAttribute('max', today);
        }
    });
    
    // Reativado: verificar se existe progresso salvo
    checkSavedProgress();
    
    // Múltiplas tentativas de inicialização
    initializeITI();
    setTimeout(initializeITI, 200);
    setTimeout(initializeITI, 500);
    setTimeout(initializeITI, 1000);

    // Interceptar radio buttons
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        const onclickAttr = radio.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes('nextStep')) {
            radio.removeAttribute('onclick');

            const match = onclickAttr.match(/nextStep\(['"]([^'"]+)['"]\)/);
            if (match) {
                const targetId = match[1];
                radio.addEventListener('change', function () {
                    setTimeout(() => {
                        nextStep(targetId, true);
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
});

// Confirmação antes de sair da página - DESATIVADA
// window.addEventListener('beforeunload', (e) => {
//     if (formHasData && !formSubmitted) {
//         e.preventDefault();
//         e.returnValue = '';
//         return '';
//     }
// });
