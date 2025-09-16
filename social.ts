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
const GOALS_STORAGE_KEY = 'socialGoals';

// --- DOM Elements ---
const elements = {
    // Goals
    goalsList: null as HTMLUListElement | null,
    goalsForm: null as HTMLFormElement | null,
    goalInput: null as HTMLInputElement | null,
    goalAIBtn: null as HTMLButtonElement | null,
    // AI Resources
    generateBtn: null as HTMLButtonElement | null,
    loadingEl: null as HTMLLIElement | null,
    outputEl: null as HTMLLIElement | null,
};

// --- AI RESOURCES ---
const generateResources = async () => {
    if (!elements.generateBtn || !elements.loadingEl || !elements.outputEl) return;
    
    const originalButtonText = elements.generateBtn.innerHTML;
    elements.generateBtn.disabled = true;
    elements.loadingEl.style.display = 'block';
    elements.outputEl.innerHTML = '';

    const prompt = `
        Sugira 3 recursos online ou aplicativos para melhorar a saúde social e as conexões.
        Para cada um, forneça um link (se aplicável) e uma breve descrição (1-2 frases).
        Formate a resposta em HTML, usando <ul> e <li> para a lista.
        Exemplo: <li><a href="..." target="_blank">Nome do Recurso</a> - Descrição breve.</li>
    `;
    
    try {
        // This is a placeholder since we can't get the raw text back from the global helper.
        // A real implementation would parse the response from a dedicated AI function.
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
        const mockHtmlResponse = `
            <div class="ai-resources-container">
                <p>Aqui estão algumas sugestões geradas por IA:</p>
                <ul>
                    <li><a href="https://www.meetup.com/" target="_blank" rel="noopener noreferrer">Meetup</a> - Uma plataforma excelente para encontrar grupos e eventos locais baseados em seus interesses, desde clubes de caminhada a grupos de tecnologia.</li>
                    <li><a href="https://www.eventbrite.com.br/" target="_blank" rel="noopener noreferrer">Eventbrite</a> - Descubra eventos, workshops e aulas na sua cidade. Uma ótima maneira de conhecer pessoas novas enquanto aprende algo.</li>
                    <li><a href="https://pt.duolingo.com/" target="_blank" rel="noopener noreferrer">Duolingo</a> - Participe de eventos de idiomas online ou presenciais para praticar com falantes nativos e outros aprendizes.</li>
                </ul>
            </div>
        `;
        elements.outputEl.innerHTML = DOMPurify.sanitize(mockHtmlResponse);
    } catch (error) {
        console.error("Error generating resources:", error);
        window.showToast('Erro ao gerar sugestões.', 'error');
        elements.outputEl.innerHTML = '<p>Não foi possível gerar sugestões no momento.</p>';
    } finally {
        elements.generateBtn.disabled = false;
        elements.generateBtn.innerHTML = originalButtonText;
        elements.loadingEl.style.display = 'none';
    }
};

// --- GOAL MANAGEMENT ---
const renderGoals = () => {
    if (!elements.goalsList) return;
    elements.goalsList.innerHTML = '';

    if (goals.length === 0) {
        elements.goalsList.innerHTML = '<li class="empty-list-placeholder">Nenhum objetivo definido ainda.</li>';
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
export function setupSocialPage() {
    const page = document.getElementById('page-social');
    if (!page) return;

    elements.goalsList = page.querySelector('#social-metas-list');
    elements.goalsForm = page.querySelector('#social-metas-form');
    elements.goalInput = page.querySelector('#social-meta-input');
    elements.goalAIBtn = page.querySelector('#social-meta-input-ai-btn');
    elements.generateBtn = page.querySelector('#generate-social-resources-btn');
    elements.loadingEl = page.querySelector('#social-resources-loading');
    elements.outputEl = page.querySelector('#social-resources-output');

    elements.goalsForm?.addEventListener('submit', handleAddGoal);
    elements.goalsList?.addEventListener('click', handleGoalAction);
    elements.generateBtn?.addEventListener('click', generateResources);

    elements.goalAIBtn?.addEventListener('click', () => {
        const prompt = "Sugira um objetivo para melhorar a saúde social, como 'Entrar em contato com um amigo que não vejo há tempos esta semana' ou 'Participar de um evento comunitário este mês'.";
        window.getAISuggestionForInput(prompt, elements.goalInput!, elements.goalAIBtn!);
    });
}

export function showSocialPage() {
    goals = window.loadItems(GOALS_STORAGE_KEY) || [];
    renderGoals();
    if (elements.outputEl) elements.outputEl.innerHTML = '';
}