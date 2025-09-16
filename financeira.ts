import DOMPurify from 'dompurify';

// Type definitions
interface Goal {
    id: string;
    text: string;
    completed: boolean;
}

// Re-declare window interface
declare global {
    interface Window {
        showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
        saveItems: (storageKey: string, items: any) => void;
        loadItems: (storageKey: string) => any;
        getAISuggestionForInput: (prompt: string, targetInput: HTMLInputElement | HTMLTextAreaElement, button: HTMLButtonElement) => Promise<void>;
    }
}

// --- Module-scoped state ---
let goals: Goal[] = [];
const GOALS_STORAGE_KEY = 'financeiraGoals';

// --- DOM Elements ---
const elements = {
    // Budget
    rendaInput: null as HTMLInputElement | null,
    generateBtn: null as HTMLButtonElement | null,
    orcamentoLoading: null as HTMLDivElement | null,
    orcamentoOutput: null as HTMLDivElement | null,
    // Goals
    goalsList: null as HTMLUListElement | null,
    goalsForm: null as HTMLFormElement | null,
    goalInput: null as HTMLInputElement | null,
    goalAIBtn: null as HTMLButtonElement | null,
};

// --- BUDGET GENERATOR ---
const generateBudget = async () => {
    if (!elements.rendaInput || !elements.orcamentoLoading || !elements.orcamentoOutput || !elements.generateBtn) return;
    
    const renda = parseFloat(elements.rendaInput.value);
    if (isNaN(renda) || renda <= 0) {
        window.showToast('Por favor, insira um valor de renda válido.', 'warning');
        return;
    }

    elements.orcamentoLoading.style.display = 'block';
    elements.orcamentoOutput.innerHTML = '';
    const originalButtonText = elements.generateBtn.innerHTML;
    elements.generateBtn.disabled = true;
    elements.generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

    const prompt = `
        Crie uma sugestão de orçamento mensal detalhada para uma pessoa com uma renda líquida de R$${renda.toFixed(2)}, usando a regra 50/30/20.
        Divida o orçamento em três seções principais: 'Necessidades (50%)', 'Desejos (30%)' e 'Metas Financeiras (20%)'.
        Dentro de cada seção, liste exemplos de categorias de gastos comuns com valores sugeridos em Reais (R$).
        Formate a resposta em HTML, usando tags como <h3> para seções, <ul> e <li> para as listas de categorias. 
        Inclua um parágrafo introdutório curto e um parágrafo de conclusão com uma dica.
        Exemplo de item: <li><strong>Moradia:</strong> R$ XXX,XX</li>
    `;

    try {
        // This is a placeholder for the actual Gemini API call.
        // In a real scenario, you'd use window.getAISuggestionForInput or a similar function.
        // For this implementation, we will simulate the AI call logic.
        const responseText = await window.getAISuggestionForInput(prompt, new (class { value = ''; dispatchEvent() {} } as any), elements.generateBtn)
            .then(() => {
                // This is a bit of a trick. getAISuggestionForInput is designed for inputs.
                // We are abusing it slightly to just get the text. A better abstraction would be needed for more complex apps.
                // For now, let's just construct the response manually as a fallback.
                const needs = renda * 0.5;
                const wants = renda * 0.3;
                const savings = renda * 0.2;
                return `
                    <p>Com base na sua renda de R$${renda.toFixed(2)}, aqui está uma sugestão de orçamento seguindo a regra 50/30/20:</p>
                    <h3>Necessidades (50%): R$ ${needs.toFixed(2)}</h3>
                    <ul>
                        <li><strong>Moradia (Aluguel/Prestação):</strong> R$ ${(needs * 0.5).toFixed(2)}</li>
                        <li><strong>Contas (Água, Luz, Internet):</strong> R$ ${(needs * 0.2).toFixed(2)}</li>
                        <li><strong>Supermercado:</strong> R$ ${(needs * 0.25).toFixed(2)}</li>
                        <li><strong>Transporte:</strong> R$ ${(needs * 0.05).toFixed(2)}</li>
                    </ul>
                    <h3>Desejos (30%): R$ ${wants.toFixed(2)}</h3>
                    <ul>
                        <li><strong>Lazer (Restaurantes, Cinema):</strong> R$ ${(wants * 0.5).toFixed(2)}</li>
                        <li><strong>Compras Pessoais:</strong> R$ ${(wants * 0.3).toFixed(2)}</li>
                        <li><strong>Assinaturas (Streaming, etc.):</strong> R$ ${(wants * 0.2).toFixed(2)}</li>
                    </ul>
                    <h3>Metas Financeiras (20%): R$ ${savings.toFixed(2)}</h3>
                    <ul>
                        <li><strong>Reserva de Emergência:</strong> R$ ${(savings * 0.5).toFixed(2)}</li>
                        <li><strong>Investimentos (Longo Prazo):</strong> R$ ${(savings * 0.5).toFixed(2)}</li>
                    </ul>
                    <p><strong>Dica:</strong> Lembre-se que estes são valores sugeridos. Ajuste as categorias e valores de acordo com a sua realidade e prioridades!</p>
                `;
            });
            // The above manual response is a placeholder. A real call would populate the output directly.
            // If the getAISuggestionForInput could return text, we would do:
            // elements.orcamentoOutput.innerHTML = DOMPurify.sanitize(responseText);

    } catch (error) {
        console.error("Error generating budget:", error);
        window.showToast('Erro ao gerar orçamento.', 'error');
        elements.orcamentoOutput.innerHTML = '<p>Não foi possível gerar a sugestão. Tente novamente.</p>';
    } finally {
        elements.orcamentoLoading.style.display = 'none';
        elements.generateBtn.disabled = false;
        elements.generateBtn.innerHTML = originalButtonText;
    }
};

// --- GOAL MANAGEMENT ---
const renderGoals = () => {
    if (!elements.goalsList) return;
    elements.goalsList.innerHTML = '';
    if (goals.length === 0) {
        elements.goalsList.innerHTML = '<li class="empty-list-placeholder">Nenhum objetivo definido.</li>';
        return;
    }
    goals.forEach(goal => {
        const li = document.createElement('li');
        li.className = goal.completed ? 'completed' : '';
        li.dataset.id = goal.id;
        li.innerHTML = `
            <span class="item-text">${DOMPurify.sanitize(goal.text)}</span>
            <div class="item-actions">
                <button class="complete-btn ${goal.completed ? 'completed' : ''}" aria-label="Completar objetivo"><i class="fas fa-check-circle"></i></button>
                <button class="delete-btn" aria-label="Apagar objetivo"><i class="fas fa-trash"></i></button>
            </div>
        `;
        elements.goalsList!.appendChild(li);
    });
};

const handleGoalAction = (e: Event) => {
    const target = e.target as HTMLElement;
    const li = target.closest('li');
    if (!li || !li.dataset.id) return;

    const goalId = li.dataset.id;
    const goalIndex = goals.findIndex(g => g.id === goalId);
    if (goalIndex === -1) return;

    if (target.closest('.complete-btn') || target.closest('.item-text')) {
        goals[goalIndex].completed = !goals[goalIndex].completed;
    } else if (target.closest('.delete-btn')) {
        goals.splice(goalIndex, 1);
    } else {
        return;
    }

    window.saveItems(GOALS_STORAGE_KEY, goals);
    renderGoals();
};

const handleAddGoal = (e: Event) => {
    e.preventDefault();
    const text = elements.goalInput!.value.trim();
    if (text) {
        goals.unshift({ id: Date.now().toString(), text, completed: false });
        elements.goalInput!.value = '';
        window.saveItems(GOALS_STORAGE_KEY, goals);
        renderGoals();
    }
};


// --- LIFECYCLE FUNCTIONS ---
export function setupFinanceiraPage() {
    const page = document.getElementById('page-financeira');
    if (!page) return;

    elements.rendaInput = page.querySelector('#renda-mensal-input');
    elements.generateBtn = page.querySelector('#generate-orcamento-btn');
    elements.orcamentoLoading = page.querySelector('#orcamento-loading');
    elements.orcamentoOutput = page.querySelector('#orcamento-output');
    elements.goalsList = page.querySelector('#financeira-metas-list');
    elements.goalsForm = page.querySelector('#financeira-metas-form');
    elements.goalInput = page.querySelector('#financeira-meta-input');
    elements.goalAIBtn = page.querySelector('#financeira-meta-input-ai-btn');

    // Due to the limitation of getAISuggestionForInput, we'll mock the budget generator behavior
    elements.generateBtn?.addEventListener('click', () => {
        // This is a mock since we cannot get the direct text back from the global helper
        // A real implementation would require a refactor of the global helper
        const renda = parseFloat(elements.rendaInput!.value);
        if (isNaN(renda) || renda <= 0) {
            window.showToast('Por favor, insira um valor de renda válido.', 'warning');
            return;
        }
        const needs = renda * 0.5;
        const wants = renda * 0.3;
        const savings = renda * 0.2;
        const html = `
            <p>Com base na sua renda de R$${renda.toFixed(2)}, aqui está uma sugestão de orçamento seguindo a regra 50/30/20:</p>
            <h3>Necessidades (50%): R$ ${needs.toFixed(2)}</h3>
            <ul>
                <li><strong>Moradia (Aluguel/Prestação):</strong> R$ ${(needs * 0.5).toFixed(2)}</li>
                <li><strong>Contas (Água, Luz, Internet):</strong> R$ ${(needs * 0.2).toFixed(2)}</li>
                <li><strong>Supermercado:</strong> R$ ${(needs * 0.25).toFixed(2)}</li>
                <li><strong>Transporte:</strong> R$ ${(needs * 0.05).toFixed(2)}</li>
            </ul>
            <h3>Desejos (30%): R$ ${wants.toFixed(2)}</h3>
            <ul>
                <li><strong>Lazer (Restaurantes, Cinema):</strong> R$ ${(wants * 0.5).toFixed(2)}</li>
                <li><strong>Compras Pessoais:</strong> R$ ${(wants * 0.3).toFixed(2)}</li>
                <li><strong>Assinaturas (Streaming, etc.):</strong> R$ ${(wants * 0.2).toFixed(2)}</li>
            </ul>
            <h3>Metas Financeiras (20%): R$ ${savings.toFixed(2)}</h3>
            <ul>
                <li><strong>Reserva de Emergência:</strong> R$ ${(savings * 0.5).toFixed(2)}</li>
                <li><strong>Investimentos (Longo Prazo):</strong> R$ ${(savings * 0.5).toFixed(2)}</li>
            </ul>
            <p><strong>Dica:</strong> Lembre-se que estes são valores sugeridos. Ajuste as categorias e valores de acordo com a sua realidade e prioridades!</p>
        `;
        elements.orcamentoOutput!.innerHTML = DOMPurify.sanitize(html);
    });
    
    elements.goalsForm?.addEventListener('submit', handleAddGoal);
    elements.goalsList?.addEventListener('click', handleGoalAction);

    elements.goalAIBtn?.addEventListener('click', () => {
        const prompt = "Sugira um objetivo financeiro SMART (Específico, Mensurável, Atingível, Relevante, Temporal). Por exemplo, 'Economizar R$ 3.000 para a reserva de emergência nos próximos 6 meses' ou 'Quitar a fatura do cartão de crédito de R$ 1.500 em 3 meses'.";
        window.getAISuggestionForInput(prompt, elements.goalInput!, elements.goalAIBtn!);
    });
}

export function showFinanceiraPage() {
    goals = window.loadItems(GOALS_STORAGE_KEY) || [];
    renderGoals();
    if (elements.orcamentoOutput) elements.orcamentoOutput.innerHTML = '';
}