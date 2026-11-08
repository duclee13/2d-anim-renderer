import React from "react";
import { SubtitleWord } from "../../types/sceneGraph";

interface SubtitleBoxProps {
  text: string;
  words?: SubtitleWord[];
  currentFrame: number;
  fps: number;
  x?: number;
  y?: number;
  fontSize?: number;
}

/**
 * Tự động ngắt dòng văn bản dài thành các dòng cân đối
 * Đảm bảo phụ đề không bao giờ tràn ra ngoài khung màn hình 2K (2560px)
 */
function splitIntoBalancedLines(text: string, maxLineChars = 40): string[] {
  if (!text || text.length <= maxLineChars) return [text.trim()];

  // Nếu có dấu phẩy ở khoảng 30% - 70% câu, ưu tiên ngắt tại dấu phẩy
  const commaIdx = text.indexOf(",");
  if (commaIdx >= 18 && commaIdx <= text.length - 15) {
    const part1 = text.slice(0, commaIdx + 1).trim();
    const part2 = text.slice(commaIdx + 1).trim();
    if (part1.length <= maxLineChars + 10 && part2.length <= maxLineChars + 10) {
      return [part1, part2];
    }
  }

  // Chia theo khoảng trắng gần trung điểm nhất
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text];

  const midChar = Math.floor(text.length / 2);
  let accumulated = 0;
  let splitIndex = Math.floor(words.length / 2);

  for (let i = 0; i < words.length; i++) {
    accumulated += words[i].length + 1;
    if (accumulated >= midChar) {
      splitIndex = i + 1;
      break;
    }
  }

  const line1 = words.slice(0, splitIndex).join(" ").trim();
  const line2 = words.slice(splitIndex).join(" ").trim();
  return [line1, line2].filter(Boolean);
}

/**
 * Nhóm các từ karaoke vào các dòng tương ứng
 */
function groupWordsIntoLines(words: SubtitleWord[], maxLineChars = 40): SubtitleWord[][] {
  const lines: SubtitleWord[][] = [];
  let currentLine: SubtitleWord[] = [];
  let currentLength = 0;

  for (const w of words) {
    const wordLen = (w.word || "").length + 1;
    if (currentLine.length === 0) {
      currentLine.push(w);
      currentLength = wordLen;
    } else if (currentLength + wordLen <= maxLineChars) {
      currentLine.push(w);
      currentLength += wordLen;
    } else {
      lines.push(currentLine);
      currentLine = [w];
      currentLength = wordLen;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);
  return lines;
}

export const SubtitleBox: React.FC<SubtitleBoxProps> = ({
  text,
  words,
  currentFrame,
  fps = 60,
  x = 1280, // Centered on 2K canvas
  y = 1330, // Đặt chuẩn ở đáy màn hình
  fontSize = 68,
}) => {
  if (!text) return null;

  const currentMs = (currentFrame / fps) * 1000;
  const isKaraoke = Boolean(words && words.length > 0);

  const textLines = isKaraoke ? [] : splitIntoBalancedLines(text, 42);
  const wordLines = isKaraoke ? groupWordsIntoLines(words!, 42) : [];
  const lineCount = isKaraoke ? wordLines.length : textLines.length;
  const isMultiLine = lineCount > 1;

  // Tính cỡ chữ tối ưu cho độ phân giải 2K
  const longestLineLen = isKaraoke
    ? Math.max(...wordLines.map((wl) => wl.map((w) => w.word).join(" ").length), 1)
    : Math.max(...textLines.map((l) => l.length), 1);

  let finalFontSize = fontSize;
  if (longestLineLen > 48) {
    finalFontSize = 52;
  } else if (longestLineLen > 38) {
    finalFontSize = 58;
  } else if (longestLineLen > 28) {
    finalFontSize = 64;
  } else {
    finalFontSize = 68;
  }

  const lineSpacing = finalFontSize * 1.30;
  // Khi có 2 dòng, tự động nâng tâm lên để dòng 2 không chạm mép dưới
  const adjustedY = isMultiLine ? y - lineSpacing * 0.42 : y;

  return (
    <g
      transform={`translate(${x}, ${adjustedY})`}
      style={{
        filter: "drop-shadow(0px 8px 18px rgba(0, 0, 0, 0.75))",
      }}
    >
      {isKaraoke ? (
        /* Karaoke Word Highlight Mode (Đa dòng) */
        <text
          textAnchor="middle"
          fontSize={finalFontSize}
          fontWeight="900"
          fontFamily="var(--font-be-vietnam-pro), sans-serif"
        >
          {wordLines.map((lineWords, lineIdx) => {
            const dyVal = isMultiLine
              ? lineIdx === 0
                ? -(lineCount - 1) * (lineSpacing / 2)
                : lineSpacing
              : 0;
            return (
              <tspan key={lineIdx} x={0} dy={dyVal}>
                {lineWords.map((item, itemIdx) => {
                  const isActive = currentMs >= item.startMs && currentMs <= item.endMs;
                  return (
                    <tspan
                      key={itemIdx}
                      dx={itemIdx === 0 ? 0 : 14}
                      fill={isActive ? "#FFD13B" : "#FFFFFF"}
                      stroke="#141414"
                      strokeWidth={isActive ? 18 : 16}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      style={{
                        paintOrder: "stroke fill",
                        transition: "fill 0.1s ease",
                      }}
                    >
                      {item.word}
                    </tspan>
                  );
                })}
              </tspan>
            );
          })}
        </text>
      ) : (
        /* Solid Subtitle Mode (Đa dòng cân đối) */
        <text
          textAnchor="middle"
          fontSize={finalFontSize}
          fontWeight="900"
          fontFamily="var(--font-be-vietnam-pro), sans-serif"
          fill="#FFFFFF"
          stroke="#141414"
          strokeWidth={16}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{
            paintOrder: "stroke fill",
          }}
        >
          {textLines.map((lineStr, lineIdx) => {
            const dyVal = isMultiLine
              ? lineIdx === 0
                ? -(lineCount - 1) * (lineSpacing / 2)
                : lineSpacing
              : 0;
            return (
              <tspan key={lineIdx} x={0} dy={dyVal}>
                {lineStr}
              </tspan>
            );
          })}
        </text>
      )}
    </g>
  );
};
