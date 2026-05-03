# xmlui-dnd-list — Build Log

A first-time XMLUI extension, narrated in real time so the toolchain decisions are legible to anyone who follows. Audience: me-in-six-months, Jon Udell, anyone evaluating XMLUI extension ergonomics.

## Goal

A reusable React component for drag-and-drop reorder of lists, with two faces:

1. **`DndListNative`** — pure React + `@dnd-kit/sortable`, zero XMLUI imports. Portable.
2. **`<DndItems>`** — XMLUI adapter, drop-in replacement for `<Items>` with one new event: `onReorder(newOrder)`. Same `$item` / `$itemIndex` / `$isFirst` / `$isLast` semantics.

The split matters: if I ever leave XMLUI, `DndListNative` comes with me; only the adapter is throwaway.

## Decisions, made up front

### Why `@dnd-kit/sortable`, not `react-beautiful-dnd` or `react-dnd`?

- `react-beautiful-dnd` is unmaintained.
- `react-dnd` is the heavyweight option for arbitrary drag (files onto canvases, etc). Sortable lists are a tiny slice of its API surface.
- `@dnd-kit/sortable` is modern, accessibility-first (keyboard sensor included), and ~10KB. Sortable lists are exactly what it's designed for.

### Why not Sortable.js (the pure-JS one)?

Sortable.js is the right answer for **server-state** UIs: HTMX + Jinja, plain FastAPI HTML round-trips. It mutates DOM directly, which fights React's reconciliation. dnd-kit fits React's mental model. Different paradigm, different tool — see "Two paradigms, two artifacts" in `~/obsidian/Main/XMLUI.md`.

### Why no build tool of my own?

XMLUI ships its own CLI: `xmlui build-lib`. Output is a self-contained UMD that externalizes React and the XMLUI runtime, and you load it via plain `<script>` tag in your XMLUI app's `index.html`. So I don't author `vite.config.ts` or `tsup.config.ts` — I just write `src/index.tsx` and run `npm run build:extension`.

The tradeoffs:
- **Pro**: no toolchain bikeshedding. The build is whatever XMLUI says it is.
- **Con**: no hot-reload. Iteration is `edit → build → copy → refresh`. Painful but bounded.
- **Con**: build CLI is a black box from a debug perspective. If TypeScript errors surface, I can't tune `tsconfig.json` to taste.

### Why start with the pure-React side, not the adapter?

This was the xmlui-expert subagent's recommendation, and I think it's right. Reasoning:

- dnd-kit has its own learning curve (sensors, modifiers, restrict-to-axis, drag overlays). Debugging that *and* the XMLUI metadata/renderer pattern simultaneously is two-systems-at-once trouble.
- The pure-React API I land on (`onReorder(newArray)`) directly dictates the adapter shape. Adapter becomes a mechanical translation step.
- The plain-React demo also serves as the long-lived dev harness. If something breaks after an `xmlui` upgrade, the plain demo is unaffected — it isolates dnd-kit issues from XMLUI-runtime issues.

## Repo shape (as scaffolded)

```
xmlui-dnd-list/
├── BUILD_LOG.md            ← this file
├── package.json
├── src/
│   ├── DndListNative.tsx   ← pure React + dnd-kit (no XMLUI)
│   ├── DndList.tsx         ← XMLUI adapter (metadata + renderer)
│   └── index.tsx           ← extension entry — registers DndItems
├── examples/
│   ├── plain-react/        ← Vite + React demo, proves portability
│   └── xmlui-app/          ← script-tag XMLUI app exercising <DndItems>
└── dist/                   ← build output, .gitignored
```

## package.json — annotated

```json
"main":   "./dist/xmlui-dnd-list.js",
"module": "./dist/xmlui-dnd-list.mjs",
```
The XMLUI build CLI emits both UMD and ESM. The XMLUI app loads the UMD via `<script src=".../xmlui-dnd-list.js">`; the ESM is for any consumer who imports it through their own bundler.

```json
"dependencies": { "@dnd-kit/*": ... },
"peerDependencies": { "react": "^18 || ^19" },
"devDependencies": { "xmlui": "..." }
```
- `@dnd-kit/*` are real `dependencies` because they get **bundled into** the UMD.
- React is a `peerDependency` because the XMLUI runtime already loaded a React for us — we'd have a "two Reacts" hooks-violation if we shipped our own.
- `xmlui` is a `devDependency` because we only need it to build, not at runtime (the host app brings its own).

---

## What actually happened, in order

### 1. Reading the build CLI

`xmlui build-lib` is documented as a black box, but `node_modules/xmlui/dist/nodejs/bin/index.mjs` has the implementation in plain text. Reading it answered every toolchain question without speculation:

- **Entry point**: hardcoded to `src/index.tsx`. No way to override via package.json.
- **Externals**: `react`, `react-dom`, `xmlui`, `react/jsx-runtime`. Globals: `React`, `ReactDOM`, plus a (broken — see below) mapping for `react/jsx-runtime`.
- **Auto-register footer**: appended to the UMD output, calls `window.xmlui.standalone.registerExtension(window['<pkg-name>'].default || window['<pkg-name>'])` at script-load time.
- **Watch mode**: `--watch` exists, but it emits ESM-only with inline sourcemaps — not the UMD that the host app loads via `<script>` tag. So practically, watch mode helps for local dev against a Vite host, not against the no-build XMLUI standalone shape. Iteration loop is `npm run build:extension && reload`.
- **Override hooks**: a `vite.config-overrides.ts` next to `package.json` can add plugins or a custom logger. Cannot override the externals list.

This was the single most useful thing I did. **Read the build tool's source before writing the package.** It's 60 lines. Saved hours of trial-and-error.

### 2. Reading XMLUI's own `Items.tsx`

The component contract is "drop-in replacement for `<Items>`," so I pulled `xmlui/src/components/Items/Items.tsx` and `ItemsReact.tsx` via the XMLUI MCP server's `xmlui_read_file`. That gave me:

- The exact metadata shape (`childrenAsTemplate: "itemTemplate"` is what makes XML children act as the template).
- The renderer pattern: pull `node`, `renderChild`, `extractValue`, `layoutContext` from context; pass `renderItem={(contextVars, key) => <MemoizedItem ... />}` to the React component.
- The contextVars contract: `$item`, `$itemIndex`, `$isFirst`, `$isLast` are wired in the React layer, not the adapter.

This let me write `DndListNative.tsx` with a near-identical signature to `ItemsReact.tsx` — same `renderItem(contextVars, key)` callback. Means the adapter is a one-line difference: I add `onReorder` and pass through `lookupEventHandler("reorder")`.

### 3. Pure-React first

Built `DndListNative.tsx` against `@dnd-kit/sortable` and dropped it into `examples/plain-react/` (a Vite app aliased to import the source directly — no publish step). Type-checked, built, and confirmed in browser:

- 5 sortable rows render
- Synthesized PointerEvents (pointerdown → pointermove past 4px activation distance → pointermove to target → pointerup) reorder the array
- `onReorder` fires once per drag with the new array
- `$isFirst` / `$isLast` re-attach correctly after reorder

Total time to "drag works": ~20 minutes from `npm install`.

### 4. The XMLUI adapter — three problems hit in succession

**Problem A: `wrapComponent` import resolution.**
I copied the Items adapter pattern using `wrapComponent`, but my first import was `from "xmlui/components-core/wrapComponent"` (matching the source-tree path). xmlui's `package.json` only exports `.`, so that path 404s. Fix: import everything from the top-level `xmlui` entry. The xmlui package re-exports `wrapComponent`, `MemoizedItem`, `createMetadata`, etc. from its main entry.

**Problem B: `wrapComponent` may be core-only.**
After the first build succeeded but the host app reported `Unknown component: DndItems`, I switched to `createComponentRenderer` (the documented extension path; `wrapComponent` is what core components use internally). Both produce a `ComponentRendererDef` shape, but the extension path is the documented one and may have semantics the registration system relies on. Switching cleared "Unknown component" once I also addressed Problem C.

**Problem C: namespace resolution.**
With `namespace: "XMLUIDndList"` set in `index.tsx`, bare `<DndItems>` markup resolves to "Unknown component." Fix: use the `xmlns:` declaration on `<App>`:
```xml
<App xmlns:Dnd="component-ns:XMLUIDndList">
  <Dnd:DndItems data="{cities}" onReorder="..." />
</App>
```
The hello-world docs show this in the "step 11" example. Steps 8 and earlier work without `xmlns:` because they don't set a namespace — but Step 6 *does* set `namespace: "XMLUIExtensions"`. So either the docs example is inconsistent, or some XMLUI versions tolerate bare resolution and others require the prefix. **Empirical answer**: with current `xmlui` 0.12.25, the prefix is required when a namespace is declared.

**Problem D (the spicy one): `react/jsx-runtime` is externalized but no host global provides it.**
After fixing namespace, the next error was `Cannot read properties of undefined (reading 'jsx')`. The `xmlui build-lib` output has a Rolldown `globals` mapping with what looks like a typo: `globals: { react: "React", "react-dom": "ReactDOM", jsx: "react/jsx-runtime" }`. The third entry maps a global named `jsx` to the *module path* `"react/jsx-runtime"`, which is backwards from the right shape. Rolldown then defaults the JSX-runtime external to the global name `react_jsx_runtime`, and the `xmlui-standalone.umd.js` doesn't expose anything by that name.

**Workaround**: an inline shim in `index.html`, before the extension `<script>` tag, that builds a `window.react_jsx_runtime` from `window.React.createElement` and `React.Fragment`. ~15 lines of vanilla JS. Documented at the top of `examples/xmlui-app/index.html`. Works against React 18; would also work for any consumer-supplied React on `window`.

This is upstream-fixable — XMLUI could either re-export `react/jsx-runtime` from the standalone bundle or fix the globals mapping. Worth filing.

### 5. End-to-end verification

With the shim in place:
- Extension auto-registers on script load (`window.xmlui.standalone.registeredExtensions` shows it)
- `<Dnd:DndItems>` renders 5 rows from XMLUI's `var.cities` array
- Synthesized pointer-drag from row 0 onto row 2 fires `onReorder`, the `var.cities` reassignment runs, and the rendered order updates to `Albany, Tokyo, Berkeley, Vancouver, Lisbon`
- dnd-kit's accessibility live region announces: "Draggable item berkeley was dropped over droppable area tokyo"

UMD bundle size: **48.5 KB minified** (16 KB gzipped). dnd-kit + sortable + utilities bundled in; React, ReactDOM, jsx-runtime, and the entire XMLUI runtime externalized.

## Things to file / fix / revisit

1. **Upstream**: the `react/jsx-runtime` globals mapping in `build-lib`. Either fix the mapping or expose the runtime on `window` from `xmlui-standalone`. Currently every extension that uses any JSX needs the inline shim.
2. **Docs**: clarify when `xmlns:` is required vs. optional. The hello-world page's Step 8 implies bare references work even with a namespace set; my experience says they don't, at least at 0.12.25.
3. **Drag handle slot**: v0 makes the entire row the handle. v0.2 should accept a slot or a CSS selector for an explicit handle, so row content with its own buttons doesn't compete with drag activation.
4. **Touch / iOS**: `PointerSensor` with `activationConstraint: { distance: 4 }` works on desktop. iOS gestures may need `TouchSensor` configured with `delay` instead of `distance` (tap-and-hold). Untested.
5. **`getItemId` default**: the JSON.stringify fallback won't survive content-equal items. For real lists, callers should pass `getItemId={item => item.id}` or use the per-item `id` field convention.
6. **Hot reload**: investigate whether ESM watch mode + a Vite-style consumer app would close the iteration loop. Probably worth it for v0.2.

## Final layout

```
xmlui-dnd-list/
├── BUILD_LOG.md
├── package.json
├── tsconfig.json
├── src/
│   ├── DndListNative.tsx     ← portable, ~120 LOC
│   ├── DndList.tsx           ← XMLUI adapter, ~70 LOC
│   └── index.tsx             ← extension entry, 8 LOC
├── examples/
│   ├── plain-react/          ← Vite + React 18, dogfoods src directly via alias
│   └── xmlui-app/            ← static, vendored UMDs, jsx-runtime shim in index.html
└── dist/                     ← .gitignored
    ├── xmlui-dnd-list.js     ← 48.5 KB UMD (auto-registers)
    └── xmlui-dnd-list.mjs    ← 61 KB ESM
```

## Total time

~2 hours from empty directory to working drag-and-drop in an XMLUI app. Toolchain friction was real but bounded — most of it lived in the three numbered "Problems" above, each one read-the-source-code-and-keep-going.

## Coda: how this all landed (2026-05-02 evening)

I sent Jon Udell the email above as a build-experience report. ~3 hours later he came back with **five upstream PRs and a PR on this repo**. All of the issues flagged in "Things to file / fix / revisit" were actioned:

- [`xmlui-org/xmlui#3424`](https://github.com/xmlui-org/xmlui/pull/3424) — extension-packaging guide now explains what `xmlui build-lib` does and links to its source. Resolves issue #1 in the list above.
- [`xmlui-org/xmlui#3425`](https://github.com/xmlui-org/xmlui/pull/3425) — removes the stale `build-hello-world-component` tutorial.
- [`xmlui-org/xmlui#3426`](https://github.com/xmlui-org/xmlui/pull/3426) — fixes the `react/jsx-runtime` globals typo. Resolves Problem D from §4. Once a release ships this, the inline JSX-runtime shim in `examples/xmlui-app/index.html` becomes unnecessary.
- [`xmlui-org/xmlui#3427`](https://github.com/xmlui-org/xmlui/pull/3427) — removes the stale `build-editor-component` tutorial and retargets the introducing-xmlui blog link.
- [`xmlui-org/trace-tools#13`](https://github.com/xmlui-org/trace-tools/pull/13) — Inspector now reads an optional `description` field from any `handler:start` `eventArg` and appends it to the trace title. Convention-only; no schema changes.

Plus the PR on this repo, [#1](https://github.com/rdhyee/xmlui-dnd-list/pull/1), with two commits by Jon (each co-authored with Claude):

1. **Switch from `createComponentRenderer` to `wrapComponent` + `customRender`** — exactly the pattern I tried first and reverted from when I misdiagnosed the `Unknown component` namespace error as an API choice issue. The original instinct was right; the doc gap was the misdirect. Diff was ~10 lines, all signature.
2. **Pass `{ item, fromIndex, toIndex, description }` as the second arg to `onReorder`** — backward compatible (unary handlers ignore the extra arg). The `description` field is what `trace-tools#13` reads to enrich Inspector titles, e.g. `"XMLUIDndList.DndItems reorder — Albany, CA moved from position 1 to position 2"`.

I added one small commit on top documenting the new payload in `README.md` (the public-API contract changed), then merged.

### Pre-merge review

Before merging, I ran the PR through Codex (gpt-5.4) for a second-pair-of-eyes pass. Codex walked the index arithmetic for `reverse=true` and signed off, but flagged one merge-blocker: removing the unary adapter means XMLUI's `lookupEventHandler` now sees a 2-arg call directly, and we hadn't actually verified that an XMLUI handler written as `(newOrder, info) => {...}` receives `info` at arg 2. Jon's PR description noted that `eventArgs[1]` was captured in the trace stream, which is necessary but not sufficient — the trace system might serialize args independently of how user handlers receive them.

So I temporarily modified the weather app's `onReorder` to a 2-arg handler stashing `info` on `window.__lastReorderInfo`, dragged Albany down two slots, and confirmed XMLUI's binding correctly forwards both args:

```json
{ "item": "Albany, CA", "fromIndex": 0, "toIndex": 2,
  "description": "Albany, CA moved from position 1 to position 3" }
```

Codex's blocker cleared. Two non-blocking concerns it flagged:

- Optional chaining was removed (`node.props?.foo` → `node.props.foo`) — less defensive but matches `Items.tsx` exactly. Accepted.
- `defaultItemLabel`'s fallback chain has minor edge cases (`id: null` → `"#null"`, plain objects → `"[object Object]"`). Real but doesn't bite the weather app's string items. Filing as a follow-up issue.

### Why the "Problems" section above is now (mostly) historical

After the upstream PRs ship in a release:

- **Problem A** (import path `xmlui/components-core/wrapComponent` 404s): still real. xmlui's package.json still only exports `.`. Future authors find this by reading the d.ts file. Worth its own followup (re-exporting subpaths or documenting "import from `xmlui` only").
- **Problem B** (`createComponentRenderer` vs `wrapComponent` confusion): #3424's docs rewrite pre-empts it.
- **Problem C** (namespace + bare-reference inconsistency): #3425 removes the misleading hello-world tutorial; future authors see only the corrected packaging guide.
- **Problem D** (`react/jsx-runtime` globals typo): #3426 fixes it at the source. The shim in `examples/xmlui-app/index.html` stays for now (until a release with #3426 ships) but is documented as removable.

I'm leaving this BUILD_LOG.md as-written (with the original Problems intact) because the *narrative* is now part of the artifact's value: it shows what a first-time author actually hit and how the framework responded. The fixes happened *because* the friction was documented narratively. If we'd just opened five terse issues, none of this would have moved this fast.

### Next: xmlui-org

Jon wants `xmlui-dnd-list` to be the first community-contributed extension under the `xmlui-org` umbrella, with the contribution coming from me (Raymond). Awaiting his guidance on the exact path — likely some combination of repo transfer, packages/ tree inclusion, or registry entry.
