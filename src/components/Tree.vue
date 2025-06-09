<template>
    <div class="tree-container" :style="{width: width + 'px', height: height + 'px', position: 'relative'}">
        <div ref="canvas" style="position: absolute; left: 0; top: 0;"></div>
    </div>
</template>


<script setup>
import controlPointsDict from "@/assets/mao/link.json";
import { calculateImageSize, loadImg } from "@/utils/image.js";
import { interpolatePath } from 'd3-interpolate-path';
import { 
    addInterpolateControlPointsToModernPath,
    adjustLinkToAvoidOverlap,
    get_elbow_path
} from "@/layout/tree.js";

import interaction from "@/utils/interaction.js";
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';

const width = ref(400);
const height = ref(0);
const treeSize = computed(()=>{
    return {
        width: width.value * (1 - padding.left - padding.right),
        height: height.value * (1 - padding.top - padding.bottom),
    }
})

var treeData = {}; // node.json 树节点逻辑关系+节点位置
var ctrl_pts_links; // 节点间link的控制点
var imgSize;
var root;
var stage; // canvas绘制的stage
const props = defineProps(['mode']);

var initSize = [0,0]; // 原始背景图像 [宽,高]
const padding = { 
    top: 0.1,
    bottom: 0.1,
    left: 0.05,
    right: 0.05
}

const canvas = useTemplateRef('canvas');


// -----初始化-----
// 根据绘制大小重新计算node和link位置
// root中的position保存原始bbox，_position为绘制大小的bbox
// return为大小更新后的link的控制点
function resizePoints(originalSize, currentSize, root) {
    let xRatio = currentSize[0] / originalSize[0]
    let yRatio = currentSize[1] / originalSize[1]
    const _newControlPointsDict = {}
    for (let key of Object.keys(controlPointsDict)) {
        _newControlPointsDict[key] = [controlPointsDict[key][0] * xRatio, controlPointsDict[key][1] * yRatio]
    }
    root.each(node => {
        node.data._position = [[0, 0], [0, 0]]
        node.data._position[0][0] = node.data.position[0][0] * xRatio
        node.data._position[1][0] = node.data.position[1][0] * xRatio
        node.data._position[0][1] = node.data.position[0][1] * xRatio
        node.data._position[1][1] = node.data.position[1][1] * yRatio
    })
    return _newControlPointsDict
}

// 更新root中x和y为现代布局下的位置
// 需要先tree.size()指定size
const tree = d3.tree();

// 计算古代link的path的d属性
// clean：是否去除多余（仅用于transition）的控制点
function get_ancient_path(d, clean = true) {
    const lineIds = d.target.data.controlPoints;
    let ctrl_points = lineIds.map(id => ctrl_pts_links[id]);
    // 去除一条水平或垂直线上超过三个点的多余的点，只保留前后两个端点。这样是防止多余的点对后续变换造成差值困难。
    const thred = 1
    const sameX = (a, b) => Math.abs(a[0] - b[0]) <= thred;
    const sameY = (a, b) => Math.abs(a[1] - b[1]) <= thred;
    let removeIndexArray = []
    for (let idx in ctrl_points) {
        idx = +idx;
        if (idx === 0) { continue }
        if (idx === ctrl_points.length - 1) { continue }
        const currentNode = ctrl_points[idx];
        const previousNode = ctrl_points[idx - 1];
        const nextNode = ctrl_points[idx + 1];
        if (sameX(currentNode, previousNode) && sameX(currentNode, nextNode)) {
            removeIndexArray.push(idx)
        }
        if (sameY(currentNode, previousNode) && sameY(currentNode, nextNode)) {
            removeIndexArray.push(idx)
        }
    }
    if (clean) {
        ctrl_points = ctrl_points.filter((_, i) => !removeIndexArray.includes(i))
    }
    return d3.line()(ctrl_points);
}

function update(root) {
    // 保存旧的位置
    var nodes = root.descendants();
    nodes.forEach(function (d) {
        d.x_pre = d.x;
        d.y_pre = d.y;
    });
    // 更新当前绘制大小
    tree.size([treeSize.value.width, treeSize.value.height]);
    // 更新古代node和link的控制点
    ctrl_pts_links = resizePoints(initSize, [width.value, height.value], root);
    // 更新现代node的控制点
    tree(root)
}

async function createCanvas(){
    // 创建konva的stage
    // stage包含layer
    stage = new Konva.Stage({
        container: canvas.value,
        width: width.value,
        height: height.value,
    });

    // 三个layer
    // layer1: 背景
    // layer2: node
    // layer3: link
    const layer = new Konva.Layer();
    const backgroundImg = await loadImg('/src/assets/mao/background.png');
    const background = new Konva.Image({
        x: 0,
        y: 0,
        width: width.value,
        height: height.value,
        image: backgroundImg,
        draggable: false,
    });
    layer.add(background);

    var nodeGroup = new Konva.Group({
        x: 0,//位置坐标
        y: 0,//位置坐标
    });
    var linkGroup = new Konva.Group({
        x: 0,//位置坐标
        y: 0,//位置坐标
    });

    layer.add(nodeGroup);
    layer.add(linkGroup);
    stage.add(layer);

    // 从mask上截出node和link的像素
    const maskImg = await loadImg('/src/assets/mao/mask.png');
    const maskImage = new Konva.Image({
        image: maskImg,
        draggable: false,
    });
    maskImage.cache()

    // 遍历root的节点，在node layer中添加
    root.descendants().forEach((_node) => {
        let d = _node.data;
        let originalNode = maskImage.clone();

        //按照原始大小截取node的mask
        originalNode.crop({
            x: d.position[0][0],
            y: d.position[0][1],
            width: d.position[1][0],
            height: d.position[1][1],
        }).setAttrs({ //按照现在_position设置node的位置(x,y)和宽高(width, height)
            x: d._position[0][0],
            y: d._position[0][1],
            width: d._position[1][0],
            height: d._position[1][1],
            id: `${d.name}`, 
            draggable: true,
            name: 'node',
        })
        _node.konvaNode = originalNode;
        originalNode.cache();

        // mouseover变红色
        originalNode.on('mouseover', () => {
            let pathToRoot = _node.ancestors();
            let nodeNames = pathToRoot.map(d => d.data.name);
            let konvaNodes = pathToRoot.map(d => d.konvaNode)
            let linkToRoot = stage.find('.link').filter((_, i, nodes) => {
                return nodeNames.includes(nodes[i].id())
            })
            interaction.highlightLink(linkToRoot)
            interaction.highlightNode(konvaNodes)
            stage.container().style.cursor = 'pointer';
            layer.draw();
        });
        // mouseover还原 
        originalNode.on('mouseleave', (e) => {
            let pathToRoot = _node.ancestors();
            let nodeNames = pathToRoot.map(d => d.data.name);
            let konvaNodes = pathToRoot.map(d => d.konvaNode)
            let linkToRoot = stage.find('.link').filter((_, i, nodes) => {
                return nodeNames.includes(nodes[i].id())
            })
            interaction.recoverLink(linkToRoot);
            interaction.recoverNode(konvaNodes);
            stage.container().style.cursor = 'default';
            layer.draw();
        });
        nodeGroup.add(originalNode);
        layer.draw()
    })
    root.links().forEach((d) => {
        let pathNode = new Konva.Path({
            data: get_ancient_path(d),
            stroke: '#000000',
            fill: null,
            zindex: 2,
            name: 'link',
            id: d.target.data.name,
        });
        pathNode.d = d;
        linkGroup.add(pathNode);
    })
    layer.draw();
}

const init = async () => {
    root = d3.hierarchy(treeData);
    // x，y为当前节点位置
    // x_pre, yo为之前的位置
    root.x_pre = width.value / 2;
    root.y_pre = 0;
    // 更新节点、node数据
    update(root);
    createCanvas();
        // var quadtree = Quadtree.addAll(root.descendants());
}

onMounted(async () => {
    imgSize = await calculateImageSize("/src/assets/mao/img.jpeg", width.value);
    initSize[0] = imgSize.originalWidth; // 原始背景图像宽
    initSize[1] = imgSize.originalHeight; // 原始背景图像高
    height.value = imgSize.newHeight; 
    treeData = await d3.json("/src/assets/mao/node.json");
    init();
})

// ----transition----
watch(
    ()=>props.mode, 
    ()=>{
        relayout();
    }
)

function relayout(){
    let calFunc = null;
    if (props.mode === "modern") {
        calFunc = get_elbow_path;
    } else if (props.mode === "ancient") {
        calFunc = get_ancient_path;
    }
    const layer = stage.getLayers()[0];
    // link切换
    const groupOffset = {
        x: imgSize.newWidth * padding.left,
        y: imgSize.newHeight * padding.top,
    }
    root.each(node=>{
        node.x += (props.mode === "modern" ? groupOffset.x : -groupOffset.x);
        node.y += (props.mode === "modern" ? groupOffset.y : -groupOffset.y);
    })
    // ----link----
    layer.find('.link').forEach(link => {
        let previous = link.data();
        let current = calFunc(link.d);
        let tweenFunc = () => {};
        if (props.mode === "modern") {
            // 从ancient到current布局
            // 1. 因为link与node存在overlap，需根据node大小重新计算link的path属性
            current = adjustLinkToAvoidOverlap(current, link.d.source, link.d.target)
            // 2. 给计算后的path插入点
            let interpolated_current = addInterpolateControlPointsToModernPath(previous, current, link.d.target.data.controlPoints.length)
            // 3. transition函数
            tweenFunc = interpolatePath(previous, interpolated_current);
        }
        else {
            let interpolated_previous = addInterpolateControlPointsToModernPath(current, previous, link.d.target.data.controlPoints.length)
            tweenFunc = interpolatePath(interpolated_previous, current);
        }
        gsap.to({}, {
            duration: 1,
            onUpdate: function () {
                link.data(tweenFunc(this.ratio)); 
            },
            onComplete: () => {
                // 若从ancient到modern，变换后用没有插入点的path替换插入点的path，防止反向transition点出错
                if (props.mode === "modern") {
                    link.data(current);
                }
            }
        });
    })
    // ----node----
    root.descendants().forEach((_node) => {
        let konvaNode = _node.konvaNode;
        let d = _node.data;
        let tweenFunc = () => {}
        if(props.mode === "modern"){
            tweenFunc = d3.interpolateArray(d._position[0], [_node.x - d._position[1][0] / 2, _node.y - d._position[1][1] / 2]);
        }else{
            tweenFunc = d3.interpolateArray([konvaNode.x(), konvaNode.y()], d._position[0]);
        }
        gsap.to({}, {
            duration: 1,
            onUpdate: function () {
                let interPos = tweenFunc(this.ratio);
                konvaNode.x(interPos[0]); 
                konvaNode.y(interPos[1]); 
            }
        });
    })
    layer.draw();
}

// -----拖拽交互-----
var Quadtree = d3.quadtree()
.x(function (d) {
    return d.x;
})
.y(function (d) {
    return d.y;
});




</script>

<style scope>

.node {
    cursor: pointer;
}

.overlay {
    background-color: #EEE;
}

.node circle {
    fill: #fff;
    stroke: steelblue;
    stroke-width: 1.5px;
}

.node text {
    font-size: 10px;
    font-family: sans-serif;
}

.link {
    fill: none;
    stroke: #000;
    stroke-width: 1.5px;
    /* stroke-opacity: 0.1; */
}

.templink {
    fill: none;
    stroke: black;
    stroke-width: 3px;
}

.ghostCircle.show {
    display: block;
}

.ghostCircle,
.activeDrag .ghostCircle {
    display: none;
}
</style>