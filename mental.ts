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
const GOALS_STORAGE_KEY = 'mentalGoals';

// --- DOM Elements ---
const elements = {
    goalsList: null as HTMLUListElement | null,
    goalsForm: null as HTMLFormElement | null,
    goalInput: null as HTMLInputElement | null,
    goalAIBtn: null as HTMLButtonElement | null,
};

// --- RENDER FUNCTION ---
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

// --- EVENT HANDLERS ---
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
export function setupMentalPage() {
    const page = document.getElementById('page-mental');
    if (!page) return;

    elements.goalsList = page.querySelector('#mental-metas-list');
    elements.goalsForm = page.querySelector('#mental-metas-form');
    elements.goalInput = page.querySelector('#mental-meta-input');
    elements.goalAIBtn = page.querySelector('#mental-meta-input-ai-btn');

    elements.goalsForm?.addEventListener('submit', handleAddGoal);
    elements.goalsList?.addEventListener('click', handleGoalAction);

    elements.goalAIBtn?.addEventListener('click', () => {
        const prompt = "Sugira um objetivo de saúde mental prático e positivo. Por exemplo, 'Praticar 5 minutos de respiração consciente diariamente' ou 'Desconectar de telas 1 hora antes de dormir'.";
        window.getAISuggestionForInput(prompt, elements.goalInput!, elements.goalAIBtn!);
    });
}

export function showMentalPage() {
    goals = window.loadItems(GOALS_STORAGE_KEY) || [];
    renderGoals();
}