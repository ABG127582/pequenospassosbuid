// alongamento.ts
// This file contains the logic for the "Alongamento" (Stretching) page.

/**
 * Sets up event listeners for the stretching page.
 * This page is currently static, so this function is a placeholder
 * to maintain the application's modular structure.
 */
export function setupAlongamentoPage(): void {
    const page = document.getElementById('page-alongamento');
    if (!page) {
        console.warn("Stretching page container (#page-alongamento) not found.");
        return;
    }
    // No interactive elements to set up yet.
}

/**
 * This function is called by the router when the stretching page is shown.
 * Currently, there is no dynamic content to refresh.
 */
export function showAlongamentoPage(): void {
    // The page is static, so no specific actions are needed on show.
    // Ensure the page scrolls to the top on view.
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.scrollTop = 0;
    }
}
