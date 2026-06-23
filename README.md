# 知识分享网站

一个基于Node.js的知识分享平台，支持用户管理、知识分享、搜索和Git版本控制。

## 功能特性

- **用户管理**：用户注册、登录、管理员审核
- **知识分享**：支持纯文字、图片、文档上传，支持标签
- **搜索功能**：按标题、描述、正文搜索
- **权限管理**：管理员最高权限，作者只能管理自己的内容
- **Git集成**：项目可直接上传到GitHub

## 技术栈

- Node.js
- Express.js
- JWT认证
- Multer文件上传

## 快速开始

### 安装依赖

```bash
cd backend
npm install
```

### 启动服务

```bash
cd backend
node server.js
```

服务启动后访问 `http://localhost:3000`

### 默认管理员账号

- 邮箱：admin@example.com
- 密码：admin123

## API接口

### 用户相关

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/register | 用户注册 |
| POST | /api/login | 用户登录 |
| GET | /api/users | 获取用户列表(管理员) |
| PUT | /api/users/:userId/approve | 审核通过用户(管理员) |
| PUT | /api/users/:userId/reject | 拒绝用户(管理员) |
| DELETE | /api/users/:userId | 删除用户(管理员) |

### 知识相关

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/knowledge | 创建知识 |
| GET | /api/knowledge | 获取所有知识 |
| GET | /api/knowledge/search?keyword=xxx | 搜索知识 |
| GET | /api/knowledge/:id | 获取知识详情 |
| PUT | /api/knowledge/:id | 更新知识 |
| DELETE | /api/knowledge/:id | 删除知识 |

## 项目结构

```
knowledge-sharing-website/
├── backend/
│   ├── server.js          # 服务器入口
│   ├── package.json       # 依赖配置
│   ├── uploads/           # 文件上传目录
│   └── .env               # 环境变量
├── frontend/public/
│   └── index.html         # 前端页面
├── .gitignore             # Git忽略文件
└── README.md              # 项目说明
```

## 部署到GitHub

1. 创建GitHub仓库
2. 添加远程仓库：
```bash
git remote add origin https://github.com/your-username/knowledge-sharing-website.git
```
3. 提交并推送：
```bash
git add .
git commit -m "Initial commit"
git push -u origin main
```

## License

MIT