// XMLUI adapter for DndListNative.
//
// Uses createComponentRenderer (the documented extension path), not the
// wrapComponent customRender pattern that core components like Items use
// internally. Functionally similar — we extract props from `node.props`
// and pass `renderItem` that wraps each emitted child in MemoizedItem so
// the itemTemplate receives contextVars ($item, $itemIndex, $isFirst, $isLast).
//
// xmlui externalizes 'xmlui' at build time, so these imports resolve to the
// host app's standalone runtime when the extension UMD is loaded.
import {
  createComponentRenderer,
  createMetadata,
  MemoizedItem,
  d,
  dComponent,
  dInternal,
} from "xmlui";
import { DndListNative } from "./DndListNative";

const COMP = "DndItems";

const DndItemsMd = createMetadata({
  status: "experimental",
  description:
    "`DndItems` renders a sortable list of data items with drag-and-drop " +
    "reordering. Drop-in replacement for `Items` plus an `onReorder` event " +
    "that fires with the new array order.",
  props: {
    items: dInternal(`This property contains the list of data items this component renders.`),
    data: d(
      `This property contains the list of data items (obtained from a data source) this component renders.`,
    ),
    reverse: {
      description:
        "This property reverses the order in which data is mapped to template components.",
      valueType: "boolean",
      defaultValue: false,
    },
    itemTemplate: dComponent("The component template to display a single item"),
  },
  events: {
    reorder: {
      description:
        "Fires after a drag completes. Receives the new array of items in their reordered positions.",
    },
  },
  childrenAsTemplate: "itemTemplate",
  contextVars: {
    $item: dComponent("Current data item being rendered"),
    $itemIndex: dComponent("Zero-based index of current item"),
    $isFirst: dComponent("Boolean indicating if this is the first item"),
    $isLast: dComponent("Boolean indicating if this is the last item"),
  },
  opaque: true,
});

export const dndItemsComponentRenderer = createComponentRenderer(
  COMP,
  DndItemsMd,
  ({ node, renderChild, extractValue, layoutContext, lookupEventHandler }: any) => {
    const onReorder = lookupEventHandler("reorder");
    return (
      <DndListNative
        items={extractValue(node.props?.items) || extractValue(node.props?.data)}
        reverse={extractValue(node.props?.reverse)}
        onReorder={(newItems: any[]) => onReorder?.(newItems)}
        renderItem={(contextVars: any, key: number) => (
          <MemoizedItem
            key={key}
            contextVars={contextVars}
            node={node.props?.itemTemplate}
            renderChild={renderChild}
            layoutContext={layoutContext}
          />
        )}
      />
    );
  },
);
