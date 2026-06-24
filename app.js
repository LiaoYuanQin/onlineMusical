// 配置
const CONFIG = {
    GITHUB_REPO: 'LiaoYuanQin/onlineMusical',
    GITHUB_API_BASE: 'https://api.github.com/repos',
    USERS_FILE: 'data/users.json',
    KNOWLEDGE_DIR: 'knowledge'
};

// 全局状态
let currentUser = null;
let allUsers = [];
let allKnowledge = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    loadKnowledge();
    checkAuth();
    setupEventListeners();
});

// 从GitHub获取文件内容
async function fetchGitHubFile(path) {
    try {
        const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${path}`);
        if (!response.ok) throw new Error('文件不存在');
        const data = await response.json();
        const content = atob(data.content);
        return JSON.parse(content);
    } catch (error) {
        console.error('获取文件失败:', error);
        return null;
    }
}

// 保存文件到GitHub
async function saveGitHubFile(path, content, message) {
    try {
        const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${path}`);
        let sha = null;
        
        if (response.ok) {
            const data = await response.json();
            sha = data.sha;
        }
        
        const putResponse = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${getGitHubToken()}`
            },
            body: JSON.stringify({
                message: message,
                content: btoa(JSON.stringify(content, null, 2)),
                sha: sha
            })
        });
        
        if (!putResponse.ok) throw new Error('保存失败');
        return await putResponse.json();
    } catch (error) {
        console.error('保存文件失败:', error);
        alert('保存失败，请检查GitHub Token配置');
        return null;
    }
}

// 获取GitHub Token
function getGitHubToken() {
    return localStorage.getItem('github_token') || '';
}

// 设置GitHub Token
function setGitHubToken(token) {
    localStorage.setItem('github_token', token);
}

// 加载用户数据
async function loadUsers() {
    const users = await fetchGitHubFile(CONFIG.USERS_FILE);
    if (users) {
        allUsers = users;
    } else {
        // 初始化管理员用户
        allUsers = [{
            id: 1,
            username: 'admin',
            email: 'admin@example.com',
            password: 'admin123',
            role: 'admin',
            status: 'approved',
            createdAt: new Date().toISOString()
        }];
        await saveGitHubFile(CONFIG.USERS_FILE, allUsers, '初始化用户数据');
    }
}

// 加载知识数据
async function loadKnowledge() {
    try {
        const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.KNOWLEDGE_DIR}`);
        if (!response.ok) throw new Error('知识目录不存在');
        
        const files = await response.json();
        allKnowledge = [];
        
        for (const file of files) {
            if (file.name.endsWith('.md')) {
                try {
                    const fileResponse = await fetch(file.url);
                    const fileData = await fileResponse.json();
                    const content = atob(fileData.content);
                    
                    // 解析Markdown文件
                    const match = content.match(/---\n([\s\S]*?)\n---/);
                    if (match) {
                        const meta = match[1];
                        const titleMatch = meta.match(/title:\s*"(.*?)"/);
                        const descMatch = meta.match(/description:\s*"(.*?)"/);
                        const tagsMatch = meta.match(/tags:\s*(.*)/);
                        const authorMatch = meta.match(/author:\s*(\d+)/);
                        const createdAtMatch = meta.match(/createdAt:\s*(.*)/);
                        const updatedAtMatch = meta.match(/updatedAt:\s*(.*)/);
                        
                        const body = content.replace(/---[\s\S]*?---\n*/, '');
                        const bodyMatch = body.match(/## 正文\n\n([\s\S]*?)(\n## |$)/);
                        const contentText = bodyMatch ? bodyMatch[1].trim() : '';
                        
                        allKnowledge.push({
                            id: parseInt(file.name.replace('.md', '')),
                            title: titleMatch ? titleMatch[1] : '',
                            description: descMatch ? descMatch[1] : '',
                            content: contentText,
                            tags: tagsMatch ? JSON.parse(tagsMatch[1]) : [],
                            author: authorMatch ? parseInt(authorMatch[1]) : 1,
                            files: [],
                            createdAt: createdAtMatch ? new Date(createdAtMatch[1]) : new Date(),
                            updatedAt: updatedAtMatch ? new Date(updatedAtMatch[1]) : new Date()
                        });
                    }
                } catch (error) {
                    console.error('解析知识文件失败:', file.name, error);
                }
            }
        }
        
        // 按创建时间排序
        allKnowledge.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
    } catch (error) {
        console.error('加载知识失败:', error);
        allKnowledge = [];
    }
}

// 检查认证状态
function checkAuth() {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        currentUser = JSON.parse(userData);
        updateAuthUI();
    }
}

// 更新认证UI
function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const adminLink = document.getElementById('adminLink');
    
    if (currentUser) {
        authButtons.style.display = 'none';
        userInfo.style.display = 'flex';
        userName.textContent = currentUser.username;
        
        if (currentUser.role === 'admin') {
            adminLink.style.display = 'block';
        } else {
            adminLink.style.display = 'none';
        }
    } else {
        authButtons.style.display = 'flex';
        userInfo.style.display = 'none';
        adminLink.style.display = 'none';
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 登录表单
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // 注册表单
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // 知识表单
    document.getElementById('knowledgeForm').addEventListener('submit', handleCreateKnowledge);
    
    // 搜索输入框回车事件
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchKnowledge();
        }
    });
}

// 页面切换
function showPage(pageName) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    // 根据页面加载相应数据
    switch(pageName) {
        case 'home':
            renderKnowledgeList(allKnowledge);
            break;
        case 'admin':
            if (currentUser && currentUser.role === 'admin') {
                renderAdminPanel();
            } else {
                alert('需要管理员权限');
                showPage('login');
            }
            break;
        case 'create':
            if (!currentUser) {
                alert('请先登录');
                showPage('login');
            }
            break;
    }
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const user = allUsers.find(u => u.email === email && u.password === password);
    
    if (!user) {
        alert('邮箱或密码错误');
        return;
    }
    
    if (user.status !== 'approved') {
        alert('账号未通过审核');
        return;
    }
    
    // 检查是否需要GitHub Token
    if (!getGitHubToken()) {
        const token = prompt('请输入GitHub Personal Access Token (用于保存数据):');
        if (token) {
            setGitHubToken(token);
        } else {
            alert('需要GitHub Token才能完整使用功能');
        }
    }
    
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    updateAuthUI();
    
    alert('登录成功');
    showPage('home');
    
    // 清空表单
    document.getElementById('loginForm').reset();
}

// 处理注册
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    // 检查邮箱是否已存在
    if (allUsers.find(u => u.email === email)) {
        alert('该邮箱已被注册');
        return;
    }
    
    const newUser = {
        id: allUsers.length + 1,
        username,
        email,
        password,
        role: 'author',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    allUsers.push(newUser);
    await saveGitHubFile(CONFIG.USERS_FILE, allUsers, `新用户注册: ${username}`);
    
    alert('注册成功，请等待管理员审核');
    showPage('login');
    
    // 清空表单
    document.getElementById('registerForm').reset();
}

// 退出登录
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateAuthUI();
    showPage('home');
}

// 渲染知识列表
function renderKnowledgeList(knowledgeList) {
    const container = document.getElementById('knowledgeList');
    
    if (knowledgeList.length === 0) {
        container.innerHTML = '<div class="loading">暂无知识内容</div>';
        return;
    }
    
    container.innerHTML = knowledgeList.map(item => {
        const author = allUsers.find(u => u.id === item.author);
        const authorName = author ? author.username : '未知作者';
        
        return `
            <div class="knowledge-card" onclick="showKnowledgeDetail(${item.id})">
                <div class="knowledge-title">${escapeHtml(item.title)}</div>
                <div class="knowledge-description">${escapeHtml(item.description)}</div>
                <div class="knowledge-tags">
                    ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
                <div class="knowledge-meta">
                    <span>👤 ${escapeHtml(authorName)}</span>
                    <span>📅 ${formatDate(item.createdAt)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 显示知识详情
function showKnowledgeDetail(id) {
    const item = allKnowledge.find(k => k.id === id);
    if (!item) {
        alert('知识不存在');
        return;
    }
    
    const author = allUsers.find(u => u.id === item.author);
    const authorName = author ? author.username : '未知作者';
    const isOwner = currentUser && (currentUser.role === 'admin' || currentUser.id === item.author);
    
    document.getElementById('knowledgeDetail').innerHTML = `
        <h1 class="detail-title">${escapeHtml(item.title)}</h1>
        <div class="detail-description">${escapeHtml(item.description)}</div>
        <div class="detail-tags">
            ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="detail-content">${escapeHtml(item.content)}</div>
        <div class="detail-meta">
            <p>👤 作者: ${escapeHtml(authorName)}</p>
            <p>📅 创建时间: ${formatDate(item.createdAt)}</p>
            <p>🔄 更新时间: ${formatDate(item.updatedAt)}</p>
        </div>
        ${isOwner ? `
            <div class="detail-actions">
                <button onclick="deleteKnowledge(${item.id})" class="btn btn-danger">删除</button>
            </div>
        ` : ''}
    `;
    
    showPage('detail');
}

// 搜索知识
function searchKnowledge() {
    const keyword = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!keyword) {
        renderKnowledgeList(allKnowledge);
        return;
    }
    
    const results = allKnowledge.filter(item => 
        item.title.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword) ||
        item.content.toLowerCase().includes(keyword)
    );
    
    renderKnowledgeList(results);
}

// 处理创建知识
async function handleCreateKnowledge(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('请先登录');
        return;
    }
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const content = document.getElementById('content').value;
    const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t);
    
    const newId = allKnowledge.length > 0 ? Math.max(...allKnowledge.map(k => k.id)) + 1 : 1;
    
    const newItem = {
        id: newId,
        title,
        description,
        content,
        tags,
        author: currentUser.id,
        files: [],
        createdAt: new Date(),
        updatedAt: new Date()
    };
    
    // 创建Markdown内容
    const mdContent = `---
title: "${title}"
description: "${description}"
tags: ${JSON.stringify(tags)}
author: ${currentUser.id}
createdAt: ${newItem.createdAt.toISOString()}
updatedAt: ${newItem.updatedAt.toISOString()}
---

# ${title}

## 描述

${description}

## 正文

${content}
`;
    
    try {
        await saveGitHubFile(`${CONFIG.KNOWLEDGE_DIR}/${newId}.md`, mdContent, `创建知识: ${title}`);
        
        allKnowledge.unshift(newItem);
        alert('知识发布成功');
        
        // 清空表单
        document.getElementById('knowledgeForm').reset();
        showPage('home');
        
    } catch (error) {
        console.error('发布知识失败:', error);
        alert('发布失败，请检查网络连接');
    }
}

// 删除知识
async function deleteKnowledge(id) {
    if (!confirm('确定要删除这条知识吗？')) return;
    
    const item = allKnowledge.find(k => k.id === id);
    if (!item) return;
    
    if (currentUser.role !== 'admin' && item.author !== currentUser.id) {
        alert('无权删除他人知识');
        return;
    }
    
    try {
        // 获取文件SHA
        const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.KNOWLEDGE_DIR}/${id}.md`);
        const data = await response.json();
        
        // 删除文件
        await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.KNOWLEDGE_DIR}/${id}.md`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${getGitHubToken()}`
            },
            body: JSON.stringify({
                message: `删除知识: ${item.title}`,
                sha: data.sha
            })
        });
        
        allKnowledge = allKnowledge.filter(k => k.id !== id);
        alert('删除成功');
        showPage('home');
        
    } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败，请检查网络连接');
    }
}

// 渲染管理面板
function renderAdminPanel() {
    renderPendingUsers();
    renderApprovedUsers();
    renderAllKnowledge();
}

// 渲染待审核用户
function renderPendingUsers() {
    const container = document.getElementById('pendingUsers');
    const pendingUsers = allUsers.filter(u => u.status === 'pending');
    
    if (pendingUsers.length === 0) {
        container.innerHTML = '<p>暂无待审核用户</p>';
        return;
    }
    
    container.innerHTML = pendingUsers.map(user => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-name">${escapeHtml(user.username)}</div>
                <div>${escapeHtml(user.email)}</div>
                <div>注册时间: ${formatDate(user.createdAt)}</div>
            </div>
            <div class="user-actions">
                <button onclick="approveUser(${user.id})" class="btn btn-primary">通过</button>
                <button onclick="rejectUser(${user.id})" class="btn btn-danger">拒绝</button>
            </div>
        </div>
    `).join('');
}

// 渲染已批准用户
function renderApprovedUsers() {
    const container = document.getElementById('approvedUsers');
    const approvedUsers = allUsers.filter(u => u.status === 'approved');
    
    if (approvedUsers.length === 0) {
        container.innerHTML = '<p>暂无已批准用户</p>';
        return;
    }
    
    container.innerHTML = approvedUsers.map(user => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-name">${escapeHtml(user.username)} ${user.role === 'admin' ? '(管理员)' : ''}</div>
                <div>${escapeHtml(user.email)}</div>
                <div>角色: ${user.role === 'admin' ? '管理员' : '作者'}</div>
            </div>
            ${user.id !== 1 ? `
                <div class="user-actions">
                    <button onclick="deleteUser(${user.id})" class="btn btn-danger">删除</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// 渲染所有知识
function renderAllKnowledge() {
    const container = document.getElementById('allKnowledge');
    
    if (allKnowledge.length === 0) {
        container.innerHTML = '<p>暂无知识内容</p>';
        return;
    }
    
    container.innerHTML = allKnowledge.map(item => {
        const author = allUsers.find(u => u.id === item.author);
        const authorName = author ? author.username : '未知作者';
        
        return `
            <div class="knowledge-item">
                <div class="knowledge-info">
                    <div class="knowledge-title">${escapeHtml(item.title)}</div>
                    <div>作者: ${escapeHtml(authorName)}</div>
                    <div>创建时间: ${formatDate(item.createdAt)}</div>
                </div>
                <div class="user-actions">
                    <button onclick="showKnowledgeDetail(${item.id})" class="btn btn-outline">查看</button>
                    <button onclick="adminDeleteKnowledge(${item.id})" class="btn btn-danger">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

// 审核通过用户
async function approveUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    user.status = 'approved';
    await saveGitHubFile(CONFIG.USERS_FILE, allUsers, `审核通过用户: ${user.username}`);
    
    alert('审核通过');
    renderAdminPanel();
}

// 拒绝用户
async function rejectUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    user.status = 'rejected';
    await saveGitHubFile(CONFIG.USERS_FILE, allUsers, `拒绝用户: ${user.username}`);
    
    alert('已拒绝该用户');
    renderAdminPanel();
}

// 删除用户
async function deleteUser(userId) {
    if (!confirm('确定要删除该用户吗？')) return;
    
    allUsers = allUsers.filter(u => u.id !== userId);
    await saveGitHubFile(CONFIG.USERS_FILE, allUsers, '删除用户');
    
    alert('用户已删除');
    renderAdminPanel();
}

// 管理员删除知识
async function adminDeleteKnowledge(id) {
    await deleteKnowledge(id);
    renderAdminPanel();
}

// 显示管理标签页
function showAdminTab(tabName) {
    // 隐藏所有标签内容
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // 移除所有标签的active类
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 显示目标标签内容
    document.getElementById(tabName + 'Tab').style.display = 'block';
    
    // 添加active类到目标标签
    event.target.classList.add('active');
}

// 工具函数：转义HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 工具函数：格式化日期
function formatDate(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}