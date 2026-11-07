# STICKMAN 2D ANIMATION STUDIO (2K 60FPS HYBRID CLOUD ENGINE)

Hệ thống sản xuất video hoạt hình **2D Stickman Explainer / Storytime** tự động ở độ phân giải **2K (2560x1440) @ 60 FPS**, kết hợp giữa **Web Studio (Deploy Vercel)** và **Distributed Cloud Renderer (Chạy song song trên GitHub Actions)** với tiêu chí: **0MB Local RAM Footprint**.

---

## 🏛️ KIẾN TRÚC HỆ THỐNG (HYBRID ARCHITECTURE)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WEB STUDIO (VERCEL)                            │
│  • Next.js 15 (App Router) + Tailwind CSS Dark Mode (Apple Aesthetic) │
│  • Google Gemini 3.8 / 2.5 Flash: Tự sinh Scene Graph JSON             │
│  • Edge-TTS: Giọng đọc tiếng Việt (Hoài My) + Word-level Timestamps    │
│  • Remotion Player: Xem trước SVG vector 60 FPS ngốn < 50MB RAM       │
│  • GitHub REST API: Gửi lệnh workflow_dispatch kích hoạt render       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                        workflow_dispatch API
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              DISTRIBUTED RENDERER (GITHUB ACTIONS MATRIX)              │
│  • Job 1 (prepare-matrix): Chia video thành 10-15 Chunks độc lập      │
│  • Job 2 (render-chunk): 15 Runner Ubuntu (16GB RAM/máy) chạy song song│
│    - Headless Chromium + Remotion render video chunk ra MP4            │
│    - Cờ FFmpeg tối ưu: libx264 superfast tune animation crf 18        │
│  • Job 3 (stitch-and-release):                                         │
│    - FFmpeg Concat Demuxer (-c copy) ghép 15 chunks trong 2 giây       │
│    - Ghép Master Audio Track từ Edge-TTS                              │
│    - Xuất bản tự động thành GitHub Release Asset (.mp4)               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ CƠ CHẾ CHỐNG LỖI ĐỒ HỌA "CẤN" (PHYSICS & ANCHOR RULES)

Xem chi tiết tại: [`.agents/rules/animation-physics.md`](file:///.agents/rules/animation-physics.md)

1. **Khắc phục lỗi Z-Index & Xuyên bàn (Ảnh 1.4):**
   - Hệ thống Scene Graph phân chia 6 tầng cố định (`backgroundLayer` -> `midgroundBackLayer` -> `characterLowerLayer` -> `midgroundFrontLayer` -> `characterUpperLayer` -> `foregroundUILayer`).
   - Khi nhân vật ở trạng thái `sittingBehindDesk`, cơ thể và đầu nằm ở lớp sau, mặt bàn nằm ở lớp trước, và hai cẳng tay nằm ở lớp trên cùng tựa lên bàn. Hai chân bị ẩn hoặc gập 90 độ sau yếm bàn.

2. **Khắc phục lỗi Tay lơ lửng khi cầm vật thể (Ảnh 1.5):**
   - Áp dụng giải thuật **2-Bone Inverse Kinematics (IK)**. Mọi đạo cụ tương tác (`GlassJar`) xuất các cổng neo toán học: `leftGrip`, `rightGrip`, `surfaceDecal`.
   - Khi ở trạng thái `holdingObject`, bàn tay trái và phải của Stickman tự động khóa chặt vào điểm neo của đồ vật, khuỷu tay tự động uốn cong theo góc hình học.

3. **Khắc phục lỗi Nhãn dán lệch ra ngoài (Ảnh 1.2):**
   - Nhãn dán ("TÁM") được neo cứng vào tâm decal mặt kính (`surfaceDecal`) hoặc gắn qua thanh định vị liên kết trực tiếp với thân lọ.

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & SỬ DỤNG

### 1. Cài đặt trên máy cá nhân (Local Development)
```bash
cd web-studio
npm install
npm run dev
```
Mở trình duyệt tại: `http://localhost:3000`.

### 2. Cấu hình API trong Web UI
Bấm vào nút **"Cấu hình API"** trên thanh tiêu đề:
- **Google Gemini API Key:** Lấy từ [Google AI Studio](https://aistudio.google.com/).
- **GitHub Personal Access Token (PAT):** Tạo tại GitHub Settings -> Developer Settings -> Personal access tokens (yêu cầu quyền `workflow` và `repo`/`contents:write`).
- **Owner & Repository:** Nhập tên `username/repo-name` nơi bạn lưu trữ mã nguồn này.

### 3. Deploy lên Vercel
1. Đẩy mã nguồn lên kho lưu trữ GitHub của bạn.
2. Truy cập [Vercel](https://vercel.com) -> New Project -> Chọn repository này.
3. Trong phần **Root Directory**, chọn thư mục `web-studio`.
4. Bấm **Deploy**.
