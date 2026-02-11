# Form Specification & Data Dictionary

This document details every question, variable, and logic branch in the B1/B2 Visa Analysis Form.

## 1. Global Fields (Always Captured)
| Field Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `session_id` | String | Unique identifier for the user session | Hidden |
| `status` | String | Current status (`started`, `in_progress`, `completed`) | Hidden |
| `timestamp` | Date | Submission timestamp | Hidden |

## 2. Step-by-Step Question Flow

### Step 0: Lead Capture
*User enters contact info to start. Data is sent to webhook immediately.*
1.  **Nome Completo** (`nome_completo`) - Text
2.  **E-mail** (`email`) - Email (Validated)
3.  **Telefone** (`telefone`) - Tel (Validated via `intl-tel-input` with country code)

### Step 0-Truth: Commitment
*   **Action**: User must click "Serei verdadeiro(a)" to proceed. No data field, just a behavioral gate.

### Step 1: Intent & History
4.  **Qual o tipo da sua solicitação?** (`solicitacao_tipo`) - Radio
    *   *Options*: Primeira solicitação (`primeira`), Reaplicação (`reaplicacao`), Renovação (`renovacao`), Mudança (`mudanca`), Extensão (`extensao`).

#### Branch 1.A: Primeira Solicitação & Renovação
*   *(If `solicitacao_tipo` == `primeira` OR `renovacao`)*
    5.  **Já viajou internacionalmente antes?** (`viagem_internacional`) - Radio (sim/nao)
    6.  *(If Sim)* **Quais países visitou?** (`paises_visitados`) - Textarea

#### Branch 1.B: Reaplicação
*   *(If `solicitacao_tipo` == `reaplicacao`)*
    5.  **Quando foi a negativa anterior?** (`data_negativa`) - Date
    6.  **Motivo da Negativa (Código)** (`motivo_negativa_codigo`) - Text
    7.  **Relato do que aconteceu** (`relato_negativa`) - Textarea
    8.  **O que mudou desde então?** (`mudancas_perfil`) - Textarea

#### Branch 1.C: Renovação
*   *(If `solicitacao_tipo` == `renovacao`)*
    *   *Note*: User answers Travel History first.
    5.  **Última entrada nos EUA** (`ultima_entrada`) - Date
    6.  **Propósito da viagem anterior** (`proposito_anterior`) - Radio (turismo, negocios, familia, outro)
    7.  **Ficou o tempo autorizado?** (`tempo_autorizado`) - Radio (sim, menos, mais)

#### Branch 1.D: Mudança de Categoria
*   *(If `solicitacao_tipo` == `mudanca`)*
    5.  **Categoria Atual** (`categoria_atual`) - Text
    6.  **Categoria Desejada** (`categoria_desejada`) - Text
    7.  **Motivo** (`motivo_mudanca`) - Textarea

#### Branch 1.E: Extensão
*   *(If `solicitacao_tipo` == `extensao`)*
    5.  **Data Limite Atual** (`data_limite_atual`) - Date
    6.  **Tempo Adicional (dias)** (`tempo_adicional`) - Number
    7.  **Motivo** (`motivo_extensao`) - Textarea

### Step 2: Financial & Employment (Enriched)
8.  **Detalhes da Viagem (Kill Switch)** **[NEW]**:
    *   **Destino Pretendido** (`destino_viagem`) - Text
    *   **Duração (Dias)** (`duracao_viagem`) - Number
9.  **Quem pagará a viagem?** (`pagador`) - Radio
    *   *Options*: Próprio (`proprio`), Patrocinador (`patrocinador`), Empresa (`empresa`)

#### Branch 2.A: Self-Funded (`proprio`)
10. **Qual sua principal fonte de renda?** (`fonte_renda`) - Radio
    *   *Logic Note*: Selecting `empresario` here flags the user to skip the business question in Step 4.
11. **Renda Mensal** (`renda_mensal`) - Currency (R$)
12. **Validação Financeira (Strategic)** **[NEW]**:
    *   **Renda Declarada no IR?** (`declaracao_ir`) - Radio
    *   **Extratos Bancários Compatíveis?** (`extratos_bancarios`) - Checkbox
13. **Detalhes do Trabalho**:
    *   *(If CLT/Public/Other)*: Nome (`nome_empresa`), Cargo (`cargo`), Tempo de Empresa (`tempo_empresa`), **Tempo no Emprego Atual** (`tempo_emprego` - Select) **[NEW]**.
    *   *(If Empresário)*: Nome (`nome_empresa_propria`), CNPJ, Data Abertura, **Qtd Funcionários** (`qtd_funcionarios`), **Tipo Sede** (`tipo_sede` - Select) **[NEW]**.
    *   *(If Autônomo)*: Descrição (`trabalho_autonomo_desc`).

#### Branch 2.B: Sponsored (`patrocinador`)
*   *Same as before*

#### Branch 2.C: Company Paid (`empresa`)
*   *Same as before*

### Step 3: Demographics & Security
14. **Idade** (`idade`) - Number
15. **Estado Civil** (`estado_civil`) - Select
16. **Tem Parentes nos EUA?** (`parentes_eua`) - Radio (Sim/Não)
17. **Viajará sozinho?** (`viaja_sozinho`) - Radio (Sim/Não)
18. **Tem filhos?** (`filhos_tem`) - Radio (sim/nao)
19. **Antecedentes (Kill Switch)** **[NEW]**:
    *   **Já teve problemas com a justiça ou imigração?** (`antecedentes_criminais`) - Radio (Sim/Não)

### Step 4: Ties (Vínculos) & Education

#### Step 4.0: Occupation Check (Sponsored/Company Only)
*   *Same as before*

#### Step 4.1: Education
20. **Está estudando atualmente?** (`estuda_atualmente`) - Radio (sim/nao)
    *   *(If Sim)*: Tipo (`estudo_tipo`), **Semestre/Período** (`estudo_semestre`) **[NEW]**, Curso (`estudo_nome`), Previsão Término (`estudo_termino`).
    *   *(If Não)*: **Possui formação concluída?** (`possui_formacao`) - Radio (sim/nao).

#### Step 4.2: Assets
21. **Quais bens você possui em seu nome?** (`bens`) - Checkbox Group
    *   *Options*: Imóvel Escritura, Imóvel Contrato, Veículo, Investimentos, Nenhum.

#### Step 4.3: Business Ties
22. **Possui alguma empresa ou negócio próprio?** (`possui_outros_negocios`) - Radio (sim/nao)

### Step 5: Finalization
23. **Principais Dúvidas** (`duvidas_principais`) - Textarea (Optional)
24. **Informações Importantes** (`info_importante`) - Textarea (Optional)

---

## 3. Validation Logic
*   **Emails**: Regex validation.
*   **Phones**: Must be valid number for the selected country (via `intl-tel-input`).
*   **Dates**:
    *   Past dates required for: Negativa, Last Entry, Formation Year.
    *   Future dates required for: Study Graduation.
*   **Numeric**: Check for realistic ranges (Age 1-120, positive income, etc.).
