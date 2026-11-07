import { WebSocket } from "ws";
import { SubtitleWord } from "../remotion/types/sceneGraph";

export interface EdgeTtsResult {
  audioBase64: string;
  durationMs: number;
  words: SubtitleWord[];
}

/**
 * Pure TypeScript Microsoft Edge-TTS client with full WordBoundary timestamp extraction.
 */
export async function synthesizeEdgeTts(
  text: string,
  voice: string = "vi-VN-HoaiMyNeural",
  rate: string = "+0%",
  pitch: string = "+0Hz"
): Promise<EdgeTtsResult> {
  return new Promise((resolve, reject) => {
    const trustedToken = "6A5AAFD830364C379E0CC76104E47567";
    const endpoint = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaheadedge/v1?TrustedClientToken=${trustedToken}`;

    const ws = new WebSocket(endpoint);
    const audioChunks: Buffer[] = [];
    const words: SubtitleWord[] = [];
    let isHeaderSent = false;

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Edge-TTS WebSocket timeout sau 15 giây"));
    }, 15000);

    ws.on("open", () => {
      // 1. Send speech config
      const date = new Date().toISOString();
      const configMessage =
        `X-Timestamp:${date}\r\n` +
        "Content-Type:application/json; charset=utf-8\r\n" +
        "Path:speech.config\r\n\r\n" +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: "false",
                  wordBoundaryEnabled: "true",
                },
                outputFormat: "audio-24khz-48kbitrate-mono-mp3",
              },
            },
          },
        });

      ws.send(configMessage);

      // 2. Send SSML request
      const requestId = Math.random().toString(36).substring(2);
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'>` +
        `<voice name='${voice}'>` +
        `<prosody rate='${rate}' pitch='${pitch}'>${text}</prosody>` +
        `</voice></speak>`;

      const requestMessage =
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${date}\r\n` +
        "Path:ssml\r\n\r\n" +
        ssml;

      ws.send(requestMessage);
      isHeaderSent = true;
    });

    ws.on("message", (data: any, isBinary: boolean) => {
      if (isBinary) {
        // Binary message contains header + audio bytes
        const buffer = Buffer.from(data);
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          const audioPart = buffer.subarray(headerEnd + 4);
          audioChunks.push(audioPart);
        } else {
          audioChunks.push(buffer);
        }
      } else {
        // Text message contains metadata (WordBoundary or turn.end)
        const textMsg = data.toString();
        if (textMsg.includes("Path:audio.metadata")) {
          const bodyIndex = textMsg.indexOf("\r\n\r\n");
          if (bodyIndex !== -1) {
            try {
              const jsonBody = JSON.parse(textMsg.substring(bodyIndex + 4));
              if (jsonBody.Metadata) {
                for (const meta of jsonBody.Metadata) {
                  if (meta.Type === "WordBoundary" && meta.Data) {
                    const offsetMs = meta.Data.Offset / 10000; // 100ns ticks to ms
                    const durationMs = meta.Data.Duration / 10000;
                    words.push({
                      word: meta.Data.text.Text,
                      startMs: Math.round(offsetMs),
                      endMs: Math.round(offsetMs + durationMs),
                    });
                  }
                }
              }
            } catch (e) {
              // Ignore metadata parse error
            }
          }
        } else if (textMsg.includes("Path:turn.end")) {
          clearTimeout(timeout);
          ws.close();

          const fullAudio = Buffer.concat(audioChunks);
          const lastWord = words[words.length - 1];
          const totalDuration = lastWord ? lastWord.endMs + 300 : 2000;

          resolve({
            audioBase64: fullAudio.toString("base64"),
            durationMs: totalDuration,
            words,
          });
        }
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
