import DOMPurify from 'dompurify';

import { showToast, saveItems, loadItems } from './utils';

export function initPreventivaPage() {
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

    const mainContainer = document.getElementById('page-preventiva');
    if (!mainContainer) return;

    const mainMenu = mainContainer.querySelector('#preventivaMainMenu');
    const subPages = mainContainer.querySelectorAll<HTMLElement>('.preventiva-page:not(#preventivaMainMenu)');
    const backButton = mainContainer.querySelector<HTMLElement>('#preventivaBackButton');
    const mainTitle = mainContainer.querySelector('#preventivaMainTitle');
    
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
        const card = mainContainer.querySelector(`.indicator-card[data-indicator-id="${indicatorId}"]`) as HTMLElement;
        if (!card) return;

        const config = indicatorConfig[indicatorId];
        const data = loadItems(`preventiva-indicator-${indicatorId}`) || { value: null, date: '' };
        const interpretationEl = card.querySelector('.interpretation') as HTMLElement;
        const suggestionEl = card.querySelector('.suggestion') as HTMLElement;
        const marker = card.querySelector('.marker') as HTMLElement;
        const bar = card.querySelector('.indicator-bar') as HTMLElement;

        const { status, suggestion } = getInterpretation(data.value, config.zones, config.reversed);
        
        if (interpretationEl) interpretationEl.textContent = status;
        if (suggestionEl) suggestionEl.textContent = suggestion;
        interpretationEl.className = `interpretation status-${status.toLowerCase().replace(' ', '-')}`;

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
        const card = mainContainer.querySelector(`.indicator-card[data-indicator-id="${indicatorId}"]`) as HTMLElement;
        if (!card) return;
        
        const valueInput = card.querySelector('.indicator-value') as HTMLInputElement;
        const dateInput = card.querySelector('.indicator-date') as HTMLInputElement;
        const value = parseFloat(valueInput.value);
        const date = dateInput.value;

        if (isNaN(value) || !date) {
            showToast('Por favor, insira um valor e uma data válidos.', 'warning');
            return;
        }

        const data = { value, date };
        saveItems(`preventiva-indicator-${indicatorId}`, data);
        
        const history = loadItems(`preventiva-indicator-history-${indicatorId}`) || [];
        history.push(data);
        saveItems(`preventiva-indicator-history-${indicatorId}`, history);
        
        showToast(`${indicatorConfig[indicatorId].name} atualizado com sucesso!`, 'success');
        renderIndicatorCard(indicatorId);
    };

    let indicatorChartInstance: any = null; // Chart.js instance

    const showIndicatorChart = (indicatorId: string) => {
        const modal = document.getElementById('indicator-chart-modal');
        const canvas = document.getElementById('indicator-chart-canvas') as HTMLCanvasElement;
        const noDataEl = document.getElementById('indicator-chart-no-data');
        const modalTitle = document.getElementById('indicator-chart-modal-title');
        if (!modal || !canvas || !noDataEl || !modalTitle) return;

        const config = indicatorConfig[indicatorId];
        const history = (loadItems(`preventiva-indicator-history-${indicatorId}`) || []).sort((a:any, b:any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        modalTitle.textContent = `Histórico de ${config.name}`;

        if (history.length < 2) {
            canvas.style.display = 'none';
            noDataEl.style.display = 'block';
            noDataEl.textContent = 'São necessários pelo menos 2 registros para exibir um gráfico.';
        } else {
            canvas.style.display = 'block';
            noDataEl.style.display = 'none';

            const labels = history.map((entry: any) => new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR'));
            const data = history.map((entry: any) => entry.value);

            if (indicatorChartInstance) {
                indicatorChartInstance.destroy();
            }

            if (typeof Chart === 'undefined') {
                console.error('Chart.js not loaded');
                return;
            }

            indicatorChartInstance = new Chart(canvas.getContext('2d'), {
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
            const history = loadItems(`preventiva-indicator-history-${indicatorId}`) || [];
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
    
    const showPreventivaPage = (targetId: string) => {
        mainMenu?.classList.remove('active');
        subPages.forEach(p => p.classList.remove('active'));
        
        const targetPage = mainContainer.querySelector(`#${targetId}`) as HTMLElement;
        if(targetPage) {
            targetPage.classList.add('active');
            if(backButton) backButton.style.display = 'block';
            if (mainTitle && targetPage.querySelector('h2.section-title')) {
                mainTitle.textContent = targetPage.querySelector('h2.section-title')!.textContent;
            }
            if (targetId === 'preventivaHistorico') {
                renderHistoryPage();
            }
        }
    };

    mainMenu?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const menuItem = target.closest<HTMLElement>('.menu-item');
        if (menuItem && menuItem.dataset.target) {
            showPreventivaPage(menuItem.dataset.target);
        }
    });

    backButton?.addEventListener('click', () => {
        subPages.forEach(p => p.classList.remove('active'));
        if (mainMenu) mainMenu.classList.add('active');
        if (backButton) backButton.style.display = 'none';
        if (mainTitle) mainTitle.textContent = 'Saúde Preventiva';
    });

    const indicatorGrid = document.getElementById('preventivaExames');
    indicatorGrid?.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const card = target.closest('.indicator-card') as HTMLElement;
        if (!card) return;
        const indicatorId = card.dataset.indicatorId;

        if (target.closest('.update-button')) {
            updateIndicator(indicatorId!);
        }
        if (target.closest('.history-button')) {
            showIndicatorChart(indicatorId!);
        }
    });

    const historicoTable = document.getElementById('tabela-historico-indicadores');
    historicoTable?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const chartButton = target.closest('.history-chart-btn');
        if (chartButton && (chartButton as HTMLElement).dataset.indicatorId) {
            showIndicatorChart((chartButton as HTMLElement).dataset.indicatorId!);
        }
    });

    const closeChartModalBtn = document.getElementById('indicator-chart-modal-close-btn');
    const cancelChartModalBtn = document.getElementById('indicator-chart-modal-cancel-btn');
    const chartModal = document.getElementById('indicator-chart-modal');
    const closeChartModal = () => {
        if (chartModal) {
            chartModal.classList.remove('visible');
            setTimeout(() => { if (chartModal) chartModal.style.display = 'none'; }, 300);
        }
    }
    closeChartModalBtn?.addEventListener('click', closeChartModal);
    cancelChartModalBtn?.addEventListener('click', closeChartModal);

    Object.keys(indicatorConfig).forEach(renderIndicatorCard);
}