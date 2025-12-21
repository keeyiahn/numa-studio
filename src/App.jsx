import { 
  ReactFlowProvider,
 } from '@xyflow/react';
import { useEffect, useState } from 'react';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import Rightbar from './components/Rightbar';
import ConfigModal from './components/ConfigModal';
import ScriptModal from './components/ScriptModal';

import usePipeline from './hooks/usePipeline';
import useTemplates from './hooks/useTemplates';
import useModal from './hooks/useModal';
import useScripts from './hooks/useScripts';

 
export default function App() {

  const pipelineHook = usePipeline();
  const templatesHook = useTemplates();
  const modalHook = useModal();
  const scriptModalHook = useModal();
  const scriptsHook = useScripts();
  
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [rightbarVisible, setRightbarVisible] = useState(true);

  useEffect(() => {
    console.log("Pipeline nodes:", pipelineHook.nodes);
    console.log("Pipeline edges:", pipelineHook.edges);
  });


 
  return (
    <div style={{ 
      display: 'flex', 
      width: '100vw', 
      height: '100vh',
      background: '#f8fafc',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <ConfigModal 
        modalHook={modalHook}
        pipelineHook={pipelineHook}
        templatesHook={templatesHook}
        scriptsHook={scriptsHook}
      />
      <ScriptModal 
        scriptModalHook={scriptModalHook}
        scriptsHook={scriptsHook}
      />
      <Sidebar 
        templatesHook={templatesHook}
        modalHook={modalHook}
        isVisible={sidebarVisible}
        onToggle={() => setSidebarVisible(!sidebarVisible)}
      />
      <div style={{
        flex: 1, 
        height: '100%',
        background: '#ffffff',
        borderRadius: sidebarVisible && rightbarVisible ? '12px 0 0 0' : sidebarVisible ? '12px 0 0 12px' : rightbarVisible ? '0 0 0 12px' : '12px',
        boxShadow: 'inset 0 0 0 1px #e2e8f0',
        transition: 'border-radius 0.3s ease'
      }}>
        <ReactFlowProvider>
          <Canvas 
            pipelineHook={pipelineHook}
            modalHook={modalHook}
          />
        </ReactFlowProvider>
      </div>
      <Rightbar 
        scriptsHook={scriptsHook}
        scriptModalHook={scriptModalHook}
        isVisible={rightbarVisible}
        onToggle={() => setRightbarVisible(!rightbarVisible)}
      />
    </div>
  );
}