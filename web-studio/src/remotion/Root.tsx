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
  let graph = props?.sceneGraph as MasterSceneGraph | undefined;

  // Handle case where raw sceneGraph object was passed at root of props
  if (!graph && props?.scenes && Array.isArray(props.scenes)) {
    graph = props as unknown as MasterSceneGraph;
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
      sceneGraph: graph || defaultMockSceneGraph,
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
        defaultProps={{
          sceneGraph: defaultMockSceneGraph,
        }}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
