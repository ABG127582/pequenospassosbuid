import DOMPurify from 'dompurify';

// This file contains the logic for the "Tarefas" (Tasks) page.
// It was moved from index.tsx to improve code organization and maintainability.

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

import { showToast, saveItems, loadItems, getAISuggestionForInput } from './utils';


export function initTarefasPage() {
    // State variables
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

    // DOM Elements
    const elements = {
        // Main container and views
        container: document.getElementById('page-tarefas'),
        checklistViewContainer: document.getElementById('checklist-view-container') as HTMLElement,
        tableViewContainer: document.querySelector('#page-tarefas .table-wrapper') as HTMLElement,
        taskListBody: document.getElementById('task-list'),
        emptyStateMessage: document.getElementById('empty-state-message'),

        // Controls
        addCategoryBtn: document.getElementById('add-category-btn'),
        categoriesList: document.getElementById('categories-list'),
        searchInput: document.getElementById('search-input') as HTMLInputElement,
        filterSelect: document.getElementById('filter-select') as HTMLSelectElement,
        checklistViewBtn: document.getElementById('checklist-view-btn'),
        tableViewBtn: document.getElementById('table-view-btn'),

        // Quick Add
        quickTaskInput: document.getElementById('quick-task-input') as HTMLInputElement,
        addTaskBtn: document.getElementById('add-task-btn'),
        quickTaskAIBtn: document.getElementById('quick-task-input-ai-btn') as HTMLButtonElement,

        // Counts
        totalCountEl: document.getElementById('total-count'),
        completedCountEl: document.getElementById('completed-count'),
        pendingCountEl: document.getElementById('pending-count'),

        // Pagination
        pageInfoEl: document.querySelector('.pagination .page-info'),
        currentPageEl: document.getElementById('current-page'),
        totalPagesEl: document.getElementById('total-pages'),
        prevPageBtn: document.getElementById('prev-page-btn') as HTMLButtonElement,
        nextPageBtn: document.getElementById('next-page-btn') as HTMLButtonElement,

        // Modal
        taskModal: document.getElementById('task-modal-gerenciar-tarefas'),
        taskModalTitle: document.getElementById('modal-title-tarefas'),
        taskModalForm: document.getElementById('task-form-gerenciar-tarefas') as HTMLFormElement,
        taskModalCloseBtn: document.getElementById('task-modal-close-btn'),
        taskModalCancelBtn: document.getElementById('cancel-task-btn-gerenciar-tarefas'),
        modalTitleInput: document.getElementById('modal-task-title') as HTMLInputElement,
        modalDescriptionInput: document.getElementById('modal-task-description') as HTMLTextAreaElement,
        modalDueDateInput: document.getElementById('modal-task-due-date') as HTMLInputElement,
        modalPrioritySelect: document.getElementById('modal-task-priority') as HTMLSelectElement,
        modalCategorySelect: document.getElementById('modal-task-category') as HTMLSelectElement,
        modalTitleAIBtn: document.getElementById('modal-task-title-ai-btn') as HTMLButtonElement,
        modalDescriptionAIBtn: document.getElementById('modal-task-description-ai-btn') as HTMLButtonElement,

        // Analytics
        categoryChartCanvas: document.getElementById('category-chart') as HTMLCanvasElement,
        chartNoData: document.getElementById('chart-no-data'),
    };

    if (!elements.container) return; // Exit if not on the right page

    // --- Data Persistence ---
    const saveData = () => {
        saveItems('tasksData', tasks);
        saveItems('tasksCategories', categories);
    };

    const loadData = () => {
        tasks = loadItems('tasksData') || [];
        categories = loadItems('tasksCategories') || ['Física', 'Mental', 'Financeira', 'Familiar', 'Profissional', 'Social', 'Espiritual', 'Preventiva'];
    };

    // --- Modal Logic ---
    const openTaskModal = (task?: Task) => {
        if (!elements.taskModal || !elements.taskModalForm || !elements.taskModalTitle) return;
        elements.taskModalForm.reset();
        
        // Populate categories in modal dropdown
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
            elements.modalTitleInput.value = task.title;
            elements.modalDescriptionInput.value = task.description;
            elements.modalDueDateInput.value = task.dueDate;
            elements.modalPrioritySelect.value = task.priority;
            elements.modalCategorySelect.value = task.category;
        } else {
            editingTaskId = null;
            elements.taskModalTitle.textContent = 'Adicionar Tarefa';
            elements.modalPrioritySelect.value = 'medium';
        }
        elements.taskModal.style.display = 'flex';
        setTimeout(() => elements.taskModal?.classList.add('visible'), 10);
    };

    const closeTaskModal = () => {
        if (!elements.taskModal) return;
        elements.taskModal.classList.remove('visible');
        setTimeout(() => { if(elements.taskModal) elements.taskModal.style.display = 'none'; }, 300);
    };

    const handleTaskFormSubmit = (e: Event) => {
        e.preventDefault();
        const formData = new FormData(elements.taskModalForm);
        const taskData: Partial<Task> = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            dueDate: formData.get('dueDate') as string,
            priority: formData.get('priority') as 'low' | 'medium' | 'high',
            category: formData.get('category') as string,
        };

        if (!taskData.title || taskData.title.trim() === '') {
            showToast('O título da tarefa é obrigatório.', 'warning');
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
        showToast(`Tarefa ${editingTaskId ? 'atualizada' : 'adicionada'} com sucesso!`, 'success');
    };

    // Renders the category doughnut chart.
    const updateAnalytics = () => {
        if (!elements.categoryChartCanvas || !elements.chartNoData) return;

        const Chart = (window as any).Chart;
        if (!Chart) {
            console.error("Chart.js library is not loaded.");
            elements.categoryChartCanvas.style.display = 'none';
            elements.chartNoData.style.display = 'block';
            elements.chartNoData.textContent = 'Biblioteca de gráficos não carregada.';
            return;
        }

        if (categoryChart) {
            categoryChart.destroy();
        }

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
        
        const baseColors = [
            '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
            '#858796', '#5a5c69', '#f8f9fc', '#6f42c1', '#fd7e14'
        ];
        
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
                    legend: {
                        display: true,
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context: any) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
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

    // --- Core Rendering Logic ---
    const render = () => {
        const filteredTasks = getFilteredTasks();
        updateCounts(filteredTasks);
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
        
        // Category filter
        if (currentCategoryFilter !== 'all') {
            filtered = filtered.filter(task => task.category === currentCategoryFilter);
        }

        // Search filter
        if (currentSearch) {
            const searchLower = currentSearch.toLowerCase();
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(searchLower) || 
                task.description.toLowerCase().includes(searchLower)
            );
        }

        // Status filter from dropdown
        const today = new Date().toISOString().split('T')[0];
        switch (currentFilter) {
            case 'pending':
                filtered = filtered.filter(task => !task.completed);
                break;
            case 'completed':
                filtered = filtered.filter(task => task.completed);
                break;
            case 'overdue':
                filtered = filtered.filter(task => !task.completed && task.dueDate && task.dueDate < today);
                break;
            case 'high':
            case 'medium':
            case 'low':
                filtered = filtered.filter(task => task.priority === currentFilter);
                break;
        }
        
        return filtered.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    };
    
    const getPaginatedTasks = (filteredTasks: Task[]): Task[] => {
        const startIndex = (currentPage - 1) * tasksPerPage;
        return filteredTasks.slice(startIndex, startIndex + tasksPerPage);
    };
    
    const updateCounts = (filteredTasks: Task[]) => {
        if (!elements.totalCountEl || !elements.completedCountEl || !elements.pendingCountEl) return;
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        elements.totalCountEl.textContent = total.toString();
        elements.completedCountEl.textContent = completed.toString();
        elements.pendingCountEl.textContent = (total - completed).toString();
    };
    
    const renderCategories = () => {
        if (!elements.categoriesList || !elements.addCategoryBtn) return;
        // Clear existing but keep the 'add' button
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

            row.innerHTML = `
                <td><input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Marcar tarefa como concluída"></td>
                <td>
                    <span class="task-title">${DOMPurify.sanitize(task.title)}</span>
                    <span class="task-description-preview">${DOMPurify.sanitize(task.description)}</span>
                </td>
                <td style="${isOverdue ? 'color: var(--color-error); font-weight: bold;' : ''}">${dueDateText}</td>
                <td><span class="priority-tag priority-${task.priority}">${task.priority}</span></td>
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
            if (!groupedTasks[category]) {
                groupedTasks[category] = [];
            }
            groupedTasks[category].push(task);
        });

        // Ensure category order matches the tags
        const orderedCategories = ['all', ...categories, 'Sem Categoria'];
        orderedCategories.forEach(catName => {
            if (groupedTasks[catName] && groupedTasks[catName].length > 0) {
                 const groupEl = document.createElement('div');
                 groupEl.className = 'checklist-category-group';
                 groupEl.innerHTML = `<h3 class="checklist-category-title">${DOMPurify.sanitize(catName)}</h3>`;

                 groupedTasks[catName].forEach(task => {
                    const itemEl = document.createElement('div');
                    // Add 'details-expanded' by default to make details visible initially
                    itemEl.className = `checklist-item ${task.completed ? 'completed' : ''} details-expanded`;
                    itemEl.dataset.taskId = task.id;

                    const priorityMap = { low: 'Baixa', medium: 'Média', high: 'Alta' };
                    const priorityText = priorityMap[task.priority];
                    const priorityDot = `<div class="priority-dot priority-dot-${task.priority}"></div> ${priorityText}`;
                    const dueDateText = task.dueDate ? `<i class="fas fa-calendar-alt"></i> ${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}` : '';

                    itemEl.innerHTML = `
                        <div class="checklist-item-main">
                            <input type="checkbox" class="checklist-item-checkbox task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Marcar tarefa como concluída">
                            <div class="checklist-item-content">
                                <div class="checklist-item-summary">
                                    <span class="checklist-item-title">${DOMPurify.sanitize(task.title)}</span>
                                    <button class="action-btn toggle-details" aria-label="Alternar detalhes" aria-expanded="true">
                                        <i class="fas fa-chevron-up"></i>
                                    </button>
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

    // --- Event Handlers ---
    const handleActionClick = (e: Event) => {
        const target = e.target as HTMLElement;
        const taskEl = target.closest('[data-task-id]') as HTMLElement;
        if (!taskEl) return;
        
        if (target.closest('.toggle-details')) {
            const isExpanded = taskEl.classList.toggle('details-expanded');
            const toggleButton = taskEl.querySelector('.toggle-details');
            if (toggleButton) {
                toggleButton.setAttribute('aria-expanded', String(isExpanded));
                const icon = toggleButton.querySelector('i');
                if (icon) {
                    icon.className = isExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
                }
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
                showToast('Tarefa excluída.', 'success');
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
        const title = elements.quickTaskInput.value.trim();
        if (title) {
            const newTask: Task = {
                id: Date.now().toString(),
                title: title,
                description: '',
                dueDate: '',
                priority: 'medium',
                category: '',
                completed: false,
            };
            tasks.unshift(newTask);
            saveData();
            render();
            elements.quickTaskInput.value = '';
            showToast('Tarefa rápida adicionada!', 'success');
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
                    showToast('Categoria adicionada!', 'success');
                } else {
                    showToast('Essa categoria já existe.', 'warning');
                }
            }
        } else if (target.classList.contains('category-tag')) {
            currentCategoryFilter = target.dataset.category || 'all';
            currentPage = 1;
            render();
        }
    };

    // --- Initial Setup ---
    loadData();
    render();

    // Attach Event Listeners
    elements.addTaskBtn?.addEventListener('click', handleQuickAdd);
    elements.quickTaskInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleQuickAdd();
    });
    
    elements.checklistViewContainer?.addEventListener('click', handleActionClick);
    elements.taskListBody?.addEventListener('click', handleActionClick);
    
    elements.taskModalCloseBtn?.addEventListener('click', closeTaskModal);
    elements.taskModalCancelBtn?.addEventListener('click', closeTaskModal);
    elements.taskModalForm?.addEventListener('submit', handleTaskFormSubmit);
    
    elements.searchInput?.addEventListener('input', () => {
        currentSearch = elements.searchInput.value;
        currentPage = 1;
        render();
    });

    elements.filterSelect?.addEventListener('change', () => {
        currentFilter = elements.filterSelect.value;
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

    // AI Suggestions
    elements.quickTaskAIBtn?.addEventListener('click', () => {
        const prompt = "Sugira um título de tarefa conciso e acionável. Por exemplo: 'Revisar o orçamento mensal' ou 'Agendar consulta médica'.";
        getAISuggestionForInput(prompt, elements.quickTaskInput, elements.quickTaskAIBtn);
    });
    
    elements.modalTitleAIBtn?.addEventListener('click', () => {
        const prompt = "Sugira um título claro e conciso para uma tarefa, com no máximo 10 palavras.";
        getAISuggestionForInput(prompt, elements.modalTitleInput, elements.modalTitleAIBtn);
    });

    elements.modalDescriptionAIBtn?.addEventListener('click', () => {
        const currentTitle = elements.modalTitleInput.value;
        const prompt = `Com base no título da tarefa "${currentTitle || 'uma nova tarefa'}", gere uma descrição detalhada, incluindo o objetivo principal e possíveis subtarefas ou pontos a serem considerados.`;
        getAISuggestionForInput(prompt, elements.modalDescriptionInput, elements.modalDescriptionAIBtn);
    });
}