// 在 Node.js 环境中:
import { parseSVG, makeAbsolute } from 'svg-path-parser';
import simplify from 'simplify-js';

// 在浏览器 <script> 标签中，它们是全局的:
// const { parseSVG, makeAbsolute } = svgPathParser;

/**
 * 使用 svg-path-parser 和 simplify-js 简化 SVG 路径的 d 属性
 * @param {string} d - 原始的 d 属性字符串
 * @param {number} tolerance - 简化容差，数值越大，简化程度越高
 * @returns {string} - 简化后的 d 属性字符串
 */
export function simplifyPath(d, tolerance = 1.0) {
  // 1. 解析路径并转换为绝对坐标，这会让处理过程简单得多
  // 在浏览器中，使用 svgPathParser.parseSVG 和 svgPathParser.makeAbsolute
  let commands = parseSVG(d);
  commands = makeAbsolute(commands);
  console.log(commands)
  const simplifiedCommands = [];
  let currentLineSequence = [];


  // 4. 重建 d 字符串
  return simplifiedCommands.map(cmd => {
    let str = cmd.code;
    // 根据命令类型拼接坐标
    if (cmd.x !== undefined) str += ` ${cmd.x}`;
    if (cmd.y !== undefined) str += ` ${cmd.y}`;
    if (cmd.x1 !== undefined) str += ` ${cmd.x1}`;
    if (cmd.y1 !== undefined) str += ` ${cmd.y1}`;
    if (cmd.x2 !== undefined) str += ` ${cmd.x2}`;
    if (cmd.y2 !== undefined) str += ` ${cmd.y2}`;
    // 对于 A 和 S 命令可以添加更多参数
    return str;
  }).join(' ');
}

// // --- 使用示例 ---
// const originalD = "M 10 10 L 20 20 L 30 30 L 30.1 30.1 L 50 30 C 60 30 70 40 80 50 L 90 60 L 100 70 Z";

// console.log("Original D:", originalD);

// const newD = simplifyPath(originalD, 1.0); // 使用 1.0 的容差

// console.log("Simplified D:", newD);
// // 预期输出: "M 10 10 L 50 30 C 60 30 70 40 80 50 L 100 70 Z"
// // 解释:
// // L 20 20 和 L 30 30 被简化掉了，因为它们与 M 10 10 和 L 50 30 共线。
// // L 30.1 30.1 被视为重复点移除。
// // C 60 30 70 40 80 50 (曲线) 被完整保留。
// // L 90 60 被简化掉，因为它与 L 80 50 和 L 100 70 共线。
// // Z (闭合路径) 被完整保留。
