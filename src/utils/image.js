function calculateImageSize(path, targetWidth = null, targetHeight = null) {
    return new Promise((resolve, reject) => {
        // 创建一个新的图片对象
        const img = new Image();
        img.src = path;
        // 监听图片加载完成事件
        img.onload = () => {
            // 获取图片原始宽度和高度
            const originalWidth = img.width;
            const originalHeight = img.height;
            let newWidth, newHeight;

            // 根据给定的目标宽度或高度计算保持宽高比后的尺寸
            if (targetWidth && !targetHeight) {
                newWidth = targetWidth;
                newHeight = (originalHeight / originalWidth) * targetWidth;
            } else if (!targetWidth && targetHeight) {
                newHeight = targetHeight;
                newWidth = (originalWidth / originalHeight) * targetHeight;
            } else if (targetWidth && targetHeight) {
                console.warn("仅支持指定目标宽度或目标高度之一，未处理同时指定的情况。");
                newWidth = targetWidth;
                newHeight = (originalHeight / originalWidth) * targetWidth;
            } else {
                newWidth = originalWidth;
                newHeight = originalHeight;
            }

            resolve({
                originalWidth,
                originalHeight,
                newWidth: Math.round(newWidth), // 保留到整数
                newHeight: Math.round(newHeight),
            });
        };

        // 监听图片加载错误事件
        img.onerror = (error) => {
            reject("图片加载失败，请检查文件来源！");
        };
    });
}



function getImageData(imagePath) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            resolve(imageData);
        };
        img.onerror = reject;
        img.src = imagePath;
    })
}

function loadImg(imgSrc) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = imgSrc;
        image.onload = () => resolve(image); // 图片加载成功
        image.onerror = (err) => reject(err); // 图片加载失败
    });
}


function linearInterpolate(sourceArray, newLength) {
    const sourceLength = sourceArray.length;
    if (sourceLength === 0 || newLength <= 0) {
        return [];
    }
    if (sourceLength === newLength) {
        return [...sourceArray];
    }

    const destinationArray = new Array(newLength);
    // 注意：当 newLength 为 1 时，(newLength - 1) 为 0，会导致 ratio 为 NaN。
    // 我们需要处理这个边缘情况。
    if (newLength === 1) {
        destinationArray[0] = sourceArray[0];
        return destinationArray;
    }
    const ratio = (sourceLength - 1) / (newLength - 1);

    for (let i = 0; i < newLength; i++) {
        const src_float_pos = i * ratio;
        const p1_index = Math.floor(src_float_pos);
        // 这里的 Math.min 是一个很好的保护，防止 p1_index+1 在末尾越界
        const p2_index = Math.min(p1_index + 1, sourceLength - 1);

        const weight = src_float_pos - p1_index;

        const val1 = sourceArray[p1_index];
        const val2 = sourceArray[p2_index];

        destinationArray[i] = (1 - weight) * val1 + weight * val2;
    }

    return destinationArray;
}

/**
 * 从 ImageData 中快速提取指定列的所有像素数据。
 *
 * @param {ImageData} imageData - 源 ImageData 对象，包含 .data, .width, .height 属性。
 * @param {number} columnIndex - 你希望获取的列的索引 (从 0 开始)。
 * @returns {Array<[number, number, number, number]>} - 一个数组，其中每个元素是一个代表像素的 [R, G, B, A] 数组。
 */
function getColumnPixels(imageData) {
    const pixels = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    // 遍历这一列的每一行 (y)
    for (let col = 0; col < width; col++) {
        const this_column = [];
        // const previousColumnsPixelsIndex = col * width;
        for (let row = 0; row < height; row++) {
            const currentPixelIndex = (col + row * width) * 4;
            this_column.push([
                data[currentPixelIndex],
                data[currentPixelIndex + 1],
                data[currentPixelIndex + 2],
                data[currentPixelIndex + 3],
            ])
        }
        pixels.push(this_column);
    }
    console.log(pixels)
    return pixels;
}

/**
 * 使用线性插值将10列像素数据高质量地扩展到20列。
 * 
 * @param {Array<Array<[number, number, number, number]>>} originalColumns 原始的10列像素数据。
 * @param {number} originalHeight 原始数据的高度（每列的像素数）。
 * @returns {ImageData} 返回一个新的 20xH 的 ImageData 对象。
 */
function interpolateColumnsLinearly(originalColumns, newNumberColumns) {
    const originalHeight = originalColumns[0].length; // 默认每一列像素数相同
    const originalWidth = originalColumns.length;

    // const data = new Uint8ClampedArray(newNumberColumns * originalHeight * 4);
    const data = [];

    // 遍历新的20列中的每一列
    for (let x_new = 0; x_new < newNumberColumns; x_new++) {
        // 1. 找到新列在新坐标系中的精确位置
        const x_old_exact = x_new * (originalWidth / newNumberColumns);

        // 2. 找到它左右两边的原始列索引
        const x_left = Math.floor(x_old_exact);
        // “收尾不相接”：通过Math.min确保不会超出右边界
        const x_right = Math.min(originalWidth - 1, Math.ceil(x_old_exact));

        // 3. 计算插值权重 (距离右边的列有多远)
        const rightWeight = x_old_exact - x_left;
        const leftWeight = 1.0 - rightWeight;

        const _column = []
        // 遍历该列的每一个垂直像素 (y坐标)
        for (let y = 0; y < originalHeight; y++) {
            const leftPixel = originalColumns[x_left][y];
            const rightPixel = originalColumns[x_right][y];
            // 4. 对R, G, B, A四个通道分别进行线性插值
            const r = leftPixel[0] * leftWeight + rightPixel[0] * rightWeight;
            const g = leftPixel[1] * leftWeight + rightPixel[1] * rightWeight;
            const b = leftPixel[2] * leftWeight + rightPixel[2] * rightWeight;
            const a = leftPixel[3] * leftWeight + rightPixel[3] * rightWeight;

            _column.push([
                r,
                g,
                b,
                a,
            ])
            // 计算在一维数组中的索引并赋值
            // const index = (y * newNumberColumns + x_new) * 4;
            // data[index] = r;
            // data[index + 1] = g;
            // data[index + 2] = b;
            // data[index + 3] = a;
        }
        data.push(_column)
    }

    return data
}




export { calculateImageSize, getImageData, loadImg, linearInterpolate, getColumnPixels, interpolateColumnsLinearly }