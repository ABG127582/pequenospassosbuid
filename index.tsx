

import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import DOMPurify from 'dompurify';

// --- TYPE DEFINITIONS ---

// Define types for items to avoid 'any'
interface GoalItem {
    text: string;
    completed: boolean;
}

interface ActivityPracticeItem {
    name: string;
    duration?: string;
    completed: boolean;
}

type GenericItem = GoalItem | ActivityPracticeItem;

interface ListManagementConfig {
    sectionKey: string;
    storageKey: string;
    listId: string;
    formId: string;
    textInputId?: string;
    nameInputId?: string;
    durationInputId?: string;
    itemType: 'goal' | 'activity';
    fields?: string[];
}

interface DailyTask {
    id: string;
    time: string;
    description: string;
    intention: string;
    isMIT: boolean;
    status: 'pending' | 'in-progress' | 'completed';
}

interface DailyPlan {
    date: string;
    tasks: DailyTask[];
    reflection: string;
    hideCompleted: boolean;
}

interface IndicatorConfig {
    id: string;
    name: string;
    unit: string;
    barMin: number;
    barMax: number;
    optimalMin: number;
    optimalMax: number;
    reversedGradient?: boolean;
    zones: {
        min: number;
        max: number;
        label: string;
        colorClass: string;
    }[];
}

interface DiagnosticConfig {
    id: string;
    name: string;
    hasType?: boolean;
    hasSeverity?: boolean;
}


// Extend the Window interface for global functions and properties
declare global {
    interface Window {
        ai: GoogleGenAI;
        process: {
            env: {
                API_KEY?: string;
            }
        };
        showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
        saveItems: (storageKey: string, items: any) => void;
        loadItems: (storageKey: string) => any;
        showPage: (pageId: string) => Promise<void>;
        toggleSidebar: (initialize?: boolean) => void;
        updateRainSoundButtonPosition: () => void;
        loadVaccineData: () => void;
        saveVaccineData: () => void;
        calculateNextDose: (lastDose: string, intervalYears?: number, intervalMonths?: number, isAnnual?: boolean) => string;
        updateVaccineStatus: (rowOrId: HTMLElement | string) => void;
        getIndicatorById: (id: string) => IndicatorConfig | undefined;
        getDiagnosticById: (id: string) => DiagnosticConfig | undefined;
        saveIndicatorData: (indicatorId: string, value: number, date: string) => void;
        loadIndicatorData: (indicatorId: string) => { value: number; date: string } | null;
        saveAllIndicatorData: () => void;
        loadAllIndicatorData: () => void;
        updateIndicatorUI: (config: IndicatorConfig, value: number | null, date: string | null) => void;
        saveDiagnosticData: () => void;
        loadDiagnosticData: () => void;
        logIndicatorEntry: (indicatorId: string, value: number, date: string, status: string) => void;
        updateIndicatorHistoryTable: () => void;
        updateThemeToggleButtonIcon: (isDark: boolean) => void;
        loadTheme: () => void;
        toggleRainSound: () => void;
        setupListManagement: (config: ListManagementConfig) => void;
        openContractModal: () => void;
        closeContractModal: () => void;
        saveContractData: () => void;
        loadContractData: () => any;
        populateContractModal: () => void;
        printContract: () => void;
        openIndicatorChartModal: (indicatorId: string) => void;
        closeIndicatorChartModal: () => void;
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
        stopChattiListening: () => void;
        updateChattiMicButtonState: (isListening: boolean, button?: HTMLElement | null) => void;
        startFieldListening: (targetInputId: string, micButtonId: string) => void;
        addMicButtonTo: (wrapperSelector: string, targetInputId: string, sectionSpecificClass?: string) => void;
        initFisicaPage: () => void;
        initMentalPage: () => void;
        initFinanceiraPage: () => void;
        initFamiliarPage: () => void;
        initProfissionalPage: () => void;
        initSocialPage: () => void;
        initEspiritualPage: () => void;
        printDailyPlan: () => void;
        initPlanejamentoDiarioPage: () => void;
        initPreventivaPage: () => void;
        initTarefasPage: () => void;
        generateAndDisplayWebResources: (button: HTMLElement, loadingEl: HTMLElement, outputEl: HTMLElement, prompt: string) => Promise<void>;
        getAISuggestionForInput: (prompt: string, targetInput: HTMLInputElement | HTMLTextAreaElement, button: HTMLButtonElement) => Promise<void>;
    }
}

// --- SPEECH RECOGNITION (DICTATION) ---
let currentListeningInputId: string | null = null;
let recognitionInstance: any | null = null;
let recognitionTimeout: number | undefined;

function stopChattiListening() {
    if (recognitionInstance) {
        recognitionInstance.stop();
    }
}
window.stopChattiListening = stopChattiListening;

function updateChattiMicButtonState(isListening: boolean, button: HTMLElement | null = null) {
    const micButton = button || (currentListeningInputId ? document.querySelector(`[data-mic-for="${currentListeningInputId}"]`) : null);
    if (micButton) {
        micButton.classList.toggle('listening', isListening);
        const icon = micButton.querySelector('i');
        if (icon) {
            icon.className = isListening ? 'fas fa-microphone-slash' : 'fas fa-microphone';
        }
    }
}
window.updateChattiMicButtonState = updateChattiMicButtonState;

function startFieldListening(targetInputId: string, micButtonId: string) {
    if (recognitionInstance) {
        stopChattiListening();
        return;
    }

    // Check for secure context (HTTPS) before using SpeechRecognition
    if (!window.isSecureContext) {
        window.showToast("O reconhecimento de voz requer uma conexão segura (HTTPS).", "error");
        console.error("SpeechRecognition cannot be started from an insecure context.");
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        window.showToast("Reconhecimento de voz não é suportado neste navegador.", "warning");
        return;
    }

    const targetInput = document.getElementById(targetInputId) as HTMLInputElement | HTMLTextAreaElement;
    if (!targetInput) return;
    
    const micButton = document.getElementById(micButtonId);

    currentListeningInputId = targetInputId;
    recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = 'pt-BR';
    recognitionInstance.interimResults = true;
    recognitionInstance.continuous = true;

    let finalTranscript = targetInput.value ? targetInput.value + ' ' : '';

    recognitionInstance.onstart = () => {
        updateChattiMicButtonState(true, micButton);
        recognitionTimeout = window.setTimeout(() => {
            if(recognitionInstance) {
                recognitionInstance.stop();
            }
        }, 15000); 
    };

    recognitionInstance.onresult = (event: any) => {
        clearTimeout(recognitionTimeout);
        recognitionTimeout = window.setTimeout(() => {
            if(recognitionInstance) {
                recognitionInstance.stop();
            }
        }, 5000);

        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        targetInput.value = finalTranscript + interimTranscript;
    };

    recognitionInstance.onend = () => {
        targetInput.value = finalTranscript.trim();
        targetInput.dispatchEvent(new Event('input', { bubbles: true })); 
        updateChattiMicButtonState(false, micButton);
        clearTimeout(recognitionTimeout);
        recognitionInstance = null;
        currentListeningInputId = null;
    };

    recognitionInstance.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech') {
            window.showToast(`Erro no reconhecimento de voz: ${event.error}`, "error");
        }
        clearTimeout(recognitionTimeout);
        if (recognitionInstance) recognitionInstance.stop();
    };

    recognitionInstance.start();
}
window.startFieldListening = startFieldListening;

function addMicButtonTo(wrapperSelector: string, targetInputId: string, sectionSpecificClass = '') {
    const wrapper = document.querySelector(wrapperSelector) as HTMLElement;
    const targetInput = document.getElementById(targetInputId) as HTMLElement;

    if (!wrapper || !targetInput || wrapper.querySelector('.mic-button')) {
        return;
    }

    const micButtonId = `mic-btn-${targetInputId}`;
    const micButton = document.createElement('button');
    micButton.type = 'button';
    micButton.id = micButtonId;
    micButton.className = `mic-button ${sectionSpecificClass}`;
    micButton.setAttribute('aria-label', `Ditar para ${targetInput.getAttribute('placeholder') || 'campo'}`);
    micButton.dataset.micFor = targetInputId;
    micButton.innerHTML = '<i class="fas fa-microphone"></i>';

    micButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentListeningInputId === targetInputId) {
             stopChattiListening();
        } else if (currentListeningInputId !== null) {
            stopChattiListening();
            setTimeout(() => startFieldListening(targetInputId, micButtonId), 200);
        } else {
            startFieldListening(targetInputId, micButtonId);
        }
    });

    wrapper.appendChild(micButton);
}
window.addMicButtonTo = addMicButtonTo;


// --- GENERIC LOCALSTORAGE PERSISTENCE ---
function saveItems(storageKey: string, items: any) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) {
        console.error(`Failed to save items for key "${storageKey}" to localStorage`, e);
        window.showToast('Erro ao salvar dados.', 'error');
    }
}
window.saveItems = saveItems;

function loadItems(storageKey: string) {
    try {
        const storedItems = localStorage.getItem(storageKey);
        if (storedItems === null) {
            return null;
        }
        return JSON.parse(storedItems);
    } catch (e) {
        console.error(`Failed to load items for key "${storageKey}" from localStorage`, e);
        window.showToast('Erro ao carregar dados.', 'error');
        return null;
    }
}
window.loadItems = loadItems;


// --- PAGE NAVIGATION & ROUTING ---
const pageInitializers: { [key: string]: string | null } = {
    'inicio': null,
    'fisica': 'initFisicaPage',
    'mental': 'initMentalPage',
    'financeira': 'initFinanceiraPage',
    'familiar': 'initFamiliarPage',
    'profissional': 'initProfissionalPage',
    'social': 'initSocialPage',
    'espiritual': 'initEspiritualPage',
    'preventiva': 'initPreventivaPage',
    'planejamento-diario': 'initPlanejamentoDiarioPage',
    'tarefas': 'initTarefasPage',
    'contrato': 'openContractModal', // Special case for modal
    // Food pages - no specific init
    'food-gengibre': null, 'food-alho': null, 'food-brocolis': null, 'food-couveflor': null,
    'food-shitake': null, 'food-lentilha': null, 'food-azeite': null, 'food-morango': null,
    'food-laranja': null, 'food-maca': null, 'food-cenoura': null, 'food-pimenta': null,
    'food-ovo': null, 'food-vinagremaca': null, 'food-whey': null, 'food-creatina': null,
    'food-curcuma': null, 'food-chaverde': null, 'food-canela': null, 'food-linhaca': null,
    'alongamento': null,
    // Reading guides
    'leitura-guia-fisica': null, 'leitura-guia-espiritual': null, 'leitura-guia-familiar': null,
    'leitura-guia-mental': null, 'leitura-guia-financeira': null,
};
let currentPageInitFunction: Function | null = null;
const pageCache = new Map<string, string>();

async function showPage(pageId: string) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Handle special case for contract modal
    if (pageId === 'contrato') {
        window.openContractModal();
        // Reset hash so the modal doesn't stay in the URL history
        history.replaceState(null, '', '#');
        return;
    }

    try {
        let pageHtml = pageCache.get(pageId);
        if (!pageHtml) {
            const response = await fetch(`./${pageId}.html`);
            if (!response.ok) {
                console.error(`Page not found: ${pageId}.html. Redirecting to 'inicio'.`);
                window.location.hash = 'inicio';
                return;
            }
            pageHtml = await response.text();
            pageCache.set(pageId, pageHtml);
        }
        mainContent.innerHTML = pageHtml;

    } catch(e) {
        console.error(`Failed to load page ${pageId}`, e);
        mainContent.innerHTML = `<div class="container" style="padding: 20px; text-align: center;"><h1>Error</h1><p>Error loading page content for ${pageId}.</p></div>`;
        return;
    }
    
    const targetSection = mainContent.querySelector('.page-section');
    if (targetSection) {
        targetSection.classList.add('active');
        document.body.scrollTop = document.documentElement.scrollTop = 0; // Scroll to top

        // Update active link in sidebar
        document.querySelectorAll('.sidebar-link').forEach(link => {
            const linkPage = link.getAttribute('data-page');
            const isActive = linkPage === pageId || (pageId === 'contrato' && linkPage === 'contrato');

            link.classList.toggle('active', isActive);
            link.classList.remove('fisica', 'mental', 'financeira', 'familiar', 'profissional', 'social', 'espiritual', 'preventiva', 'inicio', 'planejamento-diario', 'tarefas-card');

            if (isActive) {
                link.setAttribute('aria-current', 'page');
                 if (['fisica', 'mental', 'financeira', 'familiar', 'profissional', 'social', 'espiritual', 'preventiva', 'inicio', 'planejamento-diario'].includes(pageId)) {
                    link.classList.add(pageId);
                } else if (pageId === 'tarefas') {
                    link.classList.add('tarefas-card');
                }
            } else {
                link.removeAttribute('aria-current');
            }
        });
        
        const pageTitle = targetSection.querySelector('h1')?.textContent || `Página ${pageId}`;
        document.title = `${pageTitle} | Pequenos Passos`;
        
        const initializerKey = pageInitializers[pageId];
        if (initializerKey && typeof window[initializerKey as keyof Window] === 'function') {
            const initFn = window[initializerKey as keyof Window] as () => void;
            initFn();
            currentPageInitFunction = initFn;
        } else {
            currentPageInitFunction = null;
        }

    } else {
        console.warn(`Page section not found in loaded HTML for: ${pageId}`);
        window.location.hash = 'inicio';
    }
}
window.showPage = showPage;

async function router() {
    let pageId = window.location.hash.substring(1);

    // Default to 'inicio' if hash is empty, invalid, or not in our list of pages
    if (!pageId || !pageInitializers.hasOwnProperty(pageId)) {
        pageId = 'inicio';
    }
    await showPage(pageId);
}


// --- SIDEBAR ---
function toggleSidebar(initialize = false) {
    const sidebar = document.getElementById('sidebar-menu');
    const mainContent = document.getElementById('main-content');
    const toggleButton = document.getElementById('sidebar-toggle');

    if (!sidebar || !mainContent || !toggleButton) return;

    const isCollapsed = sidebar.classList.contains('collapsed');

    if (initialize) {
        const storedState = localStorage.getItem('sidebarCollapsed');
        if (storedState === 'true') {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('sidebar-collapsed');
            document.body.classList.add('sidebar-collapsed');
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.innerHTML = '<i class="fas fa-bars"></i>';
        } else if (storedState === 'false') {
            sidebar.classList.remove('collapsed');
            mainContent.classList.remove('sidebar-collapsed');
            document.body.classList.remove('sidebar-collapsed');
            toggleButton.setAttribute('aria-expanded', 'true');
            toggleButton.innerHTML = '<i class="fas fa-times"></i>';
        } else {
            if (window.innerWidth < 768) { 
                sidebar.classList.remove('collapsed');
                mainContent.classList.remove('sidebar-collapsed');
                document.body.classList.remove('sidebar-collapsed');
                toggleButton.setAttribute('aria-expanded', 'true');
                toggleButton.innerHTML = '<i class="fas fa-times"></i>';
                localStorage.setItem('sidebarCollapsed', 'false'); 
            } else {
                 sidebar.classList.add('collapsed');
                 mainContent.classList.add('sidebar-collapsed');
                 document.body.classList.add('sidebar-collapsed');
                 toggleButton.setAttribute('aria-expanded', 'false');
                 toggleButton.innerHTML = '<i class="fas fa-bars"></i>';
                 localStorage.setItem('sidebarCollapsed', 'true'); 
            }
        }
    } else {
        // Regular toggle action
        if (isCollapsed) {
            sidebar.classList.remove('collapsed');
            mainContent.classList.remove('sidebar-collapsed');
            document.body.classList.remove('sidebar-collapsed');
            toggleButton.setAttribute('aria-expanded', 'true');
            toggleButton.innerHTML = '<i class="fas fa-times"></i>';
            localStorage.setItem('sidebarCollapsed', 'false');
        } else {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('sidebar-collapsed');
            document.body.classList.add('sidebar-collapsed');
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.innerHTML = '<i class="fas fa-bars"></i>';
            localStorage.setItem('sidebarCollapsed', 'true');
        }
    }
    if(window.updateRainSoundButtonPosition) window.updateRainSoundButtonPosition();
}
window.toggleSidebar = toggleSidebar;

// --- SAÚDE PREVENTIVA - VACINAÇÃO (GLOBAL FUNCTIONS) ---
const vaccineInfoMap: { [key: string]: any } = {
    tetano: { name: "Tétano e Difteria (dT/dTpa)", info: "Reforço a cada 10 anos. dTpa recomendada para gestantes a cada gestação e para pessoas que convivem com bebês.", intervalYears: 10, doseInfo: "Reforço a cada 10 anos. dTpa para gestantes e contactantes de bebês." },
    'hepatite-b': { name: "Hepatite B", info: "Esquema de 3 doses (0, 1, 6 meses) se não vacinado ou esquema incompleto. Verificar necessidade com exames (Anti-HBs).", requiresScheme: true, doseInfo: "3 doses (0, 1, 6 meses). Checar Anti-HBs." },
    influenza: { name: "Influenza (Gripe)", info: "Dose anual, especialmente para grupos de risco (idosos, gestantes, portadores de doenças crônicas).", isAnnual: true, doseInfo: "Anual." },
    'triplice-viral': { name: "Tríplice Viral (Sarampo, Caxumba, Rubéola - SCR)", info: "Duas doses ao longo da vida (geralmente na infância). Adultos não vacinados ou com esquema incompleto devem verificar com profissional.", ageDependent: true, requiresScheme: true, doseInfo: "2 doses na vida (verificar histórico)." },
    'febre-amarela': { name: "Febre Amarela", info: "Dose única para residentes ou viajantes para áreas de risco. Verificar recomendação para sua região.", ageDependent: true, doseInfo: "Dose única para áreas de risco." },
    hpv: { name: "HPV", info: "Recomendada para meninas e meninos (9-14 anos) e grupos específicos de adultos. Esquema de 2 ou 3 doses dependendo da idade e condição.", ageDependent: true, requiresScheme: true, intervalMonths: 6, doseInfo: "2-3 doses (verificar idade/condição)." },
    pneumococica: { name: "Pneumocócica", info: "Recomendada para idosos (60+) e grupos de risco (doenças crônicas). Esquemas variam (VPC13, VPP23).", ageDependent: true, requiresScheme: true, doseInfo: "Para 60+ e grupos de risco." },
    meningococica: { name: "Meningocócica (ACWY/B)", info: "Recomendada para adolescentes e adultos jovens, ou em situações de surto. Verificar necessidade específica.", ageDependent: true, requiresScheme: true, doseInfo: "Para adolescentes/jovens e surtos." },
    varicela: { name: "Varicela (Catapora)", info: "Duas doses para quem não teve a doença. Geralmente aplicada na infância.", ageDependent: true, requiresScheme: true, doseInfo: "2 doses se não teve a doença." },
    'hepatite-a': { name: "Hepatite A", info: "Esquema de 2 doses (intervalo de 6 meses) para grupos de risco ou viajantes.", ageDependent: true, requiresScheme: true, intervalMonths: 6, doseInfo: "2 doses (intervalo 6 meses) para risco/viajantes." },
    'herpes-zoster': { name: "Herpes Zóster", info: "Recomendada para pessoas com 50 anos ou mais. Esquema de 1 ou 2 doses dependendo da vacina.", ageDependent: true, requiresScheme: true, doseInfo: "Para 50+ (1 ou 2 doses)." },
    'covid-19': { name: "COVID-19", info: "Seguir recomendações atualizadas do Ministério da Saúde para doses de reforço conforme faixa etária e condição.", isAnnual: true, requiresScheme: true, doseInfo: "Conforme calendário oficial (reforços)." },
    dengue: { name: "Dengue", info: "Recomendada para faixas etárias específicas em áreas endêmicas, conforme definição do Ministério da Saúde. Esquema de 2 doses com intervalo de 3 meses.", ageDependent: true, requiresScheme: true, intervalMonths: 3, doseInfo: "Para áreas endêmicas (2 doses, intervalo 3 meses)." }
};

let vaccineData: { [key: string]: string } = {}; // Stores vaccineId: lastDoseDate

window.loadVaccineData = () => {
    const storedData = localStorage.getItem('vaccineData');
    if (storedData) {
        vaccineData = JSON.parse(storedData);
    } else {
        vaccineData = {};
    }
};

window.saveVaccineData = () => {
    localStorage.setItem('vaccineData', JSON.stringify(vaccineData));
};

window.calculateNextDose = (lastDose, intervalYears, intervalMonths, isAnnual) => {
    if (!lastDose) return "-";
    const lastDoseDate = new Date(lastDose + "T00:00:00"); 

    if (isNaN(lastDoseDate.getTime())) return "Data inválida";

    let nextDoseDate = new Date(lastDoseDate);

    if (isAnnual) {
        nextDoseDate.setFullYear(nextDoseDate.getFullYear() + 1);
    } else if (intervalYears) {
        nextDoseDate.setFullYear(nextDoseDate.getFullYear() + intervalYears);
    } else if (intervalMonths) {
        nextDoseDate.setMonth(nextDoseDate.getMonth() + intervalMonths);
    } else {
        return "Intervalo não definido";
    }
    return nextDoseDate.toLocaleDateString('pt-BR');
};

window.updateVaccineStatus = (rowOrId) => {
    let row: HTMLElement | null = null;
    let vaccineId = '';

    if (typeof rowOrId === 'string') {
        vaccineId = rowOrId;
        const table = document.getElementById('tabela-vacinas');
        if (table) {
            row = table.querySelector(`tr[data-vaccine-id="${vaccineId}"]`);
        }
    } else {
        row = rowOrId;
        vaccineId = row.dataset.vaccineId || '';
    }

    if (!row || !vaccineId) return;

    const vaccine = vaccineInfoMap[vaccineId];
    if (!vaccine) return;

    const lastDoseInput = row.querySelector('.vaccine-last-dose') as HTMLInputElement;
    const nextDoseCell = row.querySelector('.vaccine-next-dose') as HTMLTableCellElement;
    const statusCell = row.querySelector('.vaccine-status') as HTMLTableCellElement;
    
    if (!lastDoseInput || !nextDoseCell || !statusCell) { // Add guard for queried elements
        return;
    }

    const lastDoseDateStr = lastDoseInput.value;
    vaccineData[vaccineId] = lastDoseDateStr;
    window.saveVaccineData();

    statusCell.textContent = 'Pendente';
    statusCell.className = 'vaccine-status status-pending';
    nextDoseCell.textContent = '-';

    if (lastDoseDateStr) {
        const lastDoseDate = new Date(lastDoseDateStr + "T00:00:00"); 
        if (isNaN(lastDoseDate.getTime())) {
            nextDoseCell.textContent = "Data inválida";
            return;
        }

        if (vaccine.requiresScheme && !vaccine.isAnnual && !vaccine.intervalYears && !vaccine.intervalMonths) {
            nextDoseCell.textContent = vaccine.doseInfo || "Consultar esquema";
            statusCell.textContent = 'Esquema em Andamento'; 
            statusCell.className = 'vaccine-status status-partial';

        } else { 
            const nextDoseStr = window.calculateNextDose(lastDoseDateStr, vaccine.intervalYears, vaccine.intervalMonths, vaccine.isAnnual);
            nextDoseCell.textContent = nextDoseStr;
            if (nextDoseStr !== "-" && nextDoseStr !== "Data inválida" && nextDoseStr !== "Intervalo não definido") {
                const parts = nextDoseStr.split('/');
                const nextDoseObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                nextDoseObj.setHours(0,0,0,0);

                const today = new Date();
                today.setHours(0,0,0,0);

                if (nextDoseObj < today) {
                    statusCell.textContent = 'Atrasada';
                    statusCell.className = 'vaccine-status status-overdue';
                } else {
                    statusCell.textContent = 'Em Dia';
                    statusCell.className = 'vaccine-status status-ok';
                }
            }
        }
    } else { 
        if (vaccine.requiresScheme) {
            nextDoseCell.textContent = vaccine.doseInfo || "Consultar esquema";
            statusCell.textContent = 'Verificar';
            statusCell.className = 'vaccine-status status-check';
        } else {
            nextDoseCell.textContent = "-"; 
            statusCell.textContent = 'Pendente';
            statusCell.className = 'vaccine-status status-pending';
        }
    }
};

// --- SAÚDE PREVENTIVA - INDICATORS & DIAGNOSTICS (GLOBAL) ---
const indicatorConfigsPreventiva: IndicatorConfig[] = [
    { 
        id: 'glicemia', name: 'Glicemia em Jejum', unit: 'mg/dL', 
        barMin: 50, barMax: 150, optimalMin: 70, optimalMax: 99, 
        zones: [
            {min: 0, max: 69, label: "Baixa", colorClass: "status-warning"}, 
            {min: 70,max: 99, label: "Normal", colorClass: "status-ok"}, 
            {min:100, max:125, label: "Pré-Diabetes", colorClass: "status-warning"}, 
            {min:126, max:Infinity, label: "Diabetes", colorClass: "status-overdue"}
        ] 
    },
    { 
        id: 'hdl', name: 'HDL Colesterol', unit: 'mg/dL', 
        barMin: 20, barMax: 100, optimalMin: 60, optimalMax: Infinity, reversedGradient: true, 
        zones: [
            {min:0, max:39, label: "Baixo", colorClass: "status-overdue"}, 
            {min:40, max:59, label: "Limítrofe", colorClass: "status-warning"},
            {min:60, max:Infinity, label: "Ótimo", colorClass: "status-ok"}
        ] 
    },
    { 
        id: 'ldl', name: 'LDL Colesterol', unit: 'mg/dL', 
        barMin: 50, barMax: 200, optimalMin: 0, optimalMax: 99, 
        zones: [
            {min:0, max:99, label: "Ótimo", colorClass: "status-ok"}, 
            {min:100, max:129, label: "Desejável", colorClass: "status-ok"}, 
            {min:130, max:159, label: "Limítrofe", colorClass: "status-warning"}, 
            {min:160, max:189, label: "Alto", colorClass: "status-overdue"}, 
            {min:190, max:Infinity, label: "Muito Alto", colorClass: "status-overdue"}
        ] 
    },
    {
        id: 'colesterol', name: 'Colesterol Total', unit: 'mg/dL',
        barMin: 100, barMax: 300, optimalMin: 0, optimalMax: 199,
        zones: [
            {min:0, max:199, label: "Desejável", colorClass: "status-ok"},
            {min:200, max:239, label: "Limítrofe", colorClass: "status-warning"},
            {min:240, max:Infinity, label: "Alto", colorClass: "status-overdue"}
        ]
    },
    {
        id: 'triglicerideos', name: 'Triglicerídeos', unit: 'mg/dL',
        barMin: 50, barMax: 500, optimalMin: 0, optimalMax: 149,
        zones: [
            {min:0, max:149, label: "Normal", colorClass: "status-ok"},
            {min:150, max:199, label: "Limítrofe", colorClass: "status-warning"},
            {min:200, max:499, label: "Alto", colorClass: "status-overdue"},
            {min:500, max:Infinity, label: "Muito Alto", colorClass: "status-overdue"}
        ]
    },
    {
        id: 'vitd', name: 'Vitamina D (25-OH)', unit: 'ng/mL',
        barMin: 10, barMax: 100, optimalMin: 30, optimalMax: 60, reversedGradient: true,
        zones: [
            {min:0, max:19, label: "Deficiência", colorClass: "status-overdue"},
            {min:20, max:29, label: "Insuficiência", colorClass: "status-warning"},
            {min:30, max:100, label: "Suficiente", colorClass: "status-ok"} 
        ]
    },
    {
        id: 'tsh', name: 'TSH (Hormônio Tireoestimulante)', unit: 'µUI/mL', 
        barMin: 0.1, barMax: 10, optimalMin: 0.4, optimalMax: 4.0, 
        zones: [ 
            {min:0, max:0.39, label: "Baixo (Sugestivo de Hipertireoidismo)", colorClass: "status-warning"},
            {min:0.4, max:4.0, label: "Normal", colorClass: "status-ok"}, 
            {min:4.01, max:10, label: "Elevado (Sugestivo de Hipotireoidismo Subclínico)", colorClass: "status-warning"},
            {min:10.01, max:Infinity, label: "Muito Elevado (Sugestivo de Hipotireoidismo)", colorClass: "status-overdue"}
        ]
    },
    {
        id: 'creatinina', name: 'Creatinina', unit: 'mg/dL',
        barMin: 0.4, barMax: 1.5, 
        optimalMin: 0.6, optimalMax: 1.2, 
        zones: [
             {min:0, max:0.59, label: "Baixo (Verificar contexto)", colorClass: "status-warning"},
             {min:0.6, max:1.3, label: "Normal (Geral)", colorClass: "status-ok"}, 
             {min:1.31, max:Infinity, label: "Alto (Avaliar Função Renal)", colorClass: "status-overdue"}
        ]
    },
    {
        id: 'acidourico', name: 'Ácido Úrico', unit: 'mg/dL',
        barMin: 2, barMax: 10, 
        optimalMin: 2.5, optimalMax: 6.0, 
        zones: [ 
            {min:0, max:2.4, label: "Baixo", colorClass: "status-check"},
            {min:2.5, max:6.0, label: "Normal (Mulher)", colorClass: "status-ok"},
            {min:2.5, max:7.0, label: "Normal (Homem)", colorClass: "status-ok"},
            {min:6.1, max:Infinity, label: "Alto (Mulher - Avaliar Gota)", colorClass: "status-overdue"},
            {min:7.1, max:Infinity, label: "Alto (Homem - Avaliar Gota)", colorClass: "status-overdue"}
        ]
    },
    {
        id: 'pcr', name: 'PCR Ultrassensível', unit: 'mg/L',
        barMin: 0, barMax: 10, optimalMin: 0, optimalMax: 0.9,
        zones: [
            {min:0, max:0.9, label: "Baixo Risco Cardiovascular", colorClass: "status-ok"},
            {min:1.0, max:2.9, label: "Risco Cardiovascular Médio", colorClass: "status-warning"},
            {min:3.0, max:Infinity, label: "Alto Risco Cardiovascular / Inflamação", colorClass: "status-overdue"}
        ]
    },
    {
        id: 'ferritina', name: 'Ferritina', unit: 'ng/mL',
        barMin: 10, barMax: 400, 
        optimalMin: 50, optimalMax: 150, reversedGradient: true, 
        zones: [ 
            {min:0, max:29, label: "Baixo (Sugestivo de Deficiência de Ferro)", colorClass: "status-overdue"},
            {min:30, max:200, label: "Normal (Mulher)", colorClass: "status-ok"}, 
            {min:30, max:300, label: "Normal (Homem)", colorClass: "status-ok"}, 
            {min:201, max:Infinity, label: "Elevado (Mulher - Avaliar Causa)", colorClass: "status-warning"},
            {min:301, max:Infinity, label: "Elevado (Homem - Avaliar Causa)", colorClass: "status-warning"}
        ]
    },
    {
        id: 'b12', name: 'Vitamina B12', unit: 'pg/mL',
        barMin: 100, barMax: 1000, optimalMin: 400, optimalMax: 900, reversedGradient: true,
        zones: [
            {min:0, max:199, label: "Deficiência", colorClass: "status-overdue"},
            {min:200, max:399, label: "Limítrofe/Subótimo", colorClass: "status-warning"},
            {min:400, max:900, label: "Normal/Ótimo", colorClass: "status-ok"}, 
            {min:901, max:Infinity, label: "Elevado (Raro, verificar suplementação)", colorClass: "status-check"}
        ]
    },
    {
        id: 'gordura_bio', name: 'Gordura Corporal (Bioimpedância)', unit: '%',
        barMin: 5, barMax: 50, 
        optimalMin: 10, optimalMax: 20, 
        zones: [ 
            {min:0, max:14, label: "Muito Baixo/Atleta (M)", colorClass: "status-ok"},
            {min:15, max:20, label: "Bom (M)", colorClass: "status-ok"},
            {min:21, max:25, label: "Aceitável (M)", colorClass: "status-warning"},
            {min:26, max:Infinity, label: "Obeso (M)", colorClass: "status-overdue"},
            {min:0, max:21, label: "Muito Baixo/Atleta (F)", colorClass: "status-ok"},
            {min:22, max:25, label: "Bom (F)", colorClass: "status-ok"},
            {min:26, max:31, label: "Aceitável (F)", colorClass: "status-warning"},
            {min:32, max:Infinity, label: "Obesa (F)", colorClass: "status-overdue"}
        ]
    },
    {
        id: 'massamagra_bio', name: 'Massa Magra (Bioimpedância)', unit: 'kg',
        barMin: 30, barMax: 90, optimalMin: 50, optimalMax: 80, reversedGradient: true,
        zones: [
            {min:0, max:40, label: "Baixa", colorClass: "status-warning"},
            {min:41, max:80, label: "Adequada", colorClass: "status-ok"},
            {min:81, max:Infinity, label: "Alta", colorClass: "status-ok"}
        ]
    }
];

const diagnosticConfigs: DiagnosticConfig[] = [
    { 
        id: 'exame-prostata', 
        name: 'Exame de Próstata (PSA/Toque)', 
        hasSeverity: false 
    },
    { 
        id: 'mamografia', 
        name: 'Mamografia', 
        hasType: true,
        hasSeverity: true 
    },
    { 
        id: 'papanicolau', 
        name: 'Papanicolau (Preventivo)',
        hasSeverity: true
    },
    {
        id: 'colonoscopia',
        name: 'Colonoscopia',
        hasType: true,
        hasSeverity: true
    },
    {
        id: 'dermatologico',
        name: 'Exame Dermatológico (Pele)',
        hasSeverity: true
    },
    {
        id: 'oftalmologico',
        name: 'Exame Oftalmológico (Visão)',
        hasType: true,
        hasSeverity: false
    },
    {
        id: 'odontologico',
        name: 'Check-up Odontológico',
        hasType: true,
        hasSeverity: true
    },
    {
        id: 'densitometria',
        name: 'Densitometria Óssea',
        hasSeverity: true
    },
    {
        id: 'audiometria',
        name: 'Audiometria',
        hasSeverity: true
    }
];

let indicatorData: { [key: string]: { value: number; date: string } } = {};
let diagnosticData: { [key: string]: { date: string; type?: string; severity?: string; notes?: string; medication?: string; } } = {};
let indicatorHistory: { timestamp: number, indicatorId: string, value: number, date: string, status: string }[] = [];

window.getIndicatorById = (id: string) => indicatorConfigsPreventiva.find(c => c.id === id);
window.getDiagnosticById = (id: string) => diagnosticConfigs.find(c => c.id === id);

window.saveIndicatorData = (indicatorId, value, date) => {
    indicatorData[indicatorId] = { value, date };
    window.saveAllIndicatorData();
};
window.loadIndicatorData = (indicatorId) => {
    return indicatorData[indicatorId] || null;
};

window.saveAllIndicatorData = () => {
    localStorage.setItem('indicatorData', JSON.stringify(indicatorData));
    localStorage.setItem('indicatorHistory', JSON.stringify(indicatorHistory));
};

window.loadAllIndicatorData = () => {
    const storedData = localStorage.getItem('indicatorData');
    if (storedData) indicatorData = JSON.parse(storedData);
    const storedHistory = localStorage.getItem('indicatorHistory');
    if (storedHistory) indicatorHistory = JSON.parse(storedHistory);
};

window.saveDiagnosticData = () => {
    localStorage.setItem('diagnosticData', JSON.stringify(diagnosticData));
};

window.loadDiagnosticData = () => {
    const storedData = localStorage.getItem('diagnosticData');
    if (storedData) {
        diagnosticData = JSON.parse(storedData);
    }
};

window.logIndicatorEntry = (indicatorId, value, date, status) => {
    const newEntry = {
        timestamp: new Date().getTime(),
        indicatorId,
        value,
        date,
        status
    };
    indicatorHistory.unshift(newEntry);
    if (indicatorHistory.length > 50) { 
        indicatorHistory.pop();
    }
    window.updateIndicatorHistoryTable();
    window.saveAllIndicatorData();
};

window.updateIndicatorUI = (config, value, date) => {
    const card = document.getElementById(`indicator-card-${config.id}`) || document.querySelector(`[data-indicator-id="${config.id}"]`);
    if (!card) return;

    const valueInput = card.querySelector('.indicator-value') as HTMLInputElement;
    const dateInput = card.querySelector('.indicator-date') as HTMLInputElement;
    const marker = card.querySelector('.marker') as HTMLElement;
    const interpretationEl = card.querySelector('.interpretation') as HTMLElement;
    const suggestionEl = card.querySelector('.suggestion') as HTMLElement;
    const overdueWarningEl = card.querySelector('.overdue-warning') as HTMLElement;
    const bar = card.querySelector('.indicator-bar') as HTMLElement;
    
    if (!valueInput || !dateInput || !marker || !interpretationEl || !suggestionEl || !overdueWarningEl || !bar) {
        console.error(`One or more UI elements not found for indicator: ${config.id}`);
        return;
    }


    if (value !== null && value !== undefined && date) {
        valueInput.value = value.toString();
        dateInput.value = date;

        const zone = config.zones.find(z => value >= z.min && value <= z.max);
        let statusText = 'Indefinido';
        let statusClass = 'status-check';
        if (zone) {
            statusText = zone.label;
            statusClass = zone.colorClass;
        }
        
        interpretationEl.textContent = `Status: ${statusText}`;
        interpretationEl.className = `interpretation ${statusClass}`;
        
        if(statusClass === 'status-ok') {
            suggestionEl.textContent = "Excelente! Mantenha os bons hábitos.";
        } else if (statusClass === 'status-warning' || statusClass === 'status-overdue') {
            suggestionEl.textContent = "Recomenda-se acompanhamento médico para avaliação.";
        } else {
            suggestionEl.textContent = "Consulte um profissional de saúde para interpretar este resultado.";
        }

        const percentage = Math.max(0, Math.min(100, ((value - config.barMin) / (config.barMax - config.barMin)) * 100));
        marker.style.left = `${percentage}%`;
        bar.style.opacity = '1';

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (new Date(date) < oneYearAgo) {
            overdueWarningEl.style.display = 'flex';
        } else {
            overdueWarningEl.style.display = 'none';
        }

    } else {
        valueInput.value = '';
        dateInput.value = '';
        interpretationEl.textContent = '';
        interpretationEl.className = 'interpretation';
        suggestionEl.textContent = 'Preencha os dados para ver a análise.';
        marker.style.left = '0%';
        bar.style.opacity = '0.5';
        overdueWarningEl.style.display = 'none';
    }
};

window.updateIndicatorHistoryTable = () => {
    const historyTableBody = document.getElementById('historicoIndicadoresBody');
    if (!historyTableBody) return;

    historyTableBody.innerHTML = '';
    const last50 = indicatorHistory.slice(0, 50);

    if (last50.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum registro de indicador encontrado.</td></tr>';
        return;
    }
    
    last50.forEach(entry => {
        const indicator = window.getIndicatorById(entry.indicatorId);
        let statusClass = 'status-check';
        if (indicator) {
            const zone = indicator.zones.find(z => z.label === entry.status);
            if (zone) {
                statusClass = zone.colorClass;
            }
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${indicator?.name || 'Desconhecido'}</td>
            <td>${new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td>${entry.value.toLocaleString('pt-BR')} ${indicator?.unit || ''}</td>
            <td><span class="vaccine-status ${statusClass}">${entry.status}</span></td>
        `;
        historyTableBody.appendChild(row);
    });
}


// --- THEME ---
function updateThemeToggleButtonIcon(isDark: boolean) {
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
}
window.updateThemeToggleButtonIcon = updateThemeToggleButtonIcon;

function loadTheme() {
    const theme = localStorage.getItem('theme');
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark-mode', isDark);
    updateThemeToggleButtonIcon(isDark);
}
window.loadTheme = loadTheme;


// --- UI/UX Enhancements ---
function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const container = document.getElementById('toast-notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';
    if (type === 'error') iconClass = 'fas fa-times-circle';

    toast.innerHTML = `<i class="${iconClass}"></i> ${DOMPurify.sanitize(message)}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 500);
    }, 4000);
}
window.showToast = showToast;


// --- RAIN SOUND (Web Audio API for seamless loop) ---
let rainAudioContext: AudioContext | null = null;
let rainAudioBuffer: AudioBuffer | null = null;
let rainSourceNode: AudioBufferSourceNode | null = null;
let isRainPlaying = false;

async function toggleRainSound() {
    const button = document.getElementById('rain-sound-toggle');
    if (!button) return;

    // Initialize AudioContext on first user interaction
    if (!rainAudioContext) {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            rainAudioContext = new AudioContext();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser.", e);
            window.showToast("API de áudio não suportada.", "error");
            return;
        }
    }

    // If it's playing, stop it
    if (isRainPlaying) {
        if (rainSourceNode) {
            rainSourceNode.stop();
            rainSourceNode = null;
        }
        isRainPlaying = false;
        button.innerHTML = '<i class="fas fa-cloud-rain"></i>';
        button.setAttribute('aria-label', 'Ativar som de chuva');
        localStorage.setItem('rainSoundPlaying', 'false');
        return;
    }

    // If it's not playing, start it
    try {
        // Fetch and decode audio only if we haven't already
        if (!rainAudioBuffer) {
            window.showToast("Carregando som...", "info");
            const audioEl = document.getElementById('rain-sound') as HTMLAudioElement;
            if (!audioEl || !audioEl.src) {
                console.error("Audio element or source not found.");
                window.showToast("Fonte de áudio não encontrada.", "error");
                return;
            }
            const response = await fetch(audioEl.src);
            const arrayBuffer = await response.arrayBuffer();
            rainAudioBuffer = await rainAudioContext.decodeAudioData(arrayBuffer);
        }

        // Create a new source node (must be done each time you play)
        rainSourceNode = rainAudioContext.createBufferSource();
        rainSourceNode.buffer = rainAudioBuffer;
        rainSourceNode.loop = true; // Set seamless loop
        rainSourceNode.connect(rainAudioContext.destination);
        rainSourceNode.start(0);

        isRainPlaying = true;
        button.innerHTML = '<i class="fas fa-stop-circle"></i>';
        button.setAttribute('aria-label', 'Desativar som de chuva');
        localStorage.setItem('rainSoundPlaying', 'true');

    } catch (error) {
        console.error("Error playing rain sound with Web Audio API:", error);
        window.showToast("Erro ao tocar o som.", "error");
        isRainPlaying = false; // Reset state on error
    }
}
window.toggleRainSound = toggleRainSound;


function updateRainSoundButtonPosition() {
    const button = document.getElementById('rain-sound-toggle');
    const sidebar = document.getElementById('sidebar-menu');
    if (button && sidebar) {
        if (sidebar.classList.contains('collapsed')) {
            button.style.left = '80px';
        } else {
            button.style.left = '260px';
        }
    }
}
window.updateRainSoundButtonPosition = updateRainSoundButtonPosition;

// --- CONTRATO DE COMPROMISSO MODAL ---
function openContractModal() {
    const modal = document.getElementById('contract-modal');
    if (modal) {
        if (window.populateContractModal) window.populateContractModal();
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);
        modal.setAttribute('aria-hidden', 'false');
    }
}
window.openContractModal = openContractModal;

function closeContractModal() {
    const modal = document.getElementById('contract-modal');
    if (modal) {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            if(modal) modal.style.display = 'none';
        }, 300);
    }
}
window.closeContractModal = closeContractModal;

function saveContractData() {
    const form = document.getElementById('contract-form');
    if (!form || !(form as HTMLFormElement).checkValidity()) {
        window.showToast('Por favor, preencha todos os campos obrigatórios do contrato.', 'warning');
        (form as HTMLFormElement).reportValidity();
        return;
    }
    const data = {
        name: (document.getElementById('contract-name') as HTMLInputElement).value,
        cpf: (document.getElementById('contract-cpf') as HTMLInputElement).value,
        birthdate: (document.getElementById('contract-birthdate') as HTMLInputElement).value,
        address: (document.getElementById('contract-address') as HTMLInputElement).value,
        commitment: (document.getElementById('contract-commitment') as HTMLTextAreaElement).value,
        period: (document.getElementById('contract-period') as HTMLInputElement).value,
        goals: (document.getElementById('contract-goals') as HTMLTextAreaElement).value,
        signature: (document.getElementById('contract-signature') as HTMLInputElement).value,
        date: (document.getElementById('contract-date') as HTMLInputElement).value,
    };
    window.saveItems('contractData', data);
    window.showToast('Contrato salvo com sucesso!', 'success');
    closeContractModal();
}
window.saveContractData = saveContractData;

function loadContractData() {
    return window.loadItems('contractData');
}
window.loadContractData = loadContractData;

function populateContractModal() {
    const data = window.loadContractData();
    const nameInput = document.getElementById('contract-name') as HTMLInputElement;
    const cpfInput = document.getElementById('contract-cpf') as HTMLInputElement;
    const birthdateInput = document.getElementById('contract-birthdate') as HTMLInputElement;
    const addressInput = document.getElementById('contract-address') as HTMLInputElement;
    const commitmentInput = document.getElementById('contract-commitment') as HTMLTextAreaElement;
    const periodInput = document.getElementById('contract-period') as HTMLInputElement;
    const goalsInput = document.getElementById('contract-goals') as HTMLTextAreaElement;
    const signatureInput = document.getElementById('contract-signature') as HTMLInputElement;
    const dateInput = document.getElementById('contract-date') as HTMLInputElement;

    if (data) {
        if (nameInput) nameInput.value = data.name || '';
        if (cpfInput) cpfInput.value = data.cpf || '';
        if (birthdateInput) birthdateInput.value = data.birthdate || '';
        if (addressInput) addressInput.value = data.address || '';
        if (commitmentInput) commitmentInput.value = data.commitment || '';
        if (periodInput) periodInput.value = data.period || '';
        if (goalsInput) goalsInput.value = data.goals || '';
        if (signatureInput) signatureInput.value = data.signature || '';
        if (dateInput) dateInput.value = data.date || new Date().toISOString().split('T')[0];
    } else {
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }
}
window.populateContractModal = populateContractModal;

function printContract() {
    window.print();
}
window.printContract = printContract;

// --- INDICATOR CHART MODAL ---
let indicatorChartInstance: any = null;

function openIndicatorChartModal(indicatorId: string) {
    const modal = document.getElementById('indicator-chart-modal');
    const modalTitle = document.getElementById('indicator-chart-modal-title');
    const chartCanvas = document.getElementById('indicator-chart-canvas') as HTMLCanvasElement;
    const noDataMessage = document.getElementById('indicator-chart-no-data');

    if (!modal || !modalTitle || !chartCanvas || !noDataMessage) return;

    const config = window.getIndicatorById(indicatorId);
    if (!config) return;

    modalTitle.textContent = `Histórico de ${config.name}`;

    const historyData = indicatorHistory
        .filter(entry => entry.indicatorId === indicatorId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (indicatorChartInstance) {
        indicatorChartInstance.destroy();
    }

    if (historyData.length < 2) {
        chartCanvas.style.display = 'none';
        noDataMessage.style.display = 'block';
        noDataMessage.textContent = 'Dados insuficientes para gerar um gráfico. São necessários pelo menos 2 registros.';
    } else {
        chartCanvas.style.display = 'block';
        noDataMessage.style.display = 'none';
        
        const chartLabels = historyData.map(d => new Date(d.date + "T00:00:00").toLocaleDateString('pt-BR'));
        const chartValues = historyData.map(d => d.value);

        const Chart = (window as any).Chart;
        const ctx = chartCanvas.getContext('2d');
        if (!ctx) return;
        
        indicatorChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: `${config.name} (${config.unit})`,
                    data: chartValues,
                    borderColor: 'var(--color-preventiva)',
                    backgroundColor: 'rgba(var(--color-preventiva-rgb), 0.1)',
                    fill: true,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: false, title: { display: true, text: `Valor (${config.unit})` } },
                    x: { title: { display: true, text: 'Data' } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10);
}
window.openIndicatorChartModal = openIndicatorChartModal;

function closeIndicatorChartModal() {
    const modal = document.getElementById('indicator-chart-modal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => { if(modal) modal.style.display = 'none'; }, 300);
    }
}
window.closeIndicatorChartModal = closeIndicatorChartModal;

// --- GENERIC LIST MANAGEMENT ---
function setupListManagement(config: ListManagementConfig) {
    const list = document.getElementById(config.listId) as HTMLUListElement;
    const form = document.getElementById(config.formId) as HTMLFormElement;

    if (!list || !form) {
        console.error(`List or form not found for ${config.sectionKey}.`);
        return;
    }

    let items: GenericItem[] = loadItems(config.storageKey) || [];

    const renderItems = () => {
        list.innerHTML = '';
        if (items.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.textContent = 'Nenhum item adicionado ainda.';
            emptyLi.className = 'empty-list-item';
            list.appendChild(emptyLi);
            return;
        }

        items.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'lista-planejamento-item';
            li.dataset.index = index.toString();

            const textSpan = document.createElement('span');
            textSpan.className = 'item-text';

            if ('text' in item) { // GoalItem
                textSpan.textContent = item.text;
            } else { // ActivityPracticeItem
                textSpan.textContent = `${item.name}${item.duration ? ` (${item.duration})` : ''}`;
            }

            if (item.completed) {
                li.classList.add('completed');
            }
            li.appendChild(textSpan);

            const buttonsWrapper = document.createElement('div');
            buttonsWrapper.className = 'item-actions';

            const completeButton = document.createElement('button');
            completeButton.innerHTML = `<i class="fas ${item.completed ? 'fa-undo' : 'fa-check'}"></i>`;
            completeButton.className = `complete-btn ${item.completed ? 'completed' : ''}`;
            completeButton.setAttribute('aria-label', item.completed ? 'Desmarcar' : 'Marcar como concluído');
            completeButton.onclick = () => {
                items[index].completed = !items[index].completed;
                saveItems(config.storageKey, items);
                renderItems();
            };
            buttonsWrapper.appendChild(completeButton);

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.className = 'delete-btn';
            deleteButton.setAttribute('aria-label', 'Remover item');
            deleteButton.onclick = () => {
                items.splice(index, 1);
                saveItems(config.storageKey, items);
                renderItems();
            };
            buttonsWrapper.appendChild(deleteButton);
            li.appendChild(buttonsWrapper);
            list.appendChild(li);
        });
    };

    form.onsubmit = (e) => {
        e.preventDefault();
        let newItem: GenericItem;
        if (config.itemType === 'goal' && config.textInputId) {
            const textInput = document.getElementById(config.textInputId) as HTMLInputElement;
            if (textInput) {
                const text = textInput.value.trim();
                if (text) {
                    newItem = { text, completed: false };
                    items.push(newItem);
                    textInput.value = '';
                }
            }
        } else if (config.itemType === 'activity' && config.nameInputId) {
            const nameInput = document.getElementById(config.nameInputId) as HTMLInputElement;
            const durationInput = config.durationInputId ? document.getElementById(config.durationInputId) as HTMLInputElement : null;
            if (nameInput) {
                const name = nameInput.value.trim();
                const duration = durationInput ? durationInput.value.trim() : '';
                if (name) {
                    newItem = { name, duration, completed: false };
                    items.push(newItem);
                    nameInput.value = '';
                    if (durationInput) durationInput.value = '';
                }
            }
        }

        saveItems(config.storageKey, items);
        renderItems();
    };

    renderItems();
}
window.setupListManagement = setupListManagement;

// --- AI-POWERED FUNCTIONS ---

async function getAISuggestionForInput(prompt: string, targetInput: HTMLInputElement | HTMLTextAreaElement, button: HTMLButtonElement): Promise<void> {
    if (!window.ai) {
        window.showToast("Funcionalidade de IA não está disponível. Verifique a chave da API.", "error");
        return;
    }

    button.classList.add('loading');
    button.disabled = true;
    targetInput.disabled = true;

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await window.ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });

            const suggestion = response.text.trim();
            targetInput.value = suggestion;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));

            if (targetInput.tagName === 'TEXTAREA' && (targetInput.style.height || targetInput.scrollHeight > targetInput.clientHeight)) {
                targetInput.style.height = 'auto';
                targetInput.style.height = `${targetInput.scrollHeight}px`;
            }

            // Success, break the loop
            break;

        } catch (error: any) {
            attempt++;
            console.error(`Attempt ${attempt} failed for AI suggestion:`, error);

            // Do not retry for specific client-side errors like invalid API key
            const errorMessage = error.message || '';
            if (errorMessage.includes('API key not valid') || errorMessage.includes('403') || errorMessage.includes('400')) {
                window.showToast("Chave de API inválida ou requisição incorreta.", "error");
                break; // Stop retrying for these errors
            }

            if (attempt >= maxRetries) {
                window.showToast("Ocorreu um erro ao buscar a sugestão após várias tentativas.", "error");
            } else {
                const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
                window.showToast(`Falha na comunicação com a IA. Tentando novamente em ${delay / 1000}s...`, "warning");
                await new Promise(res => setTimeout(res, delay));
            }
        }
    }

    button.classList.remove('loading');
    button.disabled = false;
    targetInput.disabled = false;
    targetInput.focus();
}
window.getAISuggestionForInput = getAISuggestionForInput;


async function generateAndDisplayWebResources(button: HTMLElement, loadingEl: HTMLElement, outputEl: HTMLElement, prompt: string) {
    if (!window.ai) {
        window.showToast("Funcionalidade de IA não está disponível. Verifique a chave da API.", "error");
        return;
    }

    button.setAttribute('disabled', 'true');
    loadingEl.style.display = 'block';
    outputEl.innerHTML = '';

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await window.ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            let contentHtml = '<div class="ai-resources-container">';
            const sanitizedText = DOMPurify.sanitize(response.text.replace(/\n/g, '<br>'));
            contentHtml += `<p>${sanitizedText}</p>`;

            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks && groundingChunks.length > 0) {
                const uniqueSources = new Map<string, string>();
                groundingChunks.forEach((chunk: any) => {
                    if (chunk.web && chunk.web.uri) {
                        uniqueSources.set(chunk.web.uri, chunk.web.title || chunk.web.uri);
                    }
                });

                if (uniqueSources.size > 0) {
                    contentHtml += '<div class="ai-sources-list"><h5>Fontes:</h5><ul>';
                    uniqueSources.forEach((title, uri) => {
                        const sanitizedTitle = DOMPurify.sanitize(title);
                        contentHtml += `<li><a href="${uri}" target="_blank" rel="noopener noreferrer">${sanitizedTitle}</a></li>`;
                    });
                    contentHtml += '</ul></div>';
                }
            }

            contentHtml += '</div>';
            outputEl.innerHTML = contentHtml;
            break; // Success, break loop

        } catch (error: any) {
            attempt++;
            console.error(`Attempt ${attempt} failed for AI web resources:`, error);

            const errorMessage = error.message || '';
            if (errorMessage.includes('API key not valid') || errorMessage.includes('403') || errorMessage.includes('400')) {
                window.showToast("Chave de API inválida ou requisição incorreta.", "error");
                outputEl.innerHTML = '<div class="ai-resources-container"><p style="color: var(--color-error);">Falha ao carregar sugestões.</p></div>';
                break; // Stop retrying
            }

            if (attempt >= maxRetries) {
                window.showToast("Ocorreu um erro ao buscar recursos após várias tentativas.", "error");
                outputEl.innerHTML = '<div class="ai-resources-container"><p style="color: var(--color-error);">Falha ao carregar sugestões.</p></div>';
            } else {
                const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
                await new Promise(res => setTimeout(res, delay));
            }
        }
    }

    loadingEl.style.display = 'none';
    button.removeAttribute('disabled');
}
window.generateAndDisplayWebResources = generateAndDisplayWebResources;


// --- PAGE INITIALIZERS ---

const addAIButtonListener = (buttonId: string, inputId: string, prompt: string | (() => string)) => {
    const button = document.getElementById(buttonId) as HTMLButtonElement;
    const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement;
    if (button && input) {
        button.addEventListener('click', () => {
            const finalPrompt = typeof prompt === 'function' ? prompt() : prompt;
            window.getAISuggestionForInput(finalPrompt, input, button);
        });
    }
};

function initFisicaPage() {
    // Hydration calculator
    const pesoInputMapa = document.getElementById('peso-corporal-hidratacao-mapa') as HTMLInputElement;
    const calcBtnMapa = document.getElementById('btn-calcular-hidratacao-mapa');
    const resultadoSpanMapa = document.getElementById('resultado-hidratacao-mapa');
    if (calcBtnMapa && pesoInputMapa && resultadoSpanMapa) {
        calcBtnMapa.addEventListener('click', () => {
            const peso = parseFloat(pesoInputMapa.value);
            if (!isNaN(peso) && peso > 0) {
                resultadoSpanMapa.textContent = `${((peso * 35) / 1000).toFixed(2)} L/dia`;
            } else {
                resultadoSpanMapa.textContent = 'Peso inválido';
            }
        });
    }

    // --- New Blueprint-inspired sections ---
    
    // 1. Exercise Protocol
    const exerciseForm = document.getElementById('exercise-protocol-form') as HTMLFormElement;
    const protocolList = document.getElementById('exercise-protocol-list') as HTMLTableSectionElement;
    const exerciseStorageKey = 'fisicaExerciseProtocol';
    const completionStorageKey = `exerciseCompletion_${new Date().toISOString().split('T')[0]}`;

    let protocolItems: { id: number, name: string, type: string, duration: string }[] = window.loadItems(exerciseStorageKey) || [];
    let completedItems: number[] = window.loadItems(completionStorageKey) || [];

    const saveProtocol = () => window.saveItems(exerciseStorageKey, protocolItems);
    const saveCompletion = () => window.saveItems(completionStorageKey, completedItems);

    const renderProtocol = () => {
        if (!protocolList) return;
        protocolList.innerHTML = '';
        if (protocolItems.length === 0) {
            protocolList.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum exercício no protocolo. Adicione um abaixo.</td></tr>';
            return;
        }
        protocolItems.forEach(item => {
            const isCompleted = completedItems.includes(item.id);
            const row = document.createElement('tr');
            row.className = isCompleted ? 'completed' : '';
            row.innerHTML = `
                <td>${DOMPurify.sanitize(item.name)}</td>
                <td>${DOMPurify.sanitize(item.type)}</td>
                <td>${DOMPurify.sanitize(item.duration)}</td>
                <td><input type="checkbox" class="task-checkbox" data-id="${item.id}" ${isCompleted ? 'checked' : ''}></td>
                <td><button class="action-btn delete" data-id="${item.id}" title="Excluir"><i class="fas fa-trash"></i></button></td>
            `;
            protocolList.appendChild(row);
        });
    };

    protocolList?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const id = Number(target.closest('[data-id]')?.getAttribute('data-id'));
        if (isNaN(id)) return;

        if (target.matches('.task-checkbox')) {
            const checkbox = target as HTMLInputElement;
            if (checkbox.checked) {
                if (!completedItems.includes(id)) completedItems.push(id);
            } else {
                completedItems = completedItems.filter(itemId => itemId !== id);
            }
            saveCompletion();
            renderProtocol();
        } else if (target.closest('.delete')) {
            protocolItems = protocolItems.filter(item => item.id !== id);
            completedItems = completedItems.filter(itemId => itemId !== id);
            saveProtocol();
            saveCompletion();
            renderProtocol();
        }
    });
    
    exerciseForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('exercise-name-input') as HTMLInputElement;
        const typeInput = document.getElementById('exercise-type-input') as HTMLSelectElement;
        const durationInput = document.getElementById('exercise-duration-input') as HTMLInputElement;

        const newItem = {
            id: Date.now(),
            name: nameInput.value,
            type: typeInput.value,
            duration: durationInput.value
        };
        protocolItems.push(newItem);
        saveProtocol();
        renderProtocol();
        exerciseForm.reset();
    });

    addAIButtonListener('exercise-name-ai-btn', 'exercise-name-input', "Sugira um exercício físico eficaz, como 'Corrida intervalada (HIIT)' ou 'Agachamento com barra'.");
    
    // 2. Sleep Monitoring
    const sleepForm = document.getElementById('sleep-log-form') as HTMLFormElement;
    const lastEntryDiv = document.getElementById('last-sleep-entry');
    const sleepLogKey = 'fisicaSleepLog';
    
    let sleepLog: any[] = window.loadItems(sleepLogKey) || [];

    const displayLastSleepEntry = () => {
        if (lastEntryDiv && sleepLog.length > 0) {
            const lastEntry = sleepLog[sleepLog.length - 1];
            const qualityMap: {[key: string]: string} = {'4': 'Excelente', '3': 'Bom', '2': 'Razoável', '1': 'Ruim'};
            lastEntryDiv.innerHTML = `<strong>Último Registro (${new Date(lastEntry.date + 'T00:00:00').toLocaleDateString('pt-BR')}):</strong> ${lastEntry.hours}h, Qualidade: ${qualityMap[lastEntry.quality]}. <em>${DOMPurify.sanitize(lastEntry.notes)}</em>`;
        } else if(lastEntryDiv) {
            lastEntryDiv.innerHTML = 'Nenhum registro de sono salvo ainda.';
        }
    };

    sleepForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const newEntry = {
            date: (document.getElementById('sleep-date-input') as HTMLInputElement).value,
            hours: (document.getElementById('sleep-hours-input') as HTMLInputElement).value,
            quality: (document.getElementById('sleep-quality-input') as HTMLSelectElement).value,
            notes: (document.getElementById('sleep-notes-input') as HTMLTextAreaElement).value,
        };
        sleepLog.push(newEntry);
        // Keep log from getting too big, store last 90 entries
        if (sleepLog.length > 90) {
            sleepLog = sleepLog.slice(sleepLog.length - 90);
        }
        window.saveItems(sleepLogKey, sleepLog);
        window.showToast('Registro de sono salvo!', 'success');
        displayLastSleepEntry();
        sleepForm.reset();
    });

    // 3. Performance Biomarkers
    const saveBiomarkersBtn = document.getElementById('save-performance-biomarkers-btn');
    const biomarkersKey = 'fisicaPerformanceBiomarkers';

    const loadPerformanceData = () => {
        const data = window.loadItems(biomarkersKey);
        if (data) {
            (document.getElementById('vo2max-input') as HTMLInputElement).value = data.vo2max || '';
            (document.getElementById('grip-strength-input') as HTMLInputElement).value = data.gripStrength || '';
            (document.getElementById('resting-hr-input') as HTMLInputElement).value = data.restingHR || '';
            (document.getElementById('biomarker-date-input') as HTMLInputElement).value = data.date || '';
        }
    };
    
    saveBiomarkersBtn?.addEventListener('click', () => {
        const data = {
            vo2max: (document.getElementById('vo2max-input') as HTMLInputElement).value,
            gripStrength: (document.getElementById('grip-strength-input') as HTMLInputElement).value,
            restingHR: (document.getElementById('resting-hr-input') as HTMLInputElement).value,
            date: (document.getElementById('biomarker-date-input') as HTMLInputElement).value,
        };
        window.saveItems(biomarkersKey, data);
        window.showToast('Biomarcadores de performance salvos!', 'success');
    });

    // Initial calls
    renderProtocol();
    displayLastSleepEntry();
    loadPerformanceData();
}
window.initFisicaPage = initFisicaPage;

function initMentalPage() {
    window.setupListManagement({ sectionKey: 'mental', listId: 'mental-metas-list', formId: 'mental-metas-form', textInputId: 'mental-meta-input', storageKey: 'mentalGoals', itemType: 'goal' });
    
    addAIButtonListener('mental-meta-input-ai-btn', 'mental-meta-input', "Sugira uma meta SMART e concisa para a Saúde Mental. Exemplo: 'Praticar 10 minutos de meditação mindfulness 5 dias por semana' ou 'Escrever um diário de gratidão 3 vezes por semana'.");
}
window.initMentalPage = initMentalPage;

function initFinanceiraPage() {
    window.setupListManagement({ sectionKey: 'financeira', listId: 'financeira-metas-list', formId: 'financeira-metas-form', textInputId: 'financeira-meta-input', storageKey: 'financeiraGoals', itemType: 'goal' });

    addAIButtonListener('financeira-meta-input-ai-btn', 'financeira-meta-input', "Sugira uma meta financeira SMART e concisa. Exemplo: 'Economizar R$ 500 para a reserva de emergência nos próximos 3 meses' ou 'Quitar o saldo do cartão de crédito em 6 meses'.");
}
window.initFinanceiraPage = initFinanceiraPage;

function initFamiliarPage() {
    window.setupListManagement({ sectionKey: 'familiar', listId: 'familiar-metas-list', formId: 'familiar-metas-form', textInputId: 'familiar-meta-input', storageKey: 'familiarGoals', itemType: 'goal' });

    addAIButtonListener('familiar-meta-input-ai-btn', 'familiar-meta-input', "Sugira uma meta SMART e concisa para a Saúde Familiar. Exemplo: 'Realizar um jantar em família sem celulares 3 vezes por semana' ou 'Planejar uma atividade de lazer em família por mês'.");
}
window.initFamiliarPage = initFamiliarPage;

function initProfissionalPage() {
    window.setupListManagement({ sectionKey: 'profissional', listId: 'profissional-metas-list', formId: 'profissional-metas-form', textInputId: 'profissional-meta-input', storageKey: 'profissionalGoals', itemType: 'goal' });
    
    addAIButtonListener('profissional-meta-input-ai-btn', 'profissional-meta-input', "Sugira uma meta profissional SMART e concisa. Exemplo: 'Concluir o curso de especialização em Gestão de Projetos até dezembro' ou 'Atualizar meu portfólio com 3 novos projetos até o final do trimestre'.");
}
window.initProfissionalPage = initProfissionalPage;

function initTarefasPage() {
    interface Task {
        id: string;
        title: string;
        description: string;
        dueDate: string;
        priority: 'low' | 'medium' | 'high';
        category: string;
        completed: boolean;
    }

    // State variables
    let tasks: Task[] = [];
    let categories: string[] = [];
    let editingTaskId: string | null = null;
    let currentFilter = 'all';
    let currentSearch = '';
    let currentCategoryFilter = 'all';
    let currentPage = 1;
    const tasksPerPage = 10;
    let currentView = 'checklist'; // 'checklist' or 'table'
    let categoryChart: any = null;

    // DOM Elements
    const elements = {
        // Main container and views
        container: document.getElementById('page-tarefas'),
        // FIX: Cast to HTMLElement to ensure style property is available.
        checklistViewContainer: document.getElementById('checklist-view-container') as HTMLElement,
        tableViewContainer: document.querySelector('#page-tarefas .table-wrapper') as HTMLElement,
        taskListBody: document.getElementById('task-list'),
        emptyStateMessage: document.getElementById('empty-state-message'),

        // Controls
        addCategoryBtn: document.getElementById('add-category-btn'),
        categoriesList: document.getElementById('categories-list'),
        searchInput: document.getElementById('search-input') as HTMLInputElement,
        filterSelect: document.getElementById('filter-select') as HTMLSelectElement,
        checklistViewBtn: document.getElementById('checklist-view-btn'),
        tableViewBtn: document.getElementById('table-view-btn'),

        // Quick Add
        quickTaskInput: document.getElementById('quick-task-input') as HTMLInputElement,
        addTaskBtn: document.getElementById('add-task-btn'),
        quickTaskAIBtn: document.getElementById('quick-task-input-ai-btn') as HTMLButtonElement,

        // Counts
        totalCountEl: document.getElementById('total-count'),
        completedCountEl: document.getElementById('completed-count'),
        pendingCountEl: document.getElementById('pending-count'),

        // Pagination
        pageInfoEl: document.querySelector('.pagination .page-info'),
        currentPageEl: document.getElementById('current-page'),
        totalPagesEl: document.getElementById('total-pages'),
        prevPageBtn: document.getElementById('prev-page-btn') as HTMLButtonElement,
        nextPageBtn: document.getElementById('next-page-btn') as HTMLButtonElement,

        // Modal
        taskModal: document.getElementById('task-modal-gerenciar-tarefas'),
        taskModalTitle: document.getElementById('modal-title-tarefas'),
        taskModalForm: document.getElementById('task-form-gerenciar-tarefas') as HTMLFormElement,
        taskModalCloseBtn: document.getElementById('task-modal-close-btn'),
        taskModalCancelBtn: document.getElementById('cancel-task-btn-gerenciar-tarefas'),
        modalTitleInput: document.getElementById('modal-task-title') as HTMLInputElement,
        modalDescriptionInput: document.getElementById('modal-task-description') as HTMLTextAreaElement,
        modalDueDateInput: document.getElementById('modal-task-due-date') as HTMLInputElement,
        modalPrioritySelect: document.getElementById('modal-task-priority') as HTMLSelectElement,
        modalCategorySelect: document.getElementById('modal-task-category') as HTMLSelectElement,
        modalTitleAIBtn: document.getElementById('modal-task-title-ai-btn') as HTMLButtonElement,
        modalDescriptionAIBtn: document.getElementById('modal-task-description-ai-btn') as HTMLButtonElement,

        // Analytics
        categoryChartCanvas: document.getElementById('category-chart') as HTMLCanvasElement,
        chartNoData: document.getElementById('chart-no-data'),
    };

    if (!elements.container) return; // Exit if not on the right page

    // --- Data Persistence ---
    const saveData = () => {
        window.saveItems('tasksData', tasks);
        window.saveItems('tasksCategories', categories);
    };

    const loadData = () => {
        tasks = window.loadItems('tasksData') || [];
        categories = window.loadItems('tasksCategories') || ['Pessoal', 'Trabalho', 'Estudos'];
    };

    // --- Modal Logic ---
    const openTaskModal = (task?: Task) => {
        if (!elements.taskModal || !elements.taskModalForm || !elements.taskModalTitle) return;
        elements.taskModalForm.reset();
        
        // Populate categories in modal dropdown
        elements.modalCategorySelect.innerHTML = '<option value="">Nenhuma</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            elements.modalCategorySelect.appendChild(option);
        });

        if (task) {
            editingTaskId = task.id;
            elements.taskModalTitle.textContent = 'Editar Tarefa';
            elements.modalTitleInput.value = task.title;
            elements.modalDescriptionInput.value = task.description;
            elements.modalDueDateInput.value = task.dueDate;
            elements.modalPrioritySelect.value = task.priority;
            elements.modalCategorySelect.value = task.category;
        } else {
            editingTaskId = null;
            elements.taskModalTitle.textContent = 'Adicionar Tarefa';
            elements.modalPrioritySelect.value = 'medium';
        }
        elements.taskModal.style.display = 'flex';
        setTimeout(() => elements.taskModal?.classList.add('visible'), 10);
    };

    const closeTaskModal = () => {
        if (!elements.taskModal) return;
        elements.taskModal.classList.remove('visible');
        setTimeout(() => { if(elements.taskModal) elements.taskModal.style.display = 'none'; }, 300);
    };

    const handleTaskFormSubmit = (e: Event) => {
        e.preventDefault();
        const formData = new FormData(elements.taskModalForm);
        const taskData: Partial<Task> = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            dueDate: formData.get('dueDate') as string,
            priority: formData.get('priority') as 'low' | 'medium' | 'high',
            category: formData.get('category') as string,
        };

        if (!taskData.title || taskData.title.trim() === '') {
            window.showToast('O título da tarefa é obrigatório.', 'warning');
            return;
        }

        if (editingTaskId) {
            const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
            if (taskIndex > -1) {
                tasks[taskIndex] = { ...tasks[taskIndex], ...taskData };
            }
        } else {
            const newTask: Task = {
                id: Date.now().toString(),
                completed: false,
                ...taskData
            } as Task;
            tasks.unshift(newTask);
        }
        saveData();
        render();
        closeTaskModal();
        window.showToast(`Tarefa ${editingTaskId ? 'atualizada' : 'adicionada'} com sucesso!`, 'success');
    };

    // --- Core Rendering Logic ---
    const render = () => {
        const filteredTasks = getFilteredTasks();
        updateCounts(filteredTasks);
        renderCategories();
        updatePagination(filteredTasks);
        
        const paginatedTasks = getPaginatedTasks(filteredTasks);

        if (elements.checklistViewContainer && elements.tableViewContainer) {
            if (currentView === 'checklist') {
                renderChecklistView(paginatedTasks);
                elements.checklistViewContainer.style.display = 'flex';
                elements.tableViewContainer.style.display = 'none';
            } else {
                renderTableView(paginatedTasks);
                elements.checklistViewContainer.style.display = 'none';
                elements.tableViewContainer.style.display = 'block';
            }
        }

        if (elements.emptyStateMessage) {
           elements.emptyStateMessage.style.display = filteredTasks.length === 0 ? 'block' : 'none';
        }
        
        updateAnalytics();
    };

    const getFilteredTasks = (): Task[] => {
        let filtered = [...tasks];
        
        // Category filter
        if (currentCategoryFilter !== 'all') {
            filtered = filtered.filter(task => task.category === currentCategoryFilter);
        }

        // Search filter
        if (currentSearch) {
            const searchLower = currentSearch.toLowerCase();
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(searchLower) || 
                task.description.toLowerCase().includes(searchLower)
            );
        }

        // Status filter from dropdown
        const today = new Date().toISOString().split('T')[0];
        switch (currentFilter) {
            case 'pending':
                filtered = filtered.filter(task => !task.completed);
                break;
            case 'completed':
                filtered = filtered.filter(task => task.completed);
                break;
            case 'overdue':
                filtered = filtered.filter(task => !task.completed && task.dueDate && task.dueDate < today);
                break;
            case 'high':
            case 'medium':
            case 'low':
                filtered = filtered.filter(task => task.priority === currentFilter);
                break;
        }
        
        return filtered.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    };
    
    const getPaginatedTasks = (filteredTasks: Task[]): Task[] => {
        const startIndex = (currentPage - 1) * tasksPerPage;
        return filteredTasks.slice(startIndex, startIndex + tasksPerPage);
    };
    
    const updateCounts = (filteredTasks: Task[]) => {
        if (!elements.totalCountEl || !elements.completedCountEl || !elements.pendingCountEl) return;
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        elements.totalCountEl.textContent = total.toString();
        elements.completedCountEl.textContent = completed.toString();
        elements.pendingCountEl.textContent = (total - completed).toString();
    };
    
    const renderCategories = () => {
        if (!elements.categoriesList || !elements.addCategoryBtn) return;
        // Clear existing but keep the 'add' button
        elements.categoriesList.innerHTML = '';
        elements.categoriesList.appendChild(elements.addCategoryBtn);

        const allTag = document.createElement('button');
        allTag.className = `category-tag ${currentCategoryFilter === 'all' ? 'active' : ''}`;
        allTag.textContent = 'Todas';
        allTag.dataset.category = 'all';
        elements.categoriesList.prepend(allTag);

        categories.forEach(cat => {
            const tag = document.createElement('button');
            tag.className = `category-tag ${currentCategoryFilter === cat ? 'active' : ''}`;
            tag.textContent = cat;
            tag.dataset.category = cat;
            elements.categoriesList.appendChild(tag);
        });
    };

    const updatePagination = (filteredTasks: Task[]) => {
        if (!elements.pageInfoEl || !elements.currentPageEl || !elements.totalPagesEl || !elements.prevPageBtn || !elements.nextPageBtn) return;
        const totalTasks = filteredTasks.length;
        const totalPages = Math.ceil(totalTasks / tasksPerPage) || 1;

        elements.pageInfoEl.textContent = `Mostrando ${Math.min((currentPage - 1) * tasksPerPage + 1, totalTasks)}-${Math.min(currentPage * tasksPerPage, totalTasks)} de ${totalTasks}`;
        elements.currentPageEl.textContent = currentPage.toString();
        elements.totalPagesEl.textContent = totalPages.toString();

        elements.prevPageBtn.disabled = currentPage === 1;
        elements.nextPageBtn.disabled = currentPage === totalPages;
    };
    
    const renderTableView = (tasksToRender: Task[]) => {
        if (!elements.taskListBody) return;
        elements.taskListBody.innerHTML = '';
        const today = new Date().toISOString().split('T')[0];

        tasksToRender.forEach(task => {
            const row = document.createElement('tr');
            row.className = task.completed ? 'completed' : '';
            row.dataset.taskId = task.id;

            const isOverdue = !task.completed && task.dueDate && task.dueDate < today;
            const dueDateText = task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data';

            row.innerHTML = `
                <td><input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Marcar tarefa como concluída"></td>
                <td>
                    <span class="task-title">${DOMPurify.sanitize(task.title)}</span>
                    <span class="task-description-preview">${DOMPurify.sanitize(task.description)}</span>
                </td>
                <td style="${isOverdue ? 'color: var(--color-error); font-weight: bold;' : ''}">${dueDateText}</td>
                <td><span class="priority-tag priority-${task.priority}">${task.priority}</span></td>
                <td>${task.category ? `<span class="task-category-badge">${DOMPurify.sanitize(task.category)}</span>` : ''}</td>
                <td class="task-actions-cell">
                    <button class="action-btn edit" aria-label="Editar tarefa"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" aria-label="Excluir tarefa"><i class="fas fa-trash"></i></button>
                </td>
            `;
            elements.taskListBody.appendChild(row);
        });
    };

    const renderChecklistView = (tasksToRender: Task[]) => {
        if (!elements.checklistViewContainer) return;
        elements.checklistViewContainer.innerHTML = '';
        
        const groupedTasks: { [key: string]: Task[] } = {};
        tasksToRender.forEach(task => {
            const category = task.category || 'Sem Categoria';
            if (!groupedTasks[category]) {
                groupedTasks[category] = [];
            }
            groupedTasks[category].push(task);
        });

        // Ensure category order matches the tags
        const orderedCategories = ['all', ...categories, 'Sem Categoria'];
        orderedCategories.forEach(catName => {
            if (groupedTasks[catName] && groupedTasks[catName].length > 0) {
                 const groupEl = document.createElement('div');
                 groupEl.className = 'checklist-category-group';
                 groupEl.innerHTML = `<h3 class="checklist-category-title">${DOMPurify.sanitize(catName)}</h3>`;

                 groupedTasks[catName].forEach(task => {
                    const itemEl = document.createElement('div');
                    itemEl.className = `checklist-item ${task.completed ? 'completed' : ''}`;
                    itemEl.dataset.taskId = task.id;
                    
                    const priorityDot = `<div class="priority-dot priority-dot-${task.priority}"></div> ${task.priority}`;
                    const dueDateText = task.dueDate ? `<i class="fas fa-calendar-alt"></i> ${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}` : '';

                    itemEl.innerHTML = `
                        <input type="checkbox" class="checklist-item-checkbox task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Marcar tarefa como concluída">
                        <div class="checklist-item-content">
                            <span class="checklist-item-title">${DOMPurify.sanitize(task.title)}</span>
                            <div class="checklist-item-details">
                                <div class="checklist-item-priority">${priorityDot}</div>
                                <div class="checklist-item-date">${dueDateText}</div>
                            </div>
                        </div>
                        <div class="checklist-item-actions">
                            <button class="action-btn edit small-button" aria-label="Editar tarefa"><i class="fas fa-edit"></i></button>
                            <button class="action-btn delete small-button" aria-label="Excluir tarefa"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                    groupEl.appendChild(itemEl);
                 });
                 elements.checklistViewContainer.appendChild(groupEl);
            }
        });
    };
    
    const updateAnalytics = () => {
        if (!elements.categoryChartCanvas || !elements.chartNoData) return;
        const taskCountsByCategory = categories.reduce((acc, cat) => {
            acc[cat] = tasks.filter(t => t.category === cat && !t.completed).length;
            return acc;
        }, {} as Record<string, number>);

        const noCategoryCount = tasks.filter(t => !t.category && !t.completed).length;
        if(noCategoryCount > 0) {
            taskCountsByCategory['Sem Categoria'] = noCategoryCount;
        }

        const labels = Object.keys(taskCountsByCategory).filter(k => taskCountsByCategory[k] > 0);
        const data = Object.values(taskCountsByCategory).filter(v => v > 0);

        if(data.length === 0){
             elements.categoryChartCanvas.style.display = 'none';
             elements.chartNoData.style.display = 'block';
             return;
        }
        elements.categoryChartCanvas.style.display = 'block';
        elements.chartNoData.style.display = 'none';

        if (categoryChart) {
            categoryChart.data.labels = labels;
            categoryChart.data.datasets[0].data = data;
            categoryChart.update();
        } else {
            const Chart = (window as any).Chart;
            if(Chart) {
                categoryChart = new Chart(elements.categoryChartCanvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Tarefas Pendentes',
                            data: data,
                            backgroundColor: [
                                'rgba(112, 128, 144, 0.7)',
                                'rgba(70, 130, 180, 0.7)',
                                'rgba(176, 196, 222, 0.7)',
                                'rgba(119, 136, 153, 0.7)',
                                'rgba(100, 149, 237, 0.7)',
                            ],
                            borderColor: 'var(--card-background-color)',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: { color: 'var(--text-color)' }
                            },
                            title: {
                                display: true,
                                text: 'Tarefas Pendentes por Categoria',
                                color: 'var(--text-color)'
                            }
                        }
                    }
                });
            }
        }
    };

    // --- Event Listeners Setup ---
    const setupEventListeners = () => {
        // View Toggle
        elements.checklistViewBtn?.addEventListener('click', () => {
            currentView = 'checklist';
            elements.checklistViewBtn?.classList.add('active');
            elements.tableViewBtn?.classList.remove('active');
            render();
        });
        elements.tableViewBtn?.addEventListener('click', () => {
            currentView = 'table';
            elements.tableViewBtn?.classList.add('active');
            elements.checklistViewBtn?.classList.remove('active');
            render();
        });

        // Filters
        elements.searchInput?.addEventListener('input', (e) => {
            currentSearch = (e.target as HTMLInputElement).value;
            currentPage = 1;
            render();
        });
        elements.filterSelect?.addEventListener('change', (e) => {
            currentFilter = (e.target as HTMLSelectElement).value;
            currentPage = 1;
            render();
        });

        // Category Management
        elements.addCategoryBtn?.addEventListener('click', () => {
            const newCategory = prompt('Digite o nome da nova categoria:');
            if (newCategory && newCategory.trim() !== '' && !categories.includes(newCategory.trim())) {
                categories.push(newCategory.trim());
                saveData();
                render();
            } else if (newCategory) {
                window.showToast('Categoria já existe ou nome inválido.', 'warning');
            }
        });
        elements.categoriesList?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.matches('.category-tag')) {
                currentCategoryFilter = target.dataset.category || 'all';
                currentPage = 1;
                render();
            }
        });

        // Quick Add Task
        const quickAddTask = () => {
            const title = elements.quickTaskInput.value.trim();
            if (title) {
                tasks.unshift({
                    id: Date.now().toString(),
                    title, description: '', dueDate: '',
                    priority: 'medium', category: currentCategoryFilter !== 'all' ? currentCategoryFilter : '',
                    completed: false
                });
                saveData();
                render();
                elements.quickTaskInput.value = '';
                window.showToast('Tarefa rápida adicionada!', 'success');
            }
        };
        elements.addTaskBtn?.addEventListener('click', quickAddTask);
        elements.quickTaskInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') quickAddTask();
        });
        elements.quickTaskAIBtn?.addEventListener('click', () => {
            window.getAISuggestionForInput("Sugira um título conciso para uma tarefa comum. Por exemplo: 'Agendar consulta médica' ou 'Finalizar relatório de vendas'.", elements.quickTaskInput, elements.quickTaskAIBtn);
        });

        // Task Actions (delegated)
        const handleTaskActions = (e: Event) => {
            const target = e.target as HTMLElement;
            const taskElement = target.closest('[data-task-id]');
            if (!taskElement) return;

            const taskId = taskElement.getAttribute('data-task-id');
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            if (target.matches('.task-checkbox, .task-checkbox *')) {
                task.completed = !task.completed;
                saveData();
                render();
            } else if (target.matches('.edit, .edit *')) {
                openTaskModal(task);
            } else if (target.matches('.delete, .delete *')) {
                if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                    tasks = tasks.filter(t => t.id !== taskId);
                    saveData();
                    render();
                    window.showToast('Tarefa excluída.', 'info');
                }
            }
        };
        elements.tableViewContainer?.addEventListener('click', handleTaskActions);
        elements.checklistViewContainer?.addEventListener('click', handleTaskActions);


        // Pagination
        elements.prevPageBtn?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                render();
            }
        });
        elements.nextPageBtn?.addEventListener('click', () => {
            const totalPages = Math.ceil(getFilteredTasks().length / tasksPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                render();
            }
        });

        // Modal Events
        elements.taskModalForm?.addEventListener('submit', handleTaskFormSubmit);
        elements.taskModalCloseBtn?.addEventListener('click', closeTaskModal);
        elements.taskModalCancelBtn?.addEventListener('click', closeTaskModal);
        // FIX: Corrected typo from taskModalTitleAIBtn to modalTitleAIBtn.
        elements.modalTitleAIBtn?.addEventListener('click', () => {
            const prompt = "Com base na seguinte descrição, sugira um título conciso e claro para uma tarefa: " + elements.modalDescriptionInput.value;
            window.getAISuggestionForInput(prompt, elements.modalTitleInput, elements.modalTitleAIBtn);
        });
        elements.modalDescriptionAIBtn?.addEventListener('click', () => {
            const prompt = "Com base no seguinte título de tarefa, elabore uma breve descrição com os principais pontos a serem considerados: " + elements.modalTitleInput.value;
            window.getAISuggestionForInput(prompt, elements.modalDescriptionInput, elements.modalDescriptionAIBtn);
        });
    };

    // --- Initialization ---
    loadData();
    setupEventListeners();
    render();
}
window.initTarefasPage = initTarefasPage;

function initSocialPage() {
    window.setupListManagement({ sectionKey: 'social', listId: 'social-metas-list', formId: 'social-metas-form', textInputId: 'social-meta-input', storageKey: 'socialGoals', itemType: 'goal' });
    
    addAIButtonListener('social-meta-input-ai-btn', 'social-meta-input', "Sugira uma meta SMART e concisa para a Saúde Social. Exemplo: 'Entrar em contato com um amigo que não vejo há tempos uma vez por semana' ou 'Participar de um novo grupo de interesse este mês'.");

    const generateBtn = document.getElementById('generate-social-resources-btn') as HTMLElement;
    const loadingEl = document.getElementById('social-resources-loading') as HTMLElement;
    const outputEl = document.getElementById('social-resources-output') as HTMLElement;
    if (generateBtn && loadingEl && outputEl) {
        generateBtn.addEventListener('click', () => {
            const prompt = "Sugira 3 livros ou artigos e 2 vídeos ou palestras (com links, se possível) sobre como construir e manter conexões sociais saudáveis na vida adulta. Use o Google Search para encontrar informações atuais e relevantes.";
            window.generateAndDisplayWebResources(generateBtn, loadingEl, outputEl, prompt);
        });
    }
}
window.initSocialPage = initSocialPage;

function initEspiritualPage() {
    // Daily checklist
    const practices = [
        { id: 'gratidao', text: 'Praticar gratidão (3 coisas)' },
        { id: 'meditacao', text: '10 minutos de meditação/silêncio' },
        { id: 'proposito', text: 'Refletir sobre propósito/valores' },
        { id: 'natureza', text: 'Conectar-se com a natureza' }
    ];
    const listEl = document.getElementById('espiritual-praticas-list');
    const storageKey = `espiritualPractices_${new Date().toISOString().split('T')[0]}`;
    let completedPractices: string[] = window.loadItems(storageKey) || [];

    const renderPractices = () => {
        if (!listEl) return;
        listEl.innerHTML = '';
        practices.forEach(p => {
            const isCompleted = completedPractices.includes(p.id);
            const li = document.createElement('li');
            li.innerHTML = `
                <label for="${p.id}-checkbox">
                    <input type="checkbox" id="${p.id}-checkbox" data-id="${p.id}" ${isCompleted ? 'checked' : ''}>
                    <span>${p.text}</span>
                </label>
            `;
            listEl.appendChild(li);
        });
    };

    listEl?.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.matches('input[type="checkbox"]')) {
            const id = target.dataset.id;
            if (id) {
                if (target.checked) {
                    if (!completedPractices.includes(id)) completedPractices.push(id);
                } else {
                    completedPractices = completedPractices.filter(pid => pid !== id);
                }
                window.saveItems(storageKey, completedPractices);
            }
        }
    });

    renderPractices();

    // Anchor link scrolling
    const mindMapSection = document.querySelector('.mind-map-section');
    mindMapSection?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('.mind-map-button');
        if (button && button.getAttribute('href')?.startsWith('#')) {
            e.preventDefault();
            const targetId = button.getAttribute('href')?.substring(1);
            const element = document.getElementById(targetId || '');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight-on-scroll');
                setTimeout(() => element.classList.remove('highlight-on-scroll'), 2000);
            }
        }
    });

    // List management for goals
    window.setupListManagement({ sectionKey: 'espiritual', listId: 'espiritual-metas-list', formId: 'espiritual-metas-form', textInputId: 'espiritual-meta-input', storageKey: 'espiritualGoals', itemType: 'goal' });
    
    addAIButtonListener('espiritual-meta-input-ai-btn', 'espiritual-meta-input', "Sugira uma meta SMART e concisa para a Saúde Espiritual. Exemplo: 'Praticar um diário de gratidão 3 vezes por semana' ou 'Dedicar 1 hora por semana para leitura filosófica'.");

    const generateBtn = document.getElementById('generate-spiritual-resources-btn') as HTMLElement;
    const loadingEl = document.getElementById('spiritual-resources-loading') as HTMLElement;
    const outputEl = document.getElementById('spiritual-resources-output') as HTMLElement;
    if (generateBtn && loadingEl && outputEl) {
        generateBtn.addEventListener('click', () => {
            const prompt = "Sugira 3 livros (um sobre mindfulness, um sobre estoicismo e um sobre logoterapia) e 2 palestras TED (com links) sobre propósito e significado na vida. Use o Google Search para encontrar informações relevantes.";
            window.generateAndDisplayWebResources(generateBtn, loadingEl, outputEl, prompt);
        });
    }
}
window.initEspiritualPage = initEspiritualPage;

function printDailyPlan() { window.print(); }
window.printDailyPlan = printDailyPlan;

function initPlanejamentoDiarioPage() {
    let currentPlan: DailyPlan | null = null;
    let currentDate = new Date().toISOString().split('T')[0];

    const elements = {
        dateInput: document.getElementById('daily-plan-date') as HTMLInputElement,
        taskList: document.getElementById('daily-task-list'),
        addTaskBtn: document.getElementById('add-daily-task-btn'),
        reflectionTextarea: document.getElementById('daily-reflection') as HTMLTextAreaElement,
        hideCompletedToggle: document.getElementById('hide-completed-toggle') as HTMLInputElement,
        mitSummary: document.getElementById('mit-summary'),
        // FIX: Cast to unknown first to resolve HTMLElement vs SVGCircleElement type conflict.
        progressRing: document.getElementById('progress-ring-circle') as unknown as SVGCircleElement,
        progressText: document.getElementById('progress-ring-text'),
        printBtn: document.getElementById('print-daily-plan-btn'),
        reflectionAIBtn: document.getElementById('daily-reflection-ai-btn') as HTMLButtonElement,
    };

    const savePlan = () => {
        if (currentPlan) {
            window.saveItems(`dailyPlan_${currentPlan.date}`, currentPlan);
        }
    };

    const loadPlan = (date: string) => {
        const storedPlan = window.loadItems(`dailyPlan_${date}`);
        if (storedPlan) {
            currentPlan = storedPlan;
        } else {
            // Create a new plan for the day with default tasks
            currentPlan = {
                date: date,
                tasks: [
                    { id: Date.now().toString() + '1', time: '07:00', description: 'Exercício Físico (Cardio ou Força)', intention: 'Energizar o corpo e a mente para o dia.', isMIT: true, status: 'pending' },
                    { id: Date.now().toString() + '2', time: '09:00', description: 'Foco Profundo na Tarefa Mais Importante (MIT #1)', intention: 'Avançar no projeto mais crítico.', isMIT: true, status: 'pending' },
                    { id: Date.now().toString() + '3', time: '12:00', description: 'Pausa para Almoço Consciente (sem telas)', intention: 'Nutrir o corpo e descansar a mente.', isMIT: false, status: 'pending' },
                    { id: Date.now().toString() + '4', time: '15:00', description: 'Revisão de Metas Financeiras/Orçamento', intention: 'Manter o controle sobre a saúde financeira.', isMIT: false, status: 'pending' },
                    { id: Date.now().toString() + '5', time: '18:00', description: 'Tempo de Qualidade Familiar/Social', intention: 'Nutrir relacionamentos importantes.', isMIT: false, status: 'pending' },
                    { id: Date.now().toString() + '6', time: '21:00', description: 'Meditação ou Leitura Espiritual/Filosófica', intention: 'Acalmar a mente e conectar com valores.', isMIT: false, status: 'pending' },
                    { id: Date.now().toString() + '7', time: '22:00', description: 'Ritual de Desligamento (sem telas)', intention: 'Preparar o corpo para um sono reparador.', isMIT: false, status: 'pending' },
                ],
                reflection: '',
                hideCompleted: false,
            };
        }
        render();
    };

    const render = () => {
        if (!currentPlan || !elements.taskList || !elements.mitSummary || !elements.progressRing || !elements.progressText) return;
        elements.taskList.innerHTML = '';
        
        const tasksToRender = currentPlan.hideCompleted
            ? currentPlan.tasks.filter(t => t.status !== 'completed')
            : currentPlan.tasks;

        tasksToRender.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = `daily-task-item ${task.isMIT ? 'mit' : ''} ${task.status}`;
            taskEl.dataset.id = task.id;
            
            const statusIcon = task.status === 'completed' ? 'fa-check-circle' : (task.status === 'in-progress' ? 'fa-hourglass-half' : 'fa-circle');
            
            taskEl.innerHTML = `
                <div class="task-main-info">
                    <button class="task-status-toggle" aria-label="Alterar status da tarefa"><i class="fas ${statusIcon}"></i></button>
                    <input type="time" class="task-time" value="${task.time}">
                    <div class="task-description-wrapper input-mic-wrapper planner-mic-wrapper">
                         <textarea class="task-description" rows="1">${task.description}</textarea>
                    </div>
                     <div class="task-actions">
                        <button class="task-mit-toggle ${task.isMIT ? 'active' : ''}" title="Marcar como Tarefa Mais Importante">MIT</button>
                        <button class="standard-button-danger small-button delete-task-btn" title="Excluir Tarefa"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="task-intention-wrapper input-mic-wrapper planner-mic-wrapper">
                    <textarea class="task-intention" rows="1" placeholder="Qual a intenção por trás desta tarefa?">${task.intention}</textarea>
                </div>
            `;
            elements.taskList?.appendChild(taskEl);

             // Auto-resize textareas
            const textareas = taskEl.querySelectorAll('textarea');
            textareas.forEach(textarea => {
                textarea.style.height = 'auto';
                textarea.style.height = `${textarea.scrollHeight}px`;
                textarea.addEventListener('input', () => {
                    textarea.style.height = 'auto';
                    textarea.style.height = `${textarea.scrollHeight}px`;
                });
            });
        });

        elements.reflectionTextarea.value = currentPlan.reflection;
        elements.hideCompletedToggle.checked = currentPlan.hideCompleted;
        
        const mitCount = currentPlan.tasks.filter(t => t.isMIT).length;
        elements.mitSummary.textContent = `Você tem ${mitCount} MIT(s) hoje. Foque nelas!`;

        const completedCount = currentPlan.tasks.filter(t => t.status === 'completed').length;
        const totalTasks = currentPlan.tasks.length;
        const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
        
        const radius = elements.progressRing.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        elements.progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        const offset = circumference - (progress / 100) * circumference;
        elements.progressRing.style.strokeDashoffset = offset.toString();
        elements.progressText.textContent = `${progress}%`;
    };

    const handleTaskUpdate = (id: string, field: 'time' | 'description' | 'intention', value: string) => {
        if (!currentPlan) return;
        const task = currentPlan.tasks.find(t => t.id === id);
        if (task) {
            (task as any)[field] = value;
            savePlan();
        }
    };
    
    // Event Listeners
    elements.dateInput?.addEventListener('change', () => {
        currentDate = elements.dateInput.value;
        loadPlan(currentDate);
    });

    elements.hideCompletedToggle?.addEventListener('change', () => {
        if (currentPlan) {
            currentPlan.hideCompleted = elements.hideCompletedToggle.checked;
            savePlan();
            render();
        }
    });
    
    elements.addTaskBtn?.addEventListener('click', () => {
        if (currentPlan) {
            const newTask: DailyTask = {
                id: Date.now().toString(),
                time: '09:00',
                description: 'Nova Tarefa',
                intention: '',
                isMIT: false,
                status: 'pending',
            };
            currentPlan.tasks.push(newTask);
            savePlan();
            render();
        }
    });

    elements.taskList?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const taskEl = target.closest('.daily-task-item') as HTMLElement;
        if (!taskEl || !currentPlan) return;
        const id = taskEl.dataset.id!;
        const task = currentPlan.tasks.find(t => t.id === id);
        if (!task) return;

        if (target.closest('.task-status-toggle')) {
            const statuses: DailyTask['status'][] = ['pending', 'in-progress', 'completed'];
            const currentIndex = statuses.indexOf(task.status);
            task.status = statuses[(currentIndex + 1) % statuses.length];
        } else if (target.closest('.task-mit-toggle')) {
            task.isMIT = !task.isMIT;
        } else if (target.closest('.delete-task-btn')) {
            if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                currentPlan.tasks = currentPlan.tasks.filter(t => t.id !== id);
            }
        }
        savePlan();
        render();
    });

    elements.taskList?.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        const taskEl = target.closest('.daily-task-item') as HTMLElement;
        if (!taskEl) return;
        const id = taskEl.dataset.id!;
        
        if (target.matches('.task-time')) handleTaskUpdate(id, 'time', target.value);
        if (target.matches('.task-description')) handleTaskUpdate(id, 'description', target.value);
        if (target.matches('.task-intention')) handleTaskUpdate(id, 'intention', target.value);
    });
    
    elements.reflectionTextarea?.addEventListener('input', () => {
        if (currentPlan) {
            currentPlan.reflection = elements.reflectionTextarea.value;
            savePlan();
        }
    });

    elements.printBtn?.addEventListener('click', window.printDailyPlan);

    elements.reflectionAIBtn?.addEventListener('click', () => {
        const tasksDone = currentPlan?.tasks.filter(t => t.status === 'completed').map(t => t.description).join(', ') || 'Nenhuma tarefa concluída.';
        const prompt = `Com base nas tarefas que concluí hoje (${tasksDone}), ajude-me a escrever uma breve reflexão para o final do dia. Foque em um ponto de aprendizado e um motivo para gratidão.`;
        window.getAISuggestionForInput(prompt, elements.reflectionTextarea, elements.reflectionAIBtn);
    });

    // Initial Load
    elements.dateInput.value = currentDate;
    loadPlan(currentDate);

    // Add microphone buttons
    addMicButtonTo('#wrapper-daily-reflection', 'daily-reflection', 'planner-mic');
}
window.initPlanejamentoDiarioPage = initPlanejamentoDiarioPage;

function initPreventivaPage() {
    const mainTitle = document.getElementById('preventivaMainTitle');
    const backButton = document.getElementById('preventivaBackButton');
    const mainMenu = document.getElementById('preventivaMainMenu');
    const pages = document.querySelectorAll<HTMLElement>('.preventiva-page');

    const showSubPage = (pageId: string) => {
        mainMenu?.classList.remove('active');
        pages.forEach(p => p.classList.remove('active'));
        
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            if(mainTitle) mainTitle.textContent = targetPage.querySelector('h2')?.textContent || 'Saúde Preventiva';
            backButton?.style.setProperty('display', 'inline-flex');
        }
    };
    
    const showMainMenu = () => {
        pages.forEach(p => p.classList.remove('active'));
        mainMenu?.classList.add('active');
        if(mainTitle) mainTitle.textContent = 'Saúde Preventiva';
        if(backButton) backButton.style.display = 'none';
    };

    mainMenu?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // FIX: Use generic closest to get correct HTMLElement type and access dataset.
        const menuItem = target.closest<HTMLElement>('.menu-item');
        if (menuItem && menuItem.dataset.target) {
            showSubPage(menuItem.dataset.target);
        }
    });

    backButton?.addEventListener('click', showMainMenu);

    // Vaccine table logic
    const vaccineTable = document.getElementById('tabela-vacinas');
    if (vaccineTable) {
        window.loadVaccineData();
        vaccineTable.querySelectorAll('tr[data-vaccine-id]').forEach(row => {
            const vaccineId = (row as HTMLElement).dataset.vaccineId;
            if (vaccineId) {
                const lastDoseInput = row.querySelector('.vaccine-last-dose') as HTMLInputElement;
                lastDoseInput.value = vaccineData[vaccineId] || '';
                window.updateVaccineStatus(row as HTMLElement);

                lastDoseInput.addEventListener('change', () => {
                    window.updateVaccineStatus(row as HTMLElement);
                });
            }
        });
    }
    
    // Indicators and Diagnostics logic
    window.loadAllIndicatorData();
    window.loadDiagnosticData();

    document.querySelectorAll('.indicator-card').forEach(card => {
        const indicatorId = (card as HTMLElement).dataset.indicatorId;
        if (!indicatorId) return;
        
        const config = window.getIndicatorById(indicatorId);
        if (!config) return;

        const data = window.loadIndicatorData(indicatorId);
        window.updateIndicatorUI(config, data?.value, data?.date);

        const updateBtn = card.querySelector('.update-button');
        updateBtn?.addEventListener('click', () => {
            const valueInput = card.querySelector('.indicator-value') as HTMLInputElement;
            const dateInput = card.querySelector('.indicator-date') as HTMLInputElement;
            const value = parseFloat(valueInput.value);
            const date = dateInput.value;
            
            if (isNaN(value) || !date) {
                window.showToast("Por favor, preencha o valor e a data.", "warning");
                return;
            }
            
            const zone = config.zones.find(z => value >= z.min && value <= z.max);
            const statusText = zone ? zone.label : 'Indefinido';

            window.saveIndicatorData(indicatorId, value, date);
            window.updateIndicatorUI(config, value, date);
            window.logIndicatorEntry(indicatorId, value, date, statusText);
            window.showToast("Indicador salvo com sucesso!", "success");
        });

        const historyBtn = card.querySelector('.history-button');
        historyBtn?.addEventListener('click', () => {
            window.openIndicatorChartModal(indicatorId);
        });
    });

    document.querySelectorAll('.risk-item').forEach(item => {
        const diagnosticId = (item as HTMLElement).dataset.diagnosticId;
        if (!diagnosticId) return;

        const toggle = item.querySelector('.diagnostic-toggle') as HTMLInputElement;
        const details = item.querySelector('.risk-details') as HTMLElement;
        
        const data = diagnosticData[diagnosticId];
        if (data) {
            toggle.checked = true;
            details.style.display = 'block';
            (item.querySelector('.diagnostic-date') as HTMLInputElement).value = data.date || '';
            const typeInput = item.querySelector('.diagnostic-type') as HTMLInputElement;
            if (typeInput) typeInput.value = data.type || '';
            const severityInput = item.querySelector('.diagnostic-severity') as HTMLInputElement;
            if (severityInput) severityInput.value = data.severity || '';
            const notesInput = item.querySelector('.diagnostic-notes') as HTMLTextAreaElement;
            if (notesInput) notesInput.value = data.notes || '';
            const medicationInput = item.querySelector('.diagnostic-medication') as HTMLInputElement;
            if(medicationInput) medicationInput.value = data.medication || '';
        }

        toggle.addEventListener('change', () => {
            details.style.display = toggle.checked ? 'block' : 'none';
        });
    });

    document.getElementById('saveDiagnosticosButton')?.addEventListener('click', () => {
        document.querySelectorAll('.risk-item').forEach(item => {
            const diagnosticId = (item as HTMLElement).dataset.diagnosticId;
            if (!diagnosticId) return;

            const toggle = item.querySelector('.diagnostic-toggle') as HTMLInputElement;
            if (toggle.checked) {
                 diagnosticData[diagnosticId] = {
                    date: (item.querySelector('.diagnostic-date') as HTMLInputElement)?.value || '',
                    type: (item.querySelector('.diagnostic-type') as HTMLInputElement)?.value || '',
                    severity: (item.querySelector('.diagnostic-severity') as HTMLInputElement)?.value || '',
                    notes: (item.querySelector('.diagnostic-notes') as HTMLTextAreaElement)?.value || '',
                    medication: (item.querySelector('.diagnostic-medication') as HTMLInputElement)?.value || '',
                };
            } else {
                delete diagnosticData[diagnosticId];
            }
        });
        window.saveDiagnosticData();
        window.showToast("Dados de diagnósticos salvos!", "success");
    });
    
    // History Table
    window.updateIndicatorHistoryTable();

    // Chart Modal Close buttons
    document.getElementById('indicator-chart-modal-close-btn')?.addEventListener('click', window.closeIndicatorChartModal);
    document.getElementById('indicator-chart-modal-cancel-btn')?.addEventListener('click', window.closeIndicatorChartModal);

}
window.initPreventivaPage = initPreventivaPage;

// --- INITIAL LOAD & GLOBAL EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Gemini AI
    try {
        if (process.env.API_KEY) {
            window.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        } else {
            console.error("API_KEY is not defined. AI features will be disabled.");
        }
    } catch(e) {
        console.error("Error initializing GoogleGenAI. Check API key and configuration.", e);
    }
    
    // Setup Sidebar
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => toggleSidebar());
        toggleSidebar(true);
    }

    // Setup Theme
    loadTheme();
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle?.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeToggleButtonIcon(isDark);
    });

    // Setup Rain Sound
    const rainSoundToggle = document.getElementById('rain-sound-toggle');
    rainSoundToggle?.addEventListener('click', toggleRainSound);
    if (localStorage.getItem('rainSoundPlaying') === 'true') {
        // We wait for a user interaction to start audio context,
        // so we don't auto-play on load but can set the button state if needed.
    }
    
    // Setup Contract Modal
    document.querySelector('[data-page="contrato"]')?.addEventListener('click', (e) => {
         e.preventDefault();
         window.location.hash = 'contrato';
    });
    document.getElementById('contract-modal-close-btn')?.addEventListener('click', closeContractModal);
    document.getElementById('contract-modal-cancel-btn')?.addEventListener('click', closeContractModal);
    document.getElementById('contract-modal-save-btn')?.addEventListener('click', saveContractData);
    document.getElementById('contract-modal-print-btn')?.addEventListener('click', printContract);
    addAIButtonListener('contract-commitment-ai-btn', 'contract-commitment', 'Sugira um parágrafo inspirador para um contrato de compromisso pessoal focado em autocuidado e desenvolvimento contínuo.');
    addAIButtonListener('contract-goals-ai-btn', 'contract-goals', 'Com base no livro "Pequenos Passos para uma Vida Extraordinária", sugira 3 metas SMART (Específicas, Mensuráveis, Atingíveis, Relevantes, Temporais), uma para saúde física, uma para financeira e uma para familiar.');
    
    // Setup Sidebar Search
    const searchInput = document.getElementById('sidebar-search') as HTMLInputElement;
    const sidebarLinks = document.querySelectorAll('.sidebar-links .sidebar-link');
    const noResultsEl = document.querySelector('.sidebar-no-results') as HTMLElement;

    searchInput?.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        let found = false;
        sidebarLinks.forEach(link => {
            const text = link.textContent?.toLowerCase() || '';
            const match = text.includes(searchTerm);
            (link.parentElement as HTMLElement).classList.toggle('is-hidden', !match);
            if(match) found = true;
        });
        if (noResultsEl) noResultsEl.style.display = found ? 'none' : 'block';
    });

    // Delegated listener for back buttons inside main content
    const mainContent = document.getElementById('main-content');
    mainContent?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button[data-page], a[data-page], .back-button[data-target-page]');
        if (button) {
            e.preventDefault();
            const page = button.getAttribute('data-page') || button.getAttribute('data-target-page');
            if (page) {
                window.location.hash = page;
            }
        }
    });

    // Initialize Router
    window.addEventListener('hashchange', router);
    window.addEventListener('popstate', router); // Handles browser back/forward
    router(); // Load initial page based on hash
});