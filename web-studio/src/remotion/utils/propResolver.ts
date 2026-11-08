/**
 * Bộ chuẩn hóa và phân giải Prop Asset ID (Bulletproof Prop Normalizer)
 * Tự động ánh xạ mọi định dạng (camelCase, PascalCase, snake_case, tiếng Việt, tiếng Anh)
 * sang chính xác tên file SVG 2K có sẵn trong public/assets/props/
 */

export function normalizePropAssetId(rawType?: string): string {
  if (!rawType) return "glass-jar";

  // Chuyển camelCase / PascalCase sang kebab-case và thay thế gạch dưới/dấu cách
  let s = String(rawType)
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Hàm loại bỏ dấu tiếng Việt để bắt các biến thể gõ tiếng Việt từ AI / User
  const removeAccents = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");

  const unaccented = removeAccents(s);

  // 1. Lọ thủy tinh (Glass Jar)
  if (/glass-?jar|jar|thuy-?tinh|lo-?thuy|chiec-?lo|\blo\b/i.test(unaccented)) {
    return "glass-jar";
  }

  // 2. Con nhện (Spider)
  if (/spider|nhen|\btam\b/i.test(unaccented)) {
    return "spider";
  }

  // 3. Bụi cây / Thảm cỏ sân vườn (Bush / Grass / Foliage)
  if (/bush|bui-?cay|\bbui\b|shrub|hedge|grass|co|bai-?co|tham-?co|san-?vuon|vuon-?co/i.test(unaccented)) {
    return "bush";
  }

  // 4. Chậu cây cảnh / Hoa (Potted Plant / Flower)
  if (/potted-?plant|plant|cay-?canh|chau-?cay|chau-?hoa|flower|hoa|\bcay\b/i.test(unaccented)) {
    return "potted-plant";
  }

  // 5. Đèn bàn học (Desk Lamp)
  if (/desk-?lamp|lamp|den-?ban|den-?hoc|\bden\b/i.test(unaccented)) {
    return "desk-lamp";
  }

  // 6. Đồng hồ đo chỉ số / Năng lượng (Gauge Meter)
  if (/gauge|meter|dong-?ho-?do|trao-?doi-?chat/i.test(unaccented)) {
    return "gauge-meter";
  }

  // 7. Mặt bàn trước / sau (Desk Front / Back)
  if (/desk-?front/i.test(unaccented)) {
    return "desk-front";
  }
  if (/desk-?back/i.test(unaccented)) {
    return "desk-back";
  }

  // 8. Bàn học / Bàn làm việc (Desk)
  if (/desk|ban-?hoc|ban-?lam-?viec|\bban\b/i.test(unaccented)) {
    return "desk";
  }

  // 9. Sofa phòng khách (Sofa / Couch)
  if (/sofa|couch|ghe-?dai|ghe-?sofa/i.test(unaccented)) {
    return "sofa";
  }

  // 10. Ghế đơn (Chair)
  if (/chair|ghe-?tua|\bghe\b/i.test(unaccented)) {
    return "chair";
  }

  // 11. Đồng hồ báo thức (Alarm Clock)
  if (/alarm-?clock|dong-?ho-?bao-?thuc/i.test(unaccented)) {
    return "alarm-clock";
  }
  if (/clock|dong-?ho/i.test(unaccented)) {
    return "alarm-clock";
  }

  // 12. Cốc cà phê / Trà (Coffee Cup)
  if (/coffee-?cup|teacup|coffee|tea|cup|mug|coc|ly-?nuoc/i.test(unaccented)) {
    return "coffee-cup";
  }

  // 13. Máy tính xách tay (Laptop)
  if (/laptop|computer|may-?tinh/i.test(unaccented)) {
    return "laptop";
  }

  // 14. Điện thoại thông minh (Phone)
  if (/phone|smartphone|dien-?thoai/i.test(unaccented)) {
    return "phone";
  }

  // 15. Tivi màn hình lớn (TV)
  if (/tv|television|tivi|smart-?tv/i.test(unaccented)) {
    return "tv";
  }

  // 16. Bàn ăn (Table)
  if (/table|ban-?an/i.test(unaccented)) {
    return "table";
  }

  // 17. Cửa ra vào (Door)
  if (/door|cua-?ra-?vao|\bcua\b/i.test(unaccented)) {
    return "door";
  }

  // 18. Pizza
  if (/pizza/i.test(unaccented)) {
    return "pizza";
  }

  // 19. Quả táo (Apple)
  if (/apple|qua-?tao|\btao\b/i.test(unaccented)) {
    return "apple";
  }

  // 20. Đàn guitar
  if (/guitar|dan-?guitar|\bdan\b/i.test(unaccented)) {
    return "guitar";
  }

  // 21. Mèo cưng (Cat)
  if (/cat|meo|con-?meo/i.test(unaccented)) {
    return "cat";
  }

  // 22. Cây lớn (Tree)
  if (/tree|cay-?xanh|cay-?to/i.test(unaccented)) {
    return "tree";
  }

  // 23. Quả bóng bay (Balloon)
  if (/balloon|bong-?bay|bong-?bong/i.test(unaccented)) {
    return "balloon";
  }

  // 24. Cúp vàng chiến thắng (Trophy)
  if (/trophy|cup-?vang|giai-?thuong/i.test(unaccented)) {
    return "trophy";
  }

  // 25. Ngôi sao (Star)
  if (/star|ngoi-?sao/i.test(unaccented)) {
    return "star";
  }

  // 26. Trái tim (Heart)
  if (/heart|trai-?tim/i.test(unaccented)) {
    return "heart";
  }

  // 27. Bảng trắng thuyết trình (Whiteboard)
  if (/whiteboard|bang-?trang|\bbang\b/i.test(unaccented)) {
    return "whiteboard";
  }

  return s;
}
