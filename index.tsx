


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
        showPage: (pageId: string, isInitialLoad?: boolean) => Promise<void>;
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
        initInicioPage: () => void;
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


// --- PAGE NAVIGATION ---
const pageInitializers: { [key: string]: string | null } = {
    'fisica': 'initFisicaPage',
    'mental': 'initMentalPage',
    'espiritual': 'initEspiritualPage',
    'preventiva': 'initPreventivaPage',
    'financeira': 'initFinanceiraPage',
    'familiar': 'initFamiliarPage',
    'profissional': 'initProfissionalPage',
    'social': 'initSocialPage',
    'planejamento-diario': 'initPlanejamentoDiarioPage',
    'tarefas': 'initTarefasPage',
    'inicio': 'initInicioPage', 
    // Food pages - no specific init for now
    'food-gengibre': null,
    'food-alho': null,
    'food-brocolis': null,
    'food-couveflor': null,
    'food-shitake': null,
    'food-lentilha': null,
    'food-azeite': null,
    'food-morango': null,
    'food-laranja': null,
    'food-maca': null,
    'food-cenoura': null,
    'food-pimenta': null,
    'food-ovo': null,
    'food-vinagremaca': null,
    'food-whey': null,
    'food-creatina': null,
    'food-curcuma': null,
    'food-chaverde': null,
    'food-canela': null,
    'food-linhaca': null,
    'alongamento': null, // New page for stretching, yoga, and pilates
    'leitura-guia-fisica': null,
    'leitura-guia-espiritual': null,
    'leitura-guia-familiar': null,
    'leitura-guia-mental': null,
    'leitura-guia-financeira': null,
};
let currentPageInitFunction: Function | null = null;
const pageCache = new Map<string, string>();

async function showPage(pageId: string, isInitialLoad = false) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Handle button clicks within pages that should navigate
    const buttonNavTarget = document.querySelector(`[data-page="${pageId}"]`);
    if (buttonNavTarget && buttonNavTarget.tagName === 'BUTTON') {
        // This logic handles buttons that act as page links
    }


    try {
        let pageHtml = pageCache.get(pageId);
        if (!pageHtml) {
            const response = await fetch(`./${pageId}.html`);
            if (!response.ok) {
                console.error(`Page not found: ${pageId}.html. Redirecting to 'inicio'.`);
                if (pageId !== 'inicio') {
                    await showPage('inicio');
                } else {
                    mainContent.innerHTML = `<div class="container" style="padding: 20px; text-align: center;"><h1>Error</h1><p>Home page could not be loaded.</p></div>`;
                }
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
            link.classList.remove('active', 'fisica', 'mental', 'financeira', 'familiar', 'profissional', 'social', 'espiritual', 'preventiva', 'inicio', 'planejamento-diario', 'tarefas-card');
            link.removeAttribute('aria-current');
            if (link.getAttribute('data-page') === pageId) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
                if (['fisica', 'mental', 'financeira', 'familiar', 'profissional', 'social', 'espiritual', 'preventiva', 'inicio', 'planejamento-diario'].includes(pageId)) {
                    link.classList.add(pageId);
                } else if (pageId === 'tarefas') {
                    link.classList.add('tarefas-card');
                }
            }
        });
        
        const pageTitle = targetSection.querySelector('h1')?.textContent || `Página ${pageId}`;
        document.title = `${pageTitle} | Pequenos Passos`;
        
        const newHash = `#${pageId}`;
        let currentFullUrl = window.location.href;
        const hashIndex = currentFullUrl.indexOf('#');
        if (hashIndex !== -1) {
            currentFullUrl = currentFullUrl.substring(0, hashIndex); 
        }
        const newUrlForHistory = currentFullUrl + newHash;


        if (!isInitialLoad && window.location.hash !== newHash) {
            history.pushState({ page: pageId }, pageTitle, newUrlForHistory);
        } else if (isInitialLoad) {
             if (window.location.href !== newUrlForHistory) { 
                 history.replaceState({ page: pageId }, pageTitle, newUrlForHistory);
            }
        }

        const initializerKey = pageInitializers[pageId];
        if (initializerKey && typeof window[initializerKey as keyof Window] === 'function') {
            const initFn = window[initializerKey as keyof Window] as () => void;
            if (currentPageInitFunction !== initFn || initializerKey === 'initPlanejamentoDiarioPage' || isInitialLoad) {
                initFn();
                currentPageInitFunction = initFn;
            }
        } else {
             if (initializerKey && typeof window[initializerKey as keyof Window] !== 'function' && (pageId.startsWith('food-') || pageId.startsWith('leitura-') || pageId === 'alongamento')) {
                // Do not warn for food/reading/stretching pages not having initializers
            } else if (initializerKey && typeof window[initializerKey as keyof Window] !== 'function') {
                console.warn(`Page initializer ${initializerKey} not found or not a function.`);
            }
            currentPageInitFunction = null;
        }

    } else {
        console.warn(`Page section not found in loaded HTML for: ${pageId}`);
        if (pageId !== 'inicio') {
            await showPage('inicio');
        }
    }
}
window.showPage = showPage;

window.addEventListener('popstate', async (event) => {
    if (event.state && event.state.page) {
        await showPage(event.state.page, true); 
    } else {
        const pageIdFromHash = window.location.hash.substring(1);
        if (pageIdFromHash) {
            await showPage(pageIdFromHash, true);
        } else {
            await showPage('inicio', true);
        }
    }
});


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


// --- RAIN SOUND ---
let rainAudio: HTMLAudioElement | null = null;

function toggleRainSound() {
    const button = document.getElementById('rain-sound-toggle');
    if (!button) return;

    if (!rainAudio) {
        rainAudio = document.getElementById('rain-sound') as HTMLAudioElement;
        if (!rainAudio) {
            console.error("Rain sound audio element not found.");
            window.showToast("Elemento de áudio não encontrado.", "error");
            return;
        }
        rainAudio.loop = true;
        rainAudio.volume = 0.3;
    }

    if (rainAudio.paused) {
        const playPromise = rainAudio.play();

        if (playPromise !== undefined) {
            playPromise.then(_ => {
                // Playback started successfully.
                button.innerHTML = '<i class="fas fa-stop-circle"></i>';
                button.setAttribute('aria-label', 'Desativar som de chuva');
                localStorage.setItem('rainSoundPlaying', 'true');
            }).catch(error => {
                // Autoplay was prevented by browser policy.
                console.log("Audio autoplay was prevented by the browser.");
                button.innerHTML = '<i class="fas fa-cloud-rain"></i>';
                button.setAttribute('aria-label', 'Ativar som de chuva');
                localStorage.setItem('rainSoundPlaying', 'false');
            });
        }
    } else {
        rainAudio.pause();
        button.innerHTML = '<i class="fas fa-cloud-rain"></i>';
        button.setAttribute('aria-label', 'Ativar som de chuva');
        localStorage.setItem('rainSoundPlaying', 'false');
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
    let currentPage = 1;
    const tasksPerPage = 10;
    let currentFilter = 'all';
    let currentSearch = '';
    let activeCategory = 'all';
    let currentView = 'checklist';
    let categoryChart: any = null;

    // Get all DOM elements safely
    const taskList = document.getElementById('task-list');
    const checklistContainer = document.getElementById('checklist-view-container');
    const tableWrapper = document.querySelector<HTMLElement>('.table-wrapper');
    const emptyState = document.getElementById('empty-state-message');
    const paginationContainer = document.querySelector<HTMLElement>('.pagination');
    const paginationInfo = document.querySelector<HTMLElement>('.page-info');
    const prevPageBtn = document.getElementById('prev-page-btn') as HTMLButtonElement | null;
    const nextPageBtn = document.getElementById('next-page-btn') as HTMLButtonElement | null;
    const currentPageEl = document.getElementById('current-page');
    const totalPagesEl = document.getElementById('total-pages');
    const categoryList = document.getElementById('categories-list');
    const modal = document.getElementById('task-modal-gerenciar-tarefas');
    const modalTitle = document.getElementById('modal-title-tarefas');
    const taskForm = document.getElementById('task-form-gerenciar-tarefas') as HTMLFormElement | null;
    const cancelBtn = document.getElementById('cancel-task-btn-gerenciar-tarefas');
    const modalCloseBtn = document.getElementById('task-modal-close-btn');
    const quickTaskInput = document.getElementById('quick-task-input') as HTMLInputElement | null;
    const addTaskBtn = document.getElementById('add-task-btn') as HTMLButtonElement | null;
    const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
    const filterSelect = document.getElementById('filter-select') as HTMLSelectElement | null;
    const addCategoryBtn = document.getElementById('add-category-btn') as HTMLButtonElement | null;
    const totalCountEl = document.getElementById('total-count');
    const completedCountEl = document.getElementById('completed-count');
    const pendingCountEl = document.getElementById('pending-count');
    const checklistViewBtn = document.getElementById('checklist-view-btn') as HTMLButtonElement | null;
    const tableViewBtn = document.getElementById('table-view-btn') as HTMLButtonElement | null;

    function loadTasks() {
        tasks = window.loadItems('tasks') || [];
        categories = window.loadItems('taskCategories') || ['Pessoal', 'Trabalho', 'Estudos'];
        currentView = localStorage.getItem('taskView') || 'checklist';
    }

    function saveTasks() {
        window.saveItems('tasks', tasks);
        window.saveItems('taskCategories', categories);
    }

    function renderAll() {
        if (!categoryList || !taskList || !checklistContainer) return;
        renderCategories();
        renderTasks();
        renderChecklist();
        updateCounts();
        updateView();
        renderCategoryChart();
    }

    function renderCategoryChart() {
        const chartCanvas = document.getElementById('category-chart') as HTMLCanvasElement;
        const noDataMessage = document.getElementById('chart-no-data');
        if (!chartCanvas || !noDataMessage) return;

        // Destroy existing chart instance
        if (categoryChart) {
            categoryChart.destroy();
        }

        if (tasks.length === 0) {
            chartCanvas.style.display = 'none';
            noDataMessage.style.display = 'block';
            return;
        }

        chartCanvas.style.display = 'block';
        noDataMessage.style.display = 'none';

        const categoryCounts = tasks.reduce((acc, task) => {
            const category = task.category || 'Sem Categoria';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const labels = Object.keys(categoryCounts);
        const data = Object.values(categoryCounts);
        
        const chartColors = [
            'rgba(var(--color-tarefas-rgb), 0.7)',
            'rgba(var(--color-fisica-rgb), 0.7)',
            'rgba(var(--color-mental-rgb), 0.7)',
            'rgba(var(--color-financeira-rgb), 0.7)',
            'rgba(var(--color-profissional-rgb), 0.7)',
            'rgba(var(--color-social-rgb), 0.7)',
            'rgba(var(--color-espiritual-rgb), 0.7)',
            'rgba(var(--color-familiar-rgb), 0.7)',
            'rgba(var(--color-planejamento-rgb), 0.7)',
        ];
        
        while (labels.length > chartColors.length) {
             const r = Math.floor(Math.random() * 200);
             const g = Math.floor(Math.random() * 200);
             const b = Math.floor(Math.random() * 200);
             chartColors.push(`rgba(${r}, ${g}, ${b}, 0.7)`);
        }

        const ctx = chartCanvas.getContext('2d');
        if (!ctx) return;
        
        const Chart = (window as any).Chart;
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: ' Tarefas',
                    data: data,
                    backgroundColor: chartColors,
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-background-color').trim(),
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-muted').trim(),
                            boxWidth: 15,
                            padding: 20
                        }
                    },
                    title: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    const total = context.chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
                                    const value = context.parsed;
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                    label += `${value} (${percentage})`;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    function updateView() {
        if (!checklistContainer || !tableWrapper || !checklistViewBtn || !tableViewBtn) return;
        if (currentView === 'checklist') {
            checklistContainer.style.display = 'flex';
            tableWrapper.style.display = 'none';
            checklistViewBtn.classList.add('active');
            checklistViewBtn.setAttribute('aria-pressed', 'true');
            tableViewBtn.classList.remove('active');
            tableViewBtn.setAttribute('aria-pressed', 'false');
        } else {
            checklistContainer.style.display = 'none';
            tableWrapper.style.display = 'block';
            tableViewBtn.classList.add('active');
            tableViewBtn.setAttribute('aria-pressed', 'true');
            checklistViewBtn.classList.remove('active');
            checklistViewBtn.setAttribute('aria-pressed', 'false');
        }
    }

    function renderCategories() {
        if (!categoryList || !addCategoryBtn) return;
        categoryList.innerHTML = '';
        
        const allTag = document.createElement('button');
        allTag.className = 'category-tag';
        allTag.textContent = 'Todas';
        allTag.dataset.category = 'all';
        if (activeCategory === 'all') allTag.classList.add('active');
        allTag.addEventListener('click', () => {
            activeCategory = 'all';
            currentPage = 1;
            renderAll();
        });
        categoryList.appendChild(allTag);

        categories.forEach(cat => {
            const tag = document.createElement('button');
            tag.className = 'category-tag';
            tag.textContent = cat;
            tag.dataset.category = cat;
            if (activeCategory === cat) tag.classList.add('active');
            tag.addEventListener('click', () => {
                activeCategory = cat;
                currentPage = 1;
                renderAll();
            });
            categoryList.appendChild(tag);
        });
        categoryList.appendChild(addCategoryBtn);
    }

    function getFilteredTasks() {
        let filtered = tasks;
        if (activeCategory !== 'all') {
            filtered = filtered.filter(task => task.category === activeCategory);
        }
        if (currentSearch) {
            const searchLower = currentSearch.toLowerCase();
            filtered = filtered.filter(task =>
                task.title.toLowerCase().includes(searchLower) ||
                task.description.toLowerCase().includes(searchLower)
            );
        }
        switch (currentFilter) {
            case 'pending':
                filtered = filtered.filter(task => !task.completed);
                break;
            case 'completed':
                filtered = filtered.filter(task => task.completed);
                break;
            case 'overdue':
                const today = new Date();
                today.setHours(0,0,0,0);
                filtered = filtered.filter(task => !task.completed && task.dueDate && new Date(task.dueDate + 'T00:00:00') < today);
                break;
            case 'high':
                filtered = filtered.filter(task => task.priority === 'high');
                break;
            case 'medium':
                filtered = filtered.filter(task => task.priority === 'medium');
                break;
            case 'low':
                filtered = filtered.filter(task => task.priority === 'low');
                break;
        }
        return filtered;
    }

    function renderTasks() {
        if (!taskList || !emptyState || !tableWrapper || !paginationContainer) return;
        
        const filteredTasks = getFilteredTasks();
        taskList.innerHTML = '';

        if (filteredTasks.length === 0) {
            emptyState.style.display = 'block';
            paginationContainer.style.display = 'none';
            if (currentView === 'table') tableWrapper.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            if (currentView === 'table') tableWrapper.style.display = 'block';
            paginationContainer.style.display = 'flex';
        }

        const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
        const paginatedTasks = filteredTasks.slice((currentPage - 1) * tasksPerPage, currentPage * tasksPerPage);

        paginatedTasks.forEach(task => {
            const row = document.createElement('tr');
            row.dataset.taskId = task.id;
            if (task.completed) row.classList.add('completed');

            const priorityClasses: { [key: string]: string } = { low: 'priority-low', medium: 'priority-medium', high: 'priority-high' };
            const priorityText: { [key: string]: string } = { low: 'Baixa', medium: 'Média', high: 'Alta' };

            row.innerHTML = `
                <td><input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}></td>
                <td>
                    <span class="task-title">${task.title}</span>
                    <span class="task-description-preview">${task.description}</span>
                </td>
                <td>${task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</td>
                <td><span class="priority-tag ${priorityClasses[task.priority]}">${priorityText[task.priority]}</span></td>
                <td>${task.category ? `<span class="task-category-badge">${task.category}</span>` : 'Nenhuma'}</td>
                <td class="task-actions-cell">
                    <button class="action-btn edit" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            `;
            row.querySelector('.task-checkbox')?.addEventListener('change', () => toggleTaskCompletion(task.id));
            row.querySelector('.edit')?.addEventListener('click', () => openTaskModal(task));
            row.querySelector('.delete')?.addEventListener('click', () => deleteTask(task.id));
            taskList.appendChild(row);
        });

        updatePaginationControls(filteredTasks.length, totalPages);
    }

    function renderChecklist() {
        if (!checklistContainer) return;
        const filteredTasks = getFilteredTasks();
        checklistContainer.innerHTML = '';

        if (filteredTasks.length === 0) return;

        const groupedTasks = filteredTasks.reduce((acc, task) => {
            const category = task.category || 'Geral';
            if (!acc[category]) acc[category] = [];
            acc[category].push(task);
            return acc;
        }, {} as Record<string, Task[]>);

        for (const categoryName in groupedTasks) {
            const categoryGroup = document.createElement('div');
            categoryGroup.className = 'checklist-category-group';
            
            const categoryTitle = document.createElement('h2');
            categoryTitle.className = 'checklist-category-title';
            categoryTitle.textContent = categoryName;
            categoryGroup.appendChild(categoryTitle);

            const tasksForCategory = groupedTasks[categoryName];
            tasksForCategory.sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);

            tasksForCategory.forEach(task => {
                const item = document.createElement('div');
                item.className = 'checklist-item';
                if (task.completed) item.classList.add('completed');
                item.dataset.taskId = task.id;

                const priorityDots: { [key: string]: string } = {
                    low: '<div class="priority-dot priority-dot-low" title="Prioridade Baixa"></div>',
                    medium: '<div class="priority-dot priority-dot-medium" title="Prioridade Média"></div>',
                    high: '<div class="priority-dot priority-dot-high" title="Prioridade Alta"></div>',
                };

                const dueDateText = task.dueDate 
                    ? `<div title="Vencimento"><i class="fas fa-calendar-alt"></i> ${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</div>`
                    : '';

                item.innerHTML = `
                    <input type="checkbox" class="checklist-item-checkbox" ${task.completed ? 'checked' : ''} aria-labelledby="title-${task.id}">
                    <div class="checklist-item-content">
                        <span class="checklist-item-title" id="title-${task.id}">${task.title}</span>
                        <div class="checklist-item-details">
                            <div class="checklist-item-priority">${priorityDots[task.priority]}</div>
                            ${dueDateText}
                        </div>
                    </div>
                    <div class="checklist-item-actions">
                        <button class="action-btn edit" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                `;

                item.querySelector('.checklist-item-checkbox')?.addEventListener('change', () => toggleTaskCompletion(task.id));
                item.querySelector('.edit')?.addEventListener('click', () => openTaskModal(task));
                item.querySelector('.delete')?.addEventListener('click', () => deleteTask(task.id));

                categoryGroup.appendChild(item);
            });
            checklistContainer.appendChild(categoryGroup);
        }
    }

    function updatePaginationControls(filteredCount: number, totalPages: number) {
        if (!paginationInfo || !currentPageEl || !totalPagesEl || !prevPageBtn || !nextPageBtn) return;
        const startItem = filteredCount > 0 ? (currentPage - 1) * tasksPerPage + 1 : 0;
        const endItem = Math.min(currentPage * tasksPerPage, filteredCount);

        paginationInfo.innerHTML = `Mostrando ${startItem}-${endItem} de ${filteredCount}`;
        currentPageEl.textContent = currentPage.toString();
        totalPagesEl.textContent = totalPages > 0 ? totalPages.toString() : "1";

        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    function updateCounts() {
        if (!totalCountEl || !completedCountEl || !pendingCountEl) return;
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        totalCountEl.textContent = total.toString();
        completedCountEl.textContent = completed.toString();
        pendingCountEl.textContent = (total - completed).toString();
    }

    function toggleTaskCompletion(taskId: string) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderAll();
        }
    }

    function deleteTask(taskId: string) {
        if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
            tasks = tasks.filter(t => t.id !== taskId);
            saveTasks();
            renderAll();
            window.showToast('Tarefa excluída!', 'info');
        }
    }

    function openTaskModal(task: Task | null = null) {
        if (!modal || !modalTitle || !taskForm) return;
        editingTaskId = task ? task.id : null;
        modalTitle.textContent = task ? 'Editar Tarefa' : 'Adicionar Tarefa';
    
        const categoryDropdown = document.getElementById('modal-task-category') as HTMLSelectElement;
        if (categoryDropdown) {
            categoryDropdown.innerHTML = '<option value="">Nenhuma</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                categoryDropdown.appendChild(option);
            });
        }
    
        const titleInput = document.getElementById('modal-task-title') as HTMLInputElement;
        const descriptionInput = document.getElementById('modal-task-description') as HTMLTextAreaElement;
        const dueDateInput = document.getElementById('modal-task-due-date') as HTMLInputElement;
        const priorityInput = document.getElementById('modal-task-priority') as HTMLSelectElement;
    
        if (task) {
            if (titleInput) titleInput.value = task.title;
            if (descriptionInput) descriptionInput.value = task.description;
            if (dueDateInput) dueDateInput.value = task.dueDate;
            if (priorityInput) priorityInput.value = task.priority;
            if (categoryDropdown) categoryDropdown.value = task.category;
        } else {
            taskForm.reset();
        }
    
        addAIButtonListener('modal-task-title-ai-btn', 'modal-task-title', "Sugira um título claro e conciso para uma tarefa de gerenciamento de projetos ou pessoal.");
        addAIButtonListener('modal-task-description-ai-btn', 'modal-task-description', () => {
            const currentTitle = titleInput?.value || '';
            return `Para a tarefa com o título '${currentTitle}', sugira uma descrição detalhada, incluindo possíveis subtarefas, critérios de conclusão ou pontos de atenção.`;
        });
    
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);
    }

    function closeTaskModal() {
        if (!modal) return;
        modal.classList.remove('visible');
        setTimeout(() => { if (modal) modal.style.display = 'none'; }, 300);
    }

    function handleFormSubmit(e: Event) {
        e.preventDefault();
        if (!taskForm) return;

        const formData = new FormData(taskForm);
        const taskData: Task = {
            id: editingTaskId || `task-${Date.now()}`,
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            dueDate: formData.get('dueDate') as string,
            priority: formData.get('priority') as 'low' | 'medium' | 'high',
            category: formData.get('category') as string,
            completed: editingTaskId ? (tasks.find(t => t.id === editingTaskId)?.completed ?? false) : false
        };

        if (editingTaskId) {
            tasks = tasks.map(t => t.id === editingTaskId ? taskData : t);
            window.showToast('Tarefa atualizada com sucesso!', 'success');
        } else {
            tasks.unshift(taskData);
            window.showToast('Tarefa adicionada com sucesso!', 'success');
        }

        saveTasks();
        renderAll();
        closeTaskModal();
    }

    function handleQuickTaskAdd() {
        if (!quickTaskInput) return;
        const title = quickTaskInput.value.trim();
        if (!title) {
            window.showToast('Por favor, digite um título para a tarefa.', 'warning');
            return;
        }
        const newTask: Task = {
            id: `task-${Date.now()}`,
            title,
            description: '',
            dueDate: '',
            priority: 'medium',
            category: activeCategory !== 'all' ? activeCategory : '',
            completed: false
        };
        tasks.unshift(newTask);
        saveTasks();
        renderAll();
        quickTaskInput.value = '';
        window.showToast('Tarefa rápida adicionada!', 'success');
    }

    function handleAddCategory() {
        const newCategory = prompt('Digite o nome da nova categoria:');
        if (newCategory && newCategory.trim()) {
            const trimmedCategory = newCategory.trim();
            if (!categories.includes(trimmedCategory)) {
                categories.push(trimmedCategory);
                saveTasks();
                activeCategory = trimmedCategory;
                renderAll();
            } else {
                window.showToast('Essa categoria já existe.', 'warning');
            }
        }
    }

    function initEventListeners() {
        if (taskForm) taskForm.addEventListener('submit', handleFormSubmit);
        if (cancelBtn) cancelBtn.addEventListener('click', closeTaskModal);
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeTaskModal);
        if (modal) modal.addEventListener('click', (e) => {
            if (e.target === modal) closeTaskModal();
        });

        if (addTaskBtn) addTaskBtn.addEventListener('click', handleQuickTaskAdd);
        if (quickTaskInput) quickTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleQuickTaskAdd();
        });

        if (searchInput) searchInput.addEventListener('input', () => {
            currentSearch = searchInput.value;
            currentPage = 1;
            renderTasks();
            renderChecklist();
        });

        if (filterSelect) filterSelect.addEventListener('change', () => {
            currentFilter = filterSelect.value;
            currentPage = 1;
            renderTasks();
            renderChecklist();
        });

        if (addCategoryBtn) addCategoryBtn.addEventListener('click', handleAddCategory);

        if (prevPageBtn) prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTasks();
            }
        });

        if (nextPageBtn) nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(getFilteredTasks().length / tasksPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderTasks();
            }
        });

        if (checklistViewBtn) checklistViewBtn.addEventListener('click', () => {
            currentView = 'checklist';
            localStorage.setItem('taskView', 'checklist');
            updateView();
        });

        if (tableViewBtn) tableViewBtn.addEventListener('click', () => {
            currentView = 'table';
            localStorage.setItem('taskView', 'table');
            updateView();
        });

        addAIButtonListener('quick-task-input-ai-btn', 'quick-task-input', "Sugira um título para uma nova tarefa comum de produtividade pessoal ou profissional.");

    }

    loadTasks();
    renderAll();
    initEventListeners();
}
window.initTarefasPage = initTarefasPage;

function initInicioPage() {
    // Fix: Specify HTMLElement generic for querySelectorAll to correctly type 'card'.
    document.querySelectorAll<HTMLElement>('#page-inicio .saude-card').forEach(card => {
        card.addEventListener('click', (e: Event) => {
            
            if (card.classList.contains('video-livro')) {
                return;
            }

            e.preventDefault();

            if (card.dataset.page) {
                window.showPage(card.dataset.page);
                return;
            }

            const classMap: { [key: string]: string } = {
                'fisica': 'fisica',
                'mental': 'mental',
                'financeira': 'financeira',
                'familiar': 'familiar',
                'profissional': 'profissional',
                'social': 'social',
                'espiritual': 'espiritual',
                'preventiva': 'preventiva',
            };

            for (const className in classMap) {
                if (card.classList.contains(className)) {
                    window.showPage(classMap[className]);
                    return; 
                }
            }

            if (card.classList.contains('avaliacao-card')) {
                window.openContractModal();
                return;
            }
        });
    });
}
window.initInicioPage = initInicioPage;

function initSocialPage() {
    window.setupListManagement({ sectionKey: 'social', listId: 'social-metas-list', formId: 'social-metas-form', textInputId: 'social-meta-input', storageKey: 'socialGoals', itemType: 'goal' });
    
    const generateBtn = document.getElementById('generate-social-resources-btn') as HTMLElement;
    const loadingEl = document.getElementById('social-resources-loading') as HTMLElement;
    const outputEl = document.getElementById('social-resources-output') as HTMLElement;
    if(generateBtn && loadingEl && outputEl) {
        generateBtn.addEventListener('click', () => {
            const prompt = "Sugira artigos, vídeos e cursos online sobre como desenvolver habilidades sociais e comunicação interpessoal. Forneça um resumo dos tipos de recursos encontrados e os links diretos.";
            window.generateAndDisplayWebResources(generateBtn, loadingEl, outputEl, prompt);
        });
    }

    addAIButtonListener('social-meta-input-ai-btn', 'social-meta-input', "Sugira uma meta SMART e concisa para a Saúde Social. Exemplo: 'Iniciar uma conversa com uma pessoa nova em um evento este mês' ou 'Ligar para um amigo uma vez por semana'.");
}
window.initSocialPage = initSocialPage;

function initEspiritualPage() {
    window.setupListManagement({ sectionKey: 'espiritual', listId: 'espiritual-metas-list', formId: 'espiritual-metas-form', textInputId: 'espiritual-meta-input', storageKey: 'espiritualGoals', itemType: 'goal' });

    const generateBtn = document.getElementById('generate-spiritual-resources-btn') as HTMLElement;
    const loadingEl = document.getElementById('spiritual-resources-loading') as HTMLElement;
    const outputEl = document.getElementById('spiritual-resources-output') as HTMLElement;
    if (generateBtn && loadingEl && outputEl) {
        generateBtn.addEventListener('click', () => {
            const prompt = "Sugira livros, textos filosóficos e comunidades online (fóruns, grupos) para aprofundar a saúde espiritual e encontrar propósito. Forneça um resumo dos tipos de recursos encontrados e os links diretos.";
            window.generateAndDisplayWebResources(generateBtn, loadingEl, outputEl, prompt);
        });
    }

    const practices = [
        { id: 'gratidao', text: 'Gratidão Diária' },
        { id: 'proposito', text: 'Propósito Diário' },
        { id: 'busca', text: 'Busca do Sagrado, filosófico e correto' },
        { id: 'natureza', text: 'Conexão com a natureza' }
    ];

    const practicesListEl = document.getElementById('espiritual-praticas-list');
    if (practicesListEl) {
        const today = new Date().toISOString().split('T')[0];
        const storageKey = `espiritualPractices-${today}`;
        let completedPractices: string[] = window.loadItems(storageKey) || [];

        const renderPractices = () => {
            practicesListEl.innerHTML = '';
            if (practices.length === 0) {
                const emptyLi = document.createElement('li');
                emptyLi.textContent = 'Nenhuma prática diária definida.';
                emptyLi.className = 'empty-list-placeholder';
                practicesListEl.appendChild(emptyLi);
                return;
            }

            practices.forEach(practice => {
                const li = document.createElement('li');
                const isChecked = completedPractices.includes(practice.id);
                li.innerHTML = `
                    <label>
                        <input type="checkbox" data-id="${practice.id}" ${isChecked ? 'checked' : ''} aria-labelledby="practice-label-${practice.id}">
                        <span id="practice-label-${practice.id}">${practice.text}</span>
                    </label>
                `;
                practicesListEl.appendChild(li);
            });
        };

        practicesListEl.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.type === 'checkbox') {
                const practiceId = target.dataset.id;
                if (practiceId) {
                    if (target.checked) {
                        if (!completedPractices.includes(practiceId)) {
                            completedPractices.push(practiceId);
                        }
                    } else {
                        completedPractices = completedPractices.filter(id => id !== practiceId);
                    }
                    window.saveItems(storageKey, completedPractices);
                    window.showToast('Progresso diário salvo!', 'success');
                }
            }
        });
        
        renderPractices();
    }
    
    addAIButtonListener('espiritual-meta-input-ai-btn', 'espiritual-meta-input', "Sugira uma meta SMART e concisa para a Saúde Espiritual. Exemplo: 'Praticar 5 minutos de meditação de gratidão todas as manhãs' ou 'Ler um capítulo de um livro filosófico por semana'.");
}
window.initEspiritualPage = initEspiritualPage;

function initPreventivaPage() {
    // Sub-page navigation logic
    const mainTitle = document.getElementById('preventivaMainTitle') as HTMLElement;
    const backButton = document.getElementById('preventivaBackButton') as HTMLButtonElement;
    const mainMenu = document.getElementById('preventivaMainMenu') as HTMLElement;
    const menuItems = document.querySelectorAll('#preventivaMainMenu .menu-item');
    const preventivaPages = document.querySelectorAll('#page-preventiva .preventiva-page');

    const showSubPage = (targetId: string) => {
        const targetPage = document.getElementById(targetId) as HTMLElement;
        const targetMenuItem = document.querySelector(`.menu-item[data-target="${targetId}"]`);
        
        preventivaPages.forEach(p => (p as HTMLElement).classList.remove('active'));
        if (mainMenu) mainMenu.classList.remove('active');
        
        if (targetPage) {
            targetPage.classList.add('active');
            if(mainTitle && targetMenuItem) mainTitle.textContent = targetMenuItem.querySelector('h3')?.textContent || 'Saúde Preventiva';
            if(backButton) backButton.style.display = 'inline-flex';
        }
    };

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            if (targetId) showSubPage(targetId);
        });
    });

    if (backButton) {
        backButton.addEventListener('click', () => {
            preventivaPages.forEach(p => (p as HTMLElement).classList.remove('active'));
            if (mainMenu) mainMenu.classList.add('active');
            if (mainTitle) mainTitle.textContent = 'Saúde Preventiva';
            backButton.style.display = 'none';
        });
    }

    // Vacinas
    window.loadVaccineData();
    const vaccineRows = document.querySelectorAll<HTMLElement>('#tabela-vacinas tbody tr');
    vaccineRows.forEach(row => {
        const vaccineId = row.dataset.vaccineId;
        if (vaccineId) {
            const lastDoseInput = row.querySelector('.vaccine-last-dose') as HTMLInputElement;
            if (lastDoseInput) {
                lastDoseInput.value = vaccineData[vaccineId] || '';
                lastDoseInput.addEventListener('change', () => window.updateVaccineStatus(row as HTMLElement));
            }
            window.updateVaccineStatus(row as HTMLElement);
        }
    });

    // Indicadores e Diagnósticos
    window.loadAllIndicatorData();
    window.loadDiagnosticData();
    
    indicatorConfigsPreventiva.forEach(config => {
        const data = window.loadIndicatorData(config.id);
        window.updateIndicatorUI(config, data?.value, data?.date);

        const card = document.querySelector(`.indicator-card[data-indicator-id="${config.id}"]`);
        if (card) {
            const updateButton = card.querySelector('.update-button');
            const historyButton = card.querySelector('.history-button');
            const valueInput = card.querySelector('.indicator-value') as HTMLInputElement;
            const dateInput = card.querySelector('.indicator-date') as HTMLInputElement;

            updateButton?.addEventListener('click', () => {
                const value = parseFloat(valueInput.value);
                const date = dateInput.value;
                if (!isNaN(value) && date) {
                    window.saveIndicatorData(config.id, value, date);
                    const zone = config.zones.find(z => value >= z.min && value <= z.max);
                    const status = zone ? zone.label : "Indefinido";
                    window.logIndicatorEntry(config.id, value, date, status);
                    window.updateIndicatorUI(config, value, date);
                    window.showToast(`${config.name} atualizado com sucesso!`, 'success');
                } else {
                    window.showToast('Por favor, insira um valor e data válidos.', 'warning');
                }
            });

            historyButton?.addEventListener('click', () => {
                 window.openIndicatorChartModal(config.id);
            });
        }
    });

    document.querySelectorAll('.diagnostic-toggle').forEach(toggle => {
        const riskItem = (toggle as HTMLElement).closest('.risk-item');
        if (!riskItem) return;
        
        const diagnosticId = (riskItem as HTMLElement).dataset.diagnosticId || '';
        const detailsDiv = riskItem.querySelector('.risk-details') as HTMLElement;

        const checkbox = toggle as HTMLInputElement;
        
        const data = diagnosticData[diagnosticId];
        if (data && data.date) { 
             checkbox.checked = true;
             if (detailsDiv) detailsDiv.style.display = 'block';

             (riskItem.querySelector('.diagnostic-date') as HTMLInputElement).value = data.date;
             if(riskItem.querySelector('.diagnostic-type')) (riskItem.querySelector('.diagnostic-type') as HTMLInputElement).value = data.type || '';
             if(riskItem.querySelector('.diagnostic-severity')) (riskItem.querySelector('.diagnostic-severity') as HTMLInputElement).value = data.severity || '';
             if(riskItem.querySelector('.diagnostic-notes')) (riskItem.querySelector('.diagnostic-notes') as HTMLTextAreaElement).value = data.notes || '';
             if(riskItem.querySelector('.diagnostic-medication')) (riskItem.querySelector('.diagnostic-medication') as HTMLInputElement).value = data.medication || '';
        }

        checkbox.addEventListener('change', () => {
            if (detailsDiv) detailsDiv.style.display = checkbox.checked ? 'block' : 'none';
        });
    });

    document.getElementById('saveDiagnosticosButton')?.addEventListener('click', () => {
        document.querySelectorAll<HTMLElement>('.risk-item').forEach(item => {
            const id = item.dataset.diagnosticId;
            const toggle = item.querySelector('.diagnostic-toggle') as HTMLInputElement;
            if (id && toggle.checked) {
                diagnosticData[id] = {
                    date: (item.querySelector('.diagnostic-date') as HTMLInputElement)?.value || '',
                    type: (item.querySelector('.diagnostic-type') as HTMLInputElement)?.value || '',
                    severity: (item.querySelector('.diagnostic-severity') as HTMLInputElement)?.value || '',
                    notes: (item.querySelector('.diagnostic-notes') as HTMLTextAreaElement)?.value || '',
                    medication: (item.querySelector('.diagnostic-medication') as HTMLInputElement)?.value || '',
                };
            } else if (id) {
                delete diagnosticData[id];
            }
        });
        window.saveDiagnosticData();
        window.showToast('Diagnósticos e Riscos salvos com sucesso!', 'success');
    });

    window.updateIndicatorHistoryTable();

    window.setupListManagement({ sectionKey: 'preventiva', listId: 'preventiva-metas-list', formId: 'preventiva-metas-form', textInputId: 'preventiva-meta-input', storageKey: 'preventivaGoals', itemType: 'goal' });

    addAIButtonListener('preventiva-meta-input-ai-btn', 'preventiva-meta-input', "Sugira uma meta de saúde preventiva SMART e concisa. Exemplo: 'Agendar o check-up anual com o clínico geral até o final do próximo mês' ou 'Realizar o autoexame de mama no primeiro dia de cada mês'.");
}
window.initPreventivaPage = initPreventivaPage;

// --- Initialize Gemini AI ---
try {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }
    window.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} catch (e) {
    console.error(e);
    window.showToast("Não foi possível inicializar a IA. A chave da API não foi encontrada.", "error");
}


// --- INITIALIZATION SCRIPT ---
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize sidebar state on load
    window.toggleSidebar(true);

    // Initialize theme on load
    window.loadTheme();

    // Handle sidebar link clicks
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const pageId = (e.currentTarget as HTMLElement).dataset.page;
            if (pageId === 'avaliacao-card') {
                window.openContractModal();
            } else if (pageId) {
                await window.showPage(pageId);
            }
        });
    });

    // Handle sidebar toggle click
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => window.toggleSidebar());
    
    // Handle theme toggle click
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        window.updateThemeToggleButtonIcon(isDark);
    });

    // Handle rain sound toggle click
    document.getElementById('rain-sound-toggle')?.addEventListener('click', window.toggleRainSound);
    
    // --- Contract Modal ---
    document.getElementById('contract-modal-close-btn')?.addEventListener('click', window.closeContractModal);
    document.getElementById('contract-modal-cancel-btn')?.addEventListener('click', window.closeContractModal);
    document.getElementById('contract-modal-save-btn')?.addEventListener('click', window.saveContractData);
    document.getElementById('contract-modal-print-btn')?.addEventListener('click', window.printContract);
    const contractModal = document.getElementById('contract-modal');
    if (contractModal) {
        contractModal.addEventListener('click', (e) => {
            if (e.target === contractModal) window.closeContractModal();
        });
        addAIButtonListener('contract-commitment-ai-btn', 'contract-commitment', 'Sugira um parágrafo para um contrato de compromisso pessoal focado em autodesenvolvimento e bem-estar.');
        addAIButtonListener('contract-goals-ai-btn', 'contract-goals', 'Sugira 3 metas SMART para um contrato de compromisso pessoal, abrangendo as áreas física, mental e financeira.');
    }
    
    // --- Indicator Chart Modal ---
    document.getElementById('indicator-chart-modal-close-btn')?.addEventListener('click', window.closeIndicatorChartModal);
    document.getElementById('indicator-chart-modal-cancel-btn')?.addEventListener('click', window.closeIndicatorChartModal);
    const indicatorChartModal = document.getElementById('indicator-chart-modal');
    if(indicatorChartModal) {
         indicatorChartModal.addEventListener('click', (e) => {
            if(e.target === indicatorChartModal) window.closeIndicatorChartModal();
        });
    }

    // --- SIDEBAR SEARCH FUNCTIONALITY ---
    const searchInput = document.getElementById('sidebar-search') as HTMLInputElement;
    const sidebar = document.getElementById('sidebar-menu');
    const sidebarLinksContainer = sidebar?.querySelector('.sidebar-links');
    const noResultsMessage = sidebar?.querySelector('.sidebar-no-results') as HTMLElement;

    if (searchInput && sidebarLinksContainer && noResultsMessage && sidebar) {
        const sidebarLinks = Array.from(sidebarLinksContainer.querySelectorAll('li'));

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            let visibleLinks = 0;

            sidebarLinks.forEach(li => {
                const link = li.querySelector('a');
                if (!link) return;
                
                const textElement = link.querySelector('.sidebar-text');
                const linkText = textElement ? (textElement.textContent || '').toLowerCase() : '';
                const linkTitle = (link.getAttribute('title') || '').toLowerCase();

                if (linkText.includes(searchTerm) || linkTitle.includes(searchTerm)) {
                    (li as HTMLElement).style.display = '';
                    visibleLinks++;
                } else {
                    (li as HTMLElement).style.display = 'none';
                }
            });

            noResultsMessage.style.display = visibleLinks === 0 ? 'block' : 'none';
        });

        searchInput.addEventListener('focus', () => {
            if (sidebar.classList.contains('collapsed')) {
                window.toggleSidebar();
            }
        });
    }

    // --- Initial Page Load ---
    const pageIdFromHash = window.location.hash.substring(1);
    const validPageIds = Object.keys(pageInitializers);
    const initialPageId = pageIdFromHash && validPageIds.includes(pageIdFromHash) ? pageIdFromHash : 'inicio';
    await window.showPage(initialPageId, true);

    // --- Initialize Rain Sound ---
    if (localStorage.getItem('rainSoundPlaying') === 'true') {
        const rainAudio = document.getElementById('rain-sound') as HTMLAudioElement;
        const rainButton = document.getElementById('rain-sound-toggle');
        if (rainAudio && rainButton) {
            rainAudio.play().then(() => {
                rainButton.innerHTML = '<i class="fas fa-stop-circle"></i>';
                rainButton.setAttribute('aria-label', 'Desativar som de chuva');
            }).catch(e => {
                console.log("Autoplay was prevented by the browser. User must click to start rain sound.");
                localStorage.setItem('rainSoundPlaying', 'false'); // Reset state
            });
        }
    }
});