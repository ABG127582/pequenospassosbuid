import DOMPurify from 'dompurify';

// Type definitions
interface Goal {
    id: string;
    text: string;
    completed: boolean;
}

// Re-declare window interface for global functions from index.tsx
declare global {
    interface Window {
        showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
        saveItems: (storageKey: string, items: any) => void;
        loadItems: (storageKey: string) => any;
        getAISuggestionForInput: (prompt: string, targetInput: HTMLInputElement | HTMLTextAreaElement, button: HTMLButtonElement) => Promise<void>;
    }
}

// --- Module-scoped variables ---
const spiritualPractices = [
    { id: 'gratidao', text: 'Praticar a gratidão (Epicurismo)' },
    { id: 'meditacao', text: 'Atenção Plena (Mindfulness)' },
    { id: 'proposito', text: 'Reflexão sobre Valores Pessoais' },
    { id: 'natureza', text: 'Busca pela Admiração (Awe) na natureza ou na arte' }
];
const JOURNAL_PREFIX = 'gratitudeJournal-';
const GOALS_STORAGE_KEY = 'espiritualGoals';
let goals: Goal[] = [];

const elements = {
    practicesList: null as HTMLUListElement | null,
    gratitudeEntry: null as HTMLTextAreaElement | null,
    saveBtn: null as HTMLElement | null,
    viewPastBtn: null as HTMLElement | null,
    pastEntriesContainer: null as HTMLElement | null,
    // Goal elements
    goalsList: null as HTMLUListElement | null,
    goalsForm: null as HTMLFormElement | null,
    goalInput: null as HTMLInputElement | null,
    goalAIBtn: null as HTMLButtonElement | null,
};

// --- Helper Functions ---

const renderPractices = () => {
    if (!elements.practicesList) return;

    const today = new Date().toISOString().split('T')[0];
    const storageKey = `espiritual-checklist-${today}`;
    const completedPractices = window.loadItems(storageKey) || {};

    elements.practicesList.innerHTML = '';
    spiritualPractices.forEach(practice => {
        const isCompleted = !!completedPractices[practice.id];
        const li = document.createElement('li');
        li.innerHTML = `
            <label>
                <input type="checkbox" data-id="${practice.id}" ${isCompleted ? 'checked' : ''}>
                <span class="${isCompleted ? 'completed' : ''}">${practice.text}</span>
            </label>
        `;
        elements.practicesList.appendChild(li);
    });
};

const handlePracticeChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.type === 'checkbox') {
        const practiceId = target.dataset.id;
        if (practiceId) {
            const today = new Date().toISOString().split('T')[0];
            const storageKey = `espiritual-checklist-${today}`;
            let completedPractices = window.loadItems(storageKey) || {};
            completedPractices[practiceId] = target.checked;
            window.saveItems(storageKey, completedPractices);
            
            const span = target.nextElementSibling;
            if (span) {
                span.classList.toggle('completed', target.checked);
            }
        }
    }
};

const getTodayJournalKey = () => JOURNAL_PREFIX + new Date().toISOString().split('T')[0];

const loadTodaysEntry = () => {
    if (elements.gratitudeEntry) {
        elements.gratitudeEntry.value = window.loadItems(getTodayJournalKey()) || '';
    }
};

const saveEntry = () => {
    if (elements.gratitudeEntry) {
        const content = elements.gratitudeEntry.value.trim();
        window.saveItems(getTodayJournalKey(), content);
        window.showToast('Entrada de gratidão salva!', 'success');
    }
};

const renderPastEntries = () => {
    if (!elements.pastEntriesContainer) return;
    const entries = Object.keys(localStorage)
        .filter(key => key.startsWith(JOURNAL_PREFIX))
        .map(key => ({
            date: key.replace(JOURNAL_PREFIX, ''),
            content: window.loadItems(key) || ''
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

    elements.pastEntriesContainer.innerHTML = entries.length === 0
        ? '<p class="empty-list-placeholder">Nenhuma entrada anterior encontrada.</p>'
        : entries.map(entry => {
            const entryDate = new Date(entry.date + 'T00:00:00');
            const formattedDate = entryDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
            const sanitizedContent = DOMPurify.sanitize(entry.content).replace(/\n/g, '<br>');
            return `
                <div class="past-entry-item">
                    <h4>${formattedDate}</h4>
                    <p>${sanitizedContent}</p>
                </div>`;
        }).join('');
};

const togglePastEntriesView = () => {
    if (!elements.pastEntriesContainer || !elements.viewPastBtn) return;
    const isVisible = elements.pastEntriesContainer.style.display !== 'none';
    if (isVisible) {
        elements.pastEntriesContainer.style.display = 'none';
        elements.viewPastBtn.innerHTML = '<i class="fas fa-history"></i> Visualizar Entradas Anteriores';
    } else {
        renderPastEntries();
        elements.pastEntriesContainer.style.display = 'block';
        elements.viewPastBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar Entradas';
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

    if (target.closest('.complete-btn')) {
        goals[goalIndex].completed = !goals[goalIndex].completed;
    } else if (target.closest('.delete-btn')) {
        goals.splice(goalIndex, 1);
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

// --- Page Lifecycle Functions ---

export function setupEspiritualPage() {
    const page = document.getElementById('page-espiritual');
    if (!page) return;

    elements.practicesList = page.querySelector('#espiritual-praticas-list');
    elements.gratitudeEntry = page.querySelector('#gratitude-entry');
    elements.saveBtn = page.querySelector('#save-gratitude-btn');
    elements.viewPastBtn = page.querySelector('#view-past-gratitude-btn');
    elements.pastEntriesContainer = page.querySelector('#past-gratitude-entries');
    elements.goalsList = page.querySelector('#espiritual-metas-list');
    elements.goalsForm = page.querySelector('#espiritual-metas-form');
    elements.goalInput = page.querySelector('#espiritual-meta-input');
    elements.goalAIBtn = page.querySelector('#espiritual-meta-input-ai-btn');
    
    elements.practicesList?.addEventListener('change', handlePracticeChange);
    elements.saveBtn?.addEventListener('click', saveEntry);
    elements.viewPastBtn?.addEventListener('click', togglePastEntriesView);
    elements.goalsForm?.addEventListener('submit', handleAddGoal);
    elements.goalsList?.addEventListener('click', handleGoalAction);

    elements.goalAIBtn?.addEventListener('click', () => {
        const prompt = "Sugira um objetivo de saúde espiritual, como 'Meditar 10 minutos por dia' ou 'Escrever três coisas pelas quais sou grato todas as noites'.";
        window.getAISuggestionForInput(prompt, elements.goalInput!, elements.goalAIBtn!);
    });
}

export function showEspiritualPage() {
    // Load and render all components of the page
    renderPractices();
    loadTodaysEntry();
    goals = window.loadItems(GOALS_STORAGE_KEY) || [];
    renderGoals();
    
    // Reset view of past entries
    if (elements.pastEntriesContainer) elements.pastEntriesContainer.style.display = 'none';
    if (elements.viewPastBtn) elements.viewPastBtn.innerHTML = '<i class="fas fa-history"></i> Visualizar Entradas Anteriores';
}