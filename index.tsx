// This file is the main entry point for the application.
// It handles initialization, routing, and global helper functions.

import { GoogleGenAI } from "@google/genai";
import { setupEspiritualPage, showEspiritualPage } from './espiritual';
import { setupPreventivaPage, showPreventivaPage } from './preventiva';
import { setupFisicaPage, showFisicaPage } from './fisica';
import { setupMentalPage, showMentalPage } from './mental';
import { setupFinanceiraPage, showFinanceiraPage } from './financeira';
import { setupFamiliarPage, showFamiliarPage } from './familiar';
import { setupProfissionalPage, showProfissionalPage } from './profissional';
import { setupSocialPage, showSocialPage } from './social';
import { setupAlongamentoPage, showAlongamentoPage } from './alongamento';
import { setupInicioPage, showInicioPage } from './inicio';
import DOMPurify from 'dompurify';

// Re-declare the global window interface to inform TypeScript about global functions
// that we are defining and attaching to the window object.
declare global {
    interface Window {
        showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
        saveItems: (storageKey: string, items: any) => void;
        loadItems: (storageKey: string) => any;
        getAISuggestionForInput: (prompt: string, targetInput: HTMLInputElement | HTMLTextAreaElement, button: HTMLButtonElement) => Promise<void>;
        Chart: any; // Make Chart.js globally available
    }
}

// --- Gemini AI Initialization ---
let ai: GoogleGenAI;

// --- Text-to-Speech (TTS) Reader ---
const ttsReader = {
    isSelectionMode: false,
    isSpeaking: false,
    elements: [] as HTMLElement[],
    currentIndex: 0,
    highlightedElement: null as HTMLElement | null,
    keepAliveInterval: undefined as number | undefined,
    ptBrVoice: null as SpeechSynthesisVoice | null,
    textToSpeak: null as string | null,
    speakingSessionId: null as number | null,
    settingsModal: null as HTMLElement | null,
    
    // User-configurable settings
    voiceURI: null as string | null,
    rate: 0.9,
    pitch: 1.0,
    
    openSettings() {
        if(this.settingsModal) this.settingsModal.style.display = 'flex';
    },

    closeSettings() {
        if(this.settingsModal) this.settingsModal.style.display = 'none';
    },

    init() {
        this.settingsModal = document.getElementById('tts-settings-modal');
        this.loadSettings();

        const findVoiceAndPopulateDropdown = () => {
            const voices = speechSynthesis.getVoices();
            const ptBrVoices = voices.filter(v => v.lang === 'pt-BR');
            const voiceSelect = document.getElementById('tts-voice-select') as HTMLSelectElement;

            if (!voiceSelect) return;
            const currentVal = voiceSelect.value;
            voiceSelect.innerHTML = '';

            if (ptBrVoices.length === 0) {
                voiceSelect.innerHTML = '<option value="">Nenhuma voz em Português encontrada</option>';
                this.ptBrVoice = null;
                return;
            }

            ptBrVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voiceURI;
                option.textContent = `${voice.name} (${voice.lang.replace('-', '_')})`;
                if (voice.localService) option.textContent += ' - Local';
                voiceSelect.appendChild(option);
            });
            
            // Sort voices to find the best default
            const sortedVoices = [...ptBrVoices].sort((a, b) => {
                let scoreA = 0, scoreB = 0;
                if (!a.localService) scoreA += 10;
                if (!b.localService) scoreB += 10;
                if (a.name.includes('Google')) scoreA += 5;
                if (b.name.includes('Google')) scoreB += 5;
                if (a.name.includes('Microsoft')) scoreA += 3;
                if (b.name.includes('Microsoft')) scoreB += 3;
                if (/Luciana|Felipe/i.test(a.name)) scoreA += 3;
                if (/Luciana|Felipe/i.test(b.name)) scoreB += 3;
                if (a.default) scoreA += 1;
                if (b.default) scoreB += 1;
                return scoreB - scoreA;
            });

            const bestVoice = sortedVoices[0] || null;
            const savedVoiceURI = this.voiceURI;
            const preselectedVoice = ptBrVoices.find(v => v.voiceURI === savedVoiceURI) || bestVoice;

            if (preselectedVoice) {
                this.ptBrVoice = preselectedVoice;
                this.voiceURI = preselectedVoice.voiceURI;
                voiceSelect.value = preselectedVoice.voiceURI;
            } else {
                this.ptBrVoice = bestVoice;
                 if(bestVoice) {
                    this.voiceURI = bestVoice.voiceURI;
                    voiceSelect.value = bestVoice.voiceURI;
                 }
            }
        };

        findVoiceAndPopulateDropdown();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = findVoiceAndPopulateDropdown;
        }

        const playBtn = document.getElementById('tts-play-btn');
        const stopBtn = document.getElementById('tts-stop-btn');
        playBtn?.addEventListener('click', () => this.openSettings());
        stopBtn?.addEventListener('click', () => this.stop());
        document.body.addEventListener('click', (e) => this.handleBodyClick(e), true);

        // --- Settings UI Listeners ---
        const settingsCloseBtn = document.getElementById('tts-settings-close-btn');
        const startReadingBtn = document.getElementById('tts-start-reading-btn');
        const voiceSelect = document.getElementById('tts-voice-select') as HTMLSelectElement;
        const rateSlider = document.getElementById('tts-rate-slider') as HTMLInputElement;
        const rateValue = document.getElementById('tts-rate-value') as HTMLSpanElement;
        const pitchSlider = document.getElementById('tts-pitch-slider') as HTMLInputElement;
        const pitchValue = document.getElementById('tts-pitch-value') as HTMLSpanElement;
        const testBtn = document.getElementById('tts-settings-test-btn');

        settingsCloseBtn?.addEventListener('click', () => this.closeSettings());
        startReadingBtn?.addEventListener('click', () => {
            this.closeSettings();
            this.activateSelectionMode();
        });

        voiceSelect?.addEventListener('change', () => {
            this.voiceURI = voiceSelect.value;
            this.ptBrVoice = speechSynthesis.getVoices().find(v => v.voiceURI === this.voiceURI) || this.ptBrVoice;
            this.saveSettings();
        });

        rateSlider?.addEventListener('input', () => {
            this.rate = parseFloat(rateSlider.value);
            if (rateValue) rateValue.textContent = this.rate.toFixed(1);
            this.saveSettings();
        });

        pitchSlider?.addEventListener('input', () => {
            this.pitch = parseFloat(pitchSlider.value);
            if (pitchValue) pitchValue.textContent = this.pitch.toFixed(1);
            this.saveSettings();
        });

        testBtn?.addEventListener('click', () => this.testVoice());
    },

    loadSettings() {
        const saved = window.loadItems('ttsReaderSettings');
        if (saved) {
            this.voiceURI = saved.voiceURI || null;
            this.rate = saved.rate || 0.9;
            this.pitch = saved.pitch || 1.0;
        }
        
        const rateSlider = document.getElementById('tts-rate-slider') as HTMLInputElement;
        const rateValue = document.getElementById('tts-rate-value') as HTMLSpanElement;
        const pitchSlider = document.getElementById('tts-pitch-slider') as HTMLInputElement;
        const pitchValue = document.getElementById('tts-pitch-value') as HTMLSpanElement;

        if (rateSlider) rateSlider.value = String(this.rate);
        if (rateValue) rateValue.textContent = this.rate.toFixed(1);
        if (pitchSlider) pitchSlider.value = String(this.pitch);
        if (pitchValue) pitchValue.textContent = this.pitch.toFixed(1);
    },

    saveSettings() {
        window.saveItems('ttsReaderSettings', {
            voiceURI: this.voiceURI,
            rate: this.rate,
            pitch: this.pitch,
        });
    },
    
    testVoice() {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Olá, esta é uma amostra da voz e das configurações selecionadas.");
        utterance.lang = 'pt-BR';
        if (this.ptBrVoice) utterance.voice = this.ptBrVoice;
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;
        speechSynthesis.speak(utterance);
    },

    activateSelectionMode() {
        if (this.isSpeaking) return;
        this.isSelectionMode = true;
        document.body.classList.add('tts-selection-mode');
        window.showToast("Clique em um parágrafo para começar a leitura.", 'info');
    },

    deactivateSelectionMode() {
        this.isSelectionMode = false;
        document.body.classList.remove('tts-selection-mode');
    },

    handleBodyClick(e: MouseEvent) {
        if (e.target && (e.target as HTMLElement).closest('.modal-container')) return;
        if (this.isSelectionMode || this.isSpeaking) {
            this.handleReadingStartOrJump(e);
        }
    },

    handleReadingStartOrJump(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (target.closest('#tts-play-btn, #tts-stop-btn')) return;

        if (this.isSelectionMode) {
            this.deactivateSelectionMode();
        }

        const mainContent = document.getElementById('main-content');
        const readableTarget = target.closest('p, h1, h2, h3, h4, h5, h6, li, .stretch-card h5, .stretch-card p') as HTMLElement;

        if (mainContent && readableTarget && mainContent.contains(readableTarget)) {
            e.preventDefault();
            e.stopPropagation();

            const selection = window.getSelection();
            let textToStartWith = readableTarget.innerText.trim();

            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const startNode = range.startContainer;
                const startOffset = range.startOffset;

                let globalOffset = 0;
                let foundNode = false;
                const treeWalker = document.createTreeWalker(readableTarget, NodeFilter.SHOW_TEXT);
                while (treeWalker.nextNode()) {
                    const currentNode = treeWalker.currentNode;
                    if (currentNode === startNode) {
                        globalOffset += startOffset;
                        foundNode = true;
                        break;
                    }
                    globalOffset += currentNode.textContent?.length || 0;
                }

                const fullText = readableTarget.innerText;
                
                let sentenceStart = 0;
                if (foundNode) {
                    for (let i = globalOffset - 1; i >= 0; i--) {
                        if ('.?!'.includes(fullText[i]) && (i + 1 < fullText.length && /\s/.test(fullText[i+1]))) {
                            sentenceStart = i + 2;
                            break;
                        }
                    }
                }
                textToStartWith = fullText.substring(sentenceStart).trim();
            }
            
            this.textToSpeak = textToStartWith;
            
            this.elements = Array.from(mainContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, .stretch-card h5, .stretch-card p'));
            const clickedIndex = this.elements.indexOf(readableTarget);
            if (clickedIndex !== -1) {
                this.start(clickedIndex);
            }
        }
    },

    start(startIndex: number) {
        if (this.isSpeaking) {
            speechSynthesis.cancel();
        }

        this.isSpeaking = true;
        this.currentIndex = startIndex;
        this.speakingSessionId = Date.now();
        
        const playBtn = document.getElementById('tts-play-btn');
        const stopBtn = document.getElementById('tts-stop-btn');
        if (playBtn) playBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';

        this.speakNext();
        this.startKeepAlive();
    },

    stop() {
        if (!this.isSpeaking && !this.isSelectionMode) return;
        
        this.isSpeaking = false;
        this.speakingSessionId = null;
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
        
        speechSynthesis.resume();
        speechSynthesis.cancel();
        
        this.cleanupUI();
    },

    cleanupUI() {
        this.deactivateSelectionMode();
        if (this.highlightedElement) {
            this.highlightedElement.classList.remove('tts-reading-highlight');
            this.highlightedElement = null;
        }
        
        const playBtn = document.getElementById('tts-play-btn');
        const stopBtn = document.getElementById('tts-stop-btn');
        if (playBtn) playBtn.style.display = 'block';
        if (stopBtn) stopBtn.style.display = 'none';
    },

    speakNext() {
        const sessionId = this.speakingSessionId;
        if (!this.isSpeaking || this.currentIndex >= this.elements.length || sessionId !== this.speakingSessionId) {
            this.stop();
            return;
        }

        const element = this.elements[this.currentIndex];
        let text: string;

        if (this.textToSpeak) {
            text = this.textToSpeak;
            this.textToSpeak = null;
        } else {
            text = element.innerText.trim();
        }

        if (!text) {
            this.currentIndex++;
            this.speakNext();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        if (this.ptBrVoice) {
            utterance.voice = this.ptBrVoice;
        }

        utterance.rate = this.rate;
        utterance.pitch = this.pitch;

        utterance.onstart = () => {
            if (sessionId !== this.speakingSessionId) return;
            if (this.highlightedElement) {
                this.highlightedElement.classList.remove('tts-reading-highlight');
            }
            element.classList.add('tts-reading-highlight');
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.highlightedElement = element;
        };

        utterance.onend = () => {
            if (sessionId !== this.speakingSessionId) return;
            this.currentIndex++;
            setTimeout(() => this.speakNext(), 500);
        };
        
        utterance.onerror = (event) => {
            if (sessionId !== this.speakingSessionId) return;
            if (event.error === 'interrupted') {
                return;
            }
            console.error("Speech synthesis error:", event.error);
            window.showToast("Ocorreu um erro na leitura.", "error");
            this.stop();
        };

        speechSynthesis.speak(utterance);
    },
    
    startKeepAlive() {
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = setInterval(() => {
            if (speechSynthesis.speaking) {
                speechSynthesis.resume();
            } else if (!this.isSpeaking) {
                 clearInterval(this.keepAliveInterval);
            }
        }, 10000);
    }
};


// --- Page Hierarchy for Breadcrumbs and Active State ---
const pageHierarchy: { [key: string]: { parent: string | null; title: string } } = {
    'inicio': { parent: null, title: 'Início' },
    'fisica': { parent: 'inicio', title: 'Saúde Física' },
    'leitura-guia-fisica': { parent: 'fisica', title: 'Guia de Leitura' },
    'alongamento': { parent: 'fisica', title: 'Guia de Alongamento' },
    'mental': { parent: 'inicio', title: 'Saúde Mental' },
    'leitura-guia-mental': { parent: 'mental', title: 'Guia de Leitura' },
    'financeira': { parent: 'inicio', title: 'Saúde Financeira' },
    'leitura-guia-financeira': { parent: 'financeira', title: 'Guia de Leitura' },
    'familiar': { parent: 'inicio', title: 'Saúde Familiar' },
    'leitura-guia-familiar': { parent: 'familiar', title: 'Guia de Leitura' },
    'profissional': { parent: 'inicio', title: 'Saúde Profissional' },
    'social': { parent: 'inicio', title: 'Saúde Social' },
    'espiritual': { parent: 'inicio', title: 'Saúde Espiritual' },
    'leitura-guia-espiritual': { parent: 'espiritual', title: 'Guia de Leitura' },
    'preventiva': { parent: 'inicio', title: 'Saúde Preventiva' },
    'food-gengibre': { parent: 'fisica', title: 'Gengibre' },
    'food-alho': { parent: 'fisica', title: 'Alho' },
    'food-brocolis': { parent: 'fisica', title: 'Brócolis' },
    'food-couveflor': { parent: 'fisica', title: 'Couve-flor' },
    'food-shitake': { parent: 'fisica', title: 'Shitake' },
    'food-lentilha': { parent: 'fisica', title: 'Lentilha' },
    'food-azeite': { parent: 'fisica', title: 'Azeite' },
    'food-morango': { parent: 'fisica', title: 'Morango' },
    'food-laranja': { parent: 'fisica', title: 'Laranja' },
    'food-maca': { parent: 'fisica', title: 'Maçã' },
    'food-cenoura': { parent: 'fisica', title: 'Cenoura' },
    'food-pimenta': { parent: 'fisica', title: 'Pimenta' },
    'food-ovo': { parent: 'fisica', title: 'Ovo' },
    'food-vinagremaca': { parent: 'fisica', title: 'Vinagre de Maçã' },
    'food-whey': { parent: 'fisica', title: 'Whey Protein' },
    'food-creatina': { parent: 'fisica', title: 'Creatina' },
    'food-curcuma': { parent: 'fisica', title: 'Cúrcuma' },
    'food-chaverde': { parent: 'fisica', title: 'Chá Verde' },
    'food-canela': { parent: 'fisica', title: 'Canela' },
    'food-linhaca': { parent: 'fisica', title: 'Linhaça' },
    'food-couve': { parent: 'fisica', title: 'Couve' },
    'food-rucula': { parent: 'fisica', title: 'Rúcula' },
    'food-agriao': { parent: 'fisica', title: 'Agrião' },
    'food-espinafre': { parent: 'fisica', title: 'Espinafre' },
    'food-folhasbeterraba': { parent: 'fisica', title: 'Folhas de Beterraba' },
    'food-almeirao': { parent: 'fisica', title: 'Almeirão' },
    'food-denteleao': { parent: 'fisica', title: 'Dente-de-Leão' },
};


function updateBreadcrumbs(pageKey: string) {
    const nav = document.getElementById('breadcrumb-nav');
    if (!nav) return;

    if (pageKey === 'inicio' || !pageHierarchy[pageKey]) {
        nav.innerHTML = '';
        return;
    }

    const trail: { key: string; title: string }[] = [];
    let currentKey: string | null = pageKey;

    while (currentKey && pageHierarchy[currentKey]) {
        trail.unshift({ key: currentKey, title: pageHierarchy[currentKey].title });
        currentKey = pageHierarchy[currentKey].parent;
    }
    
    const ol = document.createElement('ol');
    trail.forEach((item, index) => {
        const li = document.createElement('li');
        if (index === trail.length - 1) {
            li.textContent = item.title;
            li.setAttribute('aria-current', 'page');
            li.className = 'breadcrumb-current';
        } else {
            const a = document.createElement('a');
            a.href = `#${item.key}`;
            a.dataset.page = item.key;
            a.textContent = item.title;
            li.appendChild(a);
        }
        ol.appendChild(li);
    });

    nav.innerHTML = '';
    nav.appendChild(ol);
}

function updateActiveNav(pageKey: string) {
    const navLinks = document.querySelectorAll<HTMLElement>('.sidebar-links a');
    const navSummaries = document.querySelectorAll<HTMLElement>('.sidebar-links summary');

    navLinks.forEach(link => link.classList.remove('active'));
    navSummaries.forEach(summary => summary.classList.remove('active'));

    const activeLink = document.querySelector(`.sidebar-links a[href="#${pageKey}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
        const parentDetails = activeLink.closest('details');
        if (parentDetails) {
            const parentSummary = parentDetails.querySelector('summary');
            parentSummary?.classList.add('active');
            if (!parentDetails.open) {
                parentDetails.open = true;
            }
        }
    } else {
        const hierarchy = pageHierarchy[pageKey];
        if (hierarchy && hierarchy.parent) {
            const parentSummary = document.querySelector(`summary[data-page-parent="${hierarchy.parent}"]`) as HTMLElement;
            if (parentSummary) {
                parentSummary.classList.add('active');
                const parentDetails = parentSummary.closest('details');
                if (parentDetails && !parentDetails.open) {
                    parentDetails.open = true;
                }
            }
        }
    }
}


// --- Global Helper Functions ---

/**
 * Displays a toast notification.
 * @param message The message to display.
 * @param type The type of toast (info, success, warning, error).
 */
function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const toastContainer = document.getElementById('toast-notification-container');
    if (!toastContainer) {
        console.warn('Toast container not found.');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

/**
 * Saves items to localStorage.
 * @param storageKey The key to save under.
 * @param items The items to save.
 */
function saveItems(storageKey: string, items: any): void {
    try {
        localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (error) {
        console.error(`Error saving to localStorage with key "${storageKey}":`, error);
        showToast('Não foi possível salvar os dados.', 'error');
    }
}

/**
 * Loads items from localStorage.
 * @param storageKey The key to load from.
 * @returns The parsed items or null if not found or on error.
 */
function loadItems(storageKey: string): any {
    try {
        const items = localStorage.getItem(storageKey);
        return items ? JSON.parse(items) : null;
    } catch (error) {
        console.error(`Error loading from localStorage with key "${storageKey}":`, error);
        showToast('Não foi possível carregar os dados.', 'error');
        return null;
    }
}


/**
 * Gets an AI suggestion for an input field using the Gemini API.
 * @param prompt The prompt to send to the AI.
 * @param targetInput The input element to populate with the suggestion.
 * @param button The button that triggered the action, used for loading state.
 */
async function getAISuggestionForInput(prompt: string, targetInput: HTMLInputElement | HTMLTextAreaElement, button: HTMLButtonElement): Promise<void> {
    if (!ai) {
        showToast("AI service is not available due to configuration error.", 'error');
        return;
    }

    const originalButtonContent = button.innerHTML;
    button.classList.add('loading');
    button.disabled = true;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const suggestion = response.text;
        
        if (suggestion) {
            targetInput.value = suggestion.trim();
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            showToast('A IA não retornou uma sugestão.', 'warning');
        }
    } catch (error) {
        console.error('Error getting AI suggestion:', error);
        showToast('Ocorreu um erro ao obter a sugestão da IA.', 'error');
    } finally {
        button.innerHTML = originalButtonContent;
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// --- App Initialization & Routing ---

document.addEventListener('DOMContentLoaded', () => {
    // FIX: Refactored API key check to be inside DOMContentLoaded for clearer control flow.
    // This prevents potential race conditions and clarifies the execution path for the TypeScript compiler,
    // resolving an issue where `window` could be incorrectly inferred as type `never`.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API key is missing. Please set API_KEY in your environment variables.");
        document.body.innerHTML = '<div style="padding: 20px; text-align: center; font-family: sans-serif; color: #d93025;"><h1>Configuration Error</h1><p>The Google AI API key is not configured. Please contact support.</p></div>';
        return;
    }
    ai = new GoogleGenAI({ apiKey });

    // Make global helpers available on the window object
    window.showToast = showToast;
    window.saveItems = saveItems;
    window.loadItems = loadItems;
    window.getAISuggestionForInput = getAISuggestionForInput;
    
    const sidebar = document.getElementById('sidebar-menu');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const detailsElements = document.querySelectorAll<HTMLDetailsElement>('.sidebar-links details');
    const mainContent = document.getElementById('main-content');
    const pageContentWrapper = document.getElementById('page-content-wrapper');

    // --- Initialize TTS Reader ---
    ttsReader.init();

    // --- Sidebar State Persistence ---
    const restoreMenuState = () => {
        detailsElements.forEach(details => {
            if (details.id && localStorage.getItem(details.id) === 'open') {
                details.open = true;
            }
        });
    };

    const setupMenuStatePersistence = () => {
        detailsElements.forEach(details => {
            details.addEventListener('toggle', () => {
                if (details.id) {
                    localStorage.setItem(details.id, details.open ? 'open' : 'closed');
                }
            });
        });
    };
    
    const pageCache: { [key: string]: string } = {};

    const router = async () => {
        // Always clean up TTS reader before navigating
        ttsReader.stop();
        
        const hash = window.location.hash.substring(1);
        let pageKey = hash || 'inicio';

        // Navigate to parent page if a sub-page is not found (e.g., specific food page)
        if (!pageHierarchy[pageKey]) {
            const potentialParent = pageKey.split('-')[0];
            if (pageHierarchy[potentialParent]) {
                 pageKey = potentialParent;
            } else {
                console.warn(`Page key "${pageKey}" not found in hierarchy, defaulting to inicio.`);
                pageKey = 'inicio';
            }
        }
        
        // Handle direct food links by navigating to the main 'fisica' page but handling the content loading below
        if (pageKey.startsWith('food-')) {
            updateBreadcrumbs(pageKey);
            updateActiveNav('fisica'); // Keep 'Física' active
        } else {
             updateBreadcrumbs(pageKey);
             updateActiveNav(pageKey);
        }

        if (!pageContentWrapper) {
            console.error('#page-content-wrapper not found!');
            return;
        }

        // Show a loading indicator
        pageContentWrapper.innerHTML = '<p style="text-align:center; padding: 40px;">Carregando...</p>';
        
        try {
            let pageHtml = pageCache[pageKey];
            if (!pageHtml) {
                const response = await fetch(`${pageKey}.html`);
                if (!response.ok) {
                    throw new Error(`Page not found: ${pageKey}.html (Status: ${response.status})`);
                }
                pageHtml = await response.text();
                pageCache[pageKey] = pageHtml;
            }

            pageContentWrapper.innerHTML = DOMPurify.sanitize(pageHtml, { ADD_ATTR: ['target'] });
            
            // Call setup and show for the newly loaded page
            switch (pageKey) {
                case 'inicio': setupInicioPage(); showInicioPage(); break;
                case 'espiritual': setupEspiritualPage(); showEspiritualPage(); break;
                case 'preventiva': setupPreventivaPage(); showPreventivaPage(); break;
                case 'fisica': setupFisicaPage(); showFisicaPage(); break;
                case 'mental': setupMentalPage(); showMentalPage(); break;
                case 'financeira': setupFinanceiraPage(); showFinanceiraPage(); break;
                case 'familiar': setupFamiliarPage(); showFamiliarPage(); break;
                case 'profissional': setupProfissionalPage(); showProfissionalPage(); break;
                case 'social': setupSocialPage(); showSocialPage(); break;
                case 'alongamento': setupAlongamentoPage(); showAlongamentoPage(); break;
                default:
                    // For food pages or other sub-pages that don't have their own setup
                    if (pageKey.startsWith('food-')) {
                        // No specific setup needed for static food pages
                    }
                    break;
            }

        } catch (error) {
            console.error('Error loading page:', error);
            pageContentWrapper.innerHTML = `<div class="content-section" style="text-align: center;"><h2>Página não encontrada</h2><p>Ocorreu um erro ao carregar o conteúdo. Por favor, tente novamente.</p></div>`;
            updateBreadcrumbs('inicio');
            updateActiveNav('inicio');
        }
    };


    // Global handler for in-page navigation buttons
    document.body.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Handle direct page links from buttons or anchors inside loaded content
        const pageLink = target.closest<HTMLElement>('button[data-page], a[data-page]');
        if (pageLink && pageLink.dataset.page) {
            const pageKey = pageLink.dataset.page;
            e.preventDefault();
            window.location.hash = pageKey;
        }
    });

    window.addEventListener('hashchange', router);
    window.addEventListener('popstate', router);
    
    // --- Initial App Setup ---
    
    restoreMenuState();
    setupMenuStatePersistence();
    router(); // Handle initial page load

    sidebarToggle?.addEventListener('click', () => {
        const isCollapsed = sidebar?.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed', isCollapsed);
        sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
    });

    // When the sidebar is collapsed, clicking a category summary should navigate directly.
    const navSummaries = document.querySelectorAll<HTMLElement>('.sidebar-links summary[data-page-parent]');
    navSummaries.forEach(summary => {
        summary.addEventListener('click', (e) => {
            if (sidebar?.classList.contains('collapsed')) {
                e.preventDefault();
                const pageKey = summary.dataset.pageParent;
                if (pageKey) {
                    window.location.hash = pageKey;
                }
            }
        });
    });

    // Default sidebar state to collapsed
    sidebar?.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
    sidebarToggle?.setAttribute('aria-expanded', 'false');

    // --- Theme Toggle ---
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-toggle-icon');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (theme: 'dark' | 'light') => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark-mode');
            themeIcon?.classList.remove('fa-moon');
            themeIcon?.classList.add('fa-sun');
            themeToggle?.setAttribute('aria-label', 'Alternar para modo claro');
        } else {
            document.documentElement.classList.remove('dark-mode');
            themeIcon?.classList.remove('fa-sun');
            themeIcon?.classList.add('fa-moon');
            themeToggle?.setAttribute('aria-label', 'Alternar para modo escuro');
        }
    };

    const savedTheme = localStorage.getItem('theme');
    // Apply saved theme or system preference
    if (savedTheme === 'dark' || (!savedTheme && prefersDark.matches)) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }

    themeToggle?.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark-mode');
        if (isDark) {
            applyTheme('light');
            localStorage.setItem('theme', 'light');
        } else {
            applyTheme('dark');
            localStorage.setItem('theme', 'dark');
        }
    });

    // --- Rain Sound ---
    const rainSoundToggle = document.getElementById('rain-sound-toggle');
    const rainSound = document.getElementById('rain-sound') as HTMLAudioElement;

    rainSoundToggle?.addEventListener('click', () => {
        if (!rainSound) return;
        if (rainSound.paused) {
            rainSound.play().catch(error => console.error("Error playing sound:", error));
            rainSoundToggle.classList.add('playing');
            rainSoundToggle.setAttribute('aria-label', 'Pausar som de chuva');
        } else {
            rainSound.pause();
            rainSoundToggle.classList.remove('playing');
            rainSoundToggle.setAttribute('aria-label', 'Tocar som de chuva');
        }
    });
});