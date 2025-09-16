// This file is the main entry point for the application.
// It handles initialization, routing, and global helper functions.

import { GoogleGenAI } from "@google/genai";
import { initTarefasPage } from './tarefas';
import { initEspiritualPage } from './espiritual';
import { initPreventivaPage } from './preventiva';
import { initPlanejamentoDiarioPage } from './planejamento-diario';
import DOMPurify from 'dompurify';

import { showToast, saveItems, loadItems, getAISuggestionForInput } from './utils';

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
    const mainContent = document.getElementById('main-content');
    const navLinks = document.querySelectorAll<HTMLElement>('.sidebar-links a');
    const navSummaries = document.querySelectorAll<HTMLElement>('.sidebar-links summary');
    const sidebar = document.getElementById('sidebar-menu');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const detailsElements = document.querySelectorAll<HTMLDetailsElement>('.sidebar-links details');

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
    
    const router = async () => {
        const hash = window.location.hash.substring(1);
        let pageKey = hash || 'inicio';

        // Check if the page key is valid
        if (!pageHierarchy[pageKey]) {
            pageKey = 'inicio';
        }

        if (!mainContent) {
            console.error('Main content area not found!');
            return;
        }

        try {
            const response = await fetch(`/pages/${pageKey}.html`);
            if (!response.ok) {
                throw new Error(`Page not found: ${pageKey}.html`);
            }
            const pageHtml = await response.text();
            mainContent.innerHTML = DOMPurify.sanitize(pageHtml, { ADD_TAGS: ["details", "summary"], ADD_ATTR: ['open', 'data-page', 'data-page-parent', 'data-tooltip'] });

            // Initialize any page-specific JavaScript
            if (pageKey === 'tarefas') initTarefasPage();
            else if (pageKey === 'espiritual') initEspiritualPage();
            else if (pageKey === 'planejamento-diario') initPlanejamentoDiarioPage();
            else if (pageKey === 'preventiva') initPreventivaPage();
        } catch (error) {
            console.error('Error loading page:', error);
            mainContent.innerHTML = `<div class="container"><p>Error loading page. Please try again.</p></div>`;
        }

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
    };

    window.addEventListener('popstate', router);
    
    // Initial setup
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