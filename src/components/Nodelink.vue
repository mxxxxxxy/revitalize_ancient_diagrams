<template>
	<div class="node-link-container" :style="{ width: width + 'px', height: height + 'px', position: 'relative' }">
		<div ref="canvas" style="position: absolute; left: 0; top: 0;"></div>
	</div>
</template>

<script setup>
import { ref, onMounted, watch, computed, useTemplateRef, watchEffect } from 'vue';
import { calculateImageSize, loadImg } from '@/utils/image.js';
import { PathSampler } from '@/render/sample.js'
var links, nodes;
var imgSize;
var animations = {};
var stage;
var layer;
var render = false;
var initSize = [0, 0]; // 原始背景图像 [宽,高]
var simulation = null;
var dragActive;
var linkForce;
var sampler;
const padding = {
	top: 0.1,
	bottom: 0.1,
	left: 0.05,
	right: 0.05
}
const canvas = useTemplateRef('canvas');
var line = d3.line()
	.x((d) => d[0])
	.y((d) => d[1]);
const width = ref(400);
const height = ref(0);

const xRatio = ref(1);
const yRatio = ref(1);

const props = defineProps(['mode', 'data', 'width']);
const figSize = computed(() => {
	return {
		width: width.value * (1 - padding.left - padding.right),
		height: height.value * (1 - padding.top - padding.bottom),
	}
})

// -----初始化-----
// 根据绘制大小重新计算node和link位置
// 下划线开头的为当前绘制大小下的坐标
function resize(originalSize, currentSize, nodes, links) {
	xRatio.value = currentSize[0] / originalSize[0];
	yRatio.value = currentSize[1] / originalSize[1];
	nodes.forEach(node => {
		node._position = [[0, 0], [0, 0]]
		node._position[0][0] = node.position[0][0] * xRatio.value
		node._position[1][0] = node.position[1][0] * xRatio.value
		node._position[0][1] = node.position[0][1] * xRatio.value
		node._position[1][1] = node.position[1][1] * yRatio.value
	})
	// links.forEach(link => {
	// 	link._sourcePosition = [link.sourcePosition[0] * xRatio, link.sourcePosition[1] * yRatio]
	// 	link._targetPosition = [link.targetPosition[0] * xRatio, link.targetPosition[1] * yRatio]
	// })
	links.forEach(link => {
		link._sourcePosition = [link.sourcePosition[0], link.sourcePosition[1]]
		link._targetPosition = [link.targetPosition[0], link.targetPosition[1]]
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

	sampler = new PathSampler(maskImg, {
		width: width.value
	})

	links.forEach(link => {
		link.initalLink = [link._sourcePosition, link._targetPosition];
		const d = link.path
		const id = link.name
		sampler.samplePath(id, d);
		sampler.render(id, d);
		link.bbox = sampler.outputBBox;
		animations[id] = [
			Math.round(link.bbox.x),
			Math.round(link.bbox.y),
			Math.round(link.bbox.width),
			Math.round(link.bbox.height)
		];
		const sprite = new Konva.Sprite({
			// 关键：所有 sprite 都共享同一个源 canvas 和 animations 对象
			image: sampler.resultCanvas,
			animations: animations,

			// 关键：指定当前 sprite 显示哪一个“动画”（帧）
			animation: id,

			// 关键：将 sprite 放置在它在源 canvas 上的原始位置
			x: Math.round(link.bbox.x),
			y: Math.round(link.bbox.y),

			draggable: false,
		});
		link.sprite = sprite;
		layer.add(sprite);
	});

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
		.force("collide", d3.forceCollide(() => 20))
		.force("x", d3.forceX(width.value / 2).strength(0.08))
		.force("y", d3.forceY(height.value / 2).strength(0.08))
		.on("tick", () => {
			nodes.forEach(n => {
				n.konvaNode.x(n.x);
				n.konvaNode.y(n.y);
				n.dx = n.x - n.initalX;
				n.dy = n.y - n.initalY;
			})
			sampler.clear()
			links.forEach(l => {
				// canvas
				let _ = [[0, 0], [0, 0]]
				_[0][0] = l.initalLink[0][0] + l.source.dx / xRatio.value;
				_[0][1] = l.initalLink[0][1] + l.source.dy / yRatio.value;
				_[1][0] = l.initalLink[1][0] + l.target.dx / xRatio.value;
				_[1][1] = l.initalLink[1][1] + l.target.dy / yRatio.value;
				sampler.render(l.name, line(_));
				l.bbox = sampler.outputBBox;
				animations[l.name] = [
					Math.round(l.bbox.x),
					Math.round(l.bbox.y),
					Math.round(l.bbox.width),
					Math.round(l.bbox.height)
				];
				l.sprite.setAttrs({
					animations: animations,
					animation: l.name,
					x: Math.round(l.bbox.x),
					y: Math.round(l.bbox.y),
				})
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
	links = await d3.json(`/src/assets/${props.data}/link.json`);
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