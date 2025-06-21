import xml.etree.ElementTree as ET
from svgelements import Rect, Matrix
from svg.path import parse_path
import json, os
import math
import argparse

def extract_start_end_points_from_d(d_str):
    """
    从SVG path的d属性中获取起点和终点坐标
    :param d_str: SVG path的d属性字符串
    :return: (起点坐标, 终点坐标)，例如 ((x1, y1), (x2, y2))
    """
    path_obj = parse_path(d_str)
    if not path_obj or len(path_obj) == 0:
        return None, None
    start_pt = (path_obj[0].start.real, path_obj[0].start.imag)
    end_pt = (path_obj[-1].end.real, path_obj[-1].end.imag)
    return start_pt, end_pt


# 加载SVG文件
def parse_svg(svg_file):
    # 解析SVG文件
    tree = ET.parse(svg_file)
    root = tree.getroot()
    # 命名空间 (一般SVG文件会包含默认的命名空间)
    # 根据具体的SVG文件，可能需要调整命名空间前缀
    namespace = {'svg': 'http://www.w3.org/2000/svg'}

    node, link = [], []
    groups = root[0].findall('.//svg:g', namespaces=namespace)
    for group in groups:
        if group.attrib['id'] == 'node':
            nodeEle = group.findall('.//svg:rect', namespaces=namespace)
        elif group.attrib['id'] == 'link':
            linkEle = group.findall('.//svg:path', namespaces=namespace)

    for i, _node in enumerate(nodeEle):
        x, y, w, h = float(_node.attrib['x']), float(_node.attrib['y']), float(_node.attrib['width']), float(_node.attrib['height'])
        node.append({
            "name": _node.attrib['id'],
            "position": [[x, y], [w, h]],
            "index": i
        })
    for _link in linkEle:
        (start, end) = extract_start_end_points_from_d(_link.attrib['d'])
        link.append({
            "name": _link.attrib['id'],
            "source": {
                "nodeId": "",
                "position": start
            },
            "target": {
                "nodeId": "",
                "position": end
            },
            "path": _link.attrib['d']
        })
    return node, link

def euclidean_distance(p1, p2):
    """计算两点 p1(x1,y1) 和 p2(x2,y2) 之间的欧几里得距离。"""
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def find_closest_node(pos, nodes):
    min_dist = float('inf')
    min_index = None
    for node in nodes:
        node_center = [node['position'][0][0] + node['position'][1][0] / 2, node['position'][0][1] + node['position'][1][1] / 2 ]
        dist = euclidean_distance(pos, node_center)
        if dist < min_dist:
            min_dist = dist
            min_index = node['name']
    return min_index

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="命令行参数示例")
    parser.add_argument('-s','--svg', type=str, help='SVG', default="./starmap1.svg")
    parser.add_argument('-o','--output', type=str, help='输出文件夹', default="./")
    args = parser.parse_args()
    print(args)
    print(f"SVG: {args.svg}")
    print(f"output: {args.output}")

    output_dir = args.output
    svg_file = args.svg  # 替换SVG文件路径
    node, link = parse_svg(svg_file)

    for l in link:
        source_pos = l['source']['position']
        target_pos = l['target']['position']
        l['source'] = find_closest_node(source_pos, node)
        l['sourcePosition'] = source_pos
        l['target'] = find_closest_node(target_pos, node)
        l['targetPosition'] = target_pos

    print(os.path.join(output_dir, "node.json"))
    with open(f"{output_dir}/link.json", "w", encoding="utf-8") as f:
        f.write(json.dumps(link, ensure_ascii=False))

    with open(f"{output_dir}/node.json", "w", encoding="utf-8") as f:
        f.write(json.dumps(node, ensure_ascii=False))