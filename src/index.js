import { unzip, unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { COMMON_PASSWORDS } from './passwords.js';

/**
 * 读秀ZIP转PDF Worker
 * 功能：上传读秀ZIP文件，自动转换为PDF并提供下载
 * 支持自动密码破解（391个常用密码）
 */
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // 路由处理
            switch (path) {
                case '/':
                    return handleHomePage(corsHeaders);

                case '/upload':
                    if (request.method !== 'POST') {
                        return new Response('Method not allowed', { status: 405 });
                    }
                    return await handleUpload(request, env, corsHeaders);

                case '/convert':
                    if (request.method !== 'POST') {
                        return new Response('Method not allowed', { status: 405 });
                    }
                    return await handleConvert(request, env, corsHeaders);

                case '/download':
                    return await handleDownload(request, env, corsHeaders);

                case '/list':
                    return await handleList(env, corsHeaders);

                default:
                    return new Response('Not found', { status: 404, headers: corsHeaders });
            }
        } catch (error) {
            console.error('Error:', error);
            return new Response(JSON.stringify({
                error: error.message,
                stack: error.stack
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};

/**
 * 返回首页HTML
 */
function handleHomePage(corsHeaders) {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>读秀ZIP转PDF在线工具</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .container {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 800px;
      width: 100%;
      animation: slideUp 0.5s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    h1 {
      color: #667eea;
      text-align: center;
      margin-bottom: 10px;
      font-size: 2.5em;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 30px;
      font-size: 1.1em;
    }

    .upload-area {
      border: 3px dashed #667eea;
      border-radius: 16px;
      padding: 60px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
      margin-bottom: 30px;
    }

    .upload-area:hover {
      border-color: #764ba2;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
      transform: translateY(-2px);
    }

    .upload-area.dragging {
      border-color: #764ba2;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
      transform: scale(1.02);
    }

    .upload-icon {
      font-size: 64px;
      margin-bottom: 20px;
      opacity: 0.7;
    }

    .upload-text {
      font-size: 1.2em;
      color: #667eea;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .upload-hint {
      color: #999;
      font-size: 0.9em;
    }

    input[type="file"] {
      display: none;
    }

    .btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 15px 40px;
      border-radius: 12px;
      font-size: 1.1em;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      width: 100%;
      margin-top: 10px;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .progress-container {
      display: none;
      margin-top: 30px;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 15px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      width: 0%;
      transition: width 0.3s ease;
      border-radius: 10px;
    }

    .status {
      text-align: center;
      color: #666;
      font-size: 1em;
      margin-bottom: 10px;
    }

    .file-info {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 12px;
      margin-top: 20px;
      display: none;
    }

    .file-info-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .file-info-item:last-child {
      border-bottom: none;
    }

    .file-info-label {
      color: #667eea;
      font-weight: 600;
    }

    .file-info-value {
      color: #333;
    }

    .result-container {
      display: none;
      margin-top: 30px;
      padding: 20px;
      background: linear-gradient(135deg, rgba(102, 234, 147, 0.1) 0%, rgba(102, 126, 234, 0.1) 100%);
      border-radius: 12px;
      border: 2px solid #66ea93;
    }

    .success-icon {
      font-size: 48px;
      text-align: center;
      margin-bottom: 15px;
    }

    .result-text {
      text-align: center;
      color: #22c55e;
      font-size: 1.2em;
      font-weight: 600;
      margin-bottom: 20px;
    }

    .download-btn {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
    }

    .download-btn:hover {
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.5);
    }

    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }

    .feature {
      text-align: center;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    .feature:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }

    .feature-icon {
      font-size: 36px;
      margin-bottom: 10px;
    }

    .feature-title {
      color: #667eea;
      font-weight: 600;
      margin-bottom: 5px;
    }

    .feature-desc {
      color: #666;
      font-size: 0.9em;
    }

    .error-message {
      background: #fee;
      color: #c33;
      padding: 15px;
      border-radius: 8px;
      margin-top: 15px;
      display: none;
      border-left: 4px solid #c33;
    }

    @media (max-width: 768px) {
      .container {
        padding: 25px;
      }

      h1 {
        font-size: 2em;
      }

      .features {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📚 读秀ZIP转PDF</h1>
    <p class="subtitle">在线转换工具 - 快速、安全、免费 | 支持自动密码破解</p>

    <div class="upload-area" id="uploadArea">
      <div class="upload-icon">📦</div>
      <div class="upload-text">点击或拖拽ZIP文件到这里</div>
      <div class="upload-hint">支持读秀下载的ZIP格式文件（自动解密）</div>
      <input type="file" id="fileInput" accept=".zip,.uvz,.cbz" />
    </div>

    <div class="file-info" id="fileInfo"></div>

    <button class="btn" id="convertBtn" disabled>开始转换为PDF</button>

    <div class="progress-container" id="progressContainer">
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <div class="status" id="status">准备中...</div>
    </div>

    <div class="error-message" id="errorMessage"></div>

    <div class="result-container" id="resultContainer">
      <div class="success-icon">✅</div>
      <div class="result-text" id="resultText">转换成功！</div>
      <button class="btn download-btn" id="downloadBtn">下载PDF文件</button>
    </div>

    <div class="features">
      <div class="feature">
        <div class="feature-icon">⚡</div>
        <div class="feature-title">快速转换</div>
        <div class="feature-desc">云端处理，秒级响应</div>
      </div>
      <div class="feature">
        <div class="feature-icon">�</div>
        <div class="feature-title">自动解密</div>
        <div class="feature-desc">内置391个常用密码</div>
      </div>
      <div class="feature">
        <div class="feature-icon">💾</div>
        <div class="feature-title">R2存储</div>
        <div class="feature-desc">Cloudflare全球CDN</div>
      </div>
    </div>
  </div>

  <script>
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const convertBtn = document.getElementById('convertBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const status = document.getElementById('status');
    const fileInfo = document.getElementById('fileInfo');
    const resultContainer = document.getElementById('resultContainer');
    const resultText = document.getElementById('resultText');
    const downloadBtn = document.getElementById('downloadBtn');
    const errorMessage = document.getElementById('errorMessage');

    let selectedFile = null;
    let uploadedFileKey = null;

    uploadArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      handleFileSelect(e.target.files[0]);
    });

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragging');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragging');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragging');
      handleFileSelect(e.dataTransfer.files[0]);
    });

    function handleFileSelect(file) {
      if (!file) return;

      const validExtensions = ['.zip', '.uvz', '.cbz'];
      const fileName = file.name.toLowerCase();
      const isValid = validExtensions.some(ext => fileName.endsWith(ext));

      if (!isValid) {
        showError('请选择有效的ZIP文件（支持.zip、.uvz、.cbz格式）');
        return;
      }

      selectedFile = file;
      convertBtn.disabled = false;
      
      fileInfo.style.display = 'block';
      fileInfo.innerHTML = '<div class="file-info-item"><span class="file-info-label">文件名：</span><span class="file-info-value">' + file.name + '</span></div>' +
        '<div class="file-info-item"><span class="file-info-label">文件大小：</span><span class="file-info-value">' + formatFileSize(file.size) + '</span></div>' +
        '<div class="file-info-item"><span class="file-info-label">文件类型：</span><span class="file-info-value">' + (file.type || '压缩文件') + '</span></div>';

      hideError();
    }

    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    convertBtn.addEventListener('click', async () => {
      if (!selectedFile) return;

      convertBtn.disabled = true;
      progressContainer.style.display = 'block';
      resultContainer.style.display = 'none';
      hideError();

      try {
        updateProgress(10, '正在上传文件...');
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);

        const uploadResponse = await fetch('/upload', {
          method: 'POST',
          body: uploadFormData
        });

        if (!uploadResponse.ok) {
          throw new Error('文件上传失败');
        }

        const uploadResult = await uploadResponse.json();
        uploadedFileKey = uploadResult.key;

        updateProgress(40, '文件上传成功，正在解压...');

        await new Promise(resolve => setTimeout(resolve, 500));
        updateProgress(60, '正在转换为PDF...');

        const convertResponse = await fetch('/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ key: uploadedFileKey })
        });

        if (!convertResponse.ok) {
          const error = await convertResponse.json();
          throw new Error(error.error || '转换失败');
        }

        const convertResult = await convertResponse.json();

        updateProgress(100, '转换完成！');

        await new Promise(resolve => setTimeout(resolve, 500));
        resultContainer.style.display = 'block';
        
        if (convertResult.hasPassword) {
          resultText.innerHTML = '转换成功！<br><span style="font-size: 0.8em; color: #666;">已自动解密（密码: ' + convertResult.password + '）</span>';
        } else {
          resultText.textContent = '转换成功！';
        }
        
        downloadBtn.onclick = () => {
          window.location.href = '/download?key=' + convertResult.pdfKey;
        };

      } catch (error) {
        console.error('Error:', error);
        showError('转换失败：' + error.message);
        convertBtn.disabled = false;
        progressContainer.style.display = 'none';
      }
    });

    function updateProgress(percent, statusText) {
      progressFill.style.width = percent + '%';
      status.textContent = statusText;
    }

    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
    }

    function hideError() {
      errorMessage.style.display = 'none';
    }
  </script>
</body>
</html>`;

    return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
}

/**
 * 处理文件上传
 */
async function handleUpload(request, env, corsHeaders) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return new Response(JSON.stringify({ error: '没有找到文件' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const fileKey = `uploads/${timestamp}-${randomStr}-${file.name}`;

        await env.BUCKET.put(fileKey, file.stream(), {
            httpMetadata: {
                contentType: file.type || 'application/zip'
            }
        });

        return new Response(JSON.stringify({
            success: true,
            key: fileKey,
            filename: file.name,
            size: file.size
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Upload error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 处理ZIP转PDF转换（支持自动密码破解）
 */
async function handleConvert(request, env, corsHeaders) {
    try {
        const { key } = await request.json();

        if (!key) {
            return new Response(JSON.stringify({ error: '缺少文件key' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const object = await env.BUCKET.get(key);
        if (!object) {
            return new Response(JSON.stringify({ error: '文件不存在' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const zipData = await object.arrayBuffer();

        // 尝试解压ZIP文件（包含密码尝试）
        let files = null;
        let usedPassword = null;

        // 首先尝试无密码解压
        try {
            files = await new Promise((resolve, reject) => {
                unzip(new Uint8Array(zipData), (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            console.log('ZIP文件无密码，解压成功');
        } catch (error) {
            console.log('ZIP文件可能有密码，开始尝试密码破解...');

            // 如果无密码解压失败，尝试常用密码
            for (let i = 0; i < COMMON_PASSWORDS.length; i++) {
                const password = COMMON_PASSWORDS[i];
                try {
                    const textEncoder = new TextEncoder();
                    const passwordBytes = textEncoder.encode(password);

                    files = unzipSync(new Uint8Array(zipData), {
                        password: passwordBytes
                    });

                    usedPassword = password;
                    console.log(`成功解密！使用密码: ${password} (第${i + 1}/${COMMON_PASSWORDS.length}个)`);
                    break;
                } catch (err) {
                    if (i % 10 === 0 && i > 0) {
                        console.log(`已尝试 ${i} 个密码...`);
                    }
                    continue;
                }
            }

            if (!files) {
                return new Response(JSON.stringify({
                    error: '无法解压ZIP文件：文件可能已加密，且密码不在已知列表中',
                    tried: COMMON_PASSWORDS.length
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // 提取图片文件并排序
        const imageFiles = [];
        for (const [filename, data] of Object.entries(files)) {
            const lowerName = filename.toLowerCase();
            if (lowerName.endsWith('.pdg') ||
                lowerName.endsWith('.jpg') ||
                lowerName.endsWith('.jpeg') ||
                lowerName.endsWith('.png') ||
                lowerName.endsWith('.bmp') ||
                lowerName.endsWith('.tif') ||
                lowerName.endsWith('.tiff')) {
                imageFiles.push({ filename, data });
            }
        }

        if (imageFiles.length === 0) {
            return new Response(JSON.stringify({ error: 'ZIP文件中没有找到图片' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 自然排序
        imageFiles.sort((a, b) => {
            return a.filename.localeCompare(b.filename, undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        });

        // 创建PDF
        const pdfDoc = await PDFDocument.create();

        for (const { filename, data } of imageFiles) {
            try {
                let image;
                const lowerName = filename.toLowerCase();

                if (lowerName.endsWith('.pdg')) {
                    try {
                        image = await pdfDoc.embedJpg(data);
                    } catch {
                        try {
                            image = await pdfDoc.embedPng(data);
                        } catch {
                            console.warn(`无法嵌入图片: ${filename}`);
                            continue;
                        }
                    }
                } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
                    image = await pdfDoc.embedJpg(data);
                } else if (lowerName.endsWith('.png')) {
                    image = await pdfDoc.embedPng(data);
                } else {
                    try {
                        image = await pdfDoc.embedJpg(data);
                    } catch {
                        console.warn(`跳过不支持的格式: ${filename}`);
                        continue;
                    }
                }

                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                });
            } catch (error) {
                console.error(`处理图片失败 ${filename}:`, error);
            }
        }

        const pdfBytes = await pdfDoc.save();

        const pdfKey = key.replace('uploads/', 'pdfs/').replace(/\.(zip|uvz|cbz)$/i, '.pdf');
        await env.BUCKET.put(pdfKey, pdfBytes, {
            httpMetadata: {
                contentType: 'application/pdf'
            }
        });

        return new Response(JSON.stringify({
            success: true,
            pdfKey: pdfKey,
            pages: imageFiles.length,
            hasPassword: usedPassword !== null,
            password: usedPassword
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Convert error:', error);
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 处理文件下载
 */
async function handleDownload(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const key = url.searchParams.get('key');

        if (!key) {
            return new Response('Missing key parameter', { status: 400 });
        }

        const object = await env.BUCKET.get(key);
        if (!object) {
            return new Response('File not found', { status: 404 });
        }

        const filename = key.split('/').pop();

        return new Response(object.body, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            }
        });
    } catch (error) {
        console.error('Download error:', error);
        return new Response('Download failed: ' + error.message, {
            status: 500,
            headers: corsHeaders
        });
    }
}

/**
 * 列出所有文件
 */
async function handleList(env, corsHeaders) {
    try {
        const list = await env.BUCKET.list({ prefix: 'pdfs/' });

        const files = list.objects.map(obj => ({
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded
        }));

        return new Response(JSON.stringify({
            success: true,
            files: files
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('List error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
