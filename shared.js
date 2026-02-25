// ============================================================
// shared.js — Utilitários compartilhados entre as 3 páginas
// ============================================================

// Supabase Configuration
const SUPABASE_URL = 'https://zcpvknzktfmotvrybxdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjcHZrbnprdGZtb3R2cnlieGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDk2MjIsImV4cCI6MjA4NjM4NTYyMn0.XaJG4V6NsQTYoU8I_wxHLyDEkVdPosqfJNm8nRHVjxg';

let supabaseClient = null;
if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ===== OID (Origin ID) Management =====
function getOid() {
    // 1. Tenta pegar da URL
    const params = new URLSearchParams(window.location.search);
    const urlOid = params.get('oid');
    if (urlOid) {
        localStorage.setItem('visaFormOid', urlOid);
        return urlOid;
    }
    // 2. Fallback: pega do localStorage
    return localStorage.getItem('visaFormOid') || null;
}

function buildUrlWithOid(basePath) {
    const oid = getOid();
    if (oid) {
        return `${basePath}?oid=${encodeURIComponent(oid)}`;
    }
    return basePath;
}

// ===== Session ID Management =====
function getSessionId() {
    let sessionId = localStorage.getItem('visaFormSessionId');
    if (!sessionId) {
        sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('visaFormSessionId', sessionId);
    }
    return sessionId;
}

// ===== Contact Data =====
function saveContactData(nome, email, telefone) {
    const data = { nome_completo: nome, email: email, telefone: telefone };
    localStorage.setItem('visaFormContact', JSON.stringify(data));
}

function getContactData() {
    const saved = localStorage.getItem('visaFormContact');
    if (!saved) return null;
    try {
        return JSON.parse(saved);
    } catch (e) {
        return null;
    }
}

// ===== Supabase Sync =====
async function syncToSupabase(stepId, data, formSubmitted) {
    if (!supabaseClient) {
        console.warn('[SUPABASE] Cliente não inicializado');
        return;
    }

    const contact = getContactData();

    try {
        const payload = {
            session_id: getSessionId(),
            nome_completo: data.nome_completo || (contact ? contact.nome_completo : null),
            email: data.email || (contact ? contact.email : null),
            telefone: data.telefone || (contact ? contact.telefone : null),
            current_step: stepId,
            dados_completos: data,
            status: formSubmitted ? 'completed' : 'in_progress',
            oid: getOid(),
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('analysis')
            .upsert(payload, { onConflict: 'session_id' });

        if (error) {
            console.error('[SUPABASE] Erro:', error);
        } else {
            console.log('[SUPABASE] Sync OK -', stepId);
        }
    } catch (err) {
        console.error('[SUPABASE] Exceção:', err);
    }
}

// ===== Sanitização =====
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== Limpar tudo ao finalizar =====
function clearAllFormData() {
    localStorage.removeItem('visaFormProgress');
    localStorage.removeItem('visaFormContact');
    // Não remove sessionId nem oid — podem ser úteis para tracking
}
