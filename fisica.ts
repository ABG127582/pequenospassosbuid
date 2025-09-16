import DOMPurify from 'dompurify';

// Type definitions
interface Exercise {
    id: string;
    name: string;
    type: string;
    duration: string;
}

interface SleepLog {
    date: string;
    hours: number;
    quality: number; // 1-4
    notes: string;
}

interface PerformanceBiomarkers {
    date: string;
    vo2max?: number;
    gripStrength?: number;
    restingHR?: number;
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
let exercises: Exercise[] = [];
let sleepLogs: SleepLog[] = [];
let performanceBiomarkers: PerformanceBiomarkers[] = [];

const EXERCISE_KEY = 'fisicaExercises';
const SLEEP_KEY = 'fisicaSleepLogs';
const BIOMARKER_KEY = 'fisicaBiomarkers';
const EXERCISE_STATUS_PREFIX = 'fisicaExerciseStatus-';

// --- DOM Elements ---
const elements = {
    // Hydration
    hydrationInput: null as HTMLInputElement | null,
    hydrationBtn: null as HTMLButtonElement | null,
    hydrationResult: null as HTMLSpanElement | null,
    // Exercise
    exerciseList: null as HTMLTableSectionElement | null,
    exerciseForm: null as HTMLFormElement | null,
    exerciseNameInput: null as HTMLInputElement | null,
    exerciseAIBtn: null as HTMLButtonElement | null,
    // Sleep
    sleepForm: null as HTMLFormElement | null,
    lastSleepEntry: null as HTMLDivElement | null,
    // Biomarkers
    vo2maxInput: null as HTMLInputElement | null,
    gripStrengthInput: null as HTMLInputElement | null,
    restingHRInput: null as HTMLInputElement | null,
    biomarkerDateInput: null as HTMLInputElement | null,
    saveBiomarkersBtn: null as HTMLButtonElement | null,
};

// --- RENDER FUNCTIONS ---
const renderExercises = () => {
    if (!elements.exerciseList) return;
    elements.exerciseList.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    const statusKey = `${EXERCISE_STATUS_PREFIX}${today}`;
    const dailyStatus = window.loadItems(statusKey) || {};

    if (exercises.length === 0) {
        elements.exerciseList.innerHTML = `<tr><td colspan="5" class="empty-list-placeholder">Nenhum exercício no seu protocolo.</td></tr>`;
        return;
    }

    exercises.forEach(ex => {
        const isCompleted = dailyStatus[ex.id] || false;
        const row = document.createElement('tr');
        row.dataset.id = ex.id;
        row.className = isCompleted ? 'completed' : '';
        row.innerHTML = `
            <td>${DOMPurify.sanitize(ex.name)}</td>
            <td>${DOMPurify.sanitize(ex.type)}</td>
            <td>${DOMPurify.sanitize(ex.duration)}</td>
            <td>
                <input type="checkbox" class="exercise-status-checkbox" ${isCompleted ? 'checked' : ''} aria-label="Marcar como concluído">
            </td>
            <td>
                <button class="action-btn delete-exercise-btn" aria-label="Remover exercício"><i class="fas fa-trash"></i></button>
            </td>
        `;
        elements.exerciseList!.appendChild(row);
    });
};

const renderLastSleepEntry = () => {
    if (!elements.lastSleepEntry || sleepLogs.length === 0) {
        if (elements.lastSleepEntry) elements.lastSleepEntry.innerHTML = '<p>Nenhum registro de sono encontrado.</p>';
        return;
    }
    const lastLog = sleepLogs[sleepLogs.length - 1];
    const qualityMap = { 4: 'Excelente', 3: 'Bom', 2: 'Razoável', 1: 'Ruim' };
    const date = new Date(lastLog.date + 'T00:00:00').toLocaleDateString('pt-BR');
    elements.lastSleepEntry.innerHTML = `
        <p><strong>Último Registro (${date}):</strong> ${lastLog.hours} horas, Qualidade: ${qualityMap[lastLog.quality]}. <em>"${DOMPurify.sanitize(lastLog.notes || 'Sem notas.')}"</em></p>
    `;
};


// --- EVENT HANDLERS ---
const handleHydrationCalc = () => {
    const weight = parseFloat(elements.hydrationInput!.value);
    if (weight && weight > 0) {
        const hydration = (weight * 35 / 1000).toFixed(2);
        elements.hydrationResult!.textContent = `${hydration} litros/dia`;
    } else {
        elements.hydrationResult!.textContent = '';
    }
};

const handleAddExercise = (e: Event) => {
    e.preventDefault();
    const nameInput = elements.exerciseForm!.querySelector('#exercise-name-input') as HTMLInputElement;
    const typeInput = elements.exerciseForm!.querySelector('#exercise-type-input') as HTMLSelectElement;
    const durationInput = elements.exerciseForm!.querySelector('#exercise-duration-input') as HTMLInputElement;

    const newExercise: Exercise = {
        id: Date.now().toString(),
        name: nameInput.value.trim(),
        type: typeInput.value,
        duration: durationInput.value.trim(),
    };

    if (newExercise.name && newExercise.duration) {
        exercises.push(newExercise);
        window.saveItems(EXERCISE_KEY, exercises);
        renderExercises();
        elements.exerciseForm!.reset();
    }
};

const handleExerciseListClick = (e: Event) => {
    const target = e.target as HTMLElement;
    const row = target.closest('tr');
    if (!row || !row.dataset.id) return;
    const id = row.dataset.id;

    if (target.matches('.delete-exercise-btn, .delete-exercise-btn *')) {
        exercises = exercises.filter(ex => ex.id !== id);
        window.saveItems(EXERCISE_KEY, exercises);
        renderExercises();
    } else if (target.matches('.exercise-status-checkbox')) {
        const today = new Date().toISOString().split('T')[0];
        const statusKey = `${EXERCISE_STATUS_PREFIX}${today}`;
        let dailyStatus = window.loadItems(statusKey) || {};
        dailyStatus[id] = (target as HTMLInputElement).checked;
        window.saveItems(statusKey, dailyStatus);
        renderExercises();
    }
};

const handleAddSleepLog = (e: Event) => {
    e.preventDefault();
    const date = (elements.sleepForm!.querySelector('#sleep-date-input') as HTMLInputElement).value;
    const hours = parseFloat((elements.sleepForm!.querySelector('#sleep-hours-input') as HTMLInputElement).value);
    const quality = parseInt((elements.sleepForm!.querySelector('#sleep-quality-input') as HTMLSelectElement).value, 10);
    const notes = (elements.sleepForm!.querySelector('#sleep-notes-input') as HTMLTextAreaElement).value;

    if (date && !isNaN(hours) && !isNaN(quality)) {
        const newLog: SleepLog = { date, hours, quality, notes };
        sleepLogs = sleepLogs.filter(log => log.date !== date); // Remove old entry for same day
        sleepLogs.push(newLog);
        sleepLogs.sort((a, b) => a.date.localeCompare(b.date)); // Keep sorted
        window.saveItems(SLEEP_KEY, sleepLogs);
        renderLastSleepEntry();
        elements.sleepForm!.reset();
        window.showToast('Registro de sono salvo!', 'success');
    }
};

const handleSaveBiomarkers = () => {
    const date = elements.biomarkerDateInput!.value;
    const vo2max = parseFloat(elements.vo2maxInput!.value) || undefined;
    const gripStrength = parseFloat(elements.gripStrengthInput!.value) || undefined;
    const restingHR = parseInt(elements.restingHRInput!.value, 10) || undefined;

    if (!date) {
        window.showToast('Por favor, insira a data da medição.', 'warning');
        return;
    }

    const newBiomarkers: PerformanceBiomarkers = { date, vo2max, gripStrength, restingHR };
    performanceBiomarkers = performanceBiomarkers.filter(b => b.date !== date);
    performanceBiomarkers.push(newBiomarkers);
    performanceBiomarkers.sort((a, b) => a.date.localeCompare(b.date));
    window.saveItems(BIOMARKER_KEY, performanceBiomarkers);

    window.showToast('Biomarcadores salvos com sucesso!', 'success');
};


// --- LIFECYCLE FUNCTIONS ---
export function setupFisicaPage() {
    const page = document.getElementById('page-fisica');
    if (!page) return;

    // Query elements
    elements.hydrationInput = page.querySelector('#peso-corporal-hidratacao-mapa');
    elements.hydrationBtn = page.querySelector('#btn-calcular-hidratacao-mapa');
    elements.hydrationResult = page.querySelector('#resultado-hidratacao-mapa');
    elements.exerciseList = page.querySelector('#exercise-protocol-list');
    elements.exerciseForm = page.querySelector('#exercise-protocol-form');
    elements.exerciseNameInput = page.querySelector('#exercise-name-input');
    elements.exerciseAIBtn = page.querySelector('#exercise-name-ai-btn');
    elements.sleepForm = page.querySelector('#sleep-log-form');
    elements.lastSleepEntry = page.querySelector('#last-sleep-entry');
    elements.vo2maxInput = page.querySelector('#vo2max-input');
    elements.gripStrengthInput = page.querySelector('#grip-strength-input');
    elements.restingHRInput = page.querySelector('#resting-hr-input');
    elements.biomarkerDateInput = page.querySelector('#biomarker-date-input');
    elements.saveBiomarkersBtn = page.querySelector('#save-performance-biomarkers-btn');
    
    // Attach listeners
    elements.hydrationBtn?.addEventListener('click', handleHydrationCalc);
    elements.exerciseForm?.addEventListener('submit', handleAddExercise);
    elements.exerciseList?.addEventListener('click', handleExerciseListClick);
    elements.sleepForm?.addEventListener('submit', handleAddSleepLog);
    elements.saveBiomarkersBtn?.addEventListener('click', handleSaveBiomarkers);

    elements.exerciseAIBtn?.addEventListener('click', () => {
        const prompt = "Sugira um nome de exercício físico comum, como 'Caminhada Rápida', 'Agachamento com Peso Corporal' ou 'Flexão de Braços'.";
        window.getAISuggestionForInput(prompt, elements.exerciseNameInput!, elements.exerciseAIBtn!);
    });
}

export function showFisicaPage() {
    // Load data
    exercises = window.loadItems(EXERCISE_KEY) || [];
    sleepLogs = window.loadItems(SLEEP_KEY) || [];
    performanceBiomarkers = window.loadItems(BIOMARKER_KEY) || [];

    // Render page components
    renderExercises();
    renderLastSleepEntry();

    // Prefill date inputs with today
    const today = new Date().toISOString().split('T')[0];
    if (elements.sleepForm) {
      (elements.sleepForm.querySelector('#sleep-date-input') as HTMLInputElement).value = today;
    }
    if (elements.biomarkerDateInput) {
      elements.biomarkerDateInput.value = today;
    }
}