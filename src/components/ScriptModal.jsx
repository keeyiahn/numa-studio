import { Editor } from '@monaco-editor/react';
import { parseYaml, loadYaml } from '../utils/yamlTools';
import { useState, useEffect } from 'react';
import yaml from 'js-yaml';
import { Download } from 'lucide-react';
import { modalStyles, buttonStyles, inputStyles } from '../styles/components';
import { hoverHandlers } from '../styles/hoverUtils';
import { colors, spacing, borderRadius, typography } from '../styles/theme';

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

export default function ScriptModal({ scriptModalHook, scriptsHook, repositoryHook }) {

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

    const saveConfig = async () => {
        if (type === 'new script') {
            // Create new script - useScripts expects (id, type, data)
            addScript(newId, scriptType, text);
            // Also add to repository if initialized
            if (repositoryHook?.isInitialized) {
                const scriptData = {
                    type: scriptType,
                    data: text
                };
                await repositoryHook.addScript(newId, scriptData);
            }
        } else {
            // Edit existing script - editScript expects (id, newId, newConfig)
            const currentType = scripts[id]?.type || 'map';
            editScript(id, newId, text);
            // Update repository if initialized
            if (repositoryHook?.isInitialized) {
                const scriptData = {
                    type: currentType,
                    data: text
                };
                if (id !== newId) {
                    // Name changed, remove old and add new
                    await repositoryHook.removeScript(id);
                    await repositoryHook.addScript(newId, scriptData);
                } else {
                    // Just update the script data
                    await repositoryHook.addScript(newId, scriptData);
                }
            }
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
        <div style={modalStyles.overlay}>
          <div style={{ ...modalStyles.container, ...modalStyles.containerLarge }}>
            <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="Script name"
                style={inputStyles.input}
                {...hoverHandlers.inputFocus}
            />
            
            {type === 'new script' ? (
                <>
                    <label style={inputStyles.label}>Script Type</label>
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
                        style={inputStyles.select}
                        {...hoverHandlers.inputFocus}
                    >
                        <option value="map">Map</option>
                        <option value="reduce">Reduce</option>
                    </select>
                </>
            ) : (
                <>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: spacing.md,
                        padding: spacing.xl,
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        borderRadius: spacing.md,
                        border: `1px solid ${colors.border.default}`,
                        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: spacing.lg
                        }}>
                            <div>
                                <div style={{
                                    fontSize: typography.fontSize['2xl'],
                                    fontWeight: typography.fontWeight.bold,
                                    color: colors.text.primary,
                                    letterSpacing: typography.letterSpacing.tight
                                }}>{id}</div>
                                <div style={{
                                    fontSize: typography.fontSize.base,
                                    color: colors.text.tertiary,
                                    fontWeight: typography.fontWeight.medium
                                }}>
                                    Type: <span style={{
                                        fontWeight: typography.fontWeight.semibold,
                                        color: colors.primary,
                                        textTransform: 'capitalize',
                                        fontSize: typography.fontSize.md
                                    }}>{currentScriptType}</span>
                                </div>
                            </div>
                            <button
                                onClick={downloadScriptAndDockerfile}
                                style={buttonStyles.primary}
                                title="Download .py file and Dockerfile"
                                {...hoverHandlers.primaryButton}
                            >
                                <Download size={16} style={{ marginRight: spacing.sm }} />
                                Download .py & Dockerfile
                            </button>
                        </div>
                    </div>
                </>
            )}
            
            <div style={{ 
                border: `1px solid ${colors.border.default}`, 
                borderRadius: borderRadius.lg, 
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
            <div style={modalStyles.buttonContainer}>
              <button 
                style={buttonStyles.secondary} 
                onClick={closeModal}
                {...hoverHandlers.secondaryButton}
              >
                Cancel
              </button>
              <button 
                style={buttonStyles.primary} 
                onClick={saveConfig}
                {...hoverHandlers.primaryButton}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      );
}


