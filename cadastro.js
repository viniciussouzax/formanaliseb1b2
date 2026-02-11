// ============================================================
// cadastro.js — Lógica da página de Cadastro (index.html)
// Depende de: shared.js (carregado antes)
// ============================================================

let formHasData = false;
let iti = null; // intl-tel-input instance

// Validation for cadastro step
function validateCadastro() {
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

        if (input.id === 'telefone') {
            if (iti) {
                // Usar validação do intl-tel-input
                if (!iti.isValidNumber()) {
                    showError(input, "Telefone inválido. Verifique o número e o DDI.");
                }
            } else {
                // Fallback: validação simples
                const phoneValue = input.value.replace(/\D/g, '');
                if (phoneValue.length < 8) {
                    showError(input, "Telefone inválido.");
                }
            }
        } else if (input.type === 'email') {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!input.value.trim()) {
                showError(input, "Este campo é obrigatório.");
            } else if (!emailRegex.test(input.value)) {
                showError(input, "E-mail inválido. Ex: nome@email.com");
            }
        } else {
            if (!input.value.trim()) {
                showError(input, "Este campo é obrigatório.");
            }
        }
    });

    if (!isValid && firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
    }

    return isValid;
}

// Step navigation for cadastro (only 2 steps: step-0 and step-0-truth)
let cadastroHistory = [];

function nextCadastroStep(targetId) {
    if (!validateCadastro()) return;

    const currentStep = document.querySelector('.step.active');
    if (!currentStep) return;

    cadastroHistory.push(currentStep.id);
    currentStep.classList.remove('active');

    const nextStepEl = document.getElementById(targetId);
    if (nextStepEl) {
        setTimeout(() => {
            nextStepEl.classList.add('active');
        }, 100);
    } else {
        console.error("Step not found:", targetId);
        currentStep.classList.add('active');
        cadastroHistory.pop();
    }
}

function prevCadastroStep() {
    if (cadastroHistory.length === 0) return;

    const currentStep = document.querySelector('.step.active');
    const prevStepId = cadastroHistory.pop();
    const prevStepEl = document.getElementById(prevStepId);

    if (!prevStepEl) return;

    if (currentStep) currentStep.classList.remove('active');
    setTimeout(() => {
        prevStepEl.classList.add('active');
    }, 100);
}

// Submit lead and go to step-0-truth (compromisso com a verdade)
function submitLeadAndContinue() {
    if (!validateCadastro()) return;

    const nome = document.getElementById('nome_completo');
    const email = document.getElementById('email');
    const telefoneInput = document.getElementById('telefone');

    const nomeVal = nome ? nome.value : '';
    const emailVal = email ? email.value : '';
    // Usar intl-tel-input para pegar número completo com DDI
    const telVal = iti ? iti.getNumber() : (telefoneInput ? telefoneInput.value : '');

    // Salvar dados de contato no localStorage
    saveContactData(nomeVal, emailVal, telVal);

    const leadData = {
        session_id: getSessionId(),
        status: 'started',
        nome_completo: nomeVal,
        telefone: telVal,
        email: emailVal,
        oid: getOid(),
        timestamp: new Date().toISOString()
    };

    console.log("[LEAD] Enviando lead:", leadData);

    // Enviar lead à API (fire and forget)
    fetch('https://team-sereno-club-sereno-361266c9.flowfuse.cloud/analise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
    }).then(response => {
        console.log("[LEAD] Lead capturado:", response.status);
    }).catch(err => {
        console.error("[LEAD] Erro ao capturar lead:", err);
    });

    // Sync com Supabase
    syncToSupabase('cadastro-completo', leadData, false);

    // Ir para step-0-truth (compromisso com a verdade)
    nextCadastroStep('step-0-truth');
}

// Redirecionar para a página de análise (chamada no botão "Serei verdadeiro(a)")
function goToAnalise() {
    window.location.href = buildUrlWithOid('analise.html');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Capturar oid da URL
    const oid = getOid();
    console.log('[CADASTRO] OID capturado:', oid);
    console.log('[CADASTRO] Session:', getSessionId());

    // Inicializar intl-tel-input
    const telefoneInput = document.getElementById('telefone');
    if (telefoneInput && typeof window.intlTelInput !== 'undefined') {
        iti = window.intlTelInput(telefoneInput, {
            initialCountry: 'br',
            separateDialCode: true,
            countryOrder: ['br', 'us', 'pt', 'gb', 'es', 'it', 'fr', 'de', 'jp', 'ar'],
            loadUtils: () => import("https://cdn.jsdelivr.net/npm/intl-tel-input@26.3.1/build/js/utils.js"),
            formatOnDisplay: true,
            nationalMode: false,
            autoPlaceholder: 'aggressive',
            useFullscreenPopup: false
        });
        console.log('[CADASTRO] intl-tel-input inicializado com sucesso');
    } else {
        console.warn('[CADASTRO] intl-tel-input não disponível, usando input simples');
    }

    // === PIXELS DE CADASTRO ===
    // Meta Pixel: fbq('track', 'PageView');
    // Google Ads: gtag('event', 'page_view', { page_title: 'Cadastro' });
});
