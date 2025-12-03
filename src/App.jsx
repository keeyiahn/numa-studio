import { 
  ReactFlowProvider,
 } from '@xyflow/react';
import { useEffect } from 'react';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import ConfigModal from './components/ConfigModal';

import usePipeline from './hooks/usePipeline';
import useTemplates from './hooks/useTemplates';
import useModal from './hooks/useModal';

 
export default function App() {

  const pipelineHook = usePipeline();
  const templatesHook = useTemplates();
  const modalHook = useModal();

  useEffect(() => {
    console.log("Pipeline nodes:", pipelineHook.nodes);
    console.log("Pipeline edges:", pipelineHook.edges);
  });


 
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <ConfigModal 
        modalHook={modalHook}
        pipelineHook={pipelineHook}
        templatesHook={templatesHook}
      />
      <Sidebar 
        templatesHook={templatesHook}
        modalHook={modalHook}
      />
      <div style={{flex: 1, height: '100%'}}>
        <ReactFlowProvider>
          <Canvas 
            pipelineHook={pipelineHook}
            modalHook={modalHook}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}