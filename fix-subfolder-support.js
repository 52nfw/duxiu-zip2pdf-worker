// 这段代码替换 index.js 第810-860行左右的图片提取逻辑
// 搜索 "// 提取并分类图片文件" 开始替换

// 提取并分类图片文件（支持子文件夹）
const imageFiles = [];
let hasCover = false;
let cover = null;
let backCover = null;

// 递归查找所有图片文件，不管在哪个目录层级
for (const [fullPath, data] of Object.entries(files)) {
    // 跳过目录项（某些解压库会包含目录）
    if (data.length === 0 || fullPath.endsWith('/') || fullPath.endsWith('\\')) {
        continue;
    }

    const lowerPath = fullPath.toLowerCase();

    // 检查文件扩展名是否是图片
    const isImage = lowerPath.endsWith('.pdg') || lowerPath.endsWith('.jpg') ||
        lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.png') ||
        lowerPath.endsWith('.bmp') || lowerPath.endsWith('.tif') ||
        lowerPath.endsWith('.tiff') || lowerPath.endsWith('.gif');

    if (!isImage) continue;

    // 提取文件名（不含路径）
    const fileName = fullPath.replace(/\\/g, '/').split('/').pop();
    const lowerFileName = fileName.toLowerCase();

    // 检查封面封底（不管在哪个文件夹）
    if (lowerFileName.includes('cov001') || lowerFileName.startsWith('cov001')) {
        cover = { filename: fullPath, data, isCover: true };
        hasCover = true;
        console.log(`检测到封面: ${fullPath}`);
    } else if (lowerFileName.includes('cov002') || lowerFileName.startsWith('cov002')) {
        backCover = { filename: fullPath, data, isBackCover: true };
        hasCover = true;
        console.log(`检测到封底: ${fullPath}`);
    } else {
        imageFiles.push({ filename: fullPath, data });
    }
}

if (imageFiles.length === 0 && !cover && !backCover) {
    return new Response(JSON.stringify({
        error: 'ZIP文件中没有找到图片文件',
        hint: '请确保ZIP中包含PDG、JPG、PNG等图片格式'
    }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

// 自然排序内容页（按完整路径排序）
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
