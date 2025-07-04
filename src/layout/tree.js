import { pathCommandsFromString, interpolatePathCommands } from 'd3-interpolate-path'

function refreshTreeConfig(t) {
    // merge hierarchy B in hierarchy A as child of nodeOfA
    // see https://observablehq.com/d/c2df560e9434151d   
    t = d3.hierarchy(t);
    t.each((d) => {
        d.data = { ...d.data.data, children: d.children, id: d.data.id, x: d.data.x, y: d.data.y, x0: d.data.x0, y0: d.data.y0 }
    });
    return t;
}
function pathCommandToString(commands) {
    let _ = ""
    commands.forEach(command => {
        _ += `${command.type}${command.x},${command.y}`;
    })
    return _;
}

// 该函数称为插值器工厂函数 interpolator factory，它生成一个插值器
// 💡 D3 在 d3-interpolate 模块提供了一些内置插值器，具体可以查看官方文档 https://d3js.org/d3-interpolate
// 或这一篇笔记 https://datavis-note.benbinbin.com/article/d3/core-concept/d3-concept-transition#插值器
// 该函数接收两个参数，第一个参数 `d1` 是过渡的目标值/最终值，第二个参数 `precision` 是采样的精度
// 通过采样将路径从贝塞尔曲线转换为分段折线（便于插值计算）
function smoothTween(d1, precision) {
    // 返回一个自定义的插值器
    return function () {
        // 函数内的 this 指向（在过渡管理器所绑定的选择集合中）当前所遍历的元素，在这个示例中选择集中只有一个 `<path>` 元素
        const path0 = this;
        // 通过 JS 原生方法 node.cloneNode() 拷贝该 DOM 元素
        const path1 = path0.cloneNode();
        // 将该 `<path>` 元素的属性 `d` 设置为 `d1`（过渡的目标值/最终值），所以该元素的形状与过渡完成时的路径形状一样
        path1.setAttribute("d", d1);
        // 使用方法 SVGGeometryElement.getTotalLength() 获取 `<path>` 元素的长度（以浮点数表示）
        const n0 = path0.getTotalLength(); // 过渡起始时路径的总长度
        const n1 = path1.getTotalLength(); // 过渡结束时路径的总长度

        // Uniform sampling of distance based on specified precision.
        // 基于给定的精度 precision 对（过渡前）path0 和（过渡后）path1 两个路径进行均匀采样
        // 💡 可以得到一系列配对的采样点（它们分别是路径上某一点的起始状态和最终状态）
        // 💡 然后为**每对采样点（已知起始状态和最终值）构建一个插值器**，用于实现路径切换动画
        // 用一个数组 distances 来存储采样点（相对于路径的）位置，每一个元素都表示一个采样点
        // 即每个元素/采用点都是一个 0 到 1 的数字，它是采样点到该路径开头的距离与**该路径总长度**的比值（占比）
        // 💡 使用相对值来表示采样点的位置，以便将采样点进行配对
        const distances = [0]; // 第一个采样点是路径的起点
        // 对采样的精度/步长进行标准化，使用它进行迭代采样就可以得到采样点的相对（总路径）位置
        // 其中 precise 的单位是 px 像素，是采样精度的绝对值
        // 通过精度与路径的总长度作比 precise / Math.max(n0, n1) 将精度从绝对值转换为相对值
        // 其中路径总长度是基于变换前后最长的路径，以保证在较长的路径上的采样密度（数量）也是足够
        const dt = precision / Math.max(n0, n1);
        // 通过 while 循环进行采用，每次距离增加一个标准化的步长 dt
        let i = 0; while ((i += dt) < 1) distances.push(i);
        distances.push(1); // 最后一个采样点是路径的终点

        // Compute point-interpolators at each distance.
        // 遍历数组 distances 为不同的采样点构建一系列的插值器
        const points = distances.map((t) => {
            // t 为当前所遍历的采样点的位置的相对值（与它所在的路径总长度的占比）
            // 通过 t * n0 或 t * n1 可以求出该采样点距离 path0 或 path1 路径的起点的具体距离
            // 再使用 SVG 元素的原生方法 path.getPointAtLength(distance) 可以获取距离路径起点特定距离 distance 的位置的具体信息
            // 具体可以参考 https://developer.mozilla.org/en-US/docs/Web/API/SVGGeometryElement/getPointAtLength
            // 该方法返回一个 DOMPoint 对象，它表示坐标系中的 2D 或 3D 点，其中属性 x 和 y 分别描述该点的水平坐标和垂直坐标
            // 具体可以参考 https://developer.mozilla.org/en-US/docs/Web/API/DOMPoint
            // 在 path0（过渡开始时的路径）上的采样点作为插值的起始状态
            const p0 = path0.getPointAtLength(t * n0);
            // 在 path1（过渡结束时的路径）上的采样点作为插值的最终状态
            const p1 = path1.getPointAtLength(t * n1);
            // 所以 [p0.0, p0.y] 是插值的起点的坐标值，[p1.x, p1.y] 是插值的终点的坐标值
            // 这里使用 D3 所提供的内置通用插值器构造函数 d3.interpolate(a, b) 来构建一个插值器
            // 它会根据 b 的值类型自动调用相应的数据类型插值器
            // 具体可以参考这一篇笔记 https://datavis-note.benbinbin.com/article/d3/core-concept/d3-concept-transition#通用类型插值器
            // 这里为每个采样位置构建出一个插值器，然后在过渡期间就可以计算出特定时间点该点运动到什么地方（即它的 x，y 坐标值）
            return d3.interpolate([p0.x, p0.y], [p1.x, p1.y]);
        });

        // 插值器最后需要返回一个函数，它接受标准时间 t 作为参数（其值的范围是 [0, 1]）
        // 返回的这个函数会在过渡期间被不断调用，用于生成不同时间点的 `<path>` 元素的属性 `d` 的值
        // 当过渡未结束时（标准化时间 t < 1 时），通过调用一系列的插值器 points 计算各个采样点的运动到何处，并使用指令 `L` 将这些点连起来构成一个折线
        // 而过渡结束时（标准化时间 t = 1 时），将路径替换为真正的形状 d1（而不再使用采样点模拟生成的近似形状）
        return (t) => t < 1 ? "M" + points.map((p) => p(t)).join("L") : d1;
    };
}

function addInterpolateControlPointsToModernPath(ancient_path, modern_path, numberControlPoints) { // 根据古代控制点的纵坐标判断现代添加的控制点是否位置要一致
    let ancientCommand = pathCommandsFromString(ancient_path);
    let modernCommands = pathCommandsFromString(modern_path)
    let start = modernCommands[1]; // 现代垂直直线布局一共有四个控制点，去掉第一个和最后一个，剩余两个之间的线段（横线）用于动画变化。
    let end = modernCommands[2]; //
    let numToAdd = ancientCommand.length - 4; // 根据古代path计算需要多少个添加的控制点。古代控制点总数减去两个端点以及对应现代横线布局的两个端点得到
    numToAdd = numToAdd > 0 ? numToAdd : 0; // 保证添加的端点数大于0
    let removedControlPointsNumber = numberControlPoints - ancientCommand.length;
    // console.log("removedControlPointsNumber", removedControlPointsNumber)
    let minBoundingX = Math.min(ancientCommand[1].x, ancientCommand.at(-2).x)
    let maxBoundingX = Math.max(ancientCommand[1].x, ancientCommand.at(-2).x)

    // 检查古代中间点的x是否有小于起点的x或者大于终点的x
    // 若小于起点的x，则将该x设置为正无穷。若大于终点的x，则设置为负无穷，后面排序会剔除正负无穷。
    ancientCommand.slice(2, numToAdd + 2).forEach((command, i) => {
        if (command.x < minBoundingX || Math.abs(command.x - minBoundingX) < 2) {
            // 古代布局中起点对应POSITIVE_INFINITY 终点对应NEGATIVE_INFINITY
            // ancientCommand[i+2].x = whichAncientPointIsBigger === "startBigger" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
            ancientCommand[i + 2].x = Number.NEGATIVE_INFINITY;
        }
        else if (command.x > maxBoundingX || Math.abs(command.x - maxBoundingX) < 2) {
            // 古代布局中起点对应POSITIVE_INFINITY 终点对应NEGATIVE_INFINITY
            // ancientCommand[i+2].x = whichAncientPointIsBigger === "startBigger" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
            ancientCommand[i + 2].x = Number.POSITIVE_INFINITY;
        }
    })
    let insertPoint = []
    // ancientMiddlePoints先拿到古代线条剔除前两个和后两个的点，并将其按照x大小从大到小排序 e.g. [196, 196, 126] (三个中间点的x坐标)
    let ancientMiddlePoints = ancientCommand
        .slice(2, numToAdd + 2)
        .map(d => d.x)
        .sort((a, b) => b - a);
    ancientMiddlePoints = unifyCloseNumbers(ancientMiddlePoints, 1); // 判断古代布局中垂直的两个点是否在一条垂直线上
    // sortedUnique为ancientMiddlePoints去重后并按照从大到小顺序排序的结果（剔除正负无穷，正负无穷代表的点在后续单独设置位置）,(e.g. [196,126]) 
    const sortedUnique = [...new Set(ancientMiddlePoints)].filter(d => d !== Number.POSITIVE_INFINITY && d !== Number.NEGATIVE_INFINITY).sort((a, b) => b - a);
    // ancientMiddlePoints中点的x坐标对应到直线上的比例为该x坐标在sortedUnique中的index (最终将[196, 196, 126] 转变为e.g. [1,1,2])
    const useWhat = removedControlPointsNumber >= 0 ? removedControlPointsNumber + 1 : numToAdd
    // const useWhat =  numToAdd
    // const useWhat = sortedUnique.length // 适配直接round的版本
    ancientMiddlePoints = ancientMiddlePoints.map(d => {
        if (d === Number.NEGATIVE_INFINITY) {
            // ancientCommand[1].x是起点，对应比例0，数值是0
            // ancientCommand.at(-2).x 是终点，对应比例1，数值是numToAdd + 1
            // 如果起点小于终点，则要将该点投影控制点设置为起点，即0；反之则设置为终点
            return ancientCommand[1].x < ancientCommand.at(-2).x ? 0 : useWhat + 1;
        }
        if (d === Number.POSITIVE_INFINITY) {
            return ancientCommand[1].x > ancientCommand.at(-1).x ? 0 : useWhat + 1;
        }
        else return sortedUnique.indexOf(d) + 1
    });

    if (numToAdd > 0) {
        for (let j = 0; j < numToAdd; j++) {
            // d3.interpolatePathCommands 见 https://github.com/pbeshai/d3-interpolate-path
            let inserPointerMaker = interpolatePathCommands([start], [end]); // 在现代垂直布局path的横线中等距插入点，inserPointerMaker接收0-1之间的数字，返回该比例下的点坐标
            let p = inserPointerMaker((ancientMiddlePoints[j] / (useWhat + 1))); // 直接round
            // let p = inserPointerMaker(ancientMiddlePoints[j] / (useWhat + 1)); // 直接round
            insertPoint.push(p[0])
        }
        modernCommands.splice(2, 0, ...insertPoint);
    }
    return pathCommandToString(modernCommands)
}

function unifyCloseNumbers(array, threshold) {
    // 先对数组进行排序
    array.sort((a, b) => a - b);

    const clusters = [];
    let currentCluster = [array[0]];

    // 遍历数组，将彼此接近的数字划分到同一个组
    for (let i = 1; i < array.length; i++) {
        if (Math.abs(array[i] - currentCluster[currentCluster.length - 1]) < threshold) {
            currentCluster.push(array[i]);
        } else {
            clusters.push(currentCluster);
            currentCluster = [array[i]];
        }
    }

    // 别忘了添加最后一个分组
    clusters.push(currentCluster);

    // 生成结果数组
    const result = clusters.flatMap(cluster => {
        // 计算分组内所有数字的平均值并四舍五入
        const avgValue = Math.round(cluster.reduce((sum, num) => sum + num, 0) / cluster.length);
        return cluster.map(() => avgValue); // 将分组内所有数字替换为平均值
    });

    return result;
}

function get_elbow_path({ d } = {}) {
    let local_ctrl_points;
    local_ctrl_points = [
        [d.source.x, d.source.y],
        [d.source.x, (d.source.y + (d.target.y - d.source.y) / 2)],
        [d.target.x, (d.source.y + (d.target.y - d.source.y) / 2)],
        [d.target.x, d.target.y]
    ]
    return d3.line()(local_ctrl_points)
}

// 现代layout下link重叠在node上，需要根据node大小修改link的起始和终点
function adjustLinkToAvoidOverlap(path, sourceNode, targetNode) {
    const pathCommands = pathCommandsFromString(path);
    pathCommands[0].y += sourceNode.data._position[1][1] / 2;
    pathCommands.at(-1).y -= targetNode.data._position[1][1] / 2;
    return pathCommandToString(pathCommands)
}

export {
    refreshTreeConfig,
    smoothTween,
    addInterpolateControlPointsToModernPath,
    unifyCloseNumbers,
    get_elbow_path,
    adjustLinkToAvoidOverlap,
}