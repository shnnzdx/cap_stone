"""Chicago 策展景点库 —— AI 生成行程时只能从这里挑,不许自己编。

每个字段的用处:
  price / duration / opens / closes      判定时间撞车、超预算、那天开不开门
  lat / lng                              地图 + 算两点之间的路程
  walk                                   low|medium|high —— 判 walk_limit 约束
  access                                 无障碍标签 —— 判 accessibility 约束
  diet                                   饮食标签 —— 判 dietary 约束
  tags                                   AI 按兴趣挑东西用

⚠️ 可信度:名字、地点、坐标是真的,**价格和营业时间是估算**。
   所以 source 一律 ai_estimate。人工核实过哪条,再把那条改成 verified。
   photo_url 一律留空 —— 编图片地址大概率是坏链,图应该后补(Google Places 或手动)。
"""

# (名字, 区域, lat, lng, 每人$, 分钟, 开, 关, walk, access, diet, tags)
POIS = [
    # ——— 博物馆与文化 ———
    ("Art Institute of Chicago", "Michigan Avenue", 41.8796, -87.6237, 32, 180, 10.5, 17.0, "low", ["wheelchair", "step_free", "seating"], [], ["culture", "art", "indoor", "rainy_day"]),
    ("Field Museum", "Museum Campus", 41.8663, -87.6170, 30, 180, 9.0, 17.0, "medium", ["wheelchair", "step_free", "seating"], [], ["culture", "family", "indoor", "rainy_day"]),
    ("Shedd Aquarium", "Museum Campus", 41.8676, -87.6140, 40, 150, 9.0, 18.0, "medium", ["wheelchair", "step_free"], [], ["family", "indoor", "rainy_day"]),
    ("Adler Planetarium", "Museum Campus", 41.8663, -87.6068, 25, 120, 9.0, 16.0, "medium", ["wheelchair", "step_free"], [], ["culture", "family", "indoor", "views"]),
    ("Museum of Science and Industry", "Hyde Park", 41.7906, -87.5831, 25, 180, 9.5, 17.5, "medium", ["wheelchair", "step_free", "seating"], [], ["culture", "family", "indoor", "rainy_day"]),
    ("Chicago Cultural Center", "Loop", 41.8837, -87.6250, 0, 60, 10.0, 17.0, "low", ["wheelchair", "step_free"], [], ["culture", "free", "indoor", "architecture"]),
    ("Museum of Contemporary Art", "Streeterville", 41.8967, -87.6215, 18, 120, 10.0, 17.0, "low", ["wheelchair", "step_free", "seating"], [], ["culture", "art", "indoor"]),
    ("National Museum of Mexican Art", "Pilsen", 41.8558, -87.6690, 0, 90, 10.0, 17.0, "low", ["wheelchair", "step_free"], [], ["culture", "art", "free", "indoor"]),
    ("Chicago History Museum", "Lincoln Park", 41.9114, -87.6316, 19, 120, 9.5, 16.5, "low", ["wheelchair", "step_free"], [], ["culture", "indoor", "rainy_day"]),

    # ——— 建筑与观景 ———
    ("Architecture River Cruise", "Chicago River dock", 41.8880, -87.6244, 52, 90, 9.0, 19.0, "low", ["seating"], [], ["architecture", "signature", "outdoor", "views"]),
    ("Willis Tower Skydeck", "Loop", 41.8789, -87.6359, 34, 75, 9.0, 22.0, "low", ["wheelchair", "step_free"], [], ["views", "signature", "indoor"]),
    ("360 Chicago Observation Deck", "Magnificent Mile", 41.8988, -87.6229, 32, 60, 9.0, 23.0, "low", ["wheelchair", "step_free"], [], ["views", "indoor", "evening"]),
    ("Chicago Riverwalk", "Chicago Riverwalk", 41.8879, -87.6270, 0, 90, 6.0, 23.0, "medium", ["wheelchair", "step_free", "seating"], [], ["outdoor", "free", "relaxed", "sunset"]),
    ("The Rookery Building lobby", "Loop", 41.8790, -87.6324, 0, 45, 8.0, 18.0, "low", ["wheelchair"], [], ["architecture", "free", "indoor"]),
    ("Tribune Tower & DuSable Bridge", "Magnificent Mile", 41.8899, -87.6244, 0, 30, 0.0, 24.0, "low", ["step_free"], [], ["architecture", "free", "outdoor"]),

    # ——— 公园与户外 ———
    ("Millennium Park & Cloud Gate", "Millennium Park", 41.8826, -87.6226, 0, 60, 6.0, 23.0, "low", ["wheelchair", "step_free", "seating"], [], ["outdoor", "free", "signature", "relaxed"]),
    ("Maggie Daley Park", "Millennium Park", 41.8837, -87.6187, 0, 90, 6.0, 23.0, "medium", ["wheelchair", "step_free", "seating"], [], ["outdoor", "free", "family"]),
    ("Lincoln Park Zoo", "Lincoln Park", 41.9217, -87.6337, 0, 150, 10.0, 17.0, "medium", ["wheelchair", "step_free", "seating"], [], ["outdoor", "free", "family", "relaxed"]),
    ("Lincoln Park Conservatory", "Lincoln Park", 41.9243, -87.6357, 0, 60, 10.0, 17.0, "low", ["wheelchair", "step_free"], [], ["outdoor", "free", "relaxed", "rainy_day"]),
    ("Garfield Park Conservatory", "Garfield Park", 41.8865, -87.7170, 0, 90, 10.0, 17.0, "low", ["wheelchair", "step_free", "seating"], [], ["free", "relaxed", "rainy_day", "indoor"]),
    ("Navy Pier", "Navy Pier", 41.8917, -87.6086, 0, 150, 10.0, 22.0, "medium", ["wheelchair", "step_free", "seating"], [], ["outdoor", "family", "evening", "views"]),
    ("North Avenue Beach", "Lincoln Park", 41.9184, -87.6295, 0, 120, 6.0, 23.0, "high", ["seating"], [], ["outdoor", "free", "relaxed", "summer"]),
    ("Buckingham Fountain & Grant Park", "Grant Park", 41.8758, -87.6189, 0, 45, 6.0, 23.0, "medium", ["wheelchair", "step_free", "seating"], [], ["outdoor", "free", "signature"]),
    ("Ping Tom Memorial Park", "Chinatown", 41.8542, -87.6350, 0, 45, 6.0, 21.0, "low", ["wheelchair", "step_free", "seating"], [], ["outdoor", "free", "relaxed"]),

    # ——— 街区漫步 ———
    ("Wicker Park & Bucktown walk", "Wicker Park", 41.9088, -87.6796, 0, 150, 10.0, 20.0, "high", [], [], ["neighborhood", "shopping", "free", "outdoor"]),
    ("Pilsen mural walk", "Pilsen", 41.8564, -87.6560, 0, 120, 9.0, 19.0, "high", [], [], ["neighborhood", "art", "free", "outdoor"]),
    ("Chinatown walk", "Chinatown", 41.8527, -87.6320, 0, 120, 10.0, 21.0, "medium", ["step_free"], [], ["neighborhood", "food", "free"]),
    ("Old Town stroll", "Old Town", 41.9109, -87.6376, 0, 90, 9.0, 21.0, "medium", [], [], ["neighborhood", "free", "relaxed"]),
    ("Fulton Market walk", "West Loop", 41.8848, -87.6486, 0, 120, 10.0, 22.0, "medium", ["step_free"], [], ["neighborhood", "food", "free"]),
    ("Logan Square walk", "Logan Square", 41.9294, -87.7073, 0, 120, 10.0, 22.0, "high", [], [], ["neighborhood", "free", "nightlife"]),
    ("Hyde Park & University of Chicago", "Hyde Park", 41.7897, -87.5997, 0, 120, 8.0, 20.0, "high", ["step_free"], [], ["neighborhood", "architecture", "free"]),
    ("Magnificent Mile shopping", "Magnificent Mile", 41.8955, -87.6244, 0, 120, 10.0, 20.0, "medium", ["wheelchair", "step_free"], [], ["shopping", "indoor", "rainy_day"]),

    # ——— 吃饭 ———
    ("Lou Malnati's Pizzeria", "River North", 41.8925, -87.6316, 25, 90, 11.0, 22.0, "low", ["wheelchair", "seating"], ["vegetarian"], ["food", "signature", "casual"]),
    ("Pequod's Pizza", "Lincoln Park", 41.9219, -87.6640, 25, 90, 11.0, 24.0, "low", ["seating"], ["vegetarian"], ["food", "casual", "evening"]),
    ("Portillo's Hot Dogs", "River North", 41.8925, -87.6314, 15, 60, 10.0, 22.0, "low", ["wheelchair", "seating"], [], ["food", "casual", "budget"]),
    ("Au Cheval", "West Loop", 41.8845, -87.6478, 30, 90, 11.0, 24.0, "low", ["seating"], [], ["food", "signature", "evening"]),
    ("Girl & the Goat", "West Loop", 41.8844, -87.6486, 75, 120, 16.5, 23.0, "low", ["wheelchair", "seating"], ["vegetarian"], ["food", "upscale", "evening", "celebration"]),
    ("Monteverde", "West Loop", 41.8848, -87.6510, 60, 120, 17.0, 22.0, "low", ["seating"], ["vegetarian"], ["food", "upscale", "evening", "celebration"]),
    ("The Purple Pig", "Magnificent Mile", 41.8912, -87.6244, 50, 120, 11.0, 23.0, "low", ["seating"], ["vegetarian"], ["food", "upscale", "evening"]),
    ("Xoco", "River North", 41.8925, -87.6335, 20, 60, 11.0, 21.0, "low", ["seating"], ["vegetarian"], ["food", "casual", "budget"]),
    ("Green Street Smoked Meats", "West Loop", 41.8836, -87.6478, 28, 75, 11.0, 22.0, "low", ["seating"], [], ["food", "casual"]),
    ("Sultan's Market", "Wicker Park", 41.9084, -87.6749, 12, 45, 10.0, 22.0, "low", ["seating"], ["vegetarian", "vegan", "halal"], ["food", "budget", "casual"]),
    ("Handlebar", "Wicker Park", 41.9074, -87.6773, 22, 90, 11.0, 22.0, "low", ["seating"], ["vegetarian", "vegan"], ["food", "casual", "relaxed"]),
    ("Lula Cafe", "Logan Square", 41.9265, -87.7085, 35, 90, 9.0, 22.0, "low", ["seating"], ["vegetarian", "vegan"], ["food", "brunch", "relaxed"]),
    ("Wildberry Pancakes and Cafe", "Loop", 41.8842, -87.6218, 22, 75, 7.0, 14.0, "low", ["wheelchair", "seating"], ["vegetarian"], ["food", "brunch", "morning"]),
    ("Chicago French Market", "West Loop", 41.8827, -87.6410, 18, 60, 7.0, 19.0, "low", ["wheelchair", "step_free", "seating"], ["vegetarian", "vegan", "gluten_free"], ["food", "budget", "indoor", "flexible"]),

    # ——— 夜晚 ———
    ("Green Mill Cocktail Lounge", "Uptown", 41.9700, -87.6595, 15, 120, 17.0, 26.0, "low", ["seating"], [], ["nightlife", "music", "evening"]),
    ("Kingston Mines blues club", "Lincoln Park", 41.9214, -87.6485, 25, 150, 19.0, 26.0, "medium", ["seating"], [], ["nightlife", "music", "evening"]),
    ("The Second City comedy", "Old Town", 41.9109, -87.6376, 35, 120, 18.0, 23.0, "low", ["wheelchair", "seating"], [], ["nightlife", "evening", "signature"]),
]
