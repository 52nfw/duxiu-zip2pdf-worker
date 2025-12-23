import { unzip, unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { COMMON_PASSWORDS } from './passwords.js';

/**
 * 读秀ZIP转PDF Worker - 增强版
 * 新功能：
 * - 封面封底检测（cov001/cov002）
 * - 分块文件上传
 * - 改进的进度显示
 * - 手动密码输入
 */
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Content-Range, X-Custom-Password',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
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

                case '/cleanup':
                    return await handleCleanup(env, corsHeaders);

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
 * 返回首页HTML（包含手动密码输入和改进的进度显示）
 */
function handleHomePage(corsHeaders) {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>读秀ZIP转PDF在线工具</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
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
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
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
    .upload-icon { font-size: 64px; margin-bottom: 20px; opacity: 0.7; }
    .upload-text { font-size: 1.2em; color: #667eea; margin-bottom: 10px; font-weight: 600; }
    .upload-hint { color: #999; font-size: 0.9em; }
    input[type="file"], input[type="password"] { display: none; }
    .password-input-container {
      display: none;
      margin: 20px 0;
      padding: 20px;
      background: #fff3cd;
      border-radius: 12px;
      border-left: 4px solid #ffc107;
    }
    .password-input-container.show { display: block; }
    .password-input-title {
      color: #856404;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .password-input-hint {
      color: #856404;
      font-size: 0.9em;
      margin-bottom: 10px;
    }
    .password-input-box {
      display: flex;
      gap: 10px;
    }
    .password-input-box input {
      display: block;
      flex: 1;
      padding: 10px;
      border: 2px solid #ffc107;
      border-radius: 8px;
      font-size: 1em;
    }
    .password-input-box button {
      padding: 10px 20px;
      background: #ffc107;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
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
    .file-info-item:last-child { border-bottom: none; }
    .file-info-label { color: #667eea; font-weight: 600; }
    .file-info-value { color: #333; }
    .result-container {
      display: none;
      margin-top: 30px;
      padding: 20px;
      background: linear-gradient(135deg, rgba(102, 234, 147, 0.1) 0%, rgba(102, 126, 234, 0.1) 100%);
      border-radius: 12px;
      border: 2px solid #66ea93;
    }
    .success-icon { font-size: 48px; text-align: center; margin-bottom: 15px; }
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
    .error-message {
      background: #fee;
      color: #c33;
      padding: 15px;
      border-radius: 8px;
      margin-top: 15px;
      display: none;
      border-left: 4px solid #c33;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-top: 30px;
    }
    .feature {
      text-align: center;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 12px;
      transition: all 0.3s ease;
    }
    .feature:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }
    .feature-icon { font-size: 30px; margin-bottom: 8px; }
    .feature-title { color: #667eea; font-weight: 600; margin-bottom: 5px; font-size: 0.9em; }
    .feature-desc { color: #666; font-size: 0.8em; }
    .disclaimer {
      margin-top: 30px;
      padding: 20px;
      background: #fff9e6;
      border-left: 4px solid #ffc107;
      border-radius: 8px;
      font-size: 0.85em;
      color: #856404;
    }
    .disclaimer-title {
      font-weight: 700;
      margin-bottom: 10px;
      color: #d39e00;
      font-size: 1.1em;
    }
    .disclaimer-content {
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .disclaimer-highlight {
      color: #d39e00;
      font-weight: 600;
    }
    @media (max-width: 768px) {
      .container { padding: 25px; }
      h1 { font-size: 2em; }
      .features { grid-template-columns: 1fr; }
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
      <div class="upload-hint">支持读秀下载的ZIP格式文件（自动识别封面封底）</div>
      <input type="file" id="fileInput" accept=".zip,.uvz,.cbz" />
    </div>

    <div class="file-info" id="fileInfo"></div>

    <div class="password-input-container" id="passwordInputContainer">
      <div class="password-input-title">⚠️ 自动解密失败</div>
      <div class="password-input-hint">请手动输入ZIP密码（如果知道的话）：</div>
      <div class="password-input-box">
        <input type="text" id="manualPassword" placeholder="输入密码" />
        <button onclick="retryWithManualPassword()">重试</button>
      </div>
    </div>

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
        <div class="feature-desc">云端处理</div>
      </div>
      <div class="feature">
        <div class="feature-icon">🔓</div>
        <div class="feature-title">自动解密</div>
        <div class="feature-desc">391个密码</div>
      </div>
      <div class="feature">
        <div class="feature-icon">📖</div>
        <div class="feature-title">封面识别</div>
        <div class="feature-desc">智能排序</div>
      </div>
      <div class="feature">
        <div class="feature-icon">📤</div>
        <div class="feature-title">分块上传</div>
        <div class="feature-desc">大文件支持</div>
      </div>
    </div>

    <div class="disclaimer">
      <div class="disclaimer-title">⚠️ 免责声明与使用须知</div>
      <div class="disclaimer-content">
        <strong class="disclaimer-highlight">1. 文件存储时限：</strong>转换完成的PDF文件将在服务器上保存<strong class="disclaimer-highlight">24小时</strong>后自动删除，请及时下载保存。
      </div>
      <div class="disclaimer-content">
        <strong class="disclaimer-highlight">2. 版权声明：</strong>本工具仅供个人学习研究使用。请确保您有权使用所上传的文件，并遵守相关版权法律法规。
      </div>
      <div class="disclaimer-content">
        <strong class="disclaimer-highlight">3. 隐私保护：</strong>上传的文件仅用于转换处理，24小时后自动删除。我们不会保存、分享或用于其他目的。
      </div>
      <div class="disclaimer-content">
        <strong class="disclaimer-highlight">4. 使用限制：</strong>请勿上传违法、侵权或不当内容。违规使用造成的法律责任由用户自行承担。
      </div>
      <div class="disclaimer-content">
        <strong class="disclaimer-highlight">5. 服务免责：</strong>本服务按"现状"提供，不保证100%成功转换。因使用本服务产生的任何问题，使用者需自行承担风险。
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
    const passwordInputContainer = document.getElementById('passwordInputContainer');
    const manualPassword = document.getElementById('manualPassword');

    let selectedFile = null;
    let uploadedFileKey = null;
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragging');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragging'));
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragging');
      handleFileSelect(e.dataTransfer.files[0]);
    });

    function handleFileSelect(file) {
      if (!file) return;
      const validExtensions = ['.zip', '.uvz', '.cbz'];
      const fileName = file.name.toLowerCase();
      if (!validExtensions.some(ext => fileName.endsWith(ext))) {
        showError('请选择有效的ZIP文件');
        return;
      }
      selectedFile = file;
      convertBtn.disabled = false;
      fileInfo.style.display = 'block';
      fileInfo.innerHTML = 
        '<div class="file-info-item"><span class="file-info-label">文件名：</span><span class="file-info-value">' + file.name + '</span></div>' +
        '<div class="file-info-item"><span class="file-info-label">文件大小：</span><span class="file-info-value">' + formatFileSize(file.size) + '</span></div>' +
        '<div class="file-info-item"><span class="file-info-label">上传方式：</span><span class="file-info-value">' + (file.size > CHUNK_SIZE ? '分块上传' : '直接上传') + '</span></div>';
      hideError();
      passwordInputContainer.classList.remove('show');
    }

    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // 分块上传函数
    async function uploadFileInChunks(file) {
      const chunks = Math.ceil(file.size / CHUNK_SIZE);
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const fileKey = 'uploads/' + timestamp + '-' + randomStr + '-' + file.name;

      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('file', chunk);
        formData.append('chunkIndex', i);
        formData.append('totalChunks', chunks);
        formData.append('fileKey', fileKey);

        const progress = 10 + (i / chunks) * 30;
        updateProgress(progress, '上传中 (' + (i + 1) + '/' + chunks + ')...');

        const response = await fetch('/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('上传失败');
        }
      }

      return { key: fileKey, filename: file.name, size: file.size };
    }

    convertBtn.addEventListener('click', () => startConversion());

    async function startConversion(customPassword = null) {
      if (!selectedFile) return;

      convertBtn.disabled = true;
      progressContainer.style.display = 'block';
      resultContainer.style.display = 'none';
      hideError();
      passwordInputContainer.classList.remove('show');

      try {
        updateProgress(5, '准备上传...');

        let uploadResult;
        if (selectedFile.size > CHUNK_SIZE) {
          uploadResult = await uploadFileInChunks(selectedFile);
        } else {
          updateProgress(10, '正在上传文件...');
          const uploadFormData = new FormData();
          uploadFormData.append('file', selectedFile);
          const uploadResponse = await fetch('/upload', {
            method: 'POST',
            body: uploadFormData
          });
          if (!uploadResponse.ok) throw new Error('文件上传失败');
          uploadResult = await uploadResponse.json();
        }

        uploadedFileKey = uploadResult.key;
        updateProgress(45, '文件上传完成，开始解压...');

        await new Promise(resolve => setTimeout(resolve, 500));
        updateProgress(50, '正在解压和转换...');

        const convertHeaders = { 'Content-Type': 'application/json' };
        if (customPassword) {
          convertHeaders['X-Custom-Password'] = customPassword;
        }

        const convertResponse = await fetch('/convert', {
          method: 'POST',
          headers: convertHeaders,
          body: JSON.stringify({ key: uploadedFileKey })
        });

        if (!convertResponse.ok) {
          const error = await convertResponse.json();
          if (error.needPassword) {
            passwordInputContainer.classList.add('show');
            updateProgress(50, '需要手动输入密码');
            convertBtn.disabled = false;
            return;
          }
          throw new Error(error.error || '转换失败');
        }

        const convertResult = await convertResponse.json();
        updateProgress(100, '转换完成！');

        await new Promise(resolve => setTimeout(resolve, 500));
        resultContainer.style.display = 'block';
        
        let resultHtml = '转换成功！';
        if (convertResult.hasPassword) {
          resultHtml += '<br><span style="font-size: 0.8em; color: #666;">已自动解密（密码: ' + convertResult.password + '）</span>';
        }
        if (convertResult.hasCover) {
          resultHtml += '<br><span style="font-size: 0.8em; color: #666;">✓ 已识别封面封底</span>';
        }
        resultText.innerHTML = resultHtml;
        
        downloadBtn.onclick = () => {
          window.location.href = '/download?key=' + convertResult.pdfKey;
        };
        progressContainer.style.display = 'none';

      } catch (error) {
        console.error('Error:', error);
        showError('转换失败：' + error.message);
        convertBtn.disabled = false;
        updateProgress(0, '');
      }
    }

    function retryWithManualPassword() {
      const pwd = manualPassword.value.trim();
      if (!pwd) {
        alert('请输入密码');
        return;
      }
      startConversion(pwd);
    }

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
 * 处理文件上传（支持分块上传）
 */
async function handleUpload(request, env, corsHeaders) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const chunkIndex = formData.get('chunkIndex');
        const totalChunks = formData.get('totalChunks');
        const fileKey = formData.get('fileKey');

        if (!file) {
            return new Response(JSON.stringify({ error: '没有找到文件' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 分块上传
        if (chunkIndex !== null && totalChunks !== null && fileKey) {
            const chunkKey = `${fileKey}.chunk.${chunkIndex}`;
            await env.BUCKET.put(chunkKey, file.stream());

            // 如果是最后一块，合并所有块
            if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
                const chunks = [];
                for (let i = 0; i < parseInt(totalChunks); i++) {
                    const chunk = await env.BUCKET.get(`${fileKey}.chunk.${i}`);
                    if (chunk) {
                        chunks.push(await chunk.arrayBuffer());
                    }
                }

                // 合并所有块
                const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
                const merged = new Uint8Array(totalSize);
                let offset = 0;
                for (const chunk of chunks) {
                    merged.set(new Uint8Array(chunk), offset);
                    offset += chunk.byteLength;
                }

                // 保存合并后的文件
                await env.BUCKET.put(fileKey, merged, {
                    httpMetadata: { contentType: 'application/zip' }
                });

                // 删除临时块
                for (let i = 0; i < parseInt(totalChunks); i++) {
                    await env.BUCKET.delete(`${fileKey}.chunk.${i}`);
                }

                return new Response(JSON.stringify({
                    success: true,
                    key: fileKey,
                    complete: true
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({
                success: true,
                chunkIndex: parseInt(chunkIndex),
                complete: false
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 普通单次上传
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const key = `uploads/${timestamp}-${randomStr}-${file.name}`;

        await env.BUCKET.put(key, file.stream(), {
            httpMetadata: { contentType: file.type || 'application/zip' }
        });

        return new Response(JSON.stringify({
            success: true,
            key: key,
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
 * 处理ZIP转PDF转换（支持封面封底检测和手动密码）
 */
async function handleConvert(request, env, corsHeaders) {
    try {
        const { key } = await request.json();
        const customPassword = request.headers.get('X-Custom-Password');

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
        let files = null;
        let usedPassword = null;

        // 尝试解压
        try {
            files = await new Promise((resolve, reject) => {
                unzip(new Uint8Array(zipData), (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            console.log('ZIP文件无密码，解压成功');
        } catch (error) {
            console.log('ZIP文件有密码，开始尝试...');

            // 首先尝试用户提供的密码
            if (customPassword) {
                try {
                    const textEncoder = new TextEncoder();
                    files = unzipSync(new Uint8Array(zipData), {
                        password: textEncoder.encode(customPassword)
                    });
                    usedPassword = customPassword;
                    console.log('使用用户提供的密码成功');
                } catch {
                    // 用户密码失败，继续尝试常用密码
                }
            }

            // 尝试常用密码
            if (!files) {
                for (let i = 0; i < COMMON_PASSWORDS.length; i++) {
                    const password = COMMON_PASSWORDS[i];
                    try {
                        const textEncoder = new TextEncoder();
                        files = unzipSync(new Uint8Array(zipData), {
                            password: textEncoder.encode(password)
                        });
                        usedPassword = password;
                        console.log(`自动解密成功: ${password} (${i + 1}/${COMMON_PASSWORDS.length})`);
                        break;
                    } catch {
                        if (i % 10 === 0 && i > 0) {
                            console.log(`已尝试 ${i} 个密码...`);
                        }
                        continue;
                    }
                }
            }

            // 所有密码都失败，需要用户手动输入
            if (!files) {
                return new Response(JSON.stringify({
                    error: '无法解压ZIP文件：密码不在已知列表中',
                    needPassword: true,
                    tried: COMMON_PASSWORDS.length
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // 提取并分类图片文件（支持子文件夹）
        const imageFiles = [];
        let hasCover = false;
        let cover = null;
        let backCover = null;

        for (const [fullPath, data] of Object.entries(files)) {
            if (data.length === 0 || fullPath.endsWith('/') || fullPath.endsWith('\\')) continue;
            const lowerPath = fullPath.toLowerCase();
            const isImage = lowerPath.endsWith('.pdg') || lowerPath.endsWith('.jpg') ||
                lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.png') ||
                lowerPath.endsWith('.bmp') || lowerPath.endsWith('.tif') ||
                lowerPath.endsWith('.tiff') || lowerPath.endsWith('.gif');
            if (!isImage) continue;
            const fileName = fullPath.replace(/\\/g, '/').split('/').pop();
            const lowerFileName = fileName.toLowerCase();
            if (lowerFileName.includes('cov001') || lowerFileName.startsWith('cov001')) {
                cover = { filename: fullPath, data, isCover: true };
                hasCover = true;
            } else if (lowerFileName.includes('cov002') || lowerFileName.startsWith('cov002')) {
                backCover = { filename: fullPath, data, isBackCover: true };
                hasCover = true;
            } else {
                imageFiles.push({ filename: fullPath, data });
            }
        }

        if (imageFiles.length === 0 && !cover && !backCover) {
            return new Response(JSON.stringify({ error: 'ZIP中没有找到图片', hint: '确保包含PDG/JPG/PNG格式' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        }

        // 自然排序内容页
        imageFiles.sort((a, b) => {
            return a.filename.localeCompare(b.filename, undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        });

        // 组装最终顺序：封面 + 内容 + 封底
        const finalFiles = [];
        if (cover) finalFiles.push(cover);
        finalFiles.push(...imageFiles);
        if (backCover) finalFiles.push(backCover);

        console.log(`文件排序完成: 封面=${cover ? '是' : '否'}, 内容=${imageFiles.length}页, 封底=${backCover ? '是' : '否'}`);

        // 创建PDF
        const pdfDoc = await PDFDocument.create();

        for (const { filename, data } of finalFiles) {
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

        // 保存PDF到R2，添加24小时过期元数据
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后
        await env.BUCKET.put(pdfKey, pdfBytes, {
            httpMetadata: { contentType: 'application/pdf' },
            customMetadata: {
                expiresAt: expiresAt.toISOString(),
                createdAt: new Date().toISOString()
            }
        });

        return new Response(JSON.stringify({
            success: true,
            pdfKey: pdfKey,
            pages: finalFiles.length,
            hasPassword: usedPassword !== null,
            password: usedPassword,
            hasCover: hasCover,
            expiresAt: expiresAt.toISOString(),
            expiresIn: '24小时',
            coverInfo: {
                hasFrontCover: cover !== null,
                hasBackCover: backCover !== null,
                contentPages: imageFiles.length
            }
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
 * 处理文件下载（检查过期时间）
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
            return new Response('File not found or expired', { status: 404 });
        }

        // 检查文件是否过期
        if (object.customMetadata && object.customMetadata.expiresAt) {
            const expiresAt = new Date(object.customMetadata.expiresAt);
            if (new Date() > expiresAt) {
                // 文件已过期，删除并返回404
                await env.BUCKET.delete(key);
                console.log(`Deleted expired file: ${key}`);
                return new Response('File has expired (24 hours)', { status: 410 });
            }
        }

        const filename = key.split('/').pop();

        return new Response(object.body, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'X-Expires-At': object.customMetadata?.expiresAt || 'unknown'
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

/**
 * ��������ļ���24Сʱ��
 */
async function handleCleanup(env, corsHeaders) {
    try {
        const now = new Date();
        let deletedCount = 0, checkedCount = 0;
        const uploadsList = await env.BUCKET.list({ prefix: 'uploads/' });
        for (const obj of uploadsList.objects) {
            checkedCount++;
            const object = await env.BUCKET.get(obj.key);
            if (object && object.customMetadata && object.customMetadata.expiresAt) {
                const expiresAt = new Date(object.customMetadata.expiresAt);
                if (now > expiresAt) { await env.BUCKET.delete(obj.key); deletedCount++; }
            }
        }
        const pdfsList = await env.BUCKET.list({ prefix: 'pdfs/' });
        for (const obj of pdfsList.objects) {
            checkedCount++;
            const object = await env.BUCKET.get(obj.key);
            if (object && object.customMetadata && object.customMetadata.expiresAt) {
                const expiresAt = new Date(object.customMetadata.expiresAt);
                if (now > expiresAt) { await env.BUCKET.delete(obj.key); deletedCount++; }
            } else if (object && !object.customMetadata) {
                const uploaded = new Date(obj.uploaded);
                if (now - uploaded > 24 * 60 * 60 * 1000) { await env.BUCKET.delete(obj.key); deletedCount++; }
            }
        }
        return new Response(JSON.stringify({ success: true, checked: checkedCount, deleted: deletedCount }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
