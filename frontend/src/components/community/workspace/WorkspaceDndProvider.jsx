/**
 * WorkspaceDndProvider — wraps the three workspace panels in a single
 * dnd-kit DndContext so widgets can be drag-moved WITHIN a panel and
 * BETWEEN panels. Persistence is handled via WorkspaceContext (which
 * autosaves every change).
 *
 * Design:
 *   • Each panel is a droppable container ("SortableContext").
 *   • Each widget is a sortable item; `useSortable` gives us the
 *     transform for smooth drag animation and a draggable handle.
 *   • When a widget lands on another panel we call `moveWidget(id,
 *     panel, index)` — same helper we already had — so the state
 *     shape stays consistent with the existing manual reorder UI.
 *   • Drag only activates on ≥ 6px pointer movement to avoid stealing
 *     clicks on the widget content when *not* editing.
 */
import React, { useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, closestCorners, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { getWidget } from '../../../services/workspaceRegistry';

const PANELS = ['left', 'center', 'right'];

/**
 * Resolve where a droppable target belongs. Widgets carry their
 * current panel in their id (`${panel}::${widgetId}`); panel-level
 * empty droppables carry the panel key itself.
 */
const parseId = (id) => {
  if (!id) return { panel: null, widgetId: null };
  if (PANELS.includes(id)) return { panel: id, widgetId: null };
  const [panel, widgetId] = id.split('::');
  return { panel, widgetId };
};

const WorkspaceDndProvider = ({ editing, children }) => {
  const { workspace, moveWidget, reorderPanel } = useWorkspace();
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!editing) {
    // No overhead when not in edit mode — return children unchanged.
    return children;
  }

  const handleDragEnd = (event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const src = parseId(active.id);
    const dst = parseId(over.id);

    if (!src.widgetId) return;
    const srcPanel = src.panel;
    const dstPanel = dst.panel || srcPanel;
    if (!srcPanel || !dstPanel) return;

    // Same-panel reorder: use array move.
    if (srcPanel === dstPanel && dst.widgetId) {
      const arr = [...(workspace.panels[srcPanel] || [])];
      const from = arr.indexOf(src.widgetId);
      const to = arr.indexOf(dst.widgetId);
      if (from < 0 || to < 0 || from === to) return;
      arr.splice(from, 1);
      arr.splice(to, 0, src.widgetId);
      reorderPanel(srcPanel, arr);
      return;
    }

    // Cross-panel move: figure out target index (either before a specific
    // widget or at the tail of the destination panel).
    let targetIndex = null;
    if (dst.widgetId) {
      const arr = workspace.panels[dstPanel] || [];
      const idx = arr.indexOf(dst.widgetId);
      targetIndex = idx < 0 ? null : idx;
    }
    moveWidget(src.widgetId, dstPanel, targetIndex);
  };

  const active = parseId(activeId);
  const activeEntry = active.widgetId ? getWidget(active.widgetId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: { active: { opacity: '0.4' } },
        }),
      }}>
        {activeEntry ? (
          <div style={{
            padding: '0.55rem 0.85rem',
            background: '#FFFFFF', borderRadius: 12,
            border: '2px dashed #7C3AED',
            boxShadow: '0 20px 60px rgba(11,31,58,0.25)',
            color: '#0B1F3A', fontSize: '0.8rem', fontWeight: 800,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {activeEntry.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default WorkspaceDndProvider;
