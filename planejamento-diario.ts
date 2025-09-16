// This file contains the logic for the "Planejamento Diário" (Daily Planning) page.
import DOMPurify from 'dompurify';

// Type definitions
interface DailyTask {
    id: string;
    description: string;
    intention: string;
    completed: boolean;
    mit: boolean; // Most Important Task
}

interface DailyPlan {
    tasks: DailyTask[];
    reflection: string;
}

// Re-declare global functions from index.tsx
declare global {
    interface Window {
        showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
        saveItems: (storageKey: string, items: any) => void;
        loadItems: (storageKey: string) => any;
        getAISuggestionForInput: (prompt: string, targetInput: HTMLInputElement | HTMLTextAreaElement, button: HTMLButtonElement) => Promise<void>;
    }
}

// --- Module-scoped variables ---

let currentDate: string;
let dailyPlan: DailyPlan;

const elements = {
    pageContainer: null as HTMLElement | null,
    dateInput: null as HTMLInputElement | null,
    progressRing: null as SVGCircleElement | null,
    progressText: null as SVGTextElement | null,
    mitSummary: null as HTMLParagraphElement | null,
    tasksList: null as HTMLDivElement | null,
    addTaskForm: null as HTMLFormElement | null,
    newTaskInput: null as HTMLTextAreaElement | null,
    newTaskAIBtn: null as HTMLButtonElement | null,
    reflectionTextarea: null as HTMLTextAreaElement | null,
    showCompletedToggle: null as HTMLInputElement | null,
    emptyPlaceholder: null as HTMLParagraphElement | null,
};


// --- Helper Functions ---

const getStorageKey = (date: string): string => `daily-plan-${date}`;

const loadPlan = () => {
    dailyPlan = window.loadItems(getStorageKey(currentDate)) || { tasks: [], reflection: '' };
};

const savePlan = () => {
    window.saveItems(getStorageKey(currentDate), dailyPlan);
};

const autosizeTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
};

const updateProgress = () => {
    if (!elements.progressRing || !elements.progressText) return;
    const totalTasks = dailyPlan.tasks.length;
    if (totalTasks === 0) {
        elements.progressRing.style.strokeDashoffset = '100';
        elements.progressText.textContent = '0%';
        return;
    }
    const completedTasks = dailyPlan.tasks.filter(task => task.completed).length;
    const percentage = Math.round((completedTasks / totalTasks) * 100);
    
    elements.progressRing.style.strokeDashoffset = (100 - percentage).toString();
    elements.progressText.textContent = `${percentage}%`;
};

const renderTasks = () => {
    if (!elements.tasksList || !elements.emptyPlaceholder || !elements.showCompletedToggle) return;
    
    elements.tasksList.innerHTML = ''; 
    
    const tasksToRender = elements.showCompletedToggle.checked 
        ? dailyPlan.tasks 
        : dailyPlan.tasks.filter(task => !task.completed);

    if (dailyPlan.tasks.length > 0) {
        elements.emptyPlaceholder.style.display = 'none';
    } else {
        elements.emptyPlaceholder.style.display = 'block';
    }

    if (tasksToRender.length === 0 && dailyPlan.tasks.length > 0) {
         const allDone = document.createElement('p');
         allDone.className = 'empty-list-placeholder';
         allDone.textContent = 'Todas as tarefas foram concluídas! 🎉';
         elements.tasksList.appendChild(allDone);
    } else {
         tasksToRender.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = `daily-task-item ${task.completed ? 'completed' : ''} ${task.mit ? 'mit' : ''}`;
            taskEl.dataset.taskId = task.id;

            taskEl.innerHTML = `
                <div class="task-main-info">
                    <button class="task-status-toggle" aria-label="Alterar status da tarefa">
                        <i class="far ${task.completed ? 'fa-check-circle' : 'fa-circle'}"></i>
                    </button>
                    <textarea class="task-description" rows="1">${DOMPurify.sanitize(task.description)}</textarea>
                    <div class="task-actions">
                        <button class="task-mit-toggle ${task.mit ? 'active' : ''}" aria-pressed="${task.mit}">MIT</button>
                        <button class="task-delete-btn standard-button-danger small-button" aria-label="Excluir tarefa"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <textarea class="task-intention" rows="1" placeholder="Intenção/Notas...">${DOMPurify.sanitize(task.intention || '')}</textarea>
            `;
            elements.tasksList.appendChild(taskEl);
        });
    }
    
    elements.tasksList.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(autosizeTextarea);
};

const updateMitSummary = () => {
    if (!elements.mitSummary) return;
    const mitCount = dailyPlan.tasks.filter(t => t.mit).length;
    elements.mitSummary.textContent = mitCount > 0 
        ? `Você tem ${mitCount} tarefa${mitCount > 1 ? 's' : ''} mais importante${mitCount > 1 ? 's' : ''} para hoje.` 
        : 'Defina suas tarefas mais importantes (MITs) para focar no que realmente importa.';
};

const renderPage = () => {
    loadPlan();
    renderTasks();
    updateProgress();
    updateMitSummary();
    if (elements.reflectionTextarea) {
        elements.reflectionTextarea.value = dailyPlan.reflection;
    }
};

const handleDateChange = () => {
    if (!elements.dateInput) return;
    currentDate = elements.dateInput.value;
    localStorage.setItem('daily-plan-last-date', currentDate);
    renderPage();
};

const handleAddTask = (e: Event) => {
    e.preventDefault();
    if (!elements.newTaskInput) return;
    const description = elements.newTaskInput.value.trim();
    if (!description) return;
    
    const newTask: DailyTask = {
        id: Date.now().toString(),
        description,
        intention: '',
        completed: false,
        mit: false,
    };
    
    dailyPlan.tasks.push(newTask);
    savePlan();
    renderPage();
    elements.newTaskInput.value = '';
    autosizeTextarea(elements.newTaskInput);
};

const handleTaskListActions = (e: Event) => {
    const target = e.target as HTMLElement;
    const taskItem = target.closest('.daily-task-item') as HTMLElement;
    if (!taskItem) return;

    const taskId = taskItem.dataset.taskId;
    const task = dailyPlan.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (target.closest('.task-status-toggle')) {
        task.completed = !task.completed;
    } else if (target.closest('.task-mit-toggle')) {
        task.mit = !task.mit;
    } else if (target.closest('.task-delete-btn')) {
        if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
            dailyPlan.tasks = dailyPlan.tasks.filter(t => t.id !== taskId);
        }
    } else if (target.matches('.task-description') || target.matches('.task-intention')) {
        return; // Handled by input event
    } else {
         return;
    }

    savePlan();
    renderPage();
};

const handleTaskTextChange = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    autosizeTextarea(target);

    const taskItem = target.closest('.daily-task-item') as HTMLElement;
    if (!taskItem) return;

    const taskId = taskItem.dataset.taskId;
    const task = dailyPlan.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (target.classList.contains('task-description')) {
        task.description = target.value;
    } else if (target.classList.contains('task-intention')) {
        task.intention = target.value;
    }
    
    savePlan(); // Autosave
};

// --- Page Lifecycle Functions ---

export function setupPlanejamentoDiarioPage() {
    elements.pageContainer = document.getElementById('page-planejamento-diario');
    if (!elements.pageContainer) return;

    // Query all elements once
    elements.dateInput = elements.pageContainer.querySelector('#daily-plan-date') as HTMLInputElement;
    elements.progressRing = elements.pageContainer.querySelector('#daily-progress-ring .progress-ring-fg') as SVGCircleElement;
    elements.progressText = elements.pageContainer.querySelector('#progress-ring-text') as SVGTextElement;
    elements.mitSummary = elements.pageContainer.querySelector('#mit-summary') as HTMLParagraphElement;
    elements.tasksList = elements.pageContainer.querySelector('#daily-tasks-list') as HTMLDivElement;
    elements.addTaskForm = elements.pageContainer.querySelector('#add-task-form') as HTMLFormElement;
    elements.newTaskInput = elements.pageContainer.querySelector('#new-task-description-input') as HTMLTextAreaElement;
    elements.newTaskAIBtn = elements.pageContainer.querySelector('#new-task-ai-btn') as HTMLButtonElement;
    elements.reflectionTextarea = elements.pageContainer.querySelector('#daily-reflection-textarea') as HTMLTextAreaElement;
    elements.showCompletedToggle = elements.pageContainer.querySelector('#show-completed-toggle') as HTMLInputElement;
    elements.emptyPlaceholder = elements.pageContainer.querySelector('#daily-tasks-list .empty-list-placeholder') as HTMLParagraphElement;

    // Attach event listeners once
    elements.dateInput?.addEventListener('change', handleDateChange);
    elements.addTaskForm?.addEventListener('submit', handleAddTask);
    elements.tasksList?.addEventListener('click', handleTaskListActions);
    elements.tasksList?.addEventListener('input', handleTaskTextChange);

    elements.reflectionTextarea?.addEventListener('input', () => {
        if (elements.reflectionTextarea) {
            dailyPlan.reflection = elements.reflectionTextarea.value;
            savePlan(); // Autosave reflection
        }
    });

    elements.showCompletedToggle?.addEventListener('change', renderTasks);

    elements.newTaskAIBtn?.addEventListener('click', () => {
        const prompt = "Sugira uma tarefa diária produtiva e acionável, como '08:00 - Planejar as 3 tarefas mais importantes do dia' ou '14:00 - Responder e-mails importantes por 30 minutos'.";
        if (elements.newTaskInput && elements.newTaskAIBtn) {
            window.getAISuggestionForInput(prompt, elements.newTaskInput, elements.newTaskAIBtn);
        }
    });
}

export function showPlanejamentoDiarioPage() {
    if (!elements.pageContainer || !elements.dateInput) return;

    // Set initial date for the current view
    currentDate = localStorage.getItem('daily-plan-last-date') || new Date().toISOString().split('T')[0];
    elements.dateInput.value = currentDate;
    
    // Initial render for the current date
    renderPage();
}
