from svgpathtools import parse_path, Line, wsvg
import numpy as np
import imagesize, json
from PIL import Image





def sample_normal_line(start_point, normal_vec, num_samples = 10, max_distance = 10 ):
    sampled_points = []
    step_distance = max_distance / num_samples
    assert num_samples % 2 == 0
    for i in range(1, int(num_samples / 2) + 1):
        distance = i * step_distance
        sample_point_positive = start_point + distance * normal_vec # 法向方向
        sample_point_negative = start_point + distance * (-normal_vec) #法向方向的反向
        sampled_points.append(sample_point_positive)
        sampled_points.append(sample_point_negative)
    return sampled_points

def extract_pixels_from_origin(origin_img_path, path_masks): #从原始图像提取像素
    width, height = imagesize.get(origin_img_path)
    origin_img = Image.open(origin_img_path).convert('RGBA')   # 换成你的图片路径
    origin_img = np.array(origin_img)
    new_mask = Image.new('RGBA', (width, height), (255, 255, 255, 0)) # type: ignore
    new_mask_binary = Image.new('L', (width, height), 0) # type: ignore
    # 按照origin照片替换新照片像素
    path_name_mask_dict = {}
    index= 0 
    for (path_name, masks) in path_masks.items():
        path_name_mask_dict[index] = path_name
        for mask in masks:
            x, y = mask
            if origin_img[y, x][3] == 0:
                # print(origin_img[y, x])
                origin_img[y,x] = np.array([0,255,0,255])
            new_mask.putpixel((x, y), tuple(origin_img[y, x]))  # 0 为黑色
            new_mask_binary.putpixel((x, y), index)  # 0 为黑色
        index += 1
    new_mask.save("new_mask.png")
    new_mask_binary.save("new_mask_binary.png")
    save_json(path_name_mask_dict)

def save_json(data, path="mask.json"):
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data))

if __name__ == "__main__":
    origin_img_path = "mask.png"
    with open("link.json", "r", encoding="utf-8") as f:
        link_data = json.load(f)
    path_masks = {}
    for link in link_data:
        if not link['path']:
            continue
        path = parse_path(link['path'])
        n_points = 500  # 采样点数
        points = [path.point(i/n_points) for i in range(n_points+1)]
        normals = [path.normal(i/n_points) for i in range(n_points+1)]
        normal_lines_pixels = []
        for point, normal_vec in zip(points, normals):
            normal_lines_pixels.extend(sample_normal_line(point, normal_vec))
        path_masks[link['name']] = [(int(round(p.real)), int(round(p.imag))) for p in [*points, *normal_lines_pixels]]
        # complete_pixels.extend([(int(round(p.real)), int(round(p.imag))) for p in [*points, *normal_lines_pixels]])
    extract_pixels_from_origin(origin_img_path,path_masks)
    print(len(path_masks))
    
