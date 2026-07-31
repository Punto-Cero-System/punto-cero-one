/**
 * WorkspacePanel — renders a panel (left | center | right) driven by
 * WorkspaceContext.
 *
 * When `editing` is false → passive rendering (identical to viewing mode).
 * When `editing` is true  → each widget becomes a sortable item and the
 *   panel itself is a droppable container so widgets can be dragged
 *   between panels. Drag-and-drop is powered by @dnd-kit (see
 *   WorkspaceDndProvider which owns the DndContext).
 */
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import { getWidget } from '../../../services/workspaceRegistry';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import Shell from './WorkspaceWidgetShell';

const SortableItem = ({ id, editing, children }) => {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} data-testid={`sortable-item-${id}`}>
      {editing && (
        <button
          className="pc-drag-handle"
          data-testid={`drag-handle-${id}`}
          {...attributes} {...listeners}
          aria-label="Arrastrar para mover"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 8,
            position: 'absolute', top: 6, left: -6, zIndex: 3,
            background: '#FFFFFF',
            border: '1px solid rgba(124,58,237,0.35)',
            color: '#5B21B6', cursor: 'grab', touchAction: 'none',
            boxShadow: '0 4px 12px rgba(11,31,58,0.1)',
          }}
        >
          <GripVertical size={13} />
        </button>
      )}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
};

const WorkspacePanel = ({ panel = 'left', editing = false, gap = '0.85rem', testid }) => {
  const { workspace, isWidgetEnabled, isWidgetCollapsed, toggleWidget, toggleCollapse } = useWorkspace();
  const ids = workspace?.panels?.[panel] || [];

  const { setNodeRef, isOver } = useDroppable({ id: panel, disabled: !editing });

  const sortableIds = ids.map((id) => `${panel}::${id}`);

  const body = (
    <div
      ref={editing ? setNodeRef : undefined}
      data-testid={testid || `workspace-panel-${panel}`}
      style={{
        display: 'flex', flexDirection: 'column', gap,
        position: 'relative',
        ...(editing && isOver ? {
          outline: '2px dashed rgba(124,58,237,0.35)',
          outlineOffset: 8, borderRadius: 18,
        } : {}),
        minHeight: editing ? 60 : undefined,
      }}
    >
      {ids.length === 0 && editing && (
        <div style={{
          padding: '1rem', textAlign: 'center', fontSize: '0.75rem',
          color: 'rgba(11,31,58,0.55)', background: 'rgba(11,31,58,0.03)',
          borderRadius: 12, border: '1px dashed rgba(11,31,58,0.15)',
        }}>Suelta aquí un widget para agregarlo al panel</div>
      )}
      {ids.map((id) => {
        const entry = getWidget(id);
        if (!entry) return null;
        const enabled = isWidgetEnabled(id);
        if (!enabled && !editing) return null;
        const collapsed = isWidgetCollapsed(id);
        const { Component } = entry;
        const inner = (
          <Shell
            id={id}
            title={entry.title}
            editing={editing}
            collapsed={collapsed}
            onToggleEnabled={() => toggleWidget(id)}
            onToggleCollapse={() => toggleCollapse(id)}
          >
            <div style={{ opacity: enabled ? 1 : 0.35 }}>
              <Component />
            </div>
          </Shell>
        );
        return editing ? (
          <SortableItem key={id} id={`${panel}::${id}`} editing>
            {inner}
          </SortableItem>
        ) : (
          <React.Fragment key={id}>{inner}</React.Fragment>
        );
      })}
    </div>
  );

  if (!editing) return body;
  return (
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      {body}
    </SortableContext>
  );
};

export default WorkspacePanel;
