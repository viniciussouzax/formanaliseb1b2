# Project: Visto Americano Form Strategic Audit

## 1. Overview
This project is a high-converting, strategic form designed to analyze B1/B2 Visa eligibility. It uses a multi-step approach with conditional logic to tailor questions based on the applicant's profile (First time, Renewal, Sponsored, Business Owner, etc.).

## 2. Key Logic & Rules

### A. Intelligent Branching
*   **Solicitation Type**: The form branches immediately based on whether it's a first request, renewal, reapplication (after denial), or category change.
*   **Financial Profile**:
    *   **Self-Funded**: Users are asked for their Income Source (CLT, Business Owner, Freelancer) and Monthly Income.
    *   **Sponsored (New Feature)**: Users are asked who is sponsoring (Parent, Spouse, etc.), the *Reason* for sponsorship, and importantly, the **Sponsor's Monthly Income** (now mandatory).
    *   **Occupation Check**: Sponsored users are now asked if they have an occupation (work/study) to ensure we capture their ties to Brazil even if they aren't paying for the trip.

### B. "Smart Skip" Logic (Business Owner)
*   **Context**: We need to know if an applicant has a business as it's a strong tie.
*   **Optimization**: If a user selects "Empresário" (Business Owner) as their income source in Step 2, the form **automatically skips** the "Do you have other businesses?" question in Step 4.
*   **Result**: Reduces redundancy and friction.

### C. Data Persistence
*   **Real-time Saving**: Every step progression triggers a save to `localStorage` and `Supabase`.
*   **Lead Capture**: Name, Email, and Phone are sent to the CRM/Webhook immediately after Step 0, even if the user drops off later.

## 3. Flow Diagram

```mermaid
graph TD
    StartingPoint((Start)) --> Step0[Contact Info]
    Step0 --> Truth[Truth Pledge]
    Truth --> Step1{Visa Type?}
    
    Step1 -->|First Time| Branch1A[Travel History]
    Step1 -->|Reapplication| Branch1B[Denial Details]
    Step1 -->|Renewal| Branch1C[Last Trip Info]
    
    Step1 --> Step2{Who Pays?}
    
    Step2 -->|Self| Branch2A[Income Source]
    Step2 -->|Sponsor| Branch2B[Sponsor Info]
    
    subgraph "Financial Logic"
        Branch2A -->|Business Owner| SetFlag_Business
        Branch2A -->|CLT/Freelancer| Step3
        
        Branch2B --> Branch2B_Reason[Reason]
        Branch2B_Reason --> Branch2B_Income[Sponsor Income (Required)]
        Branch2B_Income --> Step4_Occ{Has Occupation?}
    end
    
    Step3[Demographics] --> Step4[Ties & Education]
    
    Step4 --> CheckBusiness{Is Business Owner?}
    CheckBusiness -->|Yes (Flagged)| EndStep[Final Doubts]
    CheckBusiness -->|No| Step4_Biz[Do you have a business?]
    Step4_Biz --> EndStep
    
    EndStep --> Submit((Submit))
```

## 4. Source Code Context

### File: `index.html` (Structure & Layout)
Contains the multi-step HTML structure, Tailwind CSS classes, and the specific input fields for all branches.

```html
<!-- [See actual file for full content] -->
<!-- Key Section: Sponsor Income -->
<div class="step" id="branch-2-b-renda" data-step="2">
    <!-- ... inputs for sponsor income ... -->
</div>

<!-- Key Section: Business Owner Logic -->
<!-- This step is skipped if user is already identified as Entrepreneur -->
<div class="step" id="step-4-3" data-step="4">
    <!-- ... "Do you have other businesses?" ... -->
</div>
```

### File: `script.js` (Logic & State Management)
Handles navigation, validation, saving, and the logic specific rules.

```javascript
/* Key Logic: Skipping Step 4.3 */
function handleStep43Navigation(targetId) {
    if (targetId === 'step-4-3') {
        const incomeSource = document.querySelector('input[name="fonte_renda"]:checked');
        if (incomeSource && incomeSource.value === 'empresario') {
            return true; // Skips the question
        }
    }
    return false;
}

/* Key Logic: Sponsor Occupation Route */
function handleStep4Navigation(targetId) {
    if (targetId === 'step-4-1') {
        const payer = document.querySelector('input[name="pagador"]:checked');
        if (payer && (payer.value === 'patrocinador')) {
             nextStep('step-4-0-occupation', true); // Redirects to occupation question
             return true;
        }
    }
    return false;
}
```
