import { Editor } from '@monaco-editor/react';
import { parseYaml, loadYaml } from '../utils/yamlTools';
import { useState, useEffect } from 'react';
import yaml from 'js-yaml';
import { Download } from 'lucide-react';

const MAP_TEMPLATE = `
from pynumaflow.mapper import Messages, Message, Datum, MapServer

def my_handler(keys: list[str], datum: Datum) -> Messages:
    val = datum.value
    output_keys = keys
    output_tags = []
    _ = datum.event_time
    _ = datum.watermark
    messages = Messages()
    num = int.from_bytes(val, "little")

    """ UDF logic here """

    messages.append(Message(val, keys=output_keys, tags=output_tags))
    return messages

if __name__ == "__main__":
    grpc_server = MapServer(my_handler)
    grpc_server.start()
`;

const REDUCE_TEMPLATE = `
import os
from collections.abc import AsyncIterable
from pynumaflow.reducer import Messages, Message, Datum, Metadata, ReduceAsyncServer, Reducer

async def reduce_handler(keys: list[str], datums: AsyncIterable[Datum], md: Metadata) -> Messages:

    """ UDF logic here """

    return Messages(Message(str.encode(msg), keys=keys))

if __name__ == "__main__":
    grpc_server = ReduceAsyncServer(reduce_handler)
    grpc_server.start()
`;

export default function ScriptModal({ scriptModalHook, scriptsHook }) {

    const { newId, setNewId, type ,id, setId, isOpen, modalContent, openModal, closeModal } = scriptModalHook;
    const { scripts, editScript, addScript } = scriptsHook;

    const [ text, setText ] = useState(modalContent);
    const [scriptType, setScriptType] = useState('map');

    // Get the current script type for existing scripts
    const currentScriptType = type === 'new script' ? null : type;

    // Reset script type and update text when modal opens
    useEffect(() => {
        if (type === 'new script') {
            // For new scripts, reset to map and set template
            setScriptType('map');
            setText(MAP_TEMPLATE);
        } else {
            // For existing scripts, use the modalContent
            setText(modalContent || '');
        }
    }, [type, modalContent]);

    // Update text when script type changes (only for new scripts)
    useEffect(() => {
        if (type === 'new script') {
            if (scriptType === 'map') {
                setText(MAP_TEMPLATE);
            } else if (scriptType === 'reduce') {
                setText(REDUCE_TEMPLATE);
            }
        }
    }, [scriptType, type]);

    const saveConfig = () => {
        if (type === 'new script') {
            // Create new script
            addScript(newId, scriptType, text);
        } else {
            // Edit existing script
            editScript(id, newId, text);
        }

        closeModal();
    };

    const generateDockerfile = (scriptName) => {
        return `FROM python:3.10-slim

WORKDIR /app

COPY . /app

RUN pip install -r requirements.txt

CMD ["python", "-u","${scriptName}.py"]
`;
    };

    const downloadScriptAndDockerfile = () => {
        const scriptName = id || newId;
        const sanitizedName = scriptName.replace(/[^a-zA-Z0-9-_]/g, '_');
        
        // Download Python script
        const scriptBlob = new Blob([text], { type: 'text/plain' });
        const scriptUrl = URL.createObjectURL(scriptBlob);
        const scriptLink = document.createElement('a');
        scriptLink.href = scriptUrl;
        scriptLink.download = `${sanitizedName}.py`;
        document.body.appendChild(scriptLink);
        scriptLink.click();
        document.body.removeChild(scriptLink);
        
        // Wait a bit before downloading the second file to avoid browser blocking
        setTimeout(() => {
            // Download Dockerfile
            const dockerfileContent = generateDockerfile(sanitizedName);
            const dockerfileBlob = new Blob([dockerfileContent], { type: 'text/plain' });
            const dockerfileUrl = URL.createObjectURL(dockerfileBlob);
            const dockerfileLink = document.createElement('a');
            dockerfileLink.href = dockerfileUrl;
            dockerfileLink.download = 'Dockerfile';
            document.body.appendChild(dockerfileLink);
            dockerfileLink.click();
            document.body.removeChild(dockerfileLink);
            
            // Clean up URLs after a delay
            setTimeout(() => {
                URL.revokeObjectURL(scriptUrl);
                URL.revokeObjectURL(dockerfileUrl);
            }, 100);
        }, 300);
    };

    if (!isOpen) return null;    
    
    return (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="Script name"
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
            
            {type === 'new script' ? (
                <>
                    <label style={styles.label}>Script Type</label>
                    <select
                        value={scriptType}
                        onChange={(e) => {
                            setScriptType(e.target.value);
                            if (e.target.value === 'map') {
                                setText(MAP_TEMPLATE);
                            } else if (e.target.value === 'reduce') {
                                setText(REDUCE_TEMPLATE);
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
                        <option value="map">Map</option>
                        <option value="reduce">Reduce</option>
                    </select>
                </>
            ) : (
                <>
                    <div style={styles.scriptInfo}>
                        <div style={styles.scriptInfoHeader}>
                            <div>
                                <div style={styles.scriptName}>{id}</div>
                                <div style={styles.scriptTypeLabel}>
                                    Type: <span style={styles.scriptType}>{currentScriptType}</span>
                                </div>
                            </div>
                            <button
                                onClick={downloadScriptAndDockerfile}
                                style={styles.downloadButton}
                                title="Download .py file and Dockerfile"
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
                                <Download size={16} style={{ marginRight: '8px' }} />
                                Download .py & Dockerfile
                            </button>
                        </div>
                    </div>
                </>
            )}
            
            <div style={{ 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px', 
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
            }}>
                <Editor
                  height="600px"
                  width="100%"
                  language="python"
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
                Save
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
      width: '700px',
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
    scriptInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '20px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
    },
    scriptInfoHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '16px'
    },
    downloadButton: {
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
        whiteSpace: 'nowrap',
        flexShrink: 0
    },
    scriptName: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: '-0.01em'
    },
    scriptTypeLabel: {
        fontSize: '13px',
        color: '#64748b',
        fontWeight: '500'
    },
    scriptType: {
        fontWeight: '600',
        color: '#3b82f6',
        textTransform: 'capitalize',
        fontSize: '14px'
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
        transition: 'all 0.2s ease'
    }
  };

