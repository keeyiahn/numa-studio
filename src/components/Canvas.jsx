import { 
    ReactFlow,
    useReactFlow,
    Background,
    MiniMap,
    Controls,
} from "@xyflow/react";
import '@xyflow/react/dist/style.css';
import {
    useCallback,
    useRef,
    useState
} from "react";
import { Download, Upload, FileText } from 'lucide-react';

import { nameGen } from '../utils/nameGen';
import { exportPipeline, importYaml } from '../utils/yamlTools';
import yaml from 'js-yaml';

export default function Canvas({ pipelineHook, modalHook }) {

    const { nodes, edges, handleNodesChange, handleEdgesChange, handleConnect, addNode, setNodes, setEdges } = pipelineHook;
    const { isOpen, modalContent, openModal, closeModal } = modalHook;
    const { screenToFlowPosition } = useReactFlow();
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (event) => {
          event.preventDefault();
    
          const nodeTemplate = event.dataTransfer.getData("application/reactflow");
          const newNode = JSON.parse(nodeTemplate);
          const newName = nameGen(nodes, newNode.data.label);
          newNode.id = newName;
          console.log(newNode);
          console.log(newName);
          if (!nodeTemplate) return;
    
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY
          });
    
          addNode(newNode, position);
        },
        [nodes]
    );

    const onNodeClick = useCallback((event, node) => {
        event.preventDefault();
        openModal("node", node.id, node.data.config);
        console.log('node click', node);
    }, []);

    const onNodeRightClick = useCallback((event, node) => {
        event.preventDefault();
        setNodes((nds) => nds.filter((n) => n.id !== node.id));
        setEdges((eds) =>
          eds.filter((e) => e.source !== node.id && e.target !== node.id)
        );
    }, [setEdges]);

    const onEdgeClick = useCallback((event, edge) => { 
        event.preventDefault();

        const conditionsYaml = {
            ...(edge.data?.conditions ? edge.data.conditions : { conditions: {} })
          };

        openModal("edge", `from: ${edge.source} to: ${edge.target}`, conditionsYaml);
    }, []);

    const onEdgeRightClick = useCallback((event, edge) => {
        event.preventDefault();
        console.log(`edge id: ${edge.id}`);
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    }, [setNodes, setEdges]);

    const onClickExport = () => {
        const pipeline = exportPipeline(nodes, edges);
        openModal("exported pipeline", "my-pipeline", yaml.load(pipeline) );
    };

    const onClickImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
    
        setIsImporting(true);
        try {
          await importYaml(file, setNodes, setEdges);
        } catch (err) {
          alert("Import failed: " + err.message);
        } finally {
          setIsImporting(false);
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Toolbar */}
            <div style={styles.toolbar}>
                <div style={styles.toolbarGroup}>
                    <button
                        onClick={onClickExport}
                        style={styles.toolbarButton}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#2563eb';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#3b82f6';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                        title="Export pipeline as YAML"
                    >
                        <Download size={16} style={{ marginRight: '8px' }} />
                        Export Pipeline
                    </button>
                    
                    <button
                        onClick={handleImportClick}
                        disabled={isImporting}
                        style={{
                            ...styles.toolbarButton,
                            ...styles.toolbarButtonSecondary,
                            opacity: isImporting ? 0.6 : 1,
                            cursor: isImporting ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            if (!isImporting) {
                                e.currentTarget.style.background = '#e2e8f0';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isImporting) {
                                e.currentTarget.style.background = '#f1f5f9';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }
                        }}
                        title="Import pipeline from YAML file"
                    >
                        <Upload size={16} style={{ marginRight: '8px' }} />
                        {isImporting ? 'Importing...' : 'Import Pipeline'}
                    </button>
                </div>
                
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".yaml,.yml"
                    onChange={onClickImport}
                    style={styles.hiddenFileInput}
                />
            </div>
            
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                fitView
                onDragOver={onDragOver}
                onDrop={onDrop}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onNodeContextMenu={onNodeRightClick}
                onEdgeContextMenu={onEdgeRightClick}
            >
                <Background />
                <MiniMap />
                <Controls />
            </ReactFlow>
        </div>
    );
}

const styles = {
    toolbar: {
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 10,
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        background: '#ffffff',
        padding: '8px 12px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid #e2e8f0'
    },
    toolbarGroup: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
    },
    toolbarButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        fontFamily: 'inherit'
    },
    toolbarButtonSecondary: {
        background: '#f1f5f9',
        color: '#475569',
        border: '1px solid #e2e8f0'
    },
    hiddenFileInput: {
        display: 'none'
    }
};