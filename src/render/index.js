const pathData = 'M 50 250 Q 150 50 250 250 Q 350 450 450 250';

// 2. 使用 svg-path-properties 按单位距离采样
const properties = new window.SVGPathProperties(pathData);
const totalLength = properties.getTotalLength();
const step = 8; // 每隔8像素采样一个点
const points = [];
for (let d = 0; d <= totalLength; d += step) {
    points.push(properties.getPointAtLength(d));
}

// 3. 创建canvas绘制自定义样式
const canvasWidth = 500, canvasHeight = 500;
const canvas = document.createElement('canvas');
canvas.width = canvasWidth;
canvas.height = canvasHeight;
const ctx = canvas.getContext('2d');

// 4. 定义自定义单位点绘制函数（比如小圆点/图片/随机变换等）
function drawUnit(point, i, ctx) {
    ctx.save();
    ctx.translate(point.x, point.y);

    // 例子：每隔三点变色，做个环状色带
    ctx.fillStyle = `hsl(${i * 15 % 360}, 80%, 60%)`;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// 5. 绘制全部unit到canvas
points.forEach((pt, i) => drawUnit(pt, i, ctx));

// 6. 初始化Konva并把canvas作为图片加到舞台(可配合globalCompositeOperation做mask)
const stage = new Konva.Stage({
    container: 'container',
    width: canvasWidth,
    height: canvasHeight
});
const layer = new Konva.Layer();

// 可选：在背景加个色块对比
const bg = new Konva.Rect({
    x: 0, y: 0, width: canvasWidth, height: canvasHeight,
    fill: '#f2f2fd'
});
layer.add(bg);

// 7. 将canvas作为Image添加
const img = new window.Image();
img.onload = function () {
    const konvaImg = new Konva.Image({
    image: img,
    x: 0, y: 0,
    width: canvasWidth, height: canvasHeight,
    // 如果是mask则用destination-in, 这里只是覆盖叠加可以直接放置
    // globalCompositeOperation: 'destination-in',
    });
    layer.add(konvaImg);
    stage.add(layer);
    layer.batchDraw();
};
img.src = canvas.toDataURL();