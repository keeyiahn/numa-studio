import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { sidebarStyles, buttonStyles } from '../styles/components';
import { hoverHandlers } from '../styles/hoverUtils';

const Sidebar = ({ templatesHook, modalHook, isVisible = true, onToggle }) => {

    const { templates, addTemplate } = templatesHook;
    const { isOpen, modalContent, openModal, closeModal } = modalHook;

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(templates[nodeType]));
        event.dataTransfer.effectAllowed = 'move';
    };

    const onClickNew = () => {
        openModal("new template", "new-template", {scale: { min: 1}})
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
        <div style={sidebarStyles.sectionHeader}>{title}</div>
    
        {items.map(([key, value]) => (
          <div
            key={key}
            style={{ ...sidebarStyles.item, cursor: 'grab' }}
            draggable
            onDragStart={(e) => onDragStart(e, key)}
            onClick={() => openModal("template", key, value.data.config)}
            {...hoverHandlers.sidebarItemLeft}
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
        style={{ ...buttonStyles.toggle, left: '8px' }}
        title="Show sidebar"
        {...hoverHandlers.toggleButton}
      >
        <ChevronRight size={20} />
      </button>
    );
  }

  return (
    <>
      <aside style={{ ...sidebarStyles.container, ...sidebarStyles.containerLeft }}>
        <div style={sidebarStyles.headerRow} className="section-header">
          <span style={sidebarStyles.header} className="section-title">
            Vertices
          </span>

          <div style={sidebarStyles.headerButtons}>
            <button
              className="icon-button"
              onClick={onClickNew}
              title="Add template"
              style={buttonStyles.iconLarge}
              {...hoverHandlers.iconButtonLarge}
            >
              +
            </button>
            <button
              className="icon-button"
              onClick={onToggle}
              title="Hide sidebar"
              style={buttonStyles.icon}
              {...hoverHandlers.iconButton}
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        {renderSection("Sources", sources)}
        {renderSection("Sinks", sinks)}
        {renderSection("UDFs", udfs)}
      </aside>
    </>
  );
};


export default Sidebar;
