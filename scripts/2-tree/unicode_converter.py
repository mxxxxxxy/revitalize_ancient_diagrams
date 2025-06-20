import re
import html

def html_entities_to_chinese(input_string):
    # 使用正则表达式找到所有&#NNN;形式的实体
    entities = re.findall(r'&#(\d+);', input_string)
    rest = re.sub(r'&#\d+;', '', input_string)
    potentialIdx1, potentialIdx2 = rest.split('-')[0], rest.split('_')[0]
    # 将每个十进制数字转换为对应的字节
    byte_array = bytearray(int(entity) for entity in entities)
    
    # 使用UTF-8解码字节数组，得到中文字符
    chinese_text = byte_array.decode('utf-8')
    if potentialIdx1 == potentialIdx2 and potentialIdx1 and potentialIdx2:
        chinese_text += potentialIdx1
    return chinese_text

def extract_and_decode_ids(svg_file_path):
    # 读取SVG文件内容
    with open(svg_file_path, 'r', encoding='utf-8') as file:
        svg_content = file.read()
    # print(svg_content)
    # 正则表达式匹配所有id属性
    id_pattern = re.compile(r'id="(.*?)"')
    ids = id_pattern.findall(svg_content)
    id_mapping = {}
    for id_str in ids:
        # if not id_str.startswith("&"):
        #     continue
        if '&' not in id_str:
            continue
        decoded_id = html_entities_to_chinese(id_str)
        id_mapping[id_str] = decoded_id

    if not id_mapping:
        print("没有找到需要解码和替换的ID。")
        return
    
    # 替换所有匹配的ID
    def replace_match(match):
        original_id = match.group(1)
        return f'id="{id_mapping.get(original_id, original_id)}"'
    
    updated_svg_content = id_pattern.sub(replace_match, svg_content)
    return updated_svg_content

if __name__ == "__main__":
    svg_path = '../public/唐疆域669.svg' # 中文id未被正确解码
    output_svg_path = '../public/tang.svg' # 中文id正确解码后的svg
    updated_svg_content = extract_and_decode_ids(svg_path)
    with open(output_svg_path, 'w', encoding='utf-8') as file:
        file.write(updated_svg_content)
