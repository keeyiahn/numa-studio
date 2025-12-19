import React, { useState } from 'react';
import { Plus } from 'lucide-react';

const Sidebar = ({ templatesHook, modalHook }) => {

    const { templates, addTemplate } = templatesHook;
    const { isOpen, modalContent, openModal, closeModal } = modalHook;

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(templates[nodeType]));
        event.dataTransfer.effectAllowed = 'move';
    };

    const onClickNew = () => {
        openModal("new template", "new template", {scale: { min: 1}})
    };

    const sources = [];
    const sinks = [];
    const udfs = [];
    
    Object.entries(templates).forEach(([key, template]) => {
      if (template.data.config.source) {
        sources.push([key, template]);
      } else if (template.data.config.sink) {
        sinks.push([key, template]);
      } else {
        udfs.push([key, template]);
      }
    });
  
    const renderSection = (title, items) => (
      <>
        <div style={styles.sectionHeader}>{title}</div>
    
        {items.map(([key, value]) => (
          <div
            key={key}
            style={styles.item}
            draggable
            onDragStart={(e) => onDragStart(e, key)}
            onClick={() => openModal("template", key, value.data.config)}
          >
            {key}
          </div>
        ))}
      </>
    );

  return (
    <aside style={styles.sidebar}>
      <div style={styles.headerRow} className="section-header">
        <span style={styles.header} className="section-title">
          Vertices
        </span>

        <button
          className="icon-button"
          onClick={onClickNew}
          title="Add template"
        >
          +
        </button>
      </div>

      {renderSection("Sources", sources)}
      {renderSection("Sinks", sinks)}
      {renderSection("UDFs", udfs)}
    </aside>
  );
};

const styles = {
  sidebar: {
    height: '100vh',
    width: '180px',
    background: 'white',
    borderRight: '1px solid #dddddd',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px',
    gap: '8px',
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px'
  },

  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 2px'
  },

  header: {
    fontWeight: '600',
    fontSize: '15px',
    color: '#333'
  },

  addIconBtn: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#555'
  },

  addIconBtnHover: {
    background: 'rgba(0, 0, 0, 0.06)'
  },

  item: {
    padding: '8px 10px',
    background: 'white',
    borderRadius: '6px',
    border: '1px solid #d3d3d3',
    cursor: 'grab',
    transition: '0.15s',
    userSelect: 'none',
    color: '#333'
  }
};

export default Sidebar;
