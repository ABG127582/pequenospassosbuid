// mapa-mental.ts

const elements = {
    pageContainer: null as HTMLElement | null,
    // FIX: Initialize with null and make the type nullable to fix the type error
    // and align with the pattern used in other files in this project.
    indexLinks: null as NodeListOf<HTMLAnchorElement> | null,
};

function handleIndexLinkClick(event: MouseEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLAnchorElement;
    const anchorId = target.getAttribute('href');
    if (!anchorId) return;

    const anchorElement = document.querySelector(anchorId);
    if (anchorElement) {
        anchorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function setupMapaMentalPage() {
    elements.pageContainer = document.getElementById('page-mapa-mental');
    if (!elements.pageContainer) {
        console.warn("Mapa Mental page container (#page-mapa-mental) not found.");
        return;
    };

    elements.indexLinks = elements.pageContainer.querySelectorAll('.page-index a');
    // FIX: Add optional chaining to safely handle the now-nullable type of indexLinks.
    elements.indexLinks?.forEach(link => {
        link.addEventListener('click', handleIndexLinkClick);
    });
}

export function showMapaMentalPage() {
    // No specific actions needed on page show, but function is required for the router pattern.
    // We could scroll to the top of the page for consistency if needed.
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        // Scroll to the top of the main content area, not the window
        mainContent.scrollTop = 0;
    }
}
