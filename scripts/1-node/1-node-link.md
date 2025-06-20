### 节点连接图

Figma标注：

* root为一个group，包含
  * rect: 锚定原图大小
  * node ```<g>```: 每个节点的bbox 矩形
  * link ```<g>```: 每个link的线条


### 数据结构
> 和tree diagram的类似，区别在于node不存在树结构关系。每个node之间是平级的。主要保存节点的属性（语义+布局）

Node.json: [Node, Node, ...]

```ts
interface Node {
    name: string,
    position: [[number, number], [number, number]]
    index: number
}
```

Link.json: [Link, Link, ...]
三个方面：1. 直线 2. 曲线 3. 交叉
> *和树状图的区别*：直线树状图中存在许多交叉节点，属于真交叉节点，即交叉体现了真实的连接性。但节点连接图中交叉节点并不体现真实的连接关系，往往是重叠。并且两个节点之间只需要一条线（历史图表都为无向图）连接即可。因此，考虑使用保存图的方式来储存连接数据。
> 
> *交叉*：交叉的主要问题在于从图像分割到解析的判断，即如何判断出交叉点是真实连接还是重叠。在数据结构中，保存的是默认判断正确的结果。


1. 只考虑直线, **controlPoints**为不包含起点**source**和终点**target**的折线上的其他控制点，结合起点终点来重建原始连接。在d3.js的数据结构上添加起点位置和终点位置，用于重建古代图表。
```ts
interface Link {
    source: string, // 
    sourcePosition: [number, number],
    target: string,
    targetPosition: [number, number] 
    controlPoints?: [number, number][]
}
```
2.  TODO: 考虑曲线
