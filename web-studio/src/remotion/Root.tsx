import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { MainScene, defaultMockSceneGraph } from "./Composition";
import { MasterSceneGraph } from "./types/sceneGraph";

export interface RemotionProps {
  [key: string]: unknown;
  sceneGraph?: MasterSceneGraph;
  scenes?: any[];
  totalFrames?: number;
}

const calculateMetadata: CalculateMetadataFunction<any> = async ({ props }) => {
  let graph: MasterSceneGraph | undefined;

  // 1. Ưu tiên cao nhất: Nếu props có sceneGraph rõ ràng và khác defaultMockSceneGraph
  if (props?.sceneGraph && props.sceneGraph !== defaultMockSceneGraph) {
    graph = props.sceneGraph as MasterSceneGraph;
  }
  // 2. Nếu props truyền trực tiếp danh sách scenes của kịch bản người dùng
  else if (props?.scenes && Array.isArray(props.scenes) && props.scenes.length > 0) {
    graph = {
      version: (props.version as string) || "3.1.0",
      title: (props.title as string) || "Stickman 2D Explainer Video",
      width: Number(props.width) || 2560,
      height: Number(props.height) || 1440,
      fps: Number(props.fps) || 60,
      totalDurationInFrames: Number(props.totalDurationInFrames) || Number(props.totalFrames) || 480,
      scenes: props.scenes,
    };
  }
  // 3. Fallback: Nếu có sceneGraph
  else if (props?.sceneGraph) {
    graph = props.sceneGraph as MasterSceneGraph;
  } else {
    graph = defaultMockSceneGraph;
  }

  const safeScenes = Array.isArray(graph?.scenes) ? graph.scenes : defaultMockSceneGraph.scenes;
  const scenesEnd = safeScenes.reduce((acc, s) => {
    const start = Number(s?.startFrame) || 0;
    const dur = Number(s?.durationInFrames) || 120;
    return Math.max(acc, start + dur);
  }, 0);

  const requestedTotal = Number(props?.totalFrames) || 0;
  const sceneDuration = scenesEnd || Number(graph?.totalDurationInFrames) || 480;
  // BẢO VỆ CHỐNG OUT-OF-BOUNDS: Composition duration luôn bao phủ cả sceneDuration lẫn requestedTotal
  // Đảm bảo không một runner nào bị lỗi out-of-bounds dù được chỉ định render range frame nào
  const actualDuration = Math.max(60, sceneDuration, requestedTotal);

  return {
    durationInFrames: actualDuration,
    props: {
      ...props,
      sceneGraph: graph,
      scenes: graph.scenes,
      totalFrames: actualDuration,
    },
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainScene"
        component={MainScene}
        durationInFrames={480}
        fps={60}
        width={2560}
        height={1440}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
