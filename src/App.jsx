import { 
  ReactFlowProvider,
 } from '@xyflow/react';
import { useEffect, useState } from 'react';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import Rightbar from './components/Rightbar';
import DirectorySidebar from './components/DirectorySidebar';
import ConfigModal from './components/ConfigModal';
import ScriptModal from './components/ScriptModal';

import usePipeline from './hooks/usePipeline';
import useTemplates from './hooks/useTemplates';
import useModal from './hooks/useModal';
import useScripts from './hooks/useScripts';
import useRepository from './hooks/useRepository';

 
export default function App() {

  const pipelineHook = usePipeline();
  const repositoryHook = useRepository();
  const templatesHook = useTemplates(repositoryHook);
  const modalHook = useModal();
  const scriptModalHook = useModal();
  const scriptsHook = useScripts();
  
  const [directorySidebarVisible, setDirectorySidebarVisible] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [rightbarVisible, setRightbarVisible] = useState(true);

  useEffect(() => {
    console.log("Pipeline nodes:", pipelineHook.nodes);
    console.log("Pipeline edges:", pipelineHook.edges);
  });

  const getCanvasBorderRadius = () => {
    // Top-left: rounded if no left sidebars visible
    const topLeft = (!directorySidebarVisible && !sidebarVisible) ? '12px' : '0';
    // Top-right: rounded if rightbar not visible
    const topRight = !rightbarVisible ? '12px' : '0';
    // Bottom-right: same as top-right
    const bottomRight = topRight;
    // Bottom-left: same as top-left
    const bottomLeft = topLeft;
    return `${topLeft} ${topRight} ${bottomRight} ${bottomLeft}`;
  };


 
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
        repositoryHook={repositoryHook}
      />
      <DirectorySidebar
        repositoryHook={repositoryHook}
        isVisible={directorySidebarVisible}
        onToggle={() => setDirectorySidebarVisible(!directorySidebarVisible)}
        modalHook={modalHook}
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
        borderRadius: getCanvasBorderRadius(),
        boxShadow: 'inset 0 0 0 1px #e2e8f0',
        transition: 'border-radius 0.3s ease'
      }}>
        <ReactFlowProvider>
          <Canvas 
            pipelineHook={pipelineHook}
            modalHook={modalHook}
            repositoryHook={repositoryHook}
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