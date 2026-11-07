import React from "react";

/**
 * SvgDefsLibrary: Thư viện Gradient & Shader Điện ảnh Dùng chung Toàn cục (Global Cinema Shaders)
 * 
 * Cung cấp các <linearGradient> và <radialGradient> chuẩn đồ họa 2K:
 * 1. lightConeGradient: Ánh đèn bàn ấm áp đa tầng alpha (0.85 -> 0.35 -> 0.00) triệt tiêu viền cứng
 * 2. sunbeamsGradient & sunGlow: Luồng tia nắng tự nhiên (God Rays) và quầng sáng mặt trời
 * 3. glassReflectionGradient: Vệt phản quang chéo trên mặt kính lọ thủy tinh
 * 4. tableSurfaceGlow: Vệt sáng ấm tỏa trên mặt bàn làm việc
 * 5. daySkyGradient, nightSkyGradient, woodFloorGradient, ambientShadowGradient
 */
export const SvgDefsLibrary: React.FC = () => {
  return (
    <defs id="cinema-vfx-defs-library">
      {/* =========================================================================
          1. VOLUMETRIC LIGHT CONE (ÁNH ĐÈN BÀN / ĐÈN ĐƯỜNG ĐA TẦNG ALPHA)
          Đỉnh bóng đèn đậm (0.85) -> Thân chóp sáng (0.35) -> Đáy tỏa rộng loang dần (0.00)
         ========================================================================= */}
      <linearGradient id="lightConeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFE066" stopOpacity={0.85} />
        <stop offset="18%" stopColor="#FDE047" stopOpacity={0.62} />
        <stop offset="48%" stopColor="#FACC15" stopOpacity={0.32} />
        <stop offset="80%" stopColor="#EAB308" stopOpacity={0.10} />
        <stop offset="100%" stopColor="#CA8A04" stopOpacity={0.0} />
      </linearGradient>

      {/* Ánh đèn chùm lạnh / đèn neon trắng */}
      <linearGradient id="coolLightConeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#E0F2FE" stopOpacity={0.80} />
        <stop offset="25%" stopColor="#BAE6FD" stopOpacity={0.50} />
        <stop offset="60%" stopColor="#7DD3FC" stopOpacity={0.20} />
        <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.0} />
      </linearGradient>

      {/* =========================================================================
          2. GOD RAYS & SUNGLOW (TIA NẮNG CHIẾU CHÉO & QUẦNG MẶT TRỜI)
         ========================================================================= */}
      {/* Vệt tia nắng chiếu chéo từ góc trời */}
      <linearGradient id="sunbeamsGradient" x1="0%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#FEF9C3" stopOpacity={0.55} />
        <stop offset="30%" stopColor="#FEF08A" stopOpacity={0.30} />
        <stop offset="70%" stopColor="#FDE047" stopOpacity={0.10} />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.0} />
      </linearGradient>

      {/* Tâm sáng rực mặt trời */}
      <radialGradient id="sunCenter" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={1.0} />
        <stop offset="45%" stopColor="#FEF08A" stopOpacity={0.95} />
        <stop offset="80%" stopColor="#FBBF24" stopOpacity={0.85} />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.70} />
      </radialGradient>

      {/* Quầng hào quang mặt trời tỏa 3 lớp */}
      <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FEF08A" stopOpacity={0.65} />
        <stop offset="35%" stopColor="#FBBF24" stopOpacity={0.28} />
        <stop offset="75%" stopColor="#F59E0B" stopOpacity={0.08} />
        <stop offset="100%" stopColor="#D97706" stopOpacity={0.0} />
      </radialGradient>

      {/* Quầng sáng trăng đêm */}
      <radialGradient id="moonGlowGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FEF08A" stopOpacity={0.45} />
        <stop offset="40%" stopColor="#FDE047" stopOpacity={0.18} />
        <stop offset="75%" stopColor="#EAB308" stopOpacity={0.05} />
        <stop offset="100%" stopColor="#CA8A04" stopOpacity={0.0} />
      </radialGradient>

      {/* =========================================================================
          3. PHẢN QUANG MẶT KÍNH LỌ THỦY TINH (GLASS REFLECTION GRADIENT)
         ========================================================================= */}
      <linearGradient id="glassReflectionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.45} />
        <stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.20} />
        <stop offset="70%" stopColor="#FFFFFF" stopOpacity={0.05} />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.0} />
      </linearGradient>

      {/* Độ sâu thành kính thủy tinh (Refractive Edge) */}
      <linearGradient id="glassRimGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.35} />
        <stop offset="15%" stopColor="#E0F2FE" stopOpacity={0.12} />
        <stop offset="85%" stopColor="#F0F9FF" stopOpacity={0.10} />
        <stop offset="100%" stopColor="#0284C7" stopOpacity={0.38} />
      </linearGradient>

      {/* =========================================================================
          4. VỆT SÁNG BÀN LÀM VIỆC (TABLETOP SURFACE GLOW)
         ========================================================================= */}
      <radialGradient id="tableSurfaceGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FEF08A" stopOpacity={0.42} />
        <stop offset="35%" stopColor="#FDE047" stopOpacity={0.22} />
        <stop offset="70%" stopColor="#EAB308" stopOpacity={0.08} />
        <stop offset="100%" stopColor="#B45309" stopOpacity={0.0} />
      </radialGradient>

      {/* =========================================================================
          5. BẦU TRỜI & SÀN GỖ ĐIỆN ẢNH (CINEMATIC BACKGROUND GRADIENTS)
         ========================================================================= */}
      {/* Bầu trời ban ngày */}
      <linearGradient id="daySkyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="45%" stopColor="#7DD3FC" />
        <stop offset="100%" stopColor="#E0F2FE" />
      </linearGradient>

      {/* Bầu trời ban đêm */}
      <linearGradient id="nightSkyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#0B1120" />
        <stop offset="55%" stopColor="#0F172A" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>

      {/* Tường phòng ấm áp ban ngày */}
      <linearGradient id="roomWallDayGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FBF7EE" />
        <stop offset="65%" stopColor="#F5EDE0" />
        <stop offset="100%" stopColor="#EDE2CF" />
      </linearGradient>

      {/* Tường phòng ấm cúng ban đêm */}
      <linearGradient id="roomWallNightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1E1E26" />
        <stop offset="60%" stopColor="#252530" />
        <stop offset="100%" stopColor="#2B2B38" />
      </linearGradient>

      {/* Sàn gỗ có độ sâu và đổ bóng */}
      <linearGradient id="woodFloorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#B88A60" />
        <stop offset="35%" stopColor="#C99B72" />
        <stop offset="100%" stopColor="#9E734C" />
      </linearGradient>

      {/* =========================================================================
          6. BÓNG ĐỔ TIẾP XÚC MỀM (SOFT CONTACT SHADOW)
         ========================================================================= */}
      <radialGradient id="contactShadow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#0F172A" stopOpacity={0.45} />
        <stop offset="50%" stopColor="#0F172A" stopOpacity={0.20} />
        <stop offset="100%" stopColor="#0F172A" stopOpacity={0.0} />
      </radialGradient>

      {/* Vignette góc màn hình */}
      <radialGradient id="vignetteGradient" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stopColor="#000000" stopOpacity={0.0} />
        <stop offset="90%" stopColor="#000000" stopOpacity={0.12} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.28} />
      </radialGradient>
    </defs>
  );
};
