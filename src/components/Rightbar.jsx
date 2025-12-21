import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';

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
        <div style={styles.sectionHeader}>{title}</div>
    
        {items.map(([key, value]) => (
          <div
            key={key}
            style={styles.item}
            onClick={() => openModal(value.type, key, value.data)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.transform = 'translateX(-2px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
            }}
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
        style={styles.toggleButton}
        title="Show rightbar"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#e2e8f0';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#f1f5f9';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <ChevronLeft size={20} />
      </button>
    );
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.headerRow} className="section-header">
        <span style={styles.header} className="section-title">
          UDF Scripts
        </span>

        <div style={styles.headerButtons}>
          <button
            className="icon-button"
            onClick={() => {
              openModal("new script", "new-script", MAP_TEMPLATE)
            }}
            title="Add template"
            style={styles.addIconBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e2e8f0';
              e.currentTarget.style.color = '#3b82f6';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#475569';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            +
          </button>
          <button
            className="icon-button"
            onClick={onToggle}
            title="Hide rightbar"
            style={styles.toggleIconBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e2e8f0';
              e.currentTarget.style.color = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#475569';
            }}
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

const styles = {
  sidebar: {
    height: '100vh',
    width: '240px',
    background: '#ffffff',
    borderLeft: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 16px',
    gap: '24px',
    fontSize: '14px',
    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.02)',
    transition: 'transform 0.3s ease, width 0.3s ease',
    transform: 'translateX(0)',
    overflow: 'hidden'
  },

  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 4px',
    marginBottom: '8px'
  },

  header: {
    fontWeight: '700',
    fontSize: '16px',
    color: '#0f172a',
    letterSpacing: '-0.01em'
  },

  headerButtons: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
  },

  addIconBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    background: '#f1f5f9',
    cursor: 'pointer',
    fontSize: '20px',
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    transition: 'all 0.2s ease',
    fontWeight: '300'
  },

  toggleIconBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: 'none',
    background: '#f1f5f9',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    transition: 'all 0.2s ease',
    padding: 0
  },

  toggleButton: {
    position: 'fixed',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    border: 'none',
    background: '#f1f5f9',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    zIndex: 100,
    padding: 0
  },

  addIconBtnHover: {
    background: '#e2e8f0',
    color: '#3b82f6',
    transform: 'scale(1.05)'
  },

  sectionHeader: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0 4px',
    marginBottom: '8px',
    marginTop: '8px'
  },

  item: {
    padding: '12px 14px',
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    userSelect: 'none',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '500',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
    marginBottom: '6px'
  }
};

export default Rightbar;
