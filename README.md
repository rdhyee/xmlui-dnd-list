# xmlui-dnd-list

Drag-and-drop sortable list for [XMLUI](https://xmlui.org/) — a drop-in replacement for `<Items>` plus an `onReorder` event. Also ships as a pure React component with no XMLUI dependency.

> **Status**: experimental (v0). API may shift before v0.2. Use it, file what breaks.

## What you get

- **`<DndItems>`** — XMLUI component. Same `data` / `reverse` / `itemTemplate` / `$item` / `$itemIndex` / `$isFirst` / `$isLast` semantics as `<Items>`. One added event: `onReorder(newOrder)`.
- **`DndListNative`** — the underlying React component. Zero XMLUI imports. Portable to any React app.

Built on [`@dnd-kit/sortable`](https://docs.dndkit.com/) — accessibility-first, keyboard sensors built in, ~10KB. UMD output: 48KB minified, 16KB gzipped (dnd-kit bundled, React + XMLUI runtime externalized).

## Use in an XMLUI app

```html
<!-- index.html -->
<script src="/xmlui/xmlui-standalone.umd.js"></script>
<script>
  // Shim for react/jsx-runtime — see BUILD_LOG.md "Problem D"
  (function () {
    var R = window.React;
    if (!R || window.react_jsx_runtime) return;
    function jsx(t, p, k) {
      var pp = p || {}, c = pp.children, r = {};
      for (var x in pp) if (x !== "children") r[x] = pp[x];
      if (k !== undefined) r.key = k;
      if (c === undefined) return R.createElement(t, r);
      return R.createElement.apply(R, [t, r].concat(Array.isArray(c) ? c : [c]));
    }
    window.react_jsx_runtime = { jsx: jsx, jsxs: jsx, Fragment: R.Fragment };
  })();
</script>
<script src="/xmlui/xmlui-dnd-list.js"></script>
```

```xml
<App
  xmlns:Dnd="component-ns:XMLUIDndList"
  var.cities="{['Berkeley', 'Albany', 'Tokyo']}">
  <Dnd:DndItems
    data="{cities}"
    onReorder="(newOrder) => { cities = newOrder; }">
    <HStack>
      <Text>{$item}</Text>
      <Text when="{$isFirst}">first</Text>
    </HStack>
  </Dnd:DndItems>
</App>
```

## Use in a plain React app

```tsx
import { DndListNative } from "xmlui-dnd-list/native";

<DndListNative
  items={cities}
  onReorder={(next) => setCities(next)}
  renderItem={(ctx) => <Row city={ctx.$item} first={ctx.$isFirst} />}
/>
```

## Build

```bash
npm install
npm run build:extension   # produces dist/xmlui-dnd-list.{js,mjs}
```

## Examples

- `examples/plain-react/` — Vite + React 18, dogfoods `src/DndListNative.tsx` directly. `npm install && npm run dev` (port 5180).
- `examples/xmlui-app/` — Static, vendored UMDs. After building the extension, run `python3 -m http.server 5181` from the directory.

## Build journey

The narrative of building this from scratch — toolchain decisions, dead ends, the three problems hit during the XMLUI-adapter step — is in [`BUILD_LOG.md`](./BUILD_LOG.md). Useful if you're writing your own XMLUI extension.
