import { GoogleGenAI } from "@google/genai";

// --- Gemini AI Initialization ---
const apiKey = import.meta.env.VITE_API_KEY;
let ai: GoogleGenAI;

if (!apiKey) {
    console.error("API key is missing. Please set API_KEY in your environment variables.");
} else {
    ai = new GoogleGenAI({ apiKey });
}

/**
 * Displays a toast notification.
 * @param message The message to display.
 * @param type The type of toast (info, success, warning, error).
 */
export function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
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
export function saveItems(storageKey: string, items: any): void {
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
export function loadItems(storageKey: string): any {
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
export async function getAISuggestionForInput(prompt: string, targetInput: HTMLInputElement | HTMLTextAreaElement, button: HTMLButtonElement): Promise<void> {
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
