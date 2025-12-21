import { Editor } from '@monaco-editor/react';
import { parseYaml, loadYaml } from '../utils/yamlTools';
import { useState, useEffect } from 'react';
import yaml from 'js-yaml';
import { Download, FileText } from 'lucide-react';

export default function ConfigModal({ modalHook, pipelineHook, templatesHook, scriptsHook }) {

    const { newId, setNewId, type ,id, setId, isOpen, modalContent, openModal, closeModal } = modalHook;
    const { editTemplate, addTemplate } = templatesHook;
    const { editNode, editEdge } = pipelineHook;
    const { scripts } = scriptsHook || { scripts: {} };

    const [ text, setText ] = useState(parseYaml(modalContent).data);
    const [vertexType, setVertexType] = useState('source');
    const [selectedUdfScript, setSelectedUdfScript] = useState('');

    // Generate template based on vertex type
    const generateTemplate = (vertType, scriptName = '') => {
        const baseConfig = { scale: { min: 1 } };
        
        switch(vertType) {
            case 'source':
                return { ...baseConfig, source: { generator: {} } };
            case 'sink':
                return { ...baseConfig, sink: { log: {} } };
            case 'udf':
                if (scriptName) {
                    return { ...baseConfig, udf: { container: { image: `${scriptName}:latest` } } };
                }
                return baseConfig;
            default:
                return baseConfig;
        }
    };

    // Reset vertex type and script selection when modal opens for new template
    useEffect(() => {
        if (type === 'new template') {
            setVertexType('source');
            setSelectedUdfScript('');
        }
    }, [type]);

    // Update text based on modal type and content
    useEffect(() => {
        if (type === 'new template') {
            // Generate template when opening new template modal or when type/script changes
            const template = generateTemplate(vertexType, selectedUdfScript);
            const yamlText = yaml.dump(template);
            setText(yamlText);
        } else {
            // For existing templates/nodes, use the provided content
            setText(parseYaml(modalContent).data);
        }
    }, [modalContent, type, vertexType, selectedUdfScript]);

    const saveConfig = () => {
        const tryNewConfig = loadYaml(text);
        const newConfig = tryNewConfig.error ? modalContent : tryNewConfig.data;
        // editTemplate(id, newConfig);
        if (type === 'template') {
            editTemplate(id, newId, newConfig);
        };
        if (type === 'node') {
            editNode(id, newId, newConfig);
        };
        if (type === 'edge') {
            editEdge(id, newConfig);
        };
        if (type === 'new template') {
          let reactFlowType;
          if (newConfig.source) reactFlowType = "input";
          else if (newConfig.sink) reactFlowType = "output";
          else reactFlowType = undefined;
            addTemplate({
                id: newId,
                type: reactFlowType,
                data: { 
                    label: newId,
                    config: newConfig
                },
            });
        }
        if (type === 'exported pipeline') {
          const yamlText = yaml.dump(modalContent);
  
          const yamlWithName = yamlText.replace(
              /name:\s*"?<pipeline-name>"?/,
              `name: ${newId}`
            );
  
          const blob = new Blob([yamlWithName], { type: "text/yaml" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${newId}.yaml`;
          a.click();
          URL.revokeObjectURL(url);
        }

        closeModal();
    };

    if (!isOpen) return null;    
    
    // Get available UDF scripts for dropdown
    const udfScripts = Object.keys(scripts).filter(key => 
        scripts[key]?.type === 'map' || scripts[key]?.type === 'reduce'
    );

    return (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            {type === 'exported pipeline' && (
                <div style={styles.exportHeader}>
                    <div style={styles.exportIconContainer}>
                        <Download size={24} color="#3b82f6" />
                    </div>
                    <div>
                        <h3 style={styles.exportTitle}>Export Pipeline</h3>
                        <p style={styles.exportDescription}>Enter a name for your pipeline YAML file</p>
                    </div>
                </div>
            )}
            <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder={type === 'exported pipeline' ? "pipeline-name" : "e.g., generatorSource"}
                style={styles.input}
                onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                }}
            />
            
            {type === 'exported pipeline' && (
                <div style={styles.previewContainer}>
                    <div style={styles.previewHeader}>
                        <FileText size={16} style={{ marginRight: '8px', color: '#64748b' }} />
                        <span style={styles.previewLabel}>Preview</span>
                    </div>
                    <div style={styles.previewContent}>
                        <Editor
                          height="450px"
                          language="yaml"
                          theme="vs-dark"
                          options={{
                            minimap: { enabled: false },
                            fontSize: 12,
                            automaticLayout: true,
                            readOnly: true,
                          }}
                          value={text}
                        />
                    </div>
                </div>
            )}
            
            {type === 'new template' && (
                <>
                    <label style={styles.label}>Vertex Type</label>
                    <select
                        value={vertexType}
                        onChange={(e) => {
                            setVertexType(e.target.value);
                            if (e.target.value !== 'udf') {
                                setSelectedUdfScript('');
                            }
                        }}
                        style={styles.select}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#3b82f6';
                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#e2e8f0';
                            e.target.style.boxShadow = 'none';
                        }}
                    >
                        <option value="source">Source</option>
                        <option value="udf">UDF</option>
                        <option value="sink">Sink</option>
                    </select>

                    {vertexType === 'udf' && (
                        <>
                            <label style={styles.label}>UDF Script</label>
                            <select
                                value={selectedUdfScript}
                                onChange={(e) => setSelectedUdfScript(e.target.value)}
                                style={styles.select}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#3b82f6';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e2e8f0';
                                    e.target.style.boxShadow = 'none';
                                }}
                            >
                                <option value="">Select a script...</option>
                                {udfScripts.map(scriptKey => (
                                    <option key={scriptKey} value={scriptKey}>
                                        {scriptKey}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}
                </>
            )}
    
            {type !== 'exported pipeline' && (
                <div style={{ 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    overflow: 'hidden',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
                }}>
                    <Editor
                      height="350px"
                      language="yaml"
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        automaticLayout: true,
                      }}
                      value={text}
                      onChange={(change) => setText(change)}
                    />
                </div>
            )}
            <div style={styles.buttonContainer}>
              <button 
                style={styles.buttonSecondary} 
                onClick={closeModal}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e2e8f0';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                }}
              >
                Cancel
              </button>
              <button 
                style={styles.button} 
                onClick={saveConfig}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.3)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#3b82f6';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
              >
                {type === 'exported pipeline' ? (
                    <>
                        <Download size={16} style={{ marginRight: '8px' }} />
                        Download YAML
                    </>
                ) : (
                    'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      );
}

const styles = {
    overlay: {
      position: 'fixed', 
      top: 0, 
      left: 0,
      width: '100vw', 
      height: '100vh',
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      zIndex: 1000
    },
    modal: {
      background: '#ffffff',
      padding: '28px',
      width: '520px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      borderRadius: '16px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      border: '1px solid #e2e8f0'
    },
    input: {
        padding: '12px 16px',
        fontSize: '14px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: '#ffffff',
        color: '#0f172a',
        transition: 'all 0.2s ease',
        width: '100%'
    },
    label: {
        fontSize: '13px',
        fontWeight: '600',
        color: '#475569',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    },
    select: {
        padding: '12px 16px',
        fontSize: '14px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: '#ffffff',
        cursor: 'pointer',
        color: '#0f172a',
        transition: 'all 0.2s ease',
        width: '100%'
    },
    buttonContainer: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        marginTop: '8px',
        paddingTop: '16px',
        borderTop: '1px solid #f1f5f9'
    },
    button: {
        padding: '10px 20px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
    },
    buttonSecondary: {
        padding: '10px 20px',
        background: '#f1f5f9',
        color: '#475569',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center'
    },
    exportHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        padding: '16px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '8px'
    },
    exportIconContainer: {
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        background: '#dbeafe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
    },
    exportTitle: {
        margin: 0,
        fontSize: '18px',
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: '-0.01em'
    },
    exportDescription: {
        margin: '4px 0 0 0',
        fontSize: '13px',
        color: '#64748b'
    },
    previewContainer: {
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#ffffff'
    },
    previewHeader: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0'
    },
    previewLabel: {
        fontSize: '12px',
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    },
    previewContent: {
        border: 'none'
    }
  };

