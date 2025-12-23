# 读秀ZIP转PDF在线工具

一个基于 Cloudflare Workers 的在线工具，用于将读秀下载的ZIP文件转换为PDF格式。

## ✨ 功能特性

- 📦 **支持多种格式**：ZIP、UVZ、CBZ 压缩包
- 🖼️ **智能转换**：自动识别PDG、JPG、PNG等图片格式
- ⚡ **快速处理**：基于Cloudflare全球CDN，转换速度快
- 🔒 **安全可靠**：使用R2存储，数据加密传输
- 💎 **精美界面**：现代化UI设计，操作简单直观
- 📱 **响应式设计**：支持桌面和移动设备

## 🚀 快速开始

### 1. 前置要求

- Node.js 16+ 
- Cloudflare账号
- Wrangler CLI

### 2. 安装依赖

\`\`\`bash
cd duxiu-zip2pdf-worker
npm install
\`\`\`

### 3. 配置R2存储桶

在Cloudflare Dashboard中创建R2存储桶：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **R2** 服务
3. 创建新存储桶，名称为：\`duxiu-pdf-storage\`

或者使用Wrangler命令创建：

\`\`\`bash
npx wrangler r2 bucket create duxiu-pdf-storage
\`\`\`

### 4. 本地开发

\`\`\`bash
npm run dev
\`\`\`

访问 \`http://localhost:8787\` 查看效果

### 5. 部署到Cloudflare

\`\`\`bash
npm run deploy
\`\`\`

部署完成后，访问分配的 \`workers.dev\` 域名即可使用。

## 📖 使用说明

### 上传并转换

1. 打开网页
2. 点击或拖拽ZIP文件到上传区域
3. 点击"开始转换为PDF"按钮
4. 等待转换完成
5. 点击"下载PDF文件"按钮获取转换后的PDF

### API接口

#### 上传文件
\`\`\`
POST /upload
Content-Type: multipart/form-data

body: FormData with 'file' field
\`\`\`

#### 转换文件
\`\`\`
POST /convert
Content-Type: application/json

body: { "key": "uploads/xxx.zip" }
\`\`\`

#### 下载文件
\`\`\`
GET /download?key=pdfs/xxx.pdf
\`\`\`

#### 列出文件
\`\`\`
GET /list
\`\`\`

## 🔧 配置说明

### wrangler.toml

\`\`\`toml
name = "duxiu-zip2pdf-worker"
main = "src/index.js"
compatibility_date = "2024-12-01"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "duxiu-pdf-storage"
\`\`\`

- \`name\`: Worker名称
- \`bucket_name\`: R2存储桶名称（需要与创建的存储桶名称一致）

## 📁 项目结构

\`\`\`
duxiu-zip2pdf-worker/
├── src/
│   └── index.js          # 主Worker代码
├── wrangler.toml         # Wrangler配置
├── package.json          # 项目依赖
├── .gitignore           # Git忽略文件
└── README.md            # 项目说明
\`\`\`

## 🛠️ 技术栈

- **Cloudflare Workers**: 边缘计算平台
- **R2 Storage**: 对象存储服务
- **fflate**: ZIP解压库
- **pdf-lib**: PDF生成库
- **原生JavaScript**: 无需框架的纯前端实现

## 📝 工作原理

1. **上传阶段**：用户上传ZIP文件，存储到R2的\`uploads/\`目录
2. **解压阶段**：使用fflate库解压ZIP文件
3. **提取阶段**：提取所有图片文件（PDG/JPG/PNG等）
4. **排序阶段**：按文件名自然排序
5. **转换阶段**：使用pdf-lib将图片逐页嵌入PDF
6. **存储阶段**：将生成的PDF存储到R2的\`pdfs/\`目录
7. **下载阶段**：用户下载转换后的PDF文件

## ⚠️ 注意事项

1. **文件大小限制**：Workers有100MB的请求体限制，大文件可能需要分块上传
2. **执行时间限制**：免费版Workers有30秒的执行时间限制
3. **PDG格式**：PDG文件实际上是JPG格式，程序会自动尝试识别
4. **内存使用**：处理大量图片时注意内存使用

## 🎯 优化建议

### 处理大文件

如果需要处理超过100MB的文件，可以考虑：

1. 使用R2的多部分上传API
2. 实现进度条和分块上传
3. 使用Durable Objects进行状态管理

### 提升性能

1. 启用R2缓存
2. 使用Workers KV缓存转换结果
3. 实现并行处理多个图片

## 🔐 安全性

- 所有文件传输使用HTTPS加密
- R2存储默认私有
- 可以添加访问令牌认证
- 建议设置CORS策略

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📮 联系方式

如有问题或建议，请提交Issue。

## 🙏 致谢

- 基于原 [zip2pdf](https://github.com/Davy-Zhou/zip2pdf) 项目的转换逻辑
- 感谢Cloudflare提供的优秀服务

---

**注意**：本工具仅供学习和个人使用，请遵守相关法律法规和版权规定。
