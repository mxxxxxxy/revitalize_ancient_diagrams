import { svgPathBbox } from 'svg-path-bbox';
import { linearInterpolate, interpolateColumnsLinearly } from '@/utils/image.js'

function lerp(c1, c2, ratio) {
    return c1 * (1 - ratio) + c2 * ratio;
}
/**
 * 重新采样一个像素列（数组）到新的长度
 * @param {Array<Object>} originalColumn - 原始像素列，例如 [{r,g,b,a}, {r,g,b,a}, ...]
 * @param {number} newLength - 新的像素列长度
 * @returns {Array<Object>} 重新采样后的新像素列
 */
function resamplePixelColumn(originalColumn, newLength) {
    // console.log(originalColumn)
    const originalLength = originalColumn.length;
    if (originalLength === newLength) {
        return originalColumn;
    }

    const newColumn = [];

    // 如果新长度为0或原始数据为空，返回空
    if (newLength === 0 || originalLength === 0) {
        return [];
    }

    // 遍历生成每一个新像素
    for (let i = 0; i < newLength; i++) {
        // 计算当前新像素位置对应在原始像素列中的浮点位置
        const originalIndexFloat = i * (originalLength - 1) / (newLength - 1);

        const index1 = Math.floor(originalIndexFloat);
        const index2 = Math.min(Math.ceil(originalIndexFloat), originalLength - 1);

        // 如果位置正好落在原始像素上，直接取用
        if (index1 === index2) {
            newColumn.push(originalColumn[index1]);
            continue;
        }

        // 计算插值比例
        const ratio = originalIndexFloat - index1;

        const color1 = originalColumn[index1];
        const color2 = originalColumn[index2];
        // 对 RGBA 四个通道进行线性插值
        const newColor = [
            Math.round(lerp(color1[0], color2[0], ratio)),
            Math.round(lerp(color1[1], color2[1], ratio)),
            Math.round(lerp(color1[2], color2[2], ratio)),
            Math.round(lerp(color1[3], color2[3], ratio)),
        ];

        newColumn.push(newColor);
    }

    return newColumn;
}

// ratio是将原始svg的点放缩到绘制大小的比例
function estimatePathBBox(_pathData, ratio) {
    const [minX, minY, maxX, maxY] = svgPathBbox(_pathData); // return [minX, minY, maxX, maxY]
    const padding = 5 // 扩大20像素
    const expandedBBox = [minX - padding, minY - padding, maxX + padding, maxY + padding]
    return {
        x: expandedBBox[0] * ratio,
        y: expandedBBox[1] * ratio,
        width: (expandedBBox[2] - expandedBBox[0]) * ratio,
        height: (expandedBBox[3] - expandedBBox[1]) * ratio,
    };
}


export class PathSampler {

    constructor(mask, options) {
        const dpr = window.devicePixelRatio || 1;
        const { width = 800, } = options;
        this.renderPath = "";
        this.ratio = 1;
        this.renderWidth = width;

        this.sampledNormals = {}
        // this.sampledNormals2 = {}

        // 原图采样参数
        this.sampleOptions = {
            sampleDistance: 1,   // 每隔5像素采一个点
            normalLength: 8     // normalLength必须为偶数，采样列的像素长度为normalLength + 1
        };

        this.outputBBox = null;
        // 初始化canvas
        this.sourceCanvas = document.createElement('canvas');
        this.sourceCtx = this.sourceCanvas.getContext('2d');
        this.resultCanvas = document.createElement('canvas');
        this.resultCtx = this.resultCanvas.getContext('2d');
        // 加载原图mask
        // const mask = new Image();
        // mask.src = maskSrc;
        // mask.onload = () => {
        this.ratio = this.renderWidth / mask.width;
        this.sourceCanvas.width = mask.width;
        this.sourceCanvas.height = mask.height;

        this.resultCanvas.width = this.renderWidth * dpr;
        this.resultCanvas.height = this.renderWidth / mask.width * mask.height * dpr;
        this.sourceCtx.drawImage(mask, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
        this.originalPixelData = this.sourceCtx.getImageData(0, 0, this.sourceCanvas.width, this.sourceCanvas.height).data;
        // };
    }


    // 原始图像上某个线条的ID和该线条的SVG的path的d属性
    samplePath = (pathId, _path_d_attr) => {
        const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svgPath.setAttribute('d', _path_d_attr);
        const totalLength = Math.floor(svgPath.getTotalLength())
        const results = [];
        // const pixelWidth = Math.floor(totalLength / this.sampleOptions.sampleDistance);
        // const pixelHeight = this.sampleOptions.normalLength + 1;
        // const results2 = new Uint8ClampedArray(pixelWidth * pixelHeight * 4);
        for (let length = 0; length < totalLength; length += this.sampleOptions.sampleDistance) { // 列
            const pt = svgPath.getPointAtLength(length);
            const epsilon = 0.1;
            const ptBefore = svgPath.getPointAtLength(Math.max(0, length - epsilon));
            const ptAfter = svgPath.getPointAtLength(Math.min(totalLength, length + epsilon));

            // 计算切线角度
            const angle = Math.atan2(ptAfter.y - ptBefore.y, ptAfter.x - ptBefore.x);
            // 法线角度 = 切线角度 + 90度
            const normalAngle = angle + Math.PI / 2;
            const normalX = Math.cos(normalAngle)
            const normalY = Math.sin(normalAngle)

            const pixelColumn = [];
            const halfNormalLength = this.sampleOptions.normalLength / 2;

            for (let i = -halfNormalLength; i <= halfNormalLength; i++) { // 行
                const sampleX = Math.round(pt.x + i * normalX);
                const sampleY = Math.round(pt.y + i * normalY);
                let r = 0, g = 0, b = 0, a = 0;
                // if (sampleX >= 0 && sampleX < canvas.width && sampleY >= 0 && sampleY < canvas.height) {
                const index = (sampleY * this.sourceCanvas.width + sampleX) * 4;
                r = this.originalPixelData[index];
                g = this.originalPixelData[index + 1];
                b = this.originalPixelData[index + 2];
                a = this.originalPixelData[index + 3];
                // }

                // const startIndex = ((i + halfNormalLength) * pixelWidth + length) * 4;
                // results2[startIndex] = this.originalPixelData[index];
                // results2[startIndex + 1] = this.originalPixelData[index + 1];
                // results2[startIndex + 2] = this.originalPixelData[index + 2];
                // results2[startIndex + 3] = this.originalPixelData[index + 3];
                pixelColumn.push([r, g, b, a]);
            }
            // results.push({ point: { x: pt.x, y: pt.y }, pixels: pixelColumn });
            results.push(pixelColumn);
        }
        this.sampledNormals[pathId] = results;
        // this.sampledNormals2[pathId] = new ImageData(results2, pixelWidth, pixelHeight);;
    }
    linearInterpolateColor(sourceColors, newLength) {
        // 分别提取每个通道的数据
        const r_channel = sourceColors.map(c => c[0]);
        const g_channel = sourceColors.map(c => c[1]);
        const b_channel = sourceColors.map(c => c[2]);
        const a_channel = sourceColors.map(c => c[3]);

        // 对每个通道独立进行线性插值
        const r_interp = linearInterpolate(r_channel, newLength);
        const g_interp = linearInterpolate(g_channel, newLength);
        const b_interp = linearInterpolate(b_channel, newLength);
        const a_interp = linearInterpolate(a_channel, newLength);

        const destinationColors = [];
        for (let i = 0; i < newLength; i++) {
            destinationColors.push([
                r_interp[i],
                g_interp[i],
                b_interp[i],
                a_interp[i],
            ]);
        }

        return destinationColors;
    }

    _drawOnPath(ctx, pathData, brushSamples, options) {
        const { step = 1, offestX = 0, offestY = 0, scale = 1 } = options;

        // 为了计算路径上点的属性，我们需要一个在DOM中的SVG元素
        const svgNS = "http://www.w3.org/2000/svg";
        const svgEl = document.createElementNS(svgNS, 'svg');
        const pathEl = document.createElementNS(svgNS, 'path');
        pathEl.setAttribute('d', pathData);
        svgEl.appendChild(pathEl);
        document.body.appendChild(svgEl); // 必须添加到DOM中才能使用API
        svgEl.style.display = 'none'; // 但不需要显示它


        const pathLength = pathEl.getTotalLength();
        let sampleIndex = 0;

        // 沿路径步进
        for (let d = 0; d < pathLength; d += step) {
            // 获取当前点和稍前一点的点，用于计算切线方向
            const p1 = pathEl.getPointAtLength(d);
            const p2 = pathEl.getPointAtLength(d + 0.1); // 取一个非常近的点

            // 计算切线角度
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            // 法线角度 = 切线角度 + 90度
            const normalAngle = angle + Math.PI / 2;

            // 从笔刷样本库中循环选择一个样本
            const currentBrushSample = brushSamples[sampleIndex % brushSamples.length];
            sampleIndex++;


            const lengthOfDrawNormalSample = Math.round(currentBrushSample.length * this.ratio);
            const resampledColumn = resamplePixelColumn(currentBrushSample, lengthOfDrawNormalSample)

            resampledColumn.forEach((pixel, idx, arr) => {
                let offset = idx - Math.round(arr.length / 2);
                let color = `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3] / 255})`
                // 根据法线方向和偏移量计算每个像素的最终位置
                const dx = Math.cos(normalAngle) * offset;
                const dy = Math.sin(normalAngle) * offset;

                ctx.fillStyle = color;
                // 使用 fillRect 绘制一个 1x1 的像素点
                // 为了在高清屏上看起来更实，可以画 1.1x1.1
                ctx.fillRect(p1.x * scale + dx + offestX, p1.y * scale + offestY + dy, 1, 1);
            });
            this.outputBBox = estimatePathBBox(pathData, this.ratio);

        }
        // 移除临时的SVG元素
        document.body.removeChild(svgEl);
    }

    _drawOnPath2(ctx, pathData, imageData, options) {
        const { step = 1, is_resized = true} = options;
        // is_resized指pathData是否已经缩放到绘制大小 如果不是，则需要缩放到绘制大小(* this ratio)
        const scale = is_resized ? 1 : this.ratio;
        // 为了计算路径上点的属性，我们需要一个在DOM中的SVG元素
        const svgNS = "http://www.w3.org/2000/svg";
        const svgEl = document.createElementNS(svgNS, 'svg');
        const pathEl = document.createElementNS(svgNS, 'path');
        pathEl.setAttribute('d', pathData);
        svgEl.appendChild(pathEl);
        document.body.appendChild(svgEl); // 必须添加到DOM中才能使用API
        svgEl.style.display = 'none'; // 但不需要显示它

        const pathLength = pathEl.getTotalLength();
        const columns = interpolateColumnsLinearly(imageData, Math.ceil(pathLength / step))


        const renderColumnHeight = Math.round(columns[0].length * this.ratio);

        let sampleIndex = 0;
        // 沿路径步进
        for (let d = 0; d < pathLength; d += step) {
            // 获取当前点和稍前一点的点，用于计算切线方向
            const p1 = pathEl.getPointAtLength(d);
            const p2 = pathEl.getPointAtLength(d + 0.1); // 取一个非常近的点

            // 计算切线角度
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            // 法线角度 = 切线角度 + 90度
            const normalAngle = angle + Math.PI / 2;

            // 从笔刷样本库中循环选择一个样本
            const currentBrushSample = columns[sampleIndex];
            sampleIndex++;

            const resampledColumn = resamplePixelColumn(currentBrushSample, renderColumnHeight)

            resampledColumn.forEach((pixel, idx, arr) => {
                let offset = idx - Math.round(arr.length / 2);
                let color = `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3] / 255})`
                // 根据法线方向和偏移量计算每个像素的最终位置
                const dx = Math.cos(normalAngle) * offset;
                const dy = Math.sin(normalAngle) * offset;

                ctx.fillStyle = color;
                // 使用 fillRect 绘制一个 1x1 的像素点
                // 为了在高清屏上看起来更实，可以画 1.1x1.1
                ctx.fillRect(p1.x * scale + dx, p1.y * scale + dy, 1.1, 1.1);
            });
            this.outputBBox = estimatePathBBox(pathData, scale);

        }
        // 移除临时的SVG元素
        document.body.removeChild(svgEl);
    }

    clear() {
        this.resultCtx.clearRect(0, 0, this.resultCanvas.width, this.resultCanvas.height);
    }

    render(pathId, drawD, options = {}) {
        const { is_resized = false} = options;
        const data = this.sampledNormals[pathId];
        this._drawOnPath2(this.resultCtx, drawD, data, {
            step: 1, // 采样的步长，值越小线条越平滑但性能开销越大
            sclae: this.ratio,
            is_resized: is_resized
        })

    }

    // getRenderImage() {
    //     let tempCanvas = document.createElement('canvas');
    //     let tempCtx = tempCanvas.getContext('2d');
    //     tempCanvas.width = this.outputBBox.width;
    //     tempCanvas.height = this.outputBBox.height;
    //     const imageData = this.resultCtx.getImageData(this.outputBBox.x, this.outputBBox.y, this.outputBBox.width, this.outputBBox.height);
    //     tempCtx.putImageData(imageData, 0, 0)
    //     return {
    //         imageCanvas: tempCanvas,
    //         imageBBox: this.outputBBox
    //     }
    // }


}


