import DOMPurify from 'dompurify';

// Type definitions are no longer needed as Goals are removed.

// Re-declare window interface for global functions from index.tsx
declare global {
    interface Window {
        showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
        saveItems: (storageKey: string, items: any) => void;
        loadItems: (storageKey: string) => any;
        Chart: any; // Add Chart.js to global scope
    }
}

// --- VACCINE MANAGEMENT ---
const VACCINE_DATES_KEY = 'preventivaVaccineDates';

const vaccineInfo: {
    [key: string]: {
        name: string;
        scheduleType: 'booster' | 'annual' | 'series' | 'single' | 'check';
        validityYears?: number;
        pendingMonths?: number; // How early to warn
        details: string;
    }
} = {
    'tetano': { name: 'Tétano e Difteria (dT/dTpa)', scheduleType: 'booster', validityYears: 10, pendingMonths: 3, details: 'Reforço a cada 10 anos para a maioria dos adultos. Gestantes podem necessitar da dTpa a cada gestação.' },
    'hepatite-b': { name: 'Hepatite B', scheduleType: 'series', details: 'Normalmente um esquema de 3 doses. Após completo, a imunidade é geralmente vitalícia. Verifique seu status vacinal.' },
    'influenza': { name: 'Influenza (Gripe)', scheduleType: 'annual', pendingMonths: 2, details: 'Dose anual, recomendada antes do início do inverno.' },
    'triplice-viral': { name: 'Tríplice Viral (SCR)', scheduleType: 'series', details: 'Duas doses na vida para nascidos após 1960 garantem imunidade. Verifique seu cartão de vacina.' },
    'febre-amarela': { name: 'Febre Amarela', scheduleType: 'single', details: 'Dose única para a maioria das pessoas. Verifique a recomendação para sua área.' },
    'hpv': { name: 'HPV', scheduleType: 'series', details: 'Esquema de 2 ou 3 doses dependendo da idade de início. Verifique seu status vacinal.' },
    'pneumococica': { name: 'Pneumocócica', scheduleType: 'check', details: 'Recomendada para adultos 60+ ou com condições de risco. Esquema varia. Consulte um médico.' },
    'meningococica': { name: 'Meningocócica', scheduleType: 'check', details: 'Recomendada para adolescentes e adultos jovens, ou em situações de surto. Consulte um médico.' },
    'varicela': { name: 'Varicela (Catapora)', scheduleType: 'series', details: 'Esquema de 2 doses se não teve a doença. Verifique seu cartão de vacina.' },
    'hepatite-a': { name: 'Hepatite A', scheduleType: 'series', details: 'Esquema de 2 doses. Após completo, a imunidade é duradoura.' },
    'herpes-zoster': { name: 'Herpes Zóster', scheduleType: 'check', details: 'Recomendada para adultos 50+. Esquema de 2 doses da vacina recombinante. Consulte um médico.' },
    'covid-19': { name: 'COVID-19', scheduleType: 'annual', pendingMonths: 2, details: 'Reforços anuais ou semestrais podem ser recomendados, siga as diretrizes locais de saúde.' },
    'dengue': { name: 'Dengue', scheduleType: 'series', details: 'Disponível para faixas etárias específicas e em áreas endêmicas. Esquema de 2 doses. Consulte um médico.' },
};

function calculateAndDisplayVaccineStatus(vaccineId: string) {
    const mainContainer = document.getElementById('page-preventiva');
    if (!mainContainer) return;

    const row = mainContainer.querySelector(`tr[data-vaccine-id="${vaccineId}"]`);
    if (!row) return;

    const lastDoseInput = row.querySelector('.vaccine-last-dose') as HTMLInputElement;
    const nextDoseCell = row.querySelector('.vaccine-next-dose') as HTMLElement;
    const statusCell = row.querySelector('.vaccine-status') as HTMLElement;
    const infoLink = row.querySelector('.vaccine-info-link') as HTMLElement;

    const vaccineRule = vaccineInfo[vaccineId];
    if (infoLink && vaccineRule) {
        infoLink.setAttribute('data-tooltip', vaccineRule.details);
    }
    
    const savedDates = window.loadItems(VACCINE_DATES_KEY) || {};
    const lastDoseDateStr = savedDates[vaccineId];
    
    lastDoseInput.value = lastDoseDateStr || '';

    // Clear previous status
    nextDoseCell.textContent = '-';
    statusCell.textContent = '';
    statusCell.className = 'vaccine-status';

    if (!lastDoseDateStr) {
        statusCell.textContent = 'Verificar';
        statusCell.classList.add('status-check');
        return;
    }
    
    if (!vaccineRule) return;


    const lastDoseDate = new Date(lastDoseDateStr + 'T00:00:00');
    let nextDueDate: Date | null = null;
    let statusText = '';
    let statusClass = '';

    switch (vaccineRule.scheduleType) {
        case 'booster':
            if (vaccineRule.validityYears) {
                nextDueDate = new Date(lastDoseDate);
                nextDueDate.setFullYear(nextDueDate.getFullYear() + vaccineRule.validityYears);
            }
            break;
        case 'annual':
            nextDueDate = new Date(lastDoseDate);
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
            break;
        case 'series':
            statusText = 'Verificar esquema';
            statusClass = 'status-partial';
            break;
        case 'single':
            statusText = 'Dose única';
            statusClass = 'status-ok';
            break;
        case 'check':
            statusText = 'Consultar médico';
            statusClass = 'status-check';
            break;
    }

    if (nextDueDate) {
        nextDoseCell.textContent = nextDueDate.toLocaleDateString('pt-BR');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const timeDiff = nextDueDate.getTime() - today.getTime();
        const daysUntilDue = Math.ceil(timeDiff / (1000 * 3600 * 24));
        const pendingDays = (vaccineRule.pendingMonths || 1) * 30;

        if (daysUntilDue < 0) {
            statusText = 'Vencida';
            statusClass = 'status-overdue';
        } else if (daysUntilDue <= pendingDays) {
            statusText = 'Vence em breve';
            statusClass = 'status-pending';
        } else {
            statusText = 'Em dia';
            statusClass = 'status-ok';
        }
    }

    statusCell.textContent = statusText;
    if (statusClass) {
        statusCell.classList.add(statusClass);
    }
}

function loadAndDisplayAllVaccines() {
    Object.keys(vaccineInfo).forEach(calculateAndDisplayVaccineStatus);
}

function handleVaccineDateChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains('vaccine-last-dose')) return;
    
    const row = target.closest('tr');
    if (!row || !row.dataset.vaccineId) return;

    const vaccineId = row.dataset.vaccineId;
    const savedDates = window.loadItems(VACCINE_DATES_KEY) || {};
    savedDates[vaccineId] = target.value;
    window.saveItems(VACCINE_DATES_KEY, savedDates);

    calculateAndDisplayVaccineStatus(vaccineId);
}


// --- Module-scoped variables ---
const indicatorConfig: { [key: string]: any } = {
    'glicemia': { name: 'Glicemia em Jejum', unit: 'mg/dL', min: 50, max: 150, zones: [{ to: 69, color: '#f6c23e', status: 'Atenção', tip: 'Hipoglicemia' }, { to: 99, color: '#1cc88a', status: 'Normal', tip: 'Normal' }, { to: 125, color: '#f6c23e', status: 'Atenção', tip: 'Pré-Diabetes' }, { to: 150, color: '#e74a3b', status: 'Alerta', tip: 'Diabetes' }] },
    'hdl': { name: 'HDL Colesterol', unit: 'mg/dL', min: 20, max: 100, reversed: true, zones: [{ to: 39, color: '#e74a3b', status: 'Alerta', tip: 'Baixo' }, { to: 59, color: '#f6c23e', status: 'Atenção', tip: 'Normal' }, { to: 100, color: '#1cc88a', status: 'Ótimo', tip: 'Ótimo' }] },
    'ldl': { name: 'LDL Colesterol', unit: 'mg/dL', min: 50, max: 200, zones: [{ to: 99, color: '#1cc88a', status: 'Ótimo', tip: 'Ótimo' }, { to: 129, color: '#f6c23e', status: 'Atenção', tip: 'Normal' }, { to: 159, color: '#fd7e14', status: 'Alerta', tip: 'Elevado' }, { to: 200, color: '#e74a3b', status: 'Alerta', tip: 'Muito Elevado' }] },
    'colesterol': { name: 'Colesterol Total', unit: 'mg/dL', min: 100, max: 300, zones: [{ to: 199, color: '#1cc88a', status: 'Ótimo', tip: 'Ótimo' }, { to: 239, color: '#f6c23e', status: 'Atenção', tip: 'Limítrofe' }, { to: 300, color: '#e74a3b', status: 'Alerta', tip: 'Elevado' }] },
    'triglicerideos': { name: 'Triglicerídeos', unit: 'mg/dL', min: 50, max: 500, zones: [{ to: 149, color: '#1cc88a', status: 'Ótimo', tip: 'Ótimo' }, { to: 199, color: '#f6c23e', status: 'Atenção', tip: 'Limítrofe' }, { to: 499, color: '#fd7e14', status: 'Alerta', tip: 'Elevado' }, { to: 500, color: '#e74a3b', status: 'Alerta', tip: 'Muito Elevado' }] },
    'vitd': { name: 'Vitamina D', unit: 'ng/mL', min: 10, max: 100, zones: [{ to: 19, color: '#e74a3b', status: 'Alerta', tip: 'Deficiência' }, { to: 29, color: '#f6c23e', status: 'Atenção', tip: 'Insuficiência' }, { to: 60, color: '#1cc88a', status: 'Ótimo', tip: 'Normal' }, { to: 100, color: '#f6c23e', status: 'Atenção', tip: 'Elevado' }] },
    'tsh': { name: 'TSH', unit: 'µUI/mL', min: 0.1, max: 10, zones: [{ to: 0.39, color: '#f6c23e', status: 'Atenção', tip: 'Baixo' }, { to: 4.0, color: '#1cc88a', status: 'Normal', tip: 'Normal' }, { to: 10, color: '#f6c23e', status: 'Atenção', tip: 'Elevado' }] },
    'creatinina': { name: 'Creatinina', unit: 'mg/dL', min: 0.4, max: 1.5, zones: [{ to: 0.59, color: '#f6c23e', status: 'Atenção', tip: 'Baixo' }, { to: 1.2, color: '#1cc88a', status: 'Normal', tip: 'Normal' }, { to: 1.5, color: '#f6c23e', status: 'Atenção', tip: 'Elevado' }] },
    'acidourico': { name: 'Ácido Úrico', unit: 'mg/dL', min: 2, max: 10, zones: [{ to: 2.4, color: '#f6c23e', status: 'Atenção', tip: 'Baixo' }, { to: 6.0, color: '#1cc88a', status: 'Normal', tip: 'Normal' }, { to: 10, color: '#e74a3b', status: 'Alerta', tip: 'Elevado' }] },
    'pcr': { name: 'PCR Ultrassensível', unit: 'mg/L', min: 0, max: 10, zones: [{ to: 0.9, color: '#1cc88a', status: 'Normal', tip: 'Risco Baixo' }, { to: 2.9, color: '#f6c23e', status: 'Atenção', tip: 'Risco Médio' }, { to: 10, color: '#e74a3b', status: 'Alerta', tip: 'Risco Alto' }] },
    'ferritina': { name: 'Ferritina', unit: 'ng/mL', min: 10, max: 400, zones: [{ to: 49, color: '#f6c23e', status: 'Atenção', tip: 'Baixo' }, { to: 150, color: '#1cc88a', status: 'Normal', tip: 'Normal' }, { to: 400, color: '#f6c23e', status: 'Atenção', tip: 'Elevado' }] },
    'b12': { name: 'Vitamina B12', unit: 'pg/mL', min: 100, max: 1000, zones: [{ to: 399, color: '#f6c23e', status: 'Atenção', tip: 'Baixo' }, { to: 900, color: '#1cc88a', status: 'Normal', tip: 'Normal' }, { to: 1000, color: '#f6c23e', status: 'Atenção', tip: 'Elevado' }] },
    'gordura_bio': { name: 'Gordura Corporal', unit: '%', min: 5, max: 50, zones: [{ to: 9, color: '#1cc88a', status: 'Ótimo', tip: 'Atleta' }, { to: 20, color: '#1cc88a', status: 'Normal', tip: 'Saudável' }, { to: 25, color: '#f6c23e', status: 'Atenção', tip: 'Levemente Elevado' }, { to: 50, color: '#e74a3b', status: 'Alerta', tip: 'Elevado' }] },
    'massamagra_bio': { name: 'Massa Magra', unit: 'kg', min: 30, max: 90, reversed: true, zones: [{ to: 49, color: '#e74a3b', status: 'Alerta', tip: 'Baixa' }, { to: 80, color: '#1cc88a', status: 'Normal', tip: 'Normal' }, { to: 90, color: '#1cc88a', status: 'Ótimo', tip: 'Elevada' }] },
};

let indicatorChartInstance: any = null; // Chart.js instance

// --- Helper Functions ---
const getInterpretation = (value: number, zones: any[], reversed: boolean = false) => {
    if (value === null || isNaN(value)) return { status: 'N/A', suggestion: 'Insira um valor.', color: '#ccc' };
    
    const sortedZones = reversed ? [...zones].reverse() : zones;
    for (const zone of sortedZones) {
        if (reversed ? value >= zone.to : value <= zone.to) {
            return { status: zone.status, suggestion: zone.tip, color: zone.color };
        }
    }
    const lastZone = sortedZones[sortedZones.length - 1];
    return { status: lastZone.status, suggestion: lastZone.tip, color: lastZone.color };
};

const renderIndicatorCard = (indicatorId: string) => {
    const mainContainer = document.getElementById('page-preventiva');
    const card = mainContainer?.querySelector(`.indicator-card[data-indicator-id="${indicatorId}"]`) as HTMLElement;
    if (!card) return;

    const config = indicatorConfig[indicatorId];
    const data = window.loadItems(`preventiva-indicator-${indicatorId}`) || { value: null, date: '' };
    const interpretationEl = card.querySelector('.interpretation') as HTMLElement;
    const suggestionEl = card.querySelector('.suggestion') as HTMLElement;
    const marker = card.querySelector('.marker') as HTMLElement;
    const bar = card.querySelector('.indicator-bar') as HTMLElement;

    const { status, suggestion } = getInterpretation(data.value, config.zones, config.reversed);
    
    if (interpretationEl) interpretationEl.textContent = status;
    if (suggestionEl) suggestionEl.textContent = suggestion;
    if (interpretationEl) interpretationEl.className = `interpretation status-${status.toLowerCase().replace(' ', '-')}`;

    if (data.value !== null && !isNaN(data.value)) {
        const percentage = Math.max(0, Math.min(100, ((data.value - config.min) / (config.max - config.min)) * 100));
        if (marker) marker.style.left = `${percentage}%`;
    } else {
         if (marker) marker.style.left = `-100%`;
    }
    
    if (bar) {
        bar.innerHTML = ''; // Clear previous zones
        let lastPosition = config.min;
        config.zones.forEach((zone: any) => {
            const zoneEl = document.createElement('div');
            zoneEl.className = 'indicator-zone';
            zoneEl.style.backgroundColor = zone.color;
            const width = ((zone.to - lastPosition) / (config.max - config.min)) * 100;
            zoneEl.style.width = `${width}%`;
            zoneEl.dataset.tooltip = `${zone.tip} (${lastPosition} - ${zone.to})`;
            bar.appendChild(zoneEl);
            lastPosition = zone.to;
        });
    }
};

const updateIndicator = (indicatorId: string) => {
    const mainContainer = document.getElementById('page-preventiva');
    const card = mainContainer?.querySelector(`.indicator-card[data-indicator-id="${indicatorId}"]`) as HTMLElement;
    if (!card) return;
    
    const valueInput = card.querySelector('.indicator-value') as HTMLInputElement;
    const dateInput = card.querySelector('.indicator-date') as HTMLInputElement;
    const value = parseFloat(valueInput.value);
    const date = dateInput.value;

    if (isNaN(value) || !date) {
        window.showToast('Por favor, insira um valor e uma data válidos.', 'warning');
        return;
    }

    const data = { value, date };
    window.saveItems(`preventiva-indicator-${indicatorId}`, data);
    
    const history = window.loadItems(`preventiva-indicator-history-${indicatorId}`) || [];
    history.push(data);
    window.saveItems(`preventiva-indicator-history-${indicatorId}`, history);
    
    window.showToast(`${indicatorConfig[indicatorId].name} atualizado com sucesso!`, 'success');
    renderIndicatorCard(indicatorId);
};

const showIndicatorChart = (indicatorId: string) => {
    // Note: Modal elements are in index.html, so we query the global document
    const modal = document.getElementById('indicator-chart-modal');
    const canvas = document.getElementById('indicator-chart-canvas') as HTMLCanvasElement;
    const noDataEl = document.getElementById('indicator-chart-no-data');
    const modalTitle = document.getElementById('indicator-chart-modal-title');
    if (!modal || !canvas || !noDataEl || !modalTitle) return;

    const config = indicatorConfig[indicatorId];
    const history = (window.loadItems(`preventiva-indicator-history-${indicatorId}`) || []).sort((a:any, b:any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    modalTitle.textContent = `Histórico de ${config.name}`;

    if (history.length < 2) {
        canvas.style.display = 'none';
        if(noDataEl) noDataEl.style.display = 'block';
        if(noDataEl) noDataEl.textContent = 'São necessários pelo menos 2 registros para exibir um gráfico.';
    } else {
        canvas.style.display = 'block';
        if(noDataEl) noDataEl.style.display = 'none';

        const labels = history.map((entry: any) => new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR'));
        const data = history.map((entry: any) => entry.value);

        if (indicatorChartInstance) {
            indicatorChartInstance.destroy();
        }

        const Chart = window.Chart;
        if (!Chart) {
            console.error('Chart.js not loaded');
            return;
        }

        const ctx = canvas.getContext('2d');
        if(!ctx) return;
        indicatorChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: config.name,
                    data: data,
                    borderColor: 'var(--color-preventiva)',
                    backgroundColor: 'rgba(var(--color-preventiva-rgb), 0.1)',
                    tension: 0.1,
                    fill: true,
                }]
            },
            options: {
                 scales: { y: { beginAtZero: false } },
                 plugins: { legend: { display: false } }
            }
        });
    }

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10);
};

const renderHistoryPage = () => {
    const historicoTableBody = document.getElementById('historicoIndicadoresBody');
    if (!historicoTableBody) return;

    let allHistory: (any & { indicatorId: string; indicatorName: string })[] = [];

    Object.keys(indicatorConfig).forEach(indicatorId => {
        const history = window.loadItems(`preventiva-indicator-history-${indicatorId}`) || [];
        const indicatorName = indicatorConfig[indicatorId].name;
        history.forEach((entry: any) => {
            allHistory.push({ ...entry, indicatorId, indicatorName });
        });
    });

    allHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    historicoTableBody.innerHTML = '';
    if (allHistory.length === 0) {
        historicoTableBody.innerHTML = '<tr><td colspan="5" class="empty-list-placeholder">Nenhum histórico de biomarcadores encontrado.</td></tr>';
        return;
    }

    allHistory.slice(0, 50).forEach(entry => { // Limit to 50 entries
        const config = indicatorConfig[entry.indicatorId];
        const { status } = getInterpretation(entry.value, config.zones, config.reversed);
        const formattedDate = new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR');
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${DOMPurify.sanitize(entry.indicatorName)}</td>
            <td>${formattedDate}</td>
            <td>${entry.value} ${config.unit || ''}</td>
            <td><span class="interpretation status-${status.toLowerCase().replace(/\s/g, '-')}">${status}</span></td>
            <td>
                <button class="history-chart-btn standard-button-secondary small-button" data-indicator-id="${entry.indicatorId}" title="Ver Gráfico">
                    <i class="fas fa-chart-line"></i>
                </button>
            </td>
        `;
        historicoTableBody.appendChild(row);
    });
};

const showPreventivaPageUI = (targetId: string, mainContainer: HTMLElement) => {
    const mainMenu = mainContainer.querySelector('#preventivaMainMenu');
    const subPages = mainContainer.querySelectorAll<HTMLElement>('.preventiva-page:not(#preventivaMainMenu)');
    const backButton = mainContainer.querySelector<HTMLElement>('#preventivaBackButton');
    const mainTitle = mainContainer.querySelector('#preventivaMainTitle');
    
    mainMenu?.classList.remove('active');
    subPages.forEach(p => p.classList.remove('active'));
    
    const targetPage = mainContainer.querySelector(`#${targetId}`) as HTMLElement;
    if(targetPage) {
        targetPage.classList.add('active');
        if(backButton) backButton.style.display = 'block';
        if (mainTitle && targetPage.querySelector('h2.section-title')) {
            mainTitle.textContent = targetPage.querySelector('h2.section-title')!.textContent;
        }
        if (targetId === 'preventivaVacinas') {
            loadAndDisplayAllVaccines();
        }
        if (targetId === 'preventivaHistorico') {
            renderHistoryPage();
        }
    }
};

// --- Page Lifecycle Functions ---

export function setupPreventivaPage() {
    const mainContainer = document.getElementById('page-preventiva');
    if (!mainContainer) return;

    const mainMenu = mainContainer.querySelector('#preventivaMainMenu');
    const backButton = mainContainer.querySelector<HTMLElement>('#preventivaBackButton');
    const mainTitle = mainContainer.querySelector('#preventivaMainTitle');
    const indicatorGrid = mainContainer.querySelector('#preventivaExames');
    const historicoTable = mainContainer.querySelector('#tabela-historico-indicadores');
    const vacinasTable = mainContainer.querySelector('#tabela-vacinas');
    
    const closeChartModalBtn = document.getElementById('indicator-chart-modal-close-btn');
    const cancelChartModalBtn = document.getElementById('indicator-chart-modal-cancel-btn');
    const chartModal = document.getElementById('indicator-chart-modal');

    mainMenu?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const menuItem = target.closest<HTMLElement>('.menu-item');
        if (menuItem && menuItem.dataset.target) {
            showPreventivaPageUI(menuItem.dataset.target, mainContainer);
        }
    });

    backButton?.addEventListener('click', () => {
        const subPages = mainContainer.querySelectorAll<HTMLElement>('.preventiva-page:not(#preventivaMainMenu)');
        subPages.forEach(p => p.classList.remove('active'));
        if (mainMenu) mainMenu.classList.add('active');
        if (backButton) backButton.style.display = 'none';
        if (mainTitle) mainTitle.textContent = 'Saúde Preventiva';
    });

    indicatorGrid?.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const card = target.closest('.indicator-card') as HTMLElement;
        if (!card || !card.dataset.indicatorId) return;
        const indicatorId = card.dataset.indicatorId;

        if (target.closest('.update-button')) {
            updateIndicator(indicatorId);
        }
        if (target.closest('.history-button')) {
            showIndicatorChart(indicatorId);
        }
    });

    historicoTable?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const chartButton = target.closest('.history-chart-btn');
        if (chartButton && (chartButton as HTMLElement).dataset.indicatorId) {
            showIndicatorChart((chartButton as HTMLElement).dataset.indicatorId);
        }
    });

    vacinasTable?.addEventListener('change', handleVaccineDateChange);

    const closeChartModal = () => {
        if (chartModal) {
            chartModal.classList.remove('visible');
            setTimeout(() => { if (chartModal) chartModal.style.display = 'none'; }, 300);
        }
    };
    closeChartModalBtn?.addEventListener('click', closeChartModal);
    cancelChartModalBtn?.addEventListener('click', closeChartModal);
}

export function showPreventivaPage() {
    const mainContainer = document.getElementById('page-preventiva');
    if (!mainContainer) return;
    
    Object.keys(indicatorConfig).forEach(renderIndicatorCard);

    const mainMenu = mainContainer.querySelector('#preventivaMainMenu');
    const subPages = mainContainer.querySelectorAll<HTMLElement>('.preventiva-page:not(#preventivaMainMenu)');
    const backButton = mainContainer.querySelector<HTMLElement>('#preventivaBackButton');
    const mainTitle = mainContainer.querySelector('#preventivaMainTitle');
    
    subPages.forEach(p => p.classList.remove('active'));
    if (mainMenu) mainMenu.classList.add('active');
    if (backButton) backButton.style.display = 'none';
    if (mainTitle) mainTitle.textContent = 'Saúde Preventiva';
}