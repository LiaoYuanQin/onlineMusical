# 知识分享网站

一个基于纯前端的知识分享平台，数据直接存储在GitHub上，无需后端服务器。

## 功能特性

- **用户管理**：用户注册、登录、管理员审核
- **知识分享**：支持纯文字内容发布，支持标签
- **搜索功能**：按标题、描述、正文搜索
- **权限管理**：管理员最高权限，作者只能管理自己的内容
- **GitHub集成**：数据直接存储在GitHub仓库中

## 技术栈

- 纯HTML/CSS/JavaScript
- GitHub API
- LocalStorage (本地状态管理)

## 快速开始

### 1. 克隆或下载项目

```bash
git clone https://github.com/LiaoYuanQin/onlineMusical.git
cd onlineMusical
```

### 2. 配置GitHub Token

由于需要向GitHub写入数据，你需要创建GitHub Personal Access Token：

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 选择权限：`repo` (完整仓库访问权限)
4. 生成并复制token

### 3. 打开网站

直接用浏览器打开 `index.html` 文件，或者使用本地服务器：

```bash
# 使用Python
python -m http.server 8000

# 使用Node.js
npx http-server

# 然后访问 http://localhost:8000
```

### 4. 首次登录

首次登录时，系统会提示输入GitHub Token，输入刚才创建的token即可。

### 默认管理员账号

- 邮箱：`admin@example.com`
- 密码：`admin123`

## 项目结构

```
onlineMusical/
├── index.html          # 主页面
├── styles.css          # 样式文件
├── app.js              # 应用逻辑
├── data/
│   └── users.json      # 用户数据
├── knowledge/          # 知识内容目录
│   ├── 1.md           # 知识文件
│   └── ...
└── README.md          # 项目说明
```

## 数据存储

### 用户数据
存储在 `data/users.json` 文件中，包含：
- 用户基本信息
- 认证状态
- 角色权限

### 知识数据
存储在 `knowledge/` 目录中，每个知识对应一个Markdown文件：
- 文件名格式：`{id}.md`
- 包含元数据（标题、描述、标签、作者、时间）
- 包含正文内容

## API接口

项目使用GitHub API进行数据操作：

| 操作 | GitHub API |
|------|-----------|
| 读取文件 | GET /repos/{owner}/{repo}/contents/{path} |
| 创建/更新文件 | PUT /repos/{owner}/{repo}/contents/{path} |
| 删除文件 | DELETE /repos/{owner}/{repo}/contents/{path} |

## 使用说明

### 用户注册
1. 点击"注册"按钮
2. 填写用户名、邮箱、密码
3. 等待管理员审核

### 发布知识
1. 登录后点击"发布知识"
2. 填写标题、描述、正文内容
3. 添加标签（可选）
4. 点击"发布"按钮

### 搜索知识
1. 点击"搜索"按钮
2. 输入关键词
3. 系统会搜索标题、描述、正文

### 管理功能（仅管理员）
- 审核用户注册申请
- 删除用户
- 管理所有知识内容

## 部署到GitHub Pages

1. 确保项目已推送到GitHub
2. 进入仓库设置 -> Pages
3. 选择分支为 `main`，文件夹为 `/root`
4. 保存后即可通过 `https://your-username.github.io/onlineMusical` 访问

## 注意事项

1. **GitHub Token安全**：Token存储在浏览器LocalStorage中，请勿在公共设备上使用
2. **数据同步**：由于使用GitHub API，数据操作可能有轻微延迟
3. **权限要求**：需要GitHub Token的`repo`权限才能完整使用所有功能
4. **网络依赖**：需要稳定的网络连接访问GitHub API

## 开发说明

### 修改配置
在 `app.js` 中修改 `CONFIG` 对象：

```javascript
const CONFIG = {
    GITHUB_REPO: 'your-username/your-repo',  // 修改为你的仓库
    GITHUB_API_BASE: 'https://api.github.com/repos',
    USERS_FILE: 'data/users.json',
    KNOWLEDGE_DIR: 'knowledge'
};
```

### 添加新功能
1. 在 `app.js` 中添加相应函数
2. 在 `index.html` 中添加UI元素
3. 在 `styles.css` 中添加样式

## License

MIT