// inicio.ts
// This file contains the logic for the "Início" (Home) page.

/**
 * Sets up event listeners for the home page.
 * The home page is currently composed of static cards (links),
 * so no specific JavaScript setup is needed at this time.
 * This function is included to maintain the application's modular pattern.
 */
export function setupInicioPage(): void {
    const page = document.getElementById('page-inicio');
    if (!page) {
        // This might happen briefly during page transitions, so a console.warn is sufficient.
        console.warn("Home page container (#page-inicio) not found during setup.");
        return;
    }
    // No interactive elements requiring setup beyond standard anchor tags.
}

/**
 * This function is called by the router when the home page is shown.
 * Currently, there is no dynamic content to refresh on this page.
 */
export function showInicioPage(): void {
    // The home page is static, so no specific actions are needed on show.
    // The router handles scrolling to the top of the main content area.
}
