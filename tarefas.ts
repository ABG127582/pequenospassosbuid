import DOMPurify from 'dompurify';

// --- TYPE DEFINITIONS specific to this module ---
interface Task {
    id: string;
    title: string;
    description: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    category: string;
    completed: boolean;
}

// Re-declare the global window interface
declare global {
    interface Window {
        showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
        saveItems: (storageKey: string, items: any) => void;
        loadItems: (storageKey: string) => any;
        getAISuggestionForInput: (prompt: string, targetInput: HTMLInputElement | HTMLTextAreaElement, button: HTMLButtonElement) => Promise<void>;
        Chart: any;
    }
}

// --- Module-scoped state and elements ---
let tasks: Task[] = [];
let categories: string[] = [];
let editingTaskId: string | null = null;
let currentFilter = 'all';
let currentSearch = '';
let currentCategoryFilter = 'all';
let currentPage = 1;
const tasksPerPage = 10;
let currentView = 'checklist'; // 'checklist' or 'table'
let categoryChart: any = null;

const priorityMap: { [key in 'low' | 'medium' | 'high']: string } = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta'
};

const elements: { [key: string]: HTMLElement | null | any } = {
    container: null,
    checklistViewContainer: null,
    tableViewContainer: null,
    taskListBody: null,
    emptyStateMessage: null,
    addCategoryBtn: null,
    categoriesList: null,
    searchInput: null,
    filterSelect: null,
    checklistViewBtn: null,
    tableViewBtn: null,
    quickTaskInput: null,
    addTaskBtn: null,
    quickTaskAIBtn: null,
    totalCountEl: null,
    completedCountEl: null,
    pendingCountEl: null,
    pageInfoEl: null,
    currentPageEl: null,
    totalPagesEl: null,
    prevPageBtn: null,
    nextPageBtn: null,
    taskModal: null,
    taskModalTitle: null,
    taskModalForm: null,
    taskModalCloseBtn: null,
    taskModalCancelBtn: null,
    modalTitleInput: null,
    modalDescriptionInput: null,
    modalDueDateInput: null,
    modalPrioritySelect: null,
    modalCategorySelect: null,
    modalTitleAIBtn: null,
    modalDescriptionAIBtn: null,
    categoryChartCanvas: null,
    chartNoData: null,
};


// --- Helper Functions ---
const saveData = () => {
    window.saveItems('tasksData', tasks);
    window.saveItems('tasksCategories', categories);
};

const loadData = () => {
    tasks = window.loadItems('tasksData') || [];
    categories = window.loadItems('tasksCategories') || ['Física', 'Mental', 'Financeira', 'Familiar', 'Profissional', 'Social', 'Espiritual', 'Preventiva'];
};

const openTaskModal = (task?: Task) => {
    if (!elements.taskModal || !elements.taskModalForm || !elements.taskModalTitle || !elements.modalCategorySelect) return;
    elements.taskModalForm.reset();
    
    elements.modalCategorySelect.innerHTML = '<option value="">Nenhuma</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        elements.modalCategorySelect.appendChild(option);
    });

    if (task) {
        editingTaskId = task.id;
        elements.taskModalTitle.textContent = 'Editar Tarefa';
        elements.modalTitleInput!.value = task.title;
        elements.modalDescriptionInput!.value = task.description;
        elements.modalDueDateInput!.value = task.dueDate;
        elements.modalPrioritySelect!.value = task.priority;
        elements.modalCategorySelect.value = task.category;
    } else {
        editingTaskId = null;
        elements.taskModalTitle.textContent = 'Adicionar Tarefa';
        elements.modalPrioritySelect!.value = 'medium';
    }
    elements.taskModal.style.display = 'flex';
    setTimeout(() => elements.taskModal?.classList.add('visible'), 10);
};

const closeTaskModal = () => {
    if (!elements.taskModal) return;
    elements.taskModal.classList.remove('visible');
    setTimeout(() => { if (elements.taskModal) elements.taskModal.style.display = 'none'; }, 300);
};

const handleTaskFormSubmit = (e: Event) => {
    e.preventDefault();
    const formData = new FormData(elements.taskModalForm!);
    const taskData: Partial<Task> = {
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        dueDate: formData.get('dueDate') as string,
        priority: formData.get('priority') as 'low' | 'medium' | 'high',
        category: formData.get('category') as string,
    };

    if (!taskData.title || taskData.title.trim() === '') {
        window.showToast('O título da tarefa é obrigatório.', 'warning');
        return;
    }

    if (editingTaskId) {
        const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
        if (taskIndex > -1) {
            tasks[taskIndex] = { ...tasks[taskIndex], ...taskData };
        }
    } else {
        const newTask: Task = {
            id: Date.now().toString(),
            completed: false,
            ...taskData
        } as Task;
        tasks.unshift(newTask);
    }
    saveData();
    render();
    closeTaskModal();
    window.showToast(`Tarefa ${editingTaskId ? 'atualizada' : 'adicionada'} com sucesso!`, 'success');
};

const updateAnalytics = () => {
    if (!elements.categoryChartCanvas || !elements.chartNoData) return;
    const Chart = window.Chart;
    if (!Chart) return;
    if (categoryChart) categoryChart.destroy();

    const categoryCounts: { [key: string]: number } = {};
    tasks.forEach(task => {
        const category = task.category || 'Sem Categoria';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    const chartLabels = Object.keys(categoryCounts);
    const chartData = Object.values(categoryCounts);

    if (tasks.length === 0 || chartLabels.length === 0 || chartData.every(d => d === 0)) {
        elements.categoryChartCanvas.style.display = 'none';
        elements.chartNoData.style.display = 'block';
        elements.chartNoData.textContent = 'Sem dados para exibir no gráfico.';
        return;
    }

    elements.categoryChartCanvas.style.display = 'block';
    elements.chartNoData.style.display = 'none';

    const ctx = elements.categoryChartCanvas.getContext('2d');
    if (!ctx) return;
    
    const baseColors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69', '#f8f9fc', '#6f42c1', '#fd7e14'];
    const backgroundColors = chartLabels.map((_, i) => baseColors[i % baseColors.length]);

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: backgroundColors,
                hoverBackgroundColor: backgroundColors.map(c => `${c}E6`),
                hoverBorderColor: "rgba(234, 236, 244, 1)",
            }],
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
                legend: { display: true, position: 'right' },
                tooltip: {
                    callbacks: {
                        label: function(context: any) {
                            let label = context.label || '';
                            if (label) label += ': ';
                            if (context.parsed !== null) {
                                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                label += `${context.raw} (${percentage}%)`;
                            }
                            return label;
                        }
                    }
                }
            },
            cutout: '80%',
        },
    });
};

const render = () => {
    const filteredTasks = getFilteredTasks();
    updateCounts();
    renderCategories();
    updatePagination(filteredTasks);
    
    const paginatedTasks = getPaginatedTasks(filteredTasks);

    if (elements.checklistViewContainer && elements.tableViewContainer) {
        if (currentView === 'checklist') {
            renderChecklistView(paginatedTasks);
            elements.checklistViewContainer.style.display = 'flex';
            elements.tableViewContainer.style.display = 'none';
        } else {
            renderTableView(paginatedTasks);
            elements.checklistViewContainer.style.display = 'none';
            elements.tableViewContainer.style.display = 'block';
        }
    }

    if (elements.emptyStateMessage) {
       elements.emptyStateMessage.style.display = filteredTasks.length === 0 ? 'block' : 'none';
    }
    
    updateAnalytics();
};

const getFilteredTasks = (): Task[] => {
    let filtered = [...tasks];
    if (currentCategoryFilter !== 'all') {
        filtered = filtered.filter(task => task.category === currentCategoryFilter);
    }
    if (currentSearch) {
        const searchLower = currentSearch.toLowerCase();
        filtered = filtered.filter(task => 
            task.title.toLowerCase().includes(searchLower) || 
            task.description.toLowerCase().includes(searchLower)
        );
    }
    const today = new Date().toISOString().split('T')[0];
    switch (currentFilter) {
        case 'pending': filtered = filtered.filter(task => !task.completed); break;
        case 'completed': filtered = filtered.filter(task => task.completed); break;
        case 'overdue': filtered = filtered.filter(task => !task.completed && task.dueDate && task.dueDate < today); break;
        case 'high': case 'medium': case 'low': filtered = filtered.filter(task => task.priority === currentFilter); break;
    }
    return filtered.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
};

const getPaginatedTasks = (filteredTasks: Task[]): Task[] => {
    const startIndex = (currentPage - 1) * tasksPerPage;
    return filteredTasks.slice(startIndex, startIndex + tasksPerPage);
};

const updateCounts = () => {
    if (!elements.totalCountEl || !elements.completedCountEl || !elements.pendingCountEl) return;
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    elements.totalCountEl.textContent = total.toString();
    elements.completedCountEl.textContent = completed.toString();
    elements.pendingCountEl.textContent = (total - completed).toString();
};

const renderCategories = () => {
    if (!elements.categoriesList || !elements.addCategoryBtn) return;
    elements.categoriesList.innerHTML = '';
    elements.categoriesList.appendChild(elements.addCategoryBtn);

    const allTag = document.createElement('button');
    allTag.className = `category-tag ${currentCategoryFilter === 'all' ? 'active' : ''}`;
    allTag.textContent = 'Todas';
    allTag.dataset.category = 'all';
    elements.categoriesList.prepend(allTag);

    categories.forEach(cat => {
        const tag = document.createElement('button');
        tag.className = `category-tag ${currentCategoryFilter === cat ? 'active' : ''}`;
        tag.textContent = cat;
        tag.dataset.category = cat;
        elements.categoriesList.appendChild(tag);
    });
};

const updatePagination = (filteredTasks: Task[]) => {
    if (!elements.pageInfoEl || !elements.currentPageEl || !elements.totalPagesEl || !elements.prevPageBtn || !elements.nextPageBtn) return;
    const totalTasks = filteredTasks.length;
    const totalPages = Math.ceil(totalTasks / tasksPerPage) || 1;

    elements.pageInfoEl.textContent = `Mostrando ${Math.min((currentPage - 1) * tasksPerPage + 1, totalTasks)}-${Math.min(currentPage * tasksPerPage, totalTasks)} de ${totalTasks}`;
    elements.currentPageEl.textContent = currentPage.toString();
    elements.totalPagesEl.textContent = totalPages.toString();

    elements.prevPageBtn.disabled = currentPage === 1;
    elements.nextPageBtn.disabled = currentPage === totalPages;
};

const renderTableView = (tasksToRender: Task[]) => {
    if (!elements.taskListBody) return;
    elements.taskListBody.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    tasksToRender.forEach(task => {
        const row = document.createElement('tr');
        row.className = task.completed ? 'completed' : '';
        row.dataset.taskId = task.id;
        const isOverdue = !task.completed && task.dueDate && task.dueDate < today;
        const dueDateText = task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data';
        const priorityText = priorityMap[task.priority] || 'Média';
        row.innerHTML = `
            <td><input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Marcar tarefa como concluída"></td>
            <td>
                <span class="task-title">${DOMPurify.sanitize(task.title)}</span>
                <span class="task-description-preview">${DOMPurify.sanitize(task.description)}</span>
            </td>
            <td style="${isOverdue ? 'color: var(--color-error); font-weight: bold;' : ''}">${dueDateText}</td>
            <td><span class="priority-tag priority-${task.priority}">${priorityText}</span></td>
            <td>${task.category ? `<span class="task-category-badge">${DOMPurify.sanitize(task.category)}</span>` : ''}</td>
            <td class="task-actions-cell">
                <button class="action-btn edit" aria-label="Editar tarefa"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" aria-label="Excluir tarefa"><i class="fas fa-trash"></i></button>
            </td>
        `;
        elements.taskListBody.appendChild(row);
    });
};

const renderChecklistView = (tasksToRender: Task[]) => {
    if (!elements.checklistViewContainer) return;
    elements.checklistViewContainer.innerHTML = '';
    
    const groupedTasks: { [key: string]: Task[] } = {};
    tasksToRender.forEach(task => {
        const category = task.category || 'Sem Categoria';
        if (!groupedTasks[category]) groupedTasks[category] = [];
        groupedTasks[category].push(task);
    });

    const orderedCategories = ['all', ...categories, 'Sem Categoria'].filter(cat => cat !== 'all');
    orderedCategories.forEach(catName => {
        if (groupedTasks[catName] && groupedTasks[catName].length > 0) {
             const groupEl = document.createElement('div');
             groupEl.className = 'checklist-category-group';
             groupEl.innerHTML = `<h3 class="checklist-category-title">${DOMPurify.sanitize(catName)}</h3>`;
             groupedTasks[catName].forEach(task => {
                const itemEl = document.createElement('div');
                itemEl.className = `checklist-item ${task.completed ? 'completed' : ''}`;
                itemEl.dataset.taskId = task.id;
                const priorityText = priorityMap[task.priority];
                const priorityDot = `<div class="priority-dot priority-dot-${task.priority}"></div> ${priorityText}`;
                const dueDateText = task.dueDate ? `<i class="fas fa-calendar-alt"></i> ${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}` : '';
                itemEl.innerHTML = `
                    <div class="checklist-item-main">
                        <input type="checkbox" class="checklist-item-checkbox task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Marcar tarefa como concluída">
                        <div class="checklist-item-content">
                            <div class="checklist-item-summary">
                                <span class="checklist-item-title">${DOMPurify.sanitize(task.title)}</span>
                                <button class="action-btn toggle-details" aria-label="Alternar detalhes" aria-expanded="false"><i class="fas fa-chevron-down"></i></button>
                            </div>
                            <div class="checklist-item-full-details">
                                <div class="details-inner-wrapper">
                                    <p class="checklist-item-description">${task.description ? DOMPurify.sanitize(task.description).replace(/\n/g, '<br>') : '<i>Sem descrição.</i>'}</p>
                                    <div class="checklist-item-meta">
                                        <div class="checklist-item-priority">${priorityDot}</div>
                                        <div class="checklist-item-date">${dueDateText}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="checklist-item-actions">
                        <button class="action-btn edit" aria-label="Editar tarefa"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" aria-label="Excluir tarefa"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                groupEl.appendChild(itemEl);
            });
            elements.checklistViewContainer.appendChild(groupEl);
        }
    });
};

const handleActionClick = (e: Event) => {
    const target = e.target as HTMLElement;
    const taskEl = target.closest('[data-task-id]') as HTMLElement;
    if (!taskEl) return;
    
    // Prioritize details toggle to avoid triggering other actions
    if (target.closest('.toggle-details') || target.closest('.checklist-item-summary')) {
        const isExpanded = taskEl.classList.toggle('details-expanded');
        const toggleButton = taskEl.querySelector('.toggle-details');
        if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', String(isExpanded));
        }
        return; 
    }

    const taskId = taskEl.dataset.taskId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (target.closest('.delete')) {
        if (confirm(`Tem certeza que deseja excluir a tarefa "${task.title}"?`)) {
            tasks = tasks.filter(t => t.id !== taskId);
            saveData();
            render();
            window.showToast('Tarefa excluída.', 'success');
        }
    } else if (target.closest('.edit')) {
        openTaskModal(task);
    } else if (target.matches('.task-checkbox, .task-checkbox *')) {
        task.completed = !task.completed;
        saveData();
        render();
    }
};

const handleQuickAdd = () => {
    const title = elements.quickTaskInput!.value.trim();
    if (title) {
        const newTask: Task = {
            id: Date.now().toString(),
            title: title,
            description: '',
            dueDate: '',
            priority: 'medium',
            category: currentCategoryFilter !== 'all' ? currentCategoryFilter : '',
            completed: false,
        };
        tasks.unshift(newTask);
        saveData();
        render();
        elements.quickTaskInput!.value = '';
        window.showToast('Tarefa rápida adicionada!', 'success');
    }
};

const handleCategoryAction = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'add-category-btn') {
        const newCategory = prompt('Digite o nome da nova categoria:');
        if (newCategory && newCategory.trim() !== '') {
            if (!categories.includes(newCategory)) {
                categories.push(newCategory);
                saveData();
                renderCategories();
                window.showToast('Categoria adicionada!', 'success');
            } else {
                window.showToast('Essa categoria já existe.', 'warning');
            }
        }
    } else if (target.classList.contains('category-tag')) {
        currentCategoryFilter = target.dataset.category || 'all';
        currentPage = 1;
        render();
    }
};

// --- Page Lifecycle Functions ---
export function setupTarefasPage() {
    const page = document.getElementById('page-tarefas');
    if (!page) {
        console.error("Tarefas page container (#page-tarefas) not found.");
        return;
    }
    elements.container = page;

    // Use page container to scope selectors, preventing conflicts
    elements.checklistViewContainer = page.querySelector('#checklist-view-container');
    elements.tableViewContainer = page.querySelector('.table-wrapper');
    elements.taskListBody = page.querySelector('#task-list');
    elements.emptyStateMessage = page.querySelector('#empty-state-message');
    elements.addCategoryBtn = page.querySelector('#add-category-btn');
    elements.categoriesList = page.querySelector('#categories-list');
    elements.searchInput = page.querySelector('#search-input');
    elements.filterSelect = page.querySelector('#filter-select');
    elements.checklistViewBtn = page.querySelector('#checklist-view-btn');
    elements.tableViewBtn = page.querySelector('#table-view-btn');
    elements.quickTaskInput = page.querySelector('#quick-task-input');
    elements.addTaskBtn = page.querySelector('#add-task-btn');
    elements.quickTaskAIBtn = page.querySelector('#quick-task-input-ai-btn');
    elements.totalCountEl = page.querySelector('#total-count');
    elements.completedCountEl = page.querySelector('#completed-count');
    elements.pendingCountEl = page.querySelector('#pending-count');
    elements.pageInfoEl = page.querySelector('.page-info');
    elements.currentPageEl = page.querySelector('#current-page');
    elements.totalPagesEl = page.querySelector('#total-pages');
    elements.prevPageBtn = page.querySelector('#prev-page-btn');
    elements.nextPageBtn = page.querySelector('#next-page-btn');
    elements.categoryChartCanvas = page.querySelector('#category-chart');
    elements.chartNoData = page.querySelector('#chart-no-data');

    // Modal elements are global, so we use document.getElementById
    elements.taskModal = document.getElementById('task-modal-gerenciar-tarefas');
    elements.taskModalTitle = document.getElementById('modal-title-tarefas');
    elements.taskModalForm = document.getElementById('task-form-gerenciar-tarefas') as HTMLFormElement;
    elements.taskModalCloseBtn = document.getElementById('task-modal-close-btn');
    elements.taskModalCancelBtn = document.getElementById('cancel-task-btn-gerenciar-tarefas');
    elements.modalTitleInput = document.getElementById('modal-task-title') as HTMLInputElement;
    elements.modalDescriptionInput = document.getElementById('modal-task-description') as HTMLTextAreaElement;
    elements.modalDueDateInput = document.getElementById('modal-task-due-date') as HTMLInputElement;
    elements.modalPrioritySelect = document.getElementById('modal-task-priority') as HTMLSelectElement;
    elements.modalCategorySelect = document.getElementById('modal-task-category') as HTMLSelectElement;
    elements.modalTitleAIBtn = document.getElementById('modal-task-title-ai-btn') as HTMLButtonElement;
    elements.modalDescriptionAIBtn = document.getElementById('modal-task-description-ai-btn') as HTMLButtonElement;
    
    // Check if any essential elements are missing
    for (const [key, value] of Object.entries(elements)) {
        if (value === null) {
            console.warn(`Tarefas page element not found for key: ${key}`);
        }
    }

    // Attach Event Listeners
    elements.addTaskBtn?.addEventListener('click', handleQuickAdd);
    elements.quickTaskInput?.addEventListener('keypress', (e: KeyboardEvent) => { if (e.key === 'Enter') handleQuickAdd(); });
    
    elements.checklistViewContainer?.addEventListener('click', handleActionClick);
    elements.taskListBody?.addEventListener('click', handleActionClick);
    
    elements.taskModalCloseBtn?.addEventListener('click', closeTaskModal);
    elements.taskModalCancelBtn?.addEventListener('click', closeTaskModal);
    elements.taskModalForm?.addEventListener('submit', handleTaskFormSubmit);
    
    elements.searchInput?.addEventListener('input', () => {
        currentSearch = elements.searchInput!.value;
        currentPage = 1;
        render();
    });

    elements.filterSelect?.addEventListener('change', () => {
        currentFilter = elements.filterSelect!.value;
        currentPage = 1;
        render();
    });
    
    elements.categoriesList?.addEventListener('click', handleCategoryAction);

    elements.prevPageBtn?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            render();
        }
    });

    elements.nextPageBtn?.addEventListener('click', () => {
        const totalPages = Math.ceil(getFilteredTasks().length / tasksPerPage) || 1;
        if (currentPage < totalPages) {
            currentPage++;
            render();
        }
    });

    elements.checklistViewBtn?.addEventListener('click', () => {
        currentView = 'checklist';
        elements.checklistViewBtn?.classList.add('active');
        elements.tableViewBtn?.classList.remove('active');
        render();
    });

    elements.tableViewBtn?.addEventListener('click', () => {
        currentView = 'table';
        elements.tableViewBtn?.classList.add('active');
        elements.checklistViewBtn?.classList.remove('active');
        render();
    });

    elements.quickTaskAIBtn?.addEventListener('click', () => {
        const prompt = "Sugira um título de tarefa conciso e acionável. Por exemplo: 'Revisar o orçamento mensal' ou 'Agendar consulta médica'.";
        window.getAISuggestionForInput(prompt, elements.quickTaskInput!, elements.quickTaskAIBtn!);
    });
    
    elements.modalTitleAIBtn?.addEventListener('click', () => {
        const prompt = "Sugira um título claro e conciso para uma tarefa, com no máximo 10 palavras.";
        window.getAISuggestionForInput(prompt, elements.modalTitleInput!, elements.modalTitleAIBtn!);
    });

    elements.modalDescriptionAIBtn?.addEventListener('click', () => {
        const currentTitle = elements.modalTitleInput!.value;
        const prompt = `Com base no título da tarefa "${currentTitle || 'uma nova tarefa'}", gere uma descrição detalhada, incluindo o objetivo principal e possíveis subtarefas ou pontos a serem considerados.`;
        window.getAISuggestionForInput(prompt, elements.modalDescriptionInput!, elements.modalDescriptionAIBtn!);
    });
}

export function showTarefasPage() {
    if (!elements.container) return;
    loadData();
    render();
}