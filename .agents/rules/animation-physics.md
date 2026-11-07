# ANIMATION PHYSICS & RIGGING CONSTITUTION (2K 60FPS STICKMAN ENGINE)

Tài liệu này là quy chuẩn kỹ thuật bắt buộc (Hard Rules) cho toàn bộ mã nguồn của hệ thống **2D Stickman Explainer Video Engine**. Mọi Component, Scene Graph Schema, và Agent đều phải tuân thủ nghiêm ngặt các quy định dưới đây để triệt tiêu vĩnh viễn các lỗi "cấn" đồ họa (Z-Index clipping, floating hands, detached decals).

---

## 1. HỆ TỌA ĐỘ VÀ QUY CHUẨN CANVAS 2K
- **Độ phân giải chuẩn:** `2560 x 1440` (16:9 QHD 2K).
- **Tốc độ khung hình (Frame Rate):** `60.0 FPS`.
- **Hệ trục tọa độ SVG:**
  - Gốc `(0, 0)` nằm ở góc trên cùng bên trái.
  - Trục `X`: `0 -> 2560` (Trái sang phải).
  - Trục `Y`: `0 -> 1440` (Trên xuống dưới).
  - Mặt sàn phòng tiêu chuẩn (`floorY`): `y = 1040` (Tạo tỉ lệ vàng cho không gian phòng).
- **Quy chuẩn Stroke & Viền đen:**
  - Viền ngoại vi nhân vật và vật thể chính: `strokeWidth = 10px - 14px`.
  - Chi tiết phụ (nét mặt, chân nhện, vân nắp lọ): `strokeWidth = 5px - 7px`.
  - Thuộc tính bắt buộc cho tất cả nét vẽ: `strokeLinecap="round"` và `strokeLinejoin="round"`.
  - Mã màu nét viền tiêu chuẩn: `#1E1E1E` hoặc `#141414` (Đen mềm hoạt hình, không dùng `#000000` tuyệt đối gây chói gắt).

---

## 2. QUY CHUẨN PHÂN TẦNG Z-INDEX (CHỐNG LỖI CẮT XUYÊN BÀN - ẢNH 1.4)

Mọi cảnh quay (Scene) bắt buộc phải phân giải thành **6 tầng lớp (Layer Stacks)** theo thứ tự Z-Index tăng dần:

```
Tầng 1 (Z: 10 - 19)  ──► BackgroundLayer (Bầu trời, tường phòng, cửa sổ, trăng/sao)
Tầng 2 (Z: 20 - 29)  ──► MidgroundBackLayer (Lưng ghế, chân sau của bàn, bóng đổ mặt sàn)
Tầng 3 (Z: 30 - 39)  ──► CharacterLowerLayer (Thân Stickman, đầu Stickman khi ngồi sau bàn)
Tầng 4 (Z: 40 - 49)  ──► MidgroundFrontLayer (Mặt bàn, chân trước của bàn, đồ vật trên bàn)
Tầng 5 (Z: 50 - 59)  ──► CharacterUpperLayer (Tay nhân vật tựa lên bàn, đồ vật đang cầm)
Tầng 6 (Z: 60 - 69)  ──► VisualEffectsLayer (Nón ánh sáng đèn bàn, hạt bụi lơ lửng)
Tầng 7 (Z: 70 - 99)  ──► ForegroundUILayer (Bong bóng thoại, biểu đồ Infographic, Phụ đề)
```

### Luật bắt buộc khi nhân vật tương tác với Bàn (`sittingBehindDesk`):
1. **Tuyệt đối cấm:** Render toàn bộ nhân vật ở lớp phía trước mặt bàn (`Z-Index > Desk`).
2. **Quy tắc giải phẫu:** Khi `pose === 'sittingBehindDesk'`:
   - Thân Stickman (`spine`) và Đầu (`head`) nằm ở **Tầng 3 (`CharacterLowerLayer`)**.
   - Mặt bàn và đồ vật trên bàn nằm ở **Tầng 4 (`MidgroundFrontLayer`)**.
   - Hai chân nhân vật: Chuyển sang chế độ `legsMode = 'hiddenBehindDesk'` hoặc gập 90 độ đặt hoàn toàn ở Tầng 2/3 phía sau yếm bàn.
   - Hai cẳng tay/bàn tay: Đặt ở **Tầng 5 (`CharacterUpperLayer`)** để có thể tựa hoặc đặt tự nhiên lên mặt bàn (`tableTopSurfaceY`).

---

## 3. QUY CHUẨN ANCHOR POINT & 2-BONE KINEMATICS (CHỐNG LỖI TAY LƠ LỬNG - ẢNH 1.5)

### Định nghĩa Anchor Point (Điểm neo toán học):
Mọi vật thể tương tác (`InteractableProp`) và nhân vật (`StickmanRig`) phải công khai các tọa độ neo chuẩn xác:

```typescript
// Định nghĩa cổng neo của Đạo cụ tương tác
interface PropAnchorPorts {
  leftGrip: { x: number; y: number };      // Điểm tay trái bám vào
  rightGrip: { x: number; y: number };     // Điểm tay phải bám vào
  surfaceDecal: { x: number; y: number };  // Tâm dán nhãn (chống lệch nhãn)
  centerMass: { x: number; y: number };    // Trọng tâm vật thể
}

// Định nghĩa cổng neo của Stickman
interface StickmanAnchorPorts {
  leftShoulder: { x: number; y: number };
  rightShoulder: { x: number; y: number };
  leftHand: { x: number; y: number };
  rightHand: { x: number; y: number };
  neck: { x: number; y: number };
  hip: { x: number; y: number };
  mouth: { x: number; y: number };
}
```

### Luật bắt buộc khi Cầm nắm vật thể (`holdingObject`):
1. **Nguyên tắc Snapping:** Khi `action === 'holdingObject(targetProp)'`:
   - `stickman.leftHand` **BẮT BUỘC** khóa tọa độ bằng `targetProp.leftGrip`.
   - `stickman.rightHand` **BẮT BUỘC** khóa tọa độ bằng `targetProp.rightGrip`.
2. **Nghịch đảo động học 2 đoạn (2-Bone Inverse Kinematics - IK):**
   - Cánh tay gồm 2 đoạn: Cánh tay trên (`upperArmLength`) và Cẳng tay (`forearmLength`).
   - Tọa độ khuỷu tay (`elbowX`, `elbowY`) được tính toán giải tích bằng định lý Cosin hoặc phép chiếu tam giác đều để khuỷu tay tự động uốn cong hướng ra ngoài sườn hoặc hướng xuống dưới.
   - **Tuyệt đối cấm:** Tay duỗi thẳng hoặc giơ lên trời độc lập trong khi vật thể nằm ở một vị trí khác.
3. **Độ ưu tiên phân lớp khi cầm vật thể:**
   - Vật thể cầm trên tay (`GlassJar`) nằm ở Tầng 4 hoặc Tầng 5.
   - Hai bàn tay của nhân vật luôn được vẽ ở Tầng 5 (nằm đè lên trên mép viền của vật thể để thể hiện động tác "nắm lấy").

---

## 4. QUY CHUẨN DÁN NHÃN ĐẠO CỤ (CHỐNG LỖI NHÃN LỆCH - ẢNH 1.2)
1. Nhãn dán (`DecalLabel`) như nhãn "TÁM" của lọ thủy tinh phải được neo chặt chẽ vào `prop.surfaceDecal`.
2. Nếu nhãn có mũi tên/thanh dẫn hướng chỉ ra ngoài, thanh dẫn hướng phải xuất phát từ `prop.surfaceDecal` và nhãn phải nằm trong vùng an toàn (Safe Action Zone), không bị cắt phạm viền màn hình hay lơ lửng vô lý ngoài không gian.

---

## 5. QUY CHUẨN PHỤ ĐỀ (SUBTITLE CONSTITUTION)
- **Vị trí cố định:** Căn giữa trục ngang (`x = 1280`), cách đáy màn hình 100px (`y = 1340`).
- **Font gia đình:** `Be Vietnam Pro`, trọng số `900 (Black / ExtraBold)`.
- **Kích thước chữ:** `font-size: 52px` (chuẩn tỉ lệ vàng trên độ phân giải 2K).
- **Màu sắc & Nét viền kép (Dual Stroke Layering):**
  - Màu nền chữ: Trắng tinh `#FFFFFF`.
  - Nét viền đen ngoài: `stroke: #141414; stroke-width: 12px; stroke-linejoin: round; paint-order: stroke fill;`.
  - Đổ bóng mềm: `filter: drop-shadow(0px 4px 12px rgba(0,0,0,0.45));`.
- **Word Highlight (Karaoke Sync):** Khi từ đang được đọc phát âm từ `edge-tts` metadata, từ đó được phóng to `1.08x` và chuyển sang màu vàng tươi `#FFD13B` hoặc giữ trắng nổi bật viền.
