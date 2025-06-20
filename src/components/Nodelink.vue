<template>
	<div class="node-link-container" :style="{ width: width + 'px', height: height + 'px', position: 'relative' }">
		<div ref="canvas" style="position: absolute; left: 0; top: 0;"></div>
	</div>
</template>

<script setup>
import { ref, onMounted, watch, computed, useTemplateRef, watchEffect } from 'vue';
import { calculateImageSize, loadImg } from '@/utils/image.js';
var links, nodes;
var imgSize;
var stage;
var layer;
var render = false;
var initSize = [0, 0]; // 原始背景图像 [宽,高]
var simulation = null;
var dragActive;
var linkForce;
const padding = {
	top: 0.1,
	bottom: 0.1,
	left: 0.05,
	right: 0.05
}
const canvas = useTemplateRef('canvas');

const width = ref(400);
const height = ref(0);
const props = defineProps(['mode', 'data', 'width']);
const figSize = computed(() => {
	return {
		width: width.value * (1 - padding.left - padding.right),
		height: height.value * (1 - padding.top - padding.bottom),
	}
})

// const link_generator = (link) => {
// 	const source = link.source;
// 	const target = link.target;
// 	console.log(source, target)
// 	return 
// }

// -----初始化-----
// 根据绘制大小重新计算node和link位置
// 下划线开头的为当前绘制大小下的坐标
function resize(originalSize, currentSize, nodes, links) {
	let xRatio = currentSize[0] / originalSize[0];
	let yRatio = currentSize[1] / originalSize[1];
	nodes.forEach(node => {
		node._position = [[0, 0], [0, 0]]
		node._position[0][0] = node.position[0][0] * xRatio
		node._position[1][0] = node.position[1][0] * xRatio
		node._position[0][1] = node.position[0][1] * xRatio
		node._position[1][1] = node.position[1][1] * yRatio
	})
	links.forEach(link => {
		link._sourcePosition = [link.sourcePosition[0] * xRatio, link.sourcePosition[1] * yRatio]
		link._targetPosition = [link.targetPosition[0] * xRatio, link.targetPosition[1] * yRatio]
	})
	return nodes, links;
}



async function createCanvas() {
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
	layer = new Konva.Layer();
	const backgroundImg = await loadImg(`/src/assets/${props.data}/background.png`);
	const background = new Konva.Image({
		x: 0,
		y: 0,
		width: width.value,
		height: height.value,
		image: backgroundImg,
		draggable: false,
		// opacity: 0,
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
	const maskImg = await loadImg(`/src/assets/${props.data}/mask.png`);
	const maskImage = new Konva.Image({
		image: maskImg,
		draggable: false,
	});
	maskImage.cache()
	// 遍历root的节点，在node layer中添加
	nodes.forEach((_node) => {
		let originalNode = maskImage.clone();
		//按照原始大小截取node的mask
		originalNode.crop({
			x: _node.position[0][0],
			y: _node.position[0][1],
			width: _node.position[1][0],
			height: _node.position[1][1],
		}).setAttrs({ //按照现在_position设置node的位置(x,y)和宽高(width, height)
			x: _node._position[0][0],
			y: _node._position[0][1],
			width: _node._position[1][0],
			height: _node._position[1][1],
			id: `${_node.name}`,
			draggable: true,
			name: 'node',
		})
		_node.konvaNode = originalNode;
		originalNode.cache();
		nodeGroup.add(originalNode);
		layer.draw();

		originalNode.on('dragstart', (e) => {
			simulation.alphaTarget(0.3).restart();
			_node.fx = e.target.x();
			_node.fy = e.target.y();
		});

		originalNode.on('dragmove', (e) => {
			simulation.alphaTarget(0.3).restart();
			_node.fx = e.target.x();
			_node.fy = e.target.y();
		});

		originalNode.on('dragend', (e) => {
			simulation.alphaTarget(0);
			_node.fx = null;
			_node.fy = null;
		});

		originalNode.on('mouseover', () => {
			// let pathToRoot = _node.ancestors();
			// let nodeNames = pathToRoot.map(d => d.data.name);
			// let konvaNodes = pathToRoot.map(d => d.konvaNode)
			// let linkToRoot = stage.find('.link').filter((_, i, nodes) => {
			// 	return nodeNames.includes(nodes[i].id())
			// })
			// interaction.highlightLink(linkToRoot)
			// interaction.highlightNode(konvaNodes)
			stage.container().style.cursor = 'pointer';
			// layer.draw();
		});
		originalNode.on('mouseleave', () => {
			// let pathToRoot = _node.ancestors();
			// let nodeNames = pathToRoot.map(d => d.data.name);
			// let konvaNodes = pathToRoot.map(d => d.konvaNode)
			// let linkToRoot = stage.find('.link').filter((_, i, nodes) => {
			// 	return nodeNames.includes(nodes[i].id())
			// })
			// interaction.highlightLink(linkToRoot)
			// interaction.highlightNode(konvaNodes)
			stage.container().style.cursor = 'default';
			// layer.draw();
		});
	})

	links.forEach(_link => {
		_link.initalLink = [_link._sourcePosition[0], _link._sourcePosition[1], _link._targetPosition[0], _link._targetPosition[1]]
		let linkNode = new Konva.Line({
			points: _link.initalLink,
			stroke: '#000000',
			fill: null,
			zindex: 2,
			name: 'link',
			id: _link.name,
		});
		_link.linkNode = linkNode;
		linkGroup.add(linkNode);
	})
	layer.batchDraw();
}

const setSimulation = () => {
	// 根据node所在的位置初始化力导向的x和y坐标
	nodes.forEach(_ => {
		_.initalX = _.x = _._position[0][0];
		_.initalY = _.y = _._position[0][1];
	})
	linkForce = d3.forceLink(links).id(node => node.name).strength(1) // 绘制canvas需要使用这个力来将source和target替换为node
}

const runSimulation = () => {
	simulation = d3.forceSimulation(nodes)
		.force("linkForce", linkForce)
		.force("charge", d3.forceManyBody().strength(-50))
		.force("collide", d3.forceCollide(()=>20))
		.force("x", d3.forceX(width.value / 2).strength(0.08))
		.force("y", d3.forceY(height.value / 2).strength(0.08))
		.on("tick", () => {
			nodes.forEach(n => {
				// n.dx = n.x - n.lastX;
				// n.dy = n.y - n.lastY;
				// console.log(n.dx, n.dy)
				// if (!n.last_fx) {
				// 	n.last_fx = n.fx;
				// 	n.last_fy = n.fy;
				// }
				// if (n.fx) {
				// 	n.dx = n.fx - n.last_fx;
				// 	n.dy = n.fy - n.last_fy;
				// 	n.last_fx = n.fx;
				// 	n.last_fy = n.fy;
				// }
				// n.konvaNode.x(n.lastX + n.dx);
				// n.konvaNode.y(n.lastY + n.dy);
				n.konvaNode.x(n.x);
				n.konvaNode.y(n.y);
				n.dx = n.x - n.initalX;
				n.dy = n.y - n.initalY;
			})
			links.forEach(l => {
				let _ = Array.from(l.initalLink)
				_[0] += l.source.dx;
				_[1] += l.source.dy;
				_[2] += l.target.dx;
				_[3] += l.target.dy;
				l.linkNode.points(_);
			})
			layer.batchDraw();
		});
}

watchEffect(() => {
	if (props.mode === 'modern') {
		runSimulation();
	}
})


onMounted(async () => {
	width.value = props.width;
	links = await d3.json(`/src/assets/${props.data}/link.json`)
	nodes = await d3.json(`/src/assets/${props.data}/node.json`);
	imgSize = await calculateImageSize(`/src/assets/${props.data}/img.jpeg`, width.value);
	initSize[0] = imgSize.originalWidth; // 原始背景图像宽
	initSize[1] = imgSize.originalHeight; // 原始背景图像高
	height.value = imgSize.newHeight;
	nodes, links = resize(initSize, [width.value, height.value], nodes, links);
	setSimulation(); // 会改变node和link 非纯func
	createCanvas();
})
</script>


<style scope></style>