// Extension entry. The xmlui build-lib UMD output appends a footer that
// calls window.xmlui.standalone.registerExtension(default || namespaceObject),
// so the `default` export here is what gets registered when the script tag
// loads in a host XMLUI app.
import { dndItemsComponentRenderer } from "./DndList";

// Namespace: lets users disambiguate via `xmlns:Dnd="component-ns:XMLUIDndList"`
// in <App> when there's a name collision. Bare `<DndItems>` also resolves.
export default {
  namespace: "XMLUIDndList",
  components: [dndItemsComponentRenderer],
};
