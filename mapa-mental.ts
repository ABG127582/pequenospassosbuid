// mapa-mental.ts

const elements = {
    pageContainer: null as HTMLElement | null,
    indexLinks: null as NodeListOf<HTMLAnchorElement> | null,
};

function handleIndexLinkClick(event: MouseEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLAnchorElement;
    const anchorId = target.getAttribute('href');
    if (!anchorId) return;

    const pageContainer = document.getElementById('page-mapa-mental');
    if (!pageContainer) return;

    const anchorElement = pageContainer.querySelector(anchorId) as HTMLElement;
    const stickyIndex = pageContainer.querySelector('.page-index') as HTMLElement;

    if (anchorElement && stickyIndex) {
        const headerOffset = stickyIndex.offsetHeight + 20; // Extra space below the sticky header

        // Calculate the anchor's position relative to the document top
        const anchorTop = anchorElement.getBoundingClientRect().top + window.scrollY;

        // Calculate the final scroll position
        const finalScrollTop = anchorTop - headerOffset;

        window.scrollTo({
            top: finalScrollTop,
            behavior: 'smooth'
        });
    } else if (anchorElement) {
        // Fallback for safety
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
    elements.indexLinks?.forEach(link => {
        link.addEventListener('click', handleIndexLinkClick);
    });
}

export function showMapaMentalPage() {
    // When the page is shown, scroll to the top of the window.
    window.scrollTo(0, 0);
}
