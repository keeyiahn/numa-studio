import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { sidebarStyles, buttonStyles } from '../styles/components';
import { hoverHandlers } from '../styles/hoverUtils';

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

const Rightbar = ({ scriptsHook, scriptModalHook, isVisible = true, onToggle }) => {

    const { scripts } = scriptsHook;
    const { isOpen, modalContent, openModal, closeModal } = scriptModalHook;

    const maps = [];
    const reduces = [];
    const others = [];
    
    Object.entries(scripts).forEach(([key, script]) => {
      if (script.type === 'map') {
        maps.push([key, script]);
      } else if (script.type === 'reduce') {
        reduces.push([key, script]);
      } else {
        others.push([key, script]);
      }
    });
  
    const renderSection = (title, items) => (
      <>
        <div style={sidebarStyles.sectionHeader}>{title}</div>
    
        {items.map(([key, value]) => (
          <div
            key={key}
            style={sidebarStyles.item}
            onClick={() => openModal(value.type, key, value.data)}
            {...hoverHandlers.sidebarItemRight}
          >
            {key}
          </div>
        ))}
      </>
    );

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        style={{ ...buttonStyles.toggle, right: '8px' }}
        title="Show rightbar"
        {...hoverHandlers.toggleButton}
      >
        <ChevronLeft size={20} />
      </button>
    );
  }

  return (
    <aside style={{ ...sidebarStyles.container, ...sidebarStyles.containerRight }}>
      <div style={sidebarStyles.headerRow} className="section-header">
        <span style={sidebarStyles.header} className="section-title">
          UDF Scripts
        </span>

        <div style={sidebarStyles.headerButtons}>
          <button
            className="icon-button"
            onClick={() => {
              openModal("new script", "new-script", MAP_TEMPLATE)
            }}
            title="Add template"
            style={buttonStyles.iconLarge}
            {...hoverHandlers.iconButtonLarge}
          >
            +
          </button>
          <button
            className="icon-button"
            onClick={onToggle}
            title="Hide rightbar"
            style={buttonStyles.icon}
            {...hoverHandlers.iconButton}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {renderSection("Map Functions", maps)}
      {renderSection("Reduce Functions", reduces)}
      {renderSection("Others", others)}
    </aside>
  );
};


export default Rightbar;
