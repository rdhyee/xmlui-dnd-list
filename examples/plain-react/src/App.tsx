import { useState } from "react";
import { DndListNative } from "xmlui-dnd-list/native";

type City = { id: string; name: string; country: string };

const initial: City[] = [
  { id: "berkeley", name: "Berkeley", country: "US" },
  { id: "albany", name: "Albany", country: "US" },
  { id: "tokyo", name: "Tokyo", country: "JP" },
  { id: "vancouver", name: "Vancouver", country: "CA" },
  { id: "lisbon", name: "Lisbon", country: "PT" },
];

export function App() {
  const [cities, setCities] = useState<City[]>(initial);
  const [reorderCount, setReorderCount] = useState(0);

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 480,
        margin: "40px auto",
        padding: 20,
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>xmlui-dnd-list</h1>
      <p style={{ color: "#666", fontSize: 13, marginTop: 0 }}>
        Plain React harness for <code>DndListNative</code>. Drag a row.
        Reorder count: <strong>{reorderCount}</strong>.
      </p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 6,
          padding: 8,
          marginTop: 16,
        }}
      >
        <DndListNative
          items={cities}
          onReorder={(next) => {
            setCities(next as City[]);
            setReorderCount((n) => n + 1);
          }}
          renderItem={(ctx) => {
            const city = ctx.$item as City;
            return (
              <div
                style={{
                  padding: "10px 12px",
                  margin: "4px 0",
                  background: "#fafafa",
                  border: "1px solid #eee",
                  borderRadius: 4,
                  display: "flex",
                  justifyContent: "space-between",
                  userSelect: "none",
                }}
              >
                <span>
                  <span style={{ color: "#aaa", marginRight: 8 }}>⋮⋮</span>
                  {city.name}{" "}
                  <span style={{ color: "#888" }}>({city.country})</span>
                </span>
                <span style={{ color: "#bbb", fontSize: 12 }}>
                  {ctx.$isFirst ? "first" : ctx.$isLast ? "last" : ""}
                </span>
              </div>
            );
          }}
        />
      </div>

      <details style={{ marginTop: 24, fontSize: 13 }}>
        <summary>Current order (state)</summary>
        <pre style={{ background: "#f5f5f5", padding: 8, borderRadius: 4 }}>
          {JSON.stringify(cities.map((c) => c.name), null, 2)}
        </pre>
      </details>
    </div>
  );
}
