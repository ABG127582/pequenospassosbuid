// This file is the main entry point for the application.
// It handles initialization, routing, and global helper functions.

import { GoogleGenAI } from "@google/genai";
import { setupTarefasPage, showTarefasPage } from './tarefas';
import { setupEspiritualPage, showEspiritualPage } from './espiritual';
import { setupPreventivaPage, showPreventivaPage } from './preventiva';
import { setupPlanejamentoDiarioPage, showPlanejamentoDiarioPage } from './planejamento-diario';
import { setupFisicaPage, showFisicaPage } from './fisica';
import { setupMentalPage, showMentalPage } from './mental';
import { setupFinanceiraPage, showFinanceiraPage } from './financeira';
import { setupFamiliarPage, showFamiliarPage } from './familiar';
import { setupProfissionalPage, showProfissionalPage } from './profissional';
import { setupSocialPage, showSocialPage } from './social';
import { setupMapaMentalPage, showMapaMentalPage } from './mapa-mental';
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
const apiKey = process.env.API_KEY;
let ai: GoogleGenAI;

if (!apiKey) {
    console.error("API key is missing. Please set API_KEY in your environment variables.");
    document.addEventListener('DOMContentLoaded', () => {
        document.body.innerHTML = '<div style="padding: 20px; text-align: center; font-family: sans-serif; color: #d93025;"><h1>Configuration Error</h1><p>The Google AI API key is not configured. Please contact support.</p></div>';
    });
} else {
    ai = new GoogleGenAI({ apiKey });
}

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
    'mapa-mental': { parent: 'inicio', title: 'Mapa Mental' },
    'planejamento-diario': { parent: 'inicio', title: 'Planejamento' },
    'tarefas': { parent: 'inicio', title: 'Tarefas' },
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
            a.textContent = item.title;
            li.appendChild(a);
        }
        ol.appendChild(li);
    });

    nav.innerHTML = '';
    nav.appendChild(ol);
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
    // Make global helpers available on the window object
    window.showToast = showToast;
    window.saveItems = saveItems;
    window.loadItems = loadItems;
    window.getAISuggestionForInput = getAISuggestionForInput;
    
    const pages = document.querySelectorAll<HTMLElement>('.page-container, .page-section');
    const navLinks = document.querySelectorAll<HTMLElement>('.sidebar-links a');
    const navSummaries = document.querySelectorAll<HTMLElement>('.sidebar-links summary');
    const sidebar = document.getElementById('sidebar-menu');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const detailsElements = document.querySelectorAll<HTMLDetailsElement>('.sidebar-links details');
    const mainContent = document.getElementById('main-content');

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
    
    const router = () => {
        const hash = window.location.hash.substring(1);
        let pageKey = hash || 'inicio';
        const pageId = `page-${pageKey}`;

        if (!document.getElementById(pageId)) {
            // If a page with the given ID doesn't exist, default to the home page.
            // The specific logic for mind map anchors is now handled exclusively in 'mapa-mental.ts'
            // which prevents the hash from changing and triggers a smooth scroll,
            // so this router function will not even be called for those clicks.
            pageKey = 'inicio';
        }

        pages.forEach(page => {
            page.style.display = page.id === `page-${pageKey}` ? 'block' : 'none';
        });

        updateBreadcrumbs(pageKey);

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

        // Call the appropriate 'show' function to refresh the page content
        switch (pageKey) {
            case 'tarefas': showTarefasPage(); break;
            case 'espiritual': showEspiritualPage(); break;
            case 'planejamento-diario': showPlanejamentoDiarioPage(); break;
            case 'preventiva': showPreventivaPage(); break;
            case 'fisica': showFisicaPage(); break;
            case 'mental': showMentalPage(); break;
            case 'financeira': showFinanceiraPage(); break;
            case 'familiar': showFamiliarPage(); break;
            case 'profissional': showProfissionalPage(); break;
            case 'social': showSocialPage(); break;
            case 'mapa-mental': showMapaMentalPage(); break;
        }
    };

    // Global handler for in-page navigation buttons
    mainContent?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const pageLink = target.closest<HTMLElement>('button[data-page], a[data-page]');

        if (pageLink) {
            const pageKey = pageLink.dataset.page;
            if (pageKey) {
                e.preventDefault();
                window.location.hash = pageKey;
            }
        }
    });

    window.addEventListener('hashchange', router);
    window.addEventListener('popstate', router);
    
    // --- Initial App Setup ---
    
    // ONE-TIME SETUP of all page modules. This will attach event listeners.
    setupTarefasPage();
    setupEspiritualPage();
    setupPlanejamentoDiarioPage();
    setupPreventivaPage();
    setupFisicaPage();
    setupMentalPage();
    setupFinanceiraPage();
    setupFamiliarPage();
    setupProfissionalPage();
    setupSocialPage();
    setupMapaMentalPage();
    
    restoreMenuState();
    setupMenuStatePersistence();
    router(); // Handle initial page load

    sidebarToggle?.addEventListener('click', () => {
        const isCollapsed = sidebar?.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed', isCollapsed);
        sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
    });

    // Default sidebar state based on screen width
    if (window.innerWidth < 768) {
        sidebar?.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
    } else {
        sidebar?.classList.remove('collapsed');
        document.body.classList.remove('sidebar-collapsed');
    }
});