/**
 * Bộ chuẩn hóa và phân giải Prop Asset ID (Bulletproof Canonical Prop Resolver)
 * 
 * Kiến trúc:
 * 1. CANONICAL_PROP_IDS: Danh mục 33 asset SVG chính thức trong public/assets/props/
 * 2. Normalizer: Chuyển camelCase/PascalCase/snake_case/tiếng Việt có dấu thành kebab-case unaccented
 * 3. Exact Canonical Match: Khớp ngay lập tức nếu đã là ID chuẩn
 * 4. Exact Alias Dictionary: Bảng ánh xạ ngữ nghĩa 1-1 chính xác, không dùng regex substring bừa bãi
 * 5. Word-boundary Token Matcher: Khớp token hoàn chỉnh có ranh giới từ/gạch nối (^|-)token(-|$)
 * 6. Fallback an toàn: Giữ nguyên normalized ID thay vì âm thầm đổi sang vật thể ngẫu nhiên (như bush)
 */

export const CANONICAL_PROP_IDS = [
  "alarm-clock",
  "apple",
  "balloon",
  "book",
  "bush",
  "car",
  "cat",
  "chair",
  "clock",
  "coffee-cup",
  "cup",
  "desk-back",
  "desk-front",
  "desk-lamp",
  "desk",
  "door",
  "environment",
  "gauge-meter",
  "glass-jar",
  "guitar",
  "heart",
  "laptop",
  "phone",
  "pizza",
  "potted-plant",
  "sofa",
  "spider",
  "star",
  "table",
  "tree",
  "trophy",
  "tv",
  "whiteboard",
] as const;

export type CanonicalPropId = (typeof CANONICAL_PROP_IDS)[number];

const CANONICAL_SET = new Set<string>(CANONICAL_PROP_IDS);

/**
 * Loại bỏ dấu tiếng Việt (NFD Unicode normalization)
 */
export function removeVietnameseAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Chuẩn hóa chuỗi đầu vào thành dạng kebab-case không dấu
 */
export function toKebabKey(raw: string): string {
  return removeVietnameseAccents(String(raw || ""))
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // camelCase to kebab
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // thay thế ký tự lạ, gạch dưới, khoảng trắng bằng '-'
    .replace(/^-+|-+$/g, ""); // xoá dấu gạch ở đầu và cuối
}

/**
 * Bảng ánh xạ Alias ngữ nghĩa chính xác (Exact Alias Dictionary).
 * Mọi key ở đây đều ở dạng kebab-case không dấu.
 */
const EXACT_PROP_ALIASES: Record<string, CanonicalPropId> = {
  // 1. Cốc cà phê / Trà (Coffee Cup) - Ưu tiên cao, tuyệt đối không bị dính sang bush hay cup thường
  "coffeecup": "coffee-cup",
  "coffee-cup": "coffee-cup",
  "coffee": "coffee-cup",
  "teacup": "coffee-cup",
  "tea-cup": "coffee-cup",
  "coffee-mug": "coffee-cup",
  "mug": "coffee-cup",
  "coc-ca-phe": "coffee-cup",
  "ly-ca-phe": "coffee-cup",
  "tach-ca-phe": "coffee-cup",
  "ca-phe": "coffee-cup",
  "ly-tra": "coffee-cup",
  "tach-tra": "coffee-cup",
  "coc-tra": "coffee-cup",
  "tra": "coffee-cup",

  // 2. Máy tính xách tay / Laptop (trước đây bị 'co' biến thành bush)
  "computer": "laptop",
  "laptop": "laptop",
  "pc": "laptop",
  "may-tinh": "laptop",
  "may-tinh-xach-tay": "laptop",
  "laptop-computer": "laptop",
  "notebook-computer": "laptop",

  // 3. Mèo cưng (Cat) (trước đây bị 'co' biến thành bush)
  "con-meo": "cat",
  "meo": "cat",
  "chu-meo": "cat",
  "meo-cung": "cat",
  "cat": "cat",
  "kitten": "cat",
  "kitty": "cat",

  // 4. Bàn ăn (Table) vs Bàn học (Desk)
  "ban-an": "table",
  "ban-tron": "table",
  "cai-ban": "table",
  "ban": "table",
  "table": "table",
  "dining-table": "table",
  "dinner-table": "table",

  // 5. Bàn học / Bàn làm việc (Desk)
  "desk": "desk",
  "furniture": "desk",
  "study-desk": "desk",
  "work-desk": "desk",
  "ban-hoc": "desk",
  "ban-lam-viec": "desk",
  "desk-front": "desk-front",
  "desk-back": "desk-back",

  // 6. Cây lớn (Tree) vs Chậu cây cảnh (Potted Plant) vs Bụi cây (Bush)
  "tree": "tree",
  "cay-xanh": "tree",
  "cay-to": "tree",
  "cay-lon": "tree",
  "cay-co-thu": "tree",
  "cay": "tree",
  "big-tree": "tree",
  "large-tree": "tree",

  "potted-plant": "potted-plant",
  "pottedplant": "potted-plant",
  "chau-cay": "potted-plant",
  "chau-hoa": "potted-plant",
  "chau-canh": "potted-plant",
  "cay-canh": "potted-plant",
  "cay-trong-chau": "potted-plant",
  "houseplant": "potted-plant",
  "plant-pot": "potted-plant",
  "flower-pot": "potted-plant",

  "bush": "bush",
  "bui-cay": "bush",
  "bui-co": "bush",
  "tham-co": "bush",
  "shrub": "bush",
  "hedge": "bush",
  "grass-patch": "bush",
  "foliage": "bush",

  // 7. Cúp vàng / Giải thưởng (Trophy)
  "trophy": "trophy",
  "cup-vang": "trophy",
  "cup-chien-thang": "trophy",
  "giai-thuong": "trophy",
  "chiec-cup": "trophy",
  "trophy-cup": "trophy",

  // 8. Lọ thủy tinh (Glass Jar)
  "glass-jar": "glass-jar",
  "glassjar": "glass-jar",
  "container": "glass-jar",
  "jar": "glass-jar",
  "lo-thuy-tinh": "glass-jar",
  "chiec-lo": "glass-jar",
  "lo": "glass-jar",
  "thuy-tinh": "glass-jar",

  // 9. Con nhện (Spider)
  "spider": "spider",
  "con-nhen": "spider",
  "chu-nhen": "spider",
  "nhen": "spider",
  "tam": "spider",

  // 10. Đèn bàn (Desk Lamp)
  "desk-lamp": "desk-lamp",
  "desklamp": "desk-lamp",
  "lamp": "desk-lamp",
  "light-source": "desk-lamp",
  "den-ban": "desk-lamp",
  "den-hoc": "desk-lamp",
  "den-ban-hoc": "desk-lamp",
  "reading-lamp": "desk-lamp",

  // 11. Đồng hồ đo chỉ số (Gauge Meter)
  "gauge-meter": "gauge-meter",
  "gaugemeter": "gauge-meter",
  "gauge": "gauge-meter",
  "infographic-meter": "gauge-meter",
  "dong-ho-do": "gauge-meter",
  "trao-doi-chat": "gauge-meter",
  "speedometer": "gauge-meter",
  "meter": "gauge-meter",

  // 12. Ghế sofa & Ghế đơn
  "sofa": "sofa",
  "couch": "sofa",
  "ghe-sofa": "sofa",
  "ghe-dai": "sofa",
  "salon": "sofa",

  "chair": "chair",
  "ghe-don": "chair",
  "ghe-tua": "chair",
  "ghe": "chair",

  // 13. Đồng hồ báo thức & đồng hồ tường
  "alarm-clock": "alarm-clock",
  "alarmclock": "alarm-clock",
  "dong-ho-bao-thuc": "alarm-clock",
  "chuong-bao-thuc": "alarm-clock",

  "clock": "clock",
  "dong-ho-treo-tuong": "clock",
  "dong-ho": "clock",
  "wall-clock": "clock",

  // 14. Điện thoại (Phone)
  "phone": "phone",
  "smartphone": "phone",
  "dien-thoai": "phone",
  "dien-thoai-thong-minh": "phone",
  "mobile": "phone",
  "cellphone": "phone",

  // 15. Tivi (TV)
  "tv": "tv",
  "television": "tv",
  "tivi": "tv",
  "smart-tv": "tv",
  "smarttv": "tv",

  // 16. Xe hơi / Ô tô (Car)
  "car": "car",
  "o-to": "car",
  "xe-hoi": "car",
  "xe-o-to": "car",
  "automobile": "car",

  // 17. Sách (Book)
  "book": "book",
  "cuon-sach": "book",
  "quyen-sach": "book",
  "sach": "book",
  "notebook": "book",

  // 18. Đàn guitar (Guitar)
  "guitar": "guitar",
  "dan-guitar": "guitar",
  "cay-dan": "guitar",
  "dan": "guitar",

  // 19. Đồ ăn & Trái cây
  "pizza": "pizza",
  "banh-pizza": "pizza",
  "apple": "apple",
  "qua-tao": "apple",
  "trai-tao": "apple",
  "tao": "apple",

  // 20. Khác
  "balloon": "balloon",
  "bong-bay": "balloon",
  "bong-bong": "balloon",
  "star": "star",
  "ngoi-sao": "star",
  "sao": "star",
  "heart": "heart",
  "trai-tim": "heart",
  "tim": "heart",
  "whiteboard": "whiteboard",
  "bang-trang": "whiteboard",
  "bang": "whiteboard",
  "door": "door",
  "cua-ra-vao": "door",
  "cua": "door",
};

/**
 * Danh sách Token ghép biên độ ưu tiên cao khi chuỗi có tiền tố/hậu tố.
 * Sử dụng Regex biên từ chặt chẽ (^|-)token(-|$) để tránh bắt nhầm chữ cái lọt trong từ khác!
 */
const TOKEN_BOUNDARIES: Array<{ regex: RegExp; canonicalId: CanonicalPropId }> = [
  // Cà phê / Cốc nước (tránh dính co -> bush)
  { regex: /(?:^|-)(?:coffee-cup|coffee|teacup|tach-ca-phe|ly-ca-phe|coc-ca-phe)(?:-|$)/i, canonicalId: "coffee-cup" },
  // Cúp vàng (tránh cup -> coffee-cup)
  { regex: /(?:^|-)(?:trophy|cup-vang|giai-thuong)(?:-|$)/i, canonicalId: "trophy" },
  // Laptop / Máy tính (tránh computer -> bush)
  { regex: /(?:^|-)(?:laptop|computer|may-tinh|may-tinh-xach-tay)(?:-|$)/i, canonicalId: "laptop" },
  // Mèo (tránh con meo -> bush)
  { regex: /(?:^|-)(?:cat|meo|con-meo|chu-meo)(?:-|$)/i, canonicalId: "cat" },
  // Cây to (tránh cay xanh -> potted-plant)
  { regex: /(?:^|-)(?:tree|cay-xanh|cay-to|cay-lon|cay-co-thu)(?:-|$)/i, canonicalId: "tree" },
  // Bàn ăn (tránh ban an -> desk)
  { regex: /(?:^|-)(?:table|ban-an|ban-tron|dining-table)(?:-|$)/i, canonicalId: "table" },
  // Bàn học
  { regex: /(?:^|-)(?:desk-front|desk-back|desk-lamp)(?:-|$)/i, canonicalId: "desk" },
  { regex: /(?:^|-)(?:desk|ban-hoc|ban-lam-viec)(?:-|$)/i, canonicalId: "desk" },
  // Chậu cây
  { regex: /(?:^|-)(?:potted-plant|chau-cay|chau-hoa|chau-canh|cay-canh)(?:-|$)/i, canonicalId: "potted-plant" },
  // Bụi cây / Thảm cỏ (chỉ khớp đúng token độc lập 'bush', 'bui-cay', 'bui-co', 'tham-co', 'hedge', 'shrub')
  { regex: /(?:^|-)(?:bush|bui-cay|bui-co|tham-co|hedge|shrub)(?:-|$)/i, canonicalId: "bush" },
  // Lọ thủy tinh
  { regex: /(?:^|-)(?:glass-jar|jar|thuy-tinh|lo-thuy|chiec-lo)(?:-|$)/i, canonicalId: "glass-jar" },
  // Nhện
  { regex: /(?:^|-)(?:spider|nhen|con-nhen|tam)(?:-|$)/i, canonicalId: "spider" },
  // Đèn bàn
  { regex: /(?:^|-)(?:desk-lamp|den-ban|den-hoc)(?:-|$)/i, canonicalId: "desk-lamp" },
  // Đồng hồ đo
  { regex: /(?:^|-)(?:gauge-meter|gauge|dong-ho-do|trao-doi-chat)(?:-|$)/i, canonicalId: "gauge-meter" },
  // Đồng hồ báo thức
  { regex: /(?:^|-)(?:alarm-clock|dong-ho-bao-thuc)(?:-|$)/i, canonicalId: "alarm-clock" },
  // Đồng hồ
  { regex: /(?:^|-)(?:clock|dong-ho)(?:-|$)/i, canonicalId: "clock" },
  // Ô tô
  { regex: /(?:^|-)(?:car|o-to|xe-hoi|xe-o-to)(?:-|$)/i, canonicalId: "car" },
];

export interface PropResolutionResult {
  canonicalId: string;
  isResolved: boolean;
  status: "canonical" | "alias" | "token" | "unknown";
  raw: string;
}

/**
 * Phân giải chi tiết kèm trạng thái
 */
export function resolvePropAsset(rawType?: string): PropResolutionResult {
  if (!rawType) {
    return {
      canonicalId: "unknown-prop",
      isResolved: false,
      status: "unknown",
      raw: "",
    };
  }

  const key = toKebabKey(rawType);

  // 1. Kiểm tra trực tiếp xem đã là ID chuẩn chưa
  if (CANONICAL_SET.has(key)) {
    return {
      canonicalId: key as CanonicalPropId,
      isResolved: true,
      status: "canonical",
      raw: rawType,
    };
  }

  // 2. Tra cứu bảng Alias chính xác
  if (EXACT_PROP_ALIASES[key]) {
    return {
      canonicalId: EXACT_PROP_ALIASES[key],
      isResolved: true,
      status: "alias",
      raw: rawType,
    };
  }

  // 3. Khớp từ khóa có ranh giới từ chặt chẽ (Token boundaries)
  for (const { regex, canonicalId } of TOKEN_BOUNDARIES) {
    if (regex.test(key)) {
      return {
        canonicalId,
        isResolved: true,
        status: "token",
        raw: rawType,
      };
    }
  }

  // 4. Fallback: Bảo toàn định dạng kebab của prop thay vì âm thầm đổi sang đồ vật khác!
  return {
    canonicalId: key || "prop",
    isResolved: false,
    status: "unknown",
    raw: rawType,
  };
}

/**
 * Hàm phân giải chính (Drop-in replacement cho code cũ)
 * Luôn trả về tên file SVG chuẩn tương ứng
 */
export function normalizePropAssetId(rawType?: string): string {
  return resolvePropAsset(rawType).canonicalId;
}
