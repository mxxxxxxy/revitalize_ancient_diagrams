### 树状图

Figma标注规则：

1. 所有控制点和bbox均在一个group下，控制点使用circle，bbox使用rect
2. 控制点index从1开始递增
3. bbox的id为该node的名称，每个id需要不同
4. 背景需要用一个rect来表示，rect的id命名为"background"

### 数据处理流程

1. 在figma上进行bbox和控制点的标注 （准测见上），导出svg（导出设置需要包含元素id）
2. 运行parse_svg.ipynb,得到node.json和link.json
3. 运行外部的segment.ipynb得到mask.png
4. node.json mask.png link.json全部放在前端对应dir内

### 前端所需数据

- dirName
  - img.jpeg 原图transport
  - background.png 只保留背景
  - mask.png 去除背景后的tree diagram
  - link.json 控制点数据
  - node.json 节点layout数据+树结构数据

### 数据结构
一个树状图保存为node.json和link.json。

* node.json
  * 每个节点的**children**字段保存该节点的子节点
  * 节点属性
    * name：名称transport
    * position: bbox的x,y,w,h
    * controlPoints: 从其父节点到子节点上的控制点ID。
      * 对于**折线**连接的树状图来说，这些点使用直线连接便可构成原图上的连接关系。
      * 对于**曲线**连接的树状图来说，控制点可以是 1.起点和终点 2. 通过拟合出来贝塞尔曲线控制点
      * 曲线的控制点具体保存方式需要讨论
* link.json
  * 保存每个控制点的位置: { ID : [pos_x, pos_y] }
  * 对于**折线**连接的树状图来说，每个控制点为折线上所有的端点和交点。node根据顺序拼接这些坐标点重建原始的树状图连接。
  * 对于**曲线**
    * 1.起点和终点的坐标
    * 2.通过拟合出来贝塞尔曲线控制点

