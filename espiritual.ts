import DOMPurify from 'dompurify';

import { showToast, saveItems, loadItems } from './utils';

export function initEspiritualPage() {
    const practicesList = document.getElementById('espiritual-praticas-list') as HTMLUListElement;
    if (practicesList) {
        const spiritualPractices = [
            { id: 'gratidao', text: 'Praticar a gratidão (Epicurismo)' },
            { id: 'meditacao', text: 'Atenção Plena (Mindfulness)' },
            { id: 'proposito', text: 'Reflexão sobre Valores Pessoais' },
            { id: 'natureza', text: 'Busca pela Admiração (Awe) na natureza ou na arte' }
        ];

        const today = new Date().toISOString().split('T')[0];
        const storageKey = `espiritual-checklist-${today}`;
        let completedPractices = loadItems(storageKey) || {};

        const renderPractices = () => {
            practicesList.innerHTML = '';
            spiritualPractices.forEach(practice => {
                const isCompleted = !!completedPractices[practice.id];
                const li = document.createElement('li');
                li.innerHTML = `
                    <label>
                        <input type="checkbox" data-id="${practice.id}" ${isCompleted ? 'checked' : ''}>
                        <span class="${isCompleted ? 'completed' : ''}">${practice.text}</span>
                    </label>
                `;
                practicesList.appendChild(li);
            });
        };

        practicesList.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.type === 'checkbox') {
                const practiceId = target.dataset.id;
                if (practiceId) {
                    completedPractices[practiceId] = target.checked;
                    saveItems(storageKey, completedPractices);
                    
                    const span = target.nextElementSibling;
                    if (span) {
                        span.classList.toggle('completed', target.checked);
                    }
                }
            }
        });
        
        renderPractices();
    }

    const gratitudeEntry = document.getElementById('gratitude-entry') as HTMLTextAreaElement;
    const saveBtn = document.getElementById('save-gratitude-btn');
    const viewPastBtn = document.getElementById('view-past-gratitude-btn');
    const pastEntriesContainer = document.getElementById('past-gratitude-entries');

    if (gratitudeEntry && saveBtn && viewPastBtn && pastEntriesContainer) {
        const JOURNAL_PREFIX = 'gratitudeJournal-';
        const getTodayKey = () => JOURNAL_PREFIX + new Date().toISOString().split('T')[0];

        const loadTodaysEntry = () => {
            gratitudeEntry.value = loadItems(getTodayKey()) || '';
        };

        const saveEntry = () => {
            const content = gratitudeEntry.value.trim();
            saveItems(getTodayKey(), content);
            showToast('Entrada de gratidão salva!', 'success');
        };

        const renderPastEntries = () => {
            const entries = Object.keys(localStorage)
                .filter(key => key.startsWith(JOURNAL_PREFIX))
                .map(key => ({
                    date: key.replace(JOURNAL_PREFIX, ''),
                    content: loadItems(key) || ''
                }))
                .sort((a, b) => b.date.localeCompare(a.date));

            pastEntriesContainer.innerHTML = entries.length === 0
                ? '<p class="empty-list-placeholder">Nenhuma entrada anterior encontrada.</p>'
                : entries.map(entry => {
                    const entryDate = new Date(entry.date + 'T00:00:00');
                    const formattedDate = entryDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                    const sanitizedContent = DOMPurify.sanitize(entry.content).replace(/\n/g, '<br>');
                    return `
                        <div class="past-entry-item">
                            <h4>${formattedDate}</h4>
                            <p>${sanitizedContent}</p>
                        </div>`;
                }).join('');
        };

        const togglePastEntriesView = () => {
            const isVisible = pastEntriesContainer.style.display !== 'none';
            if (isVisible) {
                pastEntriesContainer.style.display = 'none';
                viewPastBtn.innerHTML = '<i class="fas fa-history"></i> Visualizar Entradas Anteriores';
            } else {
                renderPastEntries();
                pastEntriesContainer.style.display = 'block';
                viewPastBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar Entradas';
            }
        };

        saveBtn.addEventListener('click', saveEntry);
        viewPastBtn.addEventListener('click', togglePastEntriesView);

        loadTodaysEntry();
    }
}