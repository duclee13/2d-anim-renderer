import React from "react";
import { Composition } from "remotion";
import { MainScene, defaultMockSceneGraph } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainScene"
        component={MainScene}
        durationInFrames={defaultMockSceneGraph.totalDurationInFrames || 480}
        fps={60}
        width={2560}
        height={1440}
        defaultProps={{
          sceneGraph: defaultMockSceneGraph,
        }}
      />
    </>
  );
};
