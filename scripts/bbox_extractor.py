import xml.etree.ElementTree as ET
from svgelements import Rect, Matrix


def get_node_group(svg_file):
    # 解析SVG文件
    tree = ET.parse(svg_file)
    root = tree.getroot()
    # 命名空间 (一般SVG文件会包含默认的命名空间)
    # 根据具体的SVG文件，可能需要调整命名空间前缀
    namespace = {'svg': 'http://www.w3.org/2000/svg'}
    
    # 查找所有一级 <g> 元素
    root_g = root.find('./svg:g', namespace)  # 使用命名空间避免解析问题
    g_elements = root_g.findall('./svg:g', namespace)  # 使用命名空间避免解析问题
    
    layers = {}
    # 遍历 <g> 元素并提取属性 （图层）
    for g in g_elements:
        # print(f"Found <g> element with attributes: {g.attrib}")
        elements = []
        # 如果需要进一步提取 <g> （图层） 内子元素及其信息
        for child in g:
            # childTag = child.tag.replace('{http://www.w3.org/2000/svg}','')
            text = child.find('.//svg:text', namespace)
            rect = child.find('.//svg:rect', namespace)
            path = child.find('.//svg:path', namespace)
            circle = child.find('.//svg:circle', namespace)
            textData = []
            if text is not None:
                text_attr = text.attrib
                # print(text_attr['transform'])
                transform = text_attr.get('transform', '')
                font_size = text_attr.get('font-size', '')
                for tspan in text:
                    tspan_attr = tspan.attrib
                    textData.append({
                        "pos": [tspan_attr['x'], tspan_attr['y']],
                        "text": tspan.text,
                        "font-size": font_size,
                        "transform": transform
                    })
            if rect is not None:
                rect_attr = rect.attrib
                rect_tranform = rect_attr.get("transform", "")
                if rect_tranform:
                    d = Rect(rect_attr['x'], rect_attr['y'], rect_attr['width'], rect_attr['height'], transform=rect_tranform).d()
                else:
                    d = Rect(rect_attr['x'], rect_attr['y'], rect_attr['width'], rect_attr['height']).d()
                del rect_attr['x']
                del rect_attr['y']
                del rect_attr['width']
                del rect_attr['height']
                rect_attr['d'] = d
                elements.append({**rect_attr, 'tag': 'path', 'text': textData})
                continue
            if path is not None:
                elements.append({**path.attrib, 'tag': 'path', 'text': textData})
                if textData:
                    textName = textData[0].get('text')
                    if path.attrib['id'].startswith('Vector') and textName is not None:
                        elements[-1]['id'] = textName
            if circle is not None:
                elements.append({**circle.attrib, 'tag': 'circle', 'text': textData})
            if g.attrib['id'] == '城市边界CHGIS':
                elements[-1]['id'] += 'CHGIS'
        layers[g.attrib['id']] = elements
    return layers
