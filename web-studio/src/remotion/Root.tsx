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

  let total = Number(props?.totalFrames);
  if (!total && graph?.totalDurationInFrames) {
    total = Number(graph.totalDurationInFrames);
  }
  if (!total && graph?.scenes && Array.isArray(graph.scenes)) {
    total = graph.scenes.reduce((acc, s) => {
      const start = Number(s?.startFrame) || 0;
      const dur = Number(s?.durationInFrames) || 120;
      return Math.max(acc, start + dur);
    }, 480);
  }

  // Ensure durationInFrames is AT LEAST 72,000 frames (20 minutes @ 60fps)
  // so that ANY chunk range across parallel runners is ALWAYS valid
  const durationInFrames = Math.max(72000, Number(total) || 72000);

  return {
    durationInFrames,
    props: {
      ...props,
      sceneGraph: graph || defaultMockSceneGraph,
    },
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainScene"
        component={MainScene}
        durationInFrames={72000} // Buffer 20 minutes @ 60fps so chunk bounds checks NEVER fail
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
