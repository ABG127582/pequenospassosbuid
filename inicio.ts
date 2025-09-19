// inicio.ts
// This file contains the logic for the "Início" (Home) page.

/**
 * Sets up event listeners for the home page cards to make them clickable.
 */
export function setupInicioPage(): void {
    const page = document.getElementById('page-inicio');
    if (!page) {
        console.warn("Home page container (#page-inicio) not found during setup.");
        return;
    }

    // Select all card buttons that have a data-page attribute
    const cards = page.querySelectorAll<HTMLElement>('.saude-card[data-page]');

    cards.forEach(card => {
        card.addEventListener('click', () => {
            const pageKey = card.dataset.page;
            if (pageKey) {
                // Use window.location.hash to trigger the router
                window.location.hash = pageKey;
            }
        });
    });
}

/**
 * This function is called by the router when the home page is shown.
 * Currently, there is no dynamic content to refresh on this page.
 */
export function showInicioPage(): void {
    // The home page is static, so no specific actions are needed on show.
}
