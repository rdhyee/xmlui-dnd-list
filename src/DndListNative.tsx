import {
  Fragment,
  type ReactNode,
  useCallback,
  useMemo,
} from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// =====================================================================================================================
// Pure React drag-and-drop sortable list. No XMLUI imports.
//
// API mirrors XMLUI's <Items>: takes `items` + `renderItem(contextVars, key)`,
// where contextVars exposes `$item`, `$itemIndex`, `$isFirst`, `$isLast`.
// One additional event: `onReorder(newItems)` — fires after a drag completes.
//
// Stable IDs: dnd-kit needs each item to have a stable id so it can track
// positions during a drag. We accept an optional `getItemId(item, index)` prop;
// the default tries `item.id`, then `item.name`, then falls back to a JSON
// digest of the item. For typical lists of objects with id/name this is fine;
// if it's not, callers pass `getItemId`.

export type ContextVars = {
  $item: any;
  $itemIndex: number;
  $isFirst: boolean;
  $isLast: boolean;
};

export type DndListNativeProps = {
  items: any[];
  renderItem: (contextVars: ContextVars, key: number) => ReactNode;
  onReorder?: (newItems: any[]) => void;
  getItemId?: (item: any, index: number) => string | number;
  reverse?: boolean;
};

const defaultGetItemId = (item: any, index: number): string | number => {
  if (item == null) return index;
  if (typeof item === "object") {
    if (item.id !== undefined) return String(item.id);
    if (item.name !== undefined) return String(item.name);
    try {
      return JSON.stringify(item);
    } catch {
      return index;
    }
  }
  return String(item);
};

export function DndListNative({
  items,
  renderItem,
  onReorder,
  getItemId = defaultGetItemId,
  reverse = false,
}: DndListNativeProps) {
  const normalized = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return reverse ? [...items].reverse() : items;
  }, [items, reverse]);

  // Tag each item with a stable id once per render, so the DragEndEvent
  // active.id / over.id round-trip lands us back on the right item.
  const idForIndex = useMemo(
    () => normalized.map((item, idx) => String(getItemId(item, idx))),
    [normalized, getItemId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a small drag distance so plain clicks don't trigger drag —
      // important when row content has its own buttons.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = idForIndex.indexOf(String(active.id));
      const newIndex = idForIndex.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const newOrder = arrayMove(normalized, oldIndex, newIndex);
      // If we were rendering reversed, un-reverse before reporting back to the
      // caller so the array they see matches the source-of-truth order.
      onReorder?.(reverse ? [...newOrder].reverse() : newOrder);
    },
    [idForIndex, normalized, onReorder, reverse],
  );

  if (normalized.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={idForIndex} strategy={verticalListSortingStrategy}>
        {normalized.map((item, index) => (
          <SortableRow key={idForIndex[index]} id={idForIndex[index]}>
            {renderItem(
              {
                $item: item,
                $itemIndex: index,
                $isFirst: index === 0,
                $isLast: index === normalized.length - 1,
              },
              index,
            )}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

// SortableRow wraps each rendered child in the dnd-kit sortable hook, applying
// transform styles + spreading drag listeners onto a wrapper div. The whole
// row is the drag handle — keeping this simple for v0; a separate handle slot
// is a v0.2 affordance.
function SortableRow({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Fragment>{children}</Fragment>
    </div>
  );
}
