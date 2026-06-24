// 配置
const CONFIG = {
    GITHUB_REPO: 'LiaoYuanQin/onlineMusical',
    GITHUB_API_BASE: 'https://api.github.com/repos',
    USERS_FILE: 'data/users.json',
    KNOWLEDGE_DIR: 'knowledge',
    ATTACHMENTS_DIR: 'attachments'
};

// 全局状态
let currentUser = null;
let allUsers = [];
let allKnowledge = [];
let uploadedFiles = [];
let currentAttachments = [];
let currentAttachmentIndex = 0;
let currentZoom = 1;

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

// Unicode 字符串转 Base64
function utf8ToBase64(str) {
    try {
        // 使用 encodeURIComponent 将字符串转换为 UTF-8，然后再编码
        const utf8Str = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
            return String.fromCharCode(parseInt(p1, 16));
        });
        return btoa(utf8Str);
    } catch (error) {
        console.error('Base64 编码失败:', error);
        throw new Error('编码失败，请检查内容是否包含特殊字符');
    }
}

// 保存文本文件到GitHub
async function saveGitHubFile(path, content, message) {
    try {
        const token = getGitHubToken();
        if (!token) {
            throw new Error('GitHub Token 未配置');
        }

        console.log('=== saveGitHubFile ===');
        console.log('文件路径:', path);
        console.log('内容类型:', typeof content);
        console.log('内容长度:', typeof content === 'string' ? content.length : '对象');
        
        // 额外检查：如果是字符串，显示前50个字符
        if (typeof content === 'string') {
            console.log('内容预览(前50字符):', content.substring(0, 50));
        }

        const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${path}`, {
            headers: {
                'Authorization': `token ${token}`
            }
        });

        let sha = null;
        if (response.ok) {
            const data = await response.json();
            sha = data.sha;
            console.log('文件已存在，SHA:', sha);
        } else if (response.status === 404) {
            console.log('文件不存在，将创建新文件');
        } else {
            const errorText = await response.text();
            console.error('获取文件信息失败:', response.status, errorText);
            throw new Error(`获取文件信息失败: ${response.status} - ${errorText}`);
        }

        // 根据内容类型决定编码方式
        let base64Content;
        if (typeof content === 'string') {
            // 如果是字符串（如 Markdown），直接编码
            base64Content = utf8ToBase64(content);
            console.log('直接编码字符串，Base64长度:', base64Content.length);
        } else {
            // 如果是对象，先 JSON.stringify 再编码
            const contentJson = JSON.stringify(content, null, 2);
            base64Content = utf8ToBase64(contentJson);
            console.log('JSON.stringify 后编码，Base64长度:', base64Content.length);
        }

        const putResponse = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${token}`
            },
            body: JSON.stringify({
                message: message,
                content: base64Content,
                sha: sha
            })
        });

        if (!putResponse.ok) {
            const errorData = await putResponse.json();
            console.error('保存文件失败:', errorData);
            throw new Error(`保存失败: ${errorData.message || putResponse.statusText}`);
        }

        const result = await putResponse.json();
        console.log('文件保存成功:', result);
        console.log('=== saveGitHubFile 结束 ===');
        return result;
    } catch (error) {
        console.error('保存文件失败:', error);
        alert(`保存失败: ${error.message}\n\n请检查：\n1. GitHub Token 是否有 Contents: Read and Write 权限\n2. Token 是否已过期\n3. 网络连接是否正常`);
        return null;
    }
}

// 上传二进制文件到GitHub
async function uploadBinaryFile(file, path) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const token = getGitHubToken();
                if (!token) {
                    throw new Error('GitHub Token 未配置');
                }

                console.log('正在上传文件:', file.name, '到路径:', path);
                console.log('文件大小:', file.size, 'bytes');

                const content = e.target.result.split(',')[1];

                // 获取文件信息
                const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${path}`, {
                    headers: {
                        'Authorization': `token ${token}`
                    }
                });

                let sha = null;
                if (response.ok) {
                    const data = await response.json();
                    sha = data.sha;
                    console.log('文件已存在，SHA:', sha);
                } else if (response.status === 404) {
                    console.log('文件不存在，将创建新文件');
                } else {
                    const errorText = await response.text();
                    console.error('获取文件信息失败:', response.status, errorText);
                    throw new Error(`获取文件信息失败: ${response.status} - ${errorText}`);
                }

                // 上传文件
                const putResponse = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${path}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `token ${token}`
                    },
                    body: JSON.stringify({
                        message: `Upload attachment: ${file.name}`,
                        content: content,
                        sha: sha
                    })
                });

                if (!putResponse.ok) {
                    const errorData = await putResponse.json();
                    console.error('上传文件失败:', errorData);
                    throw new Error(`上传失败: ${errorData.message || putResponse.statusText}`);
                }

                const data = await putResponse.json();
                console.log('文件上传成功:', data);
                resolve(data);
            } catch (error) {
                console.error('上传文件失败:', error);
                reject(error);
            }
        };
        reader.onerror = (error) => {
            console.error('读取文件失败:', error);
            reject(new Error('读取文件失败'));
        };
        reader.readAsDataURL(file);
    });
}

// Base64 转 Unicode 字符串
function base64ToUtf8(str) {
    try {
        // 先解码 Base64，然后转换为 UTF-8
        const decoded = atob(str);
        return decodeURIComponent(decoded.split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    } catch (error) {
        console.error('Base64 解码失败:', error);
        throw new Error('解码失败');
    }
}

// 从GitHub下载文件
async function downloadFileFromGitHub(path) {
    try {
        const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${path}`);
        if (!response.ok) throw new Error('文件不存在');
        const data = await response.json();
        // 使用支持 Unicode 的解码方法
        const content = base64ToUtf8(data.content);
        return content;
    } catch (error) {
        console.error('下载文件失败:', error);
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

// 验证GitHub Token权限
async function validateGitHubToken(token) {
    try {
        console.log('正在验证 GitHub Token...');
        const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}`, {
            headers: {
                'Authorization': `token ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Token 验证失败:', errorData);
            return {
                valid: false,
                error: errorData.message || 'Token 无效'
            };
        }

        const repoData = await response.json();
        console.log('Token 验证成功，仓库信息:', repoData);

        // 测试写入权限
        const testPath = `test_${Date.now()}.txt`;
        const testResponse = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${testPath}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${token}`
            },
            body: JSON.stringify({
                message: 'Test write permission',
                content: btoa('Token test')
            })
        });

        if (!testResponse.ok) {
            const errorData = await testResponse.json();
            console.error('写入权限测试失败:', errorData);
            return {
                valid: true,
                hasWritePermission: false,
                error: errorData.message || '没有写入权限'
            };
        }

        // 删除测试文件
        const testData = await testResponse.json();
        await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${testPath}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${token}`
            },
            body: JSON.stringify({
                message: 'Delete test file',
                sha: testData.content.sha
            })
        });

        console.log('Token 验证完成，所有权限正常');
        return {
            valid: true,
            hasWritePermission: true,
            repoName: repoData.name,
            repoOwner: repoData.owner.login
        };
    } catch (error) {
        console.error('Token 验证异常:', error);
        return {
            valid: false,
            error: error.message
        };
    }
}

// 加载用户数据
async function loadUsers() {
    const users = await fetchGitHubFile(CONFIG.USERS_FILE);
    if (users) {
        allUsers = users;
    } else {
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
        console.log('=== 开始从 GitHub 加载知识数据 ===');
        console.log('知识目录:', CONFIG.KNOWLEDGE_DIR);
        
        const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.KNOWLEDGE_DIR}`);
        if (!response.ok) {
            console.error('知识目录不存在，响应状态:', response.status);
            throw new Error('知识目录不存在');
        }
        
        const files = await response.json();
        console.log('找到文件数量:', files.length);
        console.log('文件列表:', files.map(f => f.name));
        
        allKnowledge = [];
        
        for (const file of files) {
            if (file.name.endsWith('.md')) {
                try {
                    console.log('正在解析文件:', file.name);
                    const fileResponse = await fetch(file.url);
                    const fileData = await fileResponse.json();
                    
                    // 使用支持 Unicode 的解码方法
                    const content = base64ToUtf8(fileData.content);
                    console.log('文件内容长度:', content.length);
                    console.log('文件内容前200字符:', content.substring(0, 200));
                    
                    // 尝试匹配 YAML front matter
                    const match = content.match(/^---\n([\s\S]*?)\n---/);
                    if (match) {
                        console.log('找到 YAML front matter');
                        const meta = match[1];
                        console.log('元数据内容:', meta);
                        
                        const titleMatch = meta.match(/title:\s*"(.*?)"/);
                        const descMatch = meta.match(/description:\s*"(.*?)"/);
                        const tagsMatch = meta.match(/tags:\s*(.*)/);
                        const authorMatch = meta.match(/author:\s*(\d+)/);
                        const createdAtMatch = meta.match(/createdAt:\s*(.*)/);
                        const updatedAtMatch = meta.match(/updatedAt:\s*(.*)/);
                        const filesMatch = meta.match(/files:\s*(.*)/);
                        
                        console.log('解析结果:', {
                            title: titleMatch ? titleMatch[1] : '未找到',
                            description: descMatch ? descMatch[1] : '未找到',
                            tags: tagsMatch ? tagsMatch[1] : '未找到',
                            author: authorMatch ? authorMatch[1] : '未找到',
                            files: filesMatch ? filesMatch[1] : '未找到'
                        });
                        
                        const body = content.replace(/^---[\s\S]*?---\n*/, '');
                        const bodyMatch = body.match(/## 正文\n\n([\s\S]*?)(\n## |$)/);
                        const contentText = bodyMatch ? bodyMatch[1].trim() : '';
                        
                        const knowledgeItem = {
                            id: parseInt(file.name.replace('.md', '')),
                            title: titleMatch ? titleMatch[1] : '',
                            description: descMatch ? descMatch[1] : '',
                            content: contentText,
                            tags: tagsMatch ? JSON.parse(tagsMatch[1]) : [],
                            author: authorMatch ? parseInt(authorMatch[1]) : 1,
                            files: filesMatch ? JSON.parse(filesMatch[1]) : [],
                            createdAt: createdAtMatch ? new Date(createdAtMatch[1]) : new Date(),
                            updatedAt: updatedAtMatch ? new Date(updatedAtMatch[1]) : new Date()
                        };
                        
                        console.log('解析成功:', knowledgeItem.title, '作者ID:', knowledgeItem.author);
                        allKnowledge.push(knowledgeItem);
                    } else {
                        console.warn('文件格式不正确，无法解析元数据:', file.name);
                        console.log('文件内容:', content);
                    }
                } catch (error) {
                    console.error('解析知识文件失败:', file.name, error);
                }
            }
        }
        
        allKnowledge.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        console.log('=== 知识数据加载完成 ===');
        console.log('总共加载知识数量:', allKnowledge.length);
        console.log('知识列表:', allKnowledge.map(k => ({ id: k.id, title: k.title, author: k.author })));
        
    } catch (error) {
        console.error('加载知识失败:', error);
        console.log('将使用空的知识列表');
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
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('knowledgeForm').addEventListener('submit', handleCreateKnowledge);
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchKnowledge();
    });
    
    // 文件上传事件
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // 拖拽上传
    const uploadArea = document.getElementById('fileUploadArea');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            handleFiles(files);
        });
    }
    
    // ESC键关闭全屏
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeFullscreen();
        }
    });
    
    // 键盘导航
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('fullscreenModal');
        if (modal.style.display === 'flex') {
            if (e.key === 'ArrowLeft') {
                navigateAttachment(-1);
            } else if (e.key === 'ArrowRight') {
                navigateAttachment(1);
            }
        }
    });
}

// 处理文件选择
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    handleFiles(files);
}

// 处理文件
function handleFiles(files) {
    files.forEach(file => {
        const fileInfo = {
            file: file,
            name: file.name,
            size: file.size,
            type: file.type,
            id: Date.now() + Math.random()
        };
        uploadedFiles.push(fileInfo);
    });
    renderUploadedFiles();
}

// 渲染已上传文件
function renderUploadedFiles() {
    const container = document.getElementById('uploadedFiles');
    
    if (uploadedFiles.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = uploadedFiles.map(fileInfo => `
        <div class="uploaded-file">
            <div class="file-info">
                <div class="file-icon">${getFileIcon(fileInfo.type)}</div>
                <div>
                    <div class="file-name">${escapeHtml(fileInfo.name)}</div>
                    <div class="file-size">${formatFileSize(fileInfo.size)}</div>
                </div>
            </div>
            <button class="remove-file" onclick="removeUploadedFile(${fileInfo.id})">✕</button>
        </div>
    `).join('');
}

// 获取文件图标
function getFileIcon(type) {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📈';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    return '📎';
}

// 判断是否为图片类型
function isImageType(type) {
    return type.startsWith('image/');
}

// 判断是否为PDF类型
function isPdfType(type) {
    return type.includes('pdf') || type === 'application/pdf';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 移除已上传文件
function removeUploadedFile(id) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== id);
    renderUploadedFiles();
}

// 页面切换
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
    
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
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
            uploadedFiles = [];
            renderUploadedFiles();
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

    if (!getGitHubToken()) {
        const token = prompt('请输入GitHub Personal Access Token (用于保存数据):');
        if (token) {
            // 验证Token
            console.log('开始验证Token...');
            const validation = await validateGitHubToken(token);

            if (!validation.valid) {
                alert(`Token 无效: ${validation.error}\n\n请检查：\n1. Token 是否正确\n2. Token 是否已过期\n3. Token 是否有访问仓库权限`);
                localStorage.removeItem('github_token');
                return;
            }

            if (!validation.hasWritePermission) {
                alert(`Token 权限不足: ${validation.error}\n\n请确保 Token 有以下权限：\n- Contents: Read and Write\n\n仓库: ${validation.repoOwner}/${validation.repoName}`);
                localStorage.removeItem('github_token');
                return;
            }

            setGitHubToken(token);
            alert(`Token 验证成功！\n\n仓库: ${validation.repoOwner}/${validation.repoName}\n权限: 读取 + 写入`);
        } else {
            alert('需要GitHub Token才能完整使用功能');
        }
    } else {
        // 验证已保存的Token
        const existingToken = getGitHubToken();
        const validation = await validateGitHubToken(existingToken);

        if (!validation.valid) {
            alert(`已保存的 Token 无效: ${validation.error}\n\n请重新输入有效的 Token`);
            localStorage.removeItem('github_token');
            return;
        }

        if (!validation.hasWritePermission) {
            alert(`已保存的 Token 权限不足: ${validation.error}\n\n请重新创建有写入权限的 Token`);
            localStorage.removeItem('github_token');
            return;
        }
    }

    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    updateAuthUI();

    alert('登录成功');
    showPage('home');
    document.getElementById('loginForm').reset();
}

// 处理注册
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
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
        const hasAttachments = item.files && item.files.length > 0;
        
        return `
            <div class="knowledge-card" onclick="showKnowledgeDetail(${item.id})">
                <div class="knowledge-title">${escapeHtml(item.title)}</div>
                <div class="knowledge-description">${escapeHtml(item.description)}</div>
                <div class="knowledge-tags">
                    ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
                ${hasAttachments ? `<div class="knowledge-meta">📎 ${item.files.length} 个附件</div>` : ''}
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
    const hasAttachments = item.files && item.files.length > 0;
    
    // 生成附件HTML
    let attachmentsHtml = '';
    if (hasAttachments) {
        attachmentsHtml = `
            <div class="detail-attachments">
                <h3>📎 附件（点击图片可全屏查看）</h3>
                <div class="attachment-list">
                    ${item.files.map((file, index) => {
                        const isImg = isImageType(file.type);
                        // 使用单引号包裹 onclick，避免与 JSON 中的双引号冲突
                        const filesJson = JSON.stringify(item.files).replace(/'/g, "\\'");
                        return `
                            <div class="attachment-item" onclick='openFullscreen(${filesJson}, ${index})'>
                                ${isImg ? `
                                    <img src="${file.downloadUrl}" class="attachment-image" alt="${escapeHtml(file.name)}" />
                                ` : `
                                    <div class="attachment-doc-icon">${getFileIcon(file.type)}</div>
                                `}
                                <div class="attachment-name">${escapeHtml(file.name)}</div>
                                <div class="attachment-size">${formatFileSize(file.size)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    document.getElementById('knowledgeDetail').innerHTML = `
        <h1 class="detail-title">${escapeHtml(item.title)}</h1>
        <div class="detail-description">${escapeHtml(item.description)}</div>
        <div class="detail-tags">
            ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="detail-content">${escapeHtml(item.content)}</div>
        
        ${attachmentsHtml}
        
        <div class="detail-meta">
            <p>👤 作者: ${escapeHtml(authorName)}</p>
            <p>📅 创建时间: ${formatDate(item.createdAt)}</p>
            <p>🔄 更新时间: ${formatDate(item.updatedAt)}</p>
        </div>
        
        <div class="detail-actions">
            <button onclick="exportKnowledge(${item.id})" class="btn btn-export">📥 导出知识</button>
            ${isOwner ? `
                <button onclick="deleteKnowledge(${item.id})" class="btn btn-danger">删除</button>
            ` : ''}
        </div>
    `;
    
    showPage('detail');
}

// 打开全屏查看器
function openFullscreen(attachments, index) {
    currentAttachments = attachments;
    currentAttachmentIndex = index;
    currentZoom = 1; // 重置缩放比例
    
    const modal = document.getElementById('fullscreenModal');
    const modalImage = document.getElementById('modalImage');
    const modalIframe = document.getElementById('modalIframe');
    const modalPreview = document.getElementById('modalPreview');
    const modalDownloadLink = document.getElementById('modalDownloadLink');
    const modalCounter = document.getElementById('modalCounter');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomResetBtn = document.getElementById('zoomResetBtn');
    const zoomLevel = document.getElementById('zoomLevel');
    
    // 隐藏所有内容
    modalImage.style.display = 'none';
    modalIframe.style.display = 'none';
    modalPreview.style.display = 'none';
    
    // 隐藏缩放控制
    zoomInBtn.style.display = 'none';
    zoomOutBtn.style.display = 'none';
    zoomResetBtn.style.display = 'none';
    zoomLevel.style.display = 'none';
    
    const currentFile = currentAttachments[currentAttachmentIndex];
    
    if (isImageType(currentFile.type)) {
        modalImage.src = currentFile.downloadUrl;
        modalImage.style.display = 'block';
        modalImage.style.transform = 'scale(1)';
        modalImage.style.cursor = 'zoom-in';
        
        // 显示缩放控制
        zoomInBtn.style.display = 'inline-block';
        zoomOutBtn.style.display = 'inline-block';
        zoomResetBtn.style.display = 'inline-block';
        zoomLevel.style.display = 'inline-block';
        zoomLevel.textContent = '100%';
    } else if (isPdfType(currentFile.type)) {
        modalIframe.src = `https://docs.google.com/gview?url=${encodeURIComponent(currentFile.downloadUrl)}&embedded=true`;
        modalIframe.style.display = 'block';
    } else {
        modalDownloadLink.href = currentFile.downloadUrl;
        modalDownloadLink.download = currentFile.name;
        modalPreview.style.display = 'flex';
    }
    
    // 更新计数器
    modalCounter.textContent = `${currentAttachmentIndex + 1} / ${currentAttachments.length}`;
    
    // 更新导航按钮
    prevBtn.style.display = currentAttachmentIndex > 0 ? 'block' : 'none';
    nextBtn.style.display = currentAttachmentIndex < currentAttachments.length - 1 ? 'block' : 'none';
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// 关闭全屏查看器
function closeFullscreen() {
    const modal = document.getElementById('fullscreenModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentZoom = 1; // 重置缩放比例
}

// 导航附件
function navigateAttachment(direction) {
    const newIndex = currentAttachmentIndex + direction;
    if (newIndex >= 0 && newIndex < currentAttachments.length) {
        openFullscreen(currentAttachments, newIndex);
    }
}

// 图片缩放
function zoomImage(delta) {
    const modalImage = document.getElementById('modalImage');
    const zoomLevel = document.getElementById('zoomLevel');
    
    currentZoom = Math.max(0.25, Math.min(3, currentZoom + delta));
    modalImage.style.transform = `scale(${currentZoom})`;
    zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
    
    // 更新鼠标样式
    modalImage.style.cursor = currentZoom > 1 ? 'zoom-out' : 'zoom-in';
}

// 重置缩放
function resetZoom() {
    const modalImage = document.getElementById('modalImage');
    const zoomLevel = document.getElementById('zoomLevel');
    
    currentZoom = 1;
    modalImage.style.transform = 'scale(1)';
    zoomLevel.textContent = '100%';
    modalImage.style.cursor = 'zoom-in';
}

// 导出知识
function exportKnowledge(id) {
    const item = allKnowledge.find(k => k.id === id);
    if (!item) return;
    
    const author = allUsers.find(u => u.id === item.author);
    const authorName = author ? author.username : '未知作者';
    
    const mdContent = `---
title: "${item.title}"
description: "${item.description}"
tags: ${JSON.stringify(item.tags)}
author: ${authorName}
createdAt: ${item.createdAt}
updatedAt: ${item.updatedAt}
---

# ${item.title}

## 描述

${item.description}

## 正文

${item.content}

${item.files && item.files.length > 0 ? `## 附件

${item.files.map(f => `- [${f.name}](${f.downloadUrl})`).join('\n')}` : ''}
`;
    
    downloadFile(mdContent, `${item.title}.md`, 'text/markdown');
}

// 下载文件
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    
    console.log('=== 开始发布知识 ===');
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const content = document.getElementById('content').value;
    const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t);
    
    console.log('知识标题:', title);
    console.log('知识描述:', description);
    console.log('知识内容长度:', content.length);
    console.log('标签:', tags);
    console.log('当前用户ID:', currentUser.id);
    
    const newId = allKnowledge.length > 0 ? Math.max(...allKnowledge.map(k => k.id)) + 1 : 1;
    console.log('新知识ID:', newId);
    
    // 上传附件
    const uploadedFileInfo = [];
    console.log('开始上传附件，数量:', uploadedFiles.length);
    
    for (let i = 0; i < uploadedFiles.length; i++) {
        const fileInfo = uploadedFiles[i];
        try {
            console.log(`正在上传第 ${i + 1}/${uploadedFiles.length} 个文件:`, fileInfo.name);
            const filePath = `${CONFIG.ATTACHMENTS_DIR}/${newId}/${fileInfo.name}`;
            console.log('文件路径:', filePath);
            
            const result = await uploadBinaryFile(fileInfo.file, filePath);
            console.log('文件上传成功:', result);
            
            uploadedFileInfo.push({
                name: fileInfo.name,
                size: fileInfo.size,
                type: fileInfo.type,
                path: filePath,
                downloadUrl: result.content.download_url
            });
            console.log('附件信息已添加:', uploadedFileInfo[i]);
        } catch (error) {
            console.error('上传附件失败:', error);
            alert(`上传文件 ${fileInfo.name} 失败: ${error.message}`);
            return;
        }
    }
    
    console.log('所有附件上传完成');
    
    const mdContent = `---
title: "${title}"
description: "${description}"
tags: ${JSON.stringify(tags)}
author: ${currentUser.id}
createdAt: ${new Date().toISOString()}
updatedAt: ${new Date().toISOString()}
files: ${JSON.stringify(uploadedFileInfo)}
---

# ${title}

## 描述

${description}

## 正文

${content}

${uploadedFileInfo.length > 0 ? `## 附件

${uploadedFileInfo.map(f => `- [${f.name}](${f.downloadUrl})`).join('\n')}` : ''}
`;
    
    console.log('Markdown 内容长度:', mdContent.length);
    console.log('准备保存到 GitHub...');
    
    try {
        const fileName = `${CONFIG.KNOWLEDGE_DIR}/${newId}.md`;
        console.log('保存文件名:', fileName);
        
        const saveResult = await saveGitHubFile(fileName, mdContent, `创建知识: ${title}`);
        console.log('文件保存结果:', saveResult);
        
        if (saveResult) {
            console.log('GitHub 保存成功，文件 URL:', saveResult.content.download_url);
            
            allKnowledge.unshift({
                id: newId,
                title,
                description,
                content,
                tags,
                author: currentUser.id,
                files: uploadedFileInfo,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            console.log('本地知识列表已更新，当前总数:', allKnowledge.length);
            console.log('=== 知识发布完成 ===');
            
            alert('知识发布成功');
            
            uploadedFiles = [];
            document.getElementById('knowledgeForm').reset();
            renderUploadedFiles();
            showPage('home');
        } else {
            console.error('GitHub 保存失败，返回结果为空');
            alert('发布失败，请检查网络连接');
        }
        
    } catch (error) {
        console.error('发布知识失败:', error);
        alert('发布失败: ' + error.message);
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
        // 删除附件文件
        if (item.files && item.files.length > 0) {
            for (const file of item.files) {
                const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${file.path}`);
                if (response.ok) {
                    const data = await response.json();
                    await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${file.path}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `token ${getGitHubToken()}`
                        },
                        body: JSON.stringify({
                            message: `Delete attachment: ${file.name}`,
                            sha: data.sha
                        })
                    });
                }
            }
        }
        
        // 删除知识文件
        const response = await fetch(`${CONFIG.GITHUB_API_BASE}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.KNOWLEDGE_DIR}/${id}.md`);
        const data = await response.json();
        
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
        const hasAttachments = item.files && item.files.length > 0;
        
        return `
            <div class="knowledge-item">
                <div class="knowledge-info">
                    <div class="knowledge-title">${escapeHtml(item.title)}</div>
                    <div>作者: ${escapeHtml(authorName)}</div>
                    <div>创建时间: ${formatDate(item.createdAt)}</div>
                    ${hasAttachments ? `<div>📎 ${item.files.length} 个附件</div>` : ''}
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
    document.querySelectorAll('.admin-tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabName + 'Tab').style.display = 'block';
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