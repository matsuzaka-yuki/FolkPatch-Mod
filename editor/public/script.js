const fileSelector = document.getElementById('file-selector');
const addBtn = document.getElementById('add-btn');
const contentArea = document.getElementById('content-area');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const itemForm = document.getElementById('item-form');
const cancelBtn = document.getElementById('cancel-btn');
const toast = document.getElementById('toast');

let currentFile = null;
let currentData = [];
let editIndex = -1; // -1 表示新增，>=0 表示编辑的索引

// 初始化：加载文件列表
async function init() {
    try {
        const response = await fetch('/api/files');
        const files = await response.json();
        
        files.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            fileSelector.appendChild(option);
        });
    } catch (error) {
        showToast('加载文件列表失败');
        console.error(error);
    }
}

// 监听文件选择
fileSelector.addEventListener('change', async (e) => {
    currentFile = e.target.value;
    addBtn.disabled = false;
    await loadFileContent(currentFile);
});

// 加载文件内容
async function loadFileContent(filename) {
    try {
        const response = await fetch(`/api/content/${filename}`);
        currentData = await response.json();
        renderList();
    } catch (error) {
        showToast('加载文件内容失败');
        console.error(error);
    }
}

let sortableInstance = null;

// 渲染列表
function renderList() {
    contentArea.innerHTML = '';

    if (currentData.length === 0) {
        contentArea.innerHTML = '<div class="empty-state">暂无数据，请添加项目</div>';
        return;
    }

    currentData.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.index = index; // 存储原始索引
        card.innerHTML = `
            <div class="drag-handle">☰</div>
            <h3>${escapeHtml(item.name || '未命名')}</h3>
            <span class="version">${escapeHtml(item.version || 'v0.0.0')}</span>
            <div class="description">${escapeHtml(item.description || '暂无描述')}</div>
            <div class="url"><a href="${escapeHtml(item.url || '#')}" target="_blank">${escapeHtml(item.url || '')}</a></div>
            <div class="card-actions">
                <button class="edit-btn" onclick="openEditModal(${index})">编辑</button>
                <button class="danger-btn" onclick="deleteItem(${index})">删除</button>
            </div>
        `;
        contentArea.appendChild(card);
    });

    // 初始化或更新 Sortable
    if (sortableInstance) {
        sortableInstance.destroy();
    }
    
    sortableInstance = new Sortable(contentArea, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: async function (evt) {
            // 移动数据
            const item = currentData.splice(evt.oldIndex, 1)[0];
            currentData.splice(evt.newIndex, 0, item);
            
            // 保存但不重新渲染（避免闪烁），只更新按钮的索引
            // 或者简单点，直接保存并重新渲染
            await saveData(false); // false 表示保存后不强制重绘列表，因为 DOM 已经更新了
            
            // 更新所有卡片内的按钮索引，防止后续操作错乱
            updateCardIndices();
        }
    });
}

function updateCardIndices() {
    const cards = contentArea.querySelectorAll('.card');
    cards.forEach((card, index) => {
        card.dataset.index = index;
        const editBtn = card.querySelector('.edit-btn');
        const deleteBtn = card.querySelector('.danger-btn');
        if (editBtn) editBtn.setAttribute('onclick', `openEditModal(${index})`);
        if (deleteBtn) deleteBtn.setAttribute('onclick', `deleteItem(${index})`);
    });
}

// 保存数据到服务器
async function saveData(shouldRender = true) {
    if (!currentFile) return;
    
    try {
        const response = await fetch(`/api/content/${currentFile}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentData)
        });

        if (response.ok) {
            showToast('保存成功');
            if (shouldRender) renderList();
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        showToast('保存失败');
        console.error(error);
    }
}

// 打开添加模态框
addBtn.addEventListener('click', () => {
    editIndex = -1;
    modalTitle.textContent = '添加项目';
    itemForm.reset();
    modal.classList.remove('hidden');
});

// 打开编辑模态框
window.openEditModal = (index) => {
    editIndex = index;
    modalTitle.textContent = '编辑项目';
    const item = currentData[index];
    
    document.getElementById('name').value = item.name || '';
    document.getElementById('version').value = item.version || '';
    document.getElementById('url').value = item.url || '';
    document.getElementById('description').value = item.description || '';
    
    modal.classList.remove('hidden');
};

// 关闭模态框
cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// 提交表单
itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newItem = {
        name: document.getElementById('name').value,
        version: document.getElementById('version').value,
        url: document.getElementById('url').value,
        description: document.getElementById('description').value
    };

    if (editIndex === -1) {
        // 添加
        currentData.push(newItem);
    } else {
        // 编辑
        currentData[editIndex] = newItem;
    }

    modal.classList.add('hidden');
    await saveData();
});

// 删除项目
window.deleteItem = async (index) => {
    if (confirm('确定要删除这个项目吗？')) {
        currentData.splice(index, 1);
        await saveData();
    }
};

// 工具函数：HTML 转义防止 XSS
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Toast 提示
function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// 启动
init();
