import { useCallback, useEffect, useState } from "react";
import "./Items.css";

const API_URL = "http://localhost:5000/api/items";
const emptyItem = {
  code: "",
  name: "",
  active: true,
  packing: "",
  units: "",
  company: "",
  hsnCode: "",
  drugForm: "",
};
const fields = [
  { name: "code", label: "Code", required: true, maxLength: 50 },
  { name: "name", label: "Name", required: true, maxLength: 200 },
  { name: "packing", label: "Packing", maxLength: 100 },
  { name: "units", label: "Units", maxLength: 50 },
  { name: "company", label: "Company", maxLength: 150 },
  { name: "hsnCode", label: "HSN Code", maxLength: 50 },
  { name: "drugForm", label: "Drug Form", maxLength: 100 },
];

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      `Items API returned a non-JSON response (HTTP ${response.status}). Check that the backend is running on port 5000.`,
    );
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
  }
  return data;
}

export default function Items() {
  const [items, setItems] = useState([]);
  const [item, setItem] = useState(emptyItem);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("view");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const findItems = useCallback(async (query = "") => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API_URL}?search=${encodeURIComponent(query)}`,
      );
      const data = await readApiResponse(response);
      setItems(data.items);
      if (data.items.length === 0) setNotice("No matching items.");
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    findItems();
  }, [findItems]);

  const startAdd = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/next-code`);
      const data = await readApiResponse(response);
      setItem({ ...emptyItem, code: data.code });
      setMode("add");
    } catch (requestError) {
      setError(requestError.message || "Unable to generate an item code.");
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setItem(emptyItem);
    setMode("view");
    setError("");
    setNotice("");
  };

  const saveItem = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const isAdding = mode === "add";
    try {
      const response = await fetch(
        isAdding ? API_URL : `${API_URL}/${encodeURIComponent(item.code)}`,
        {
          method: isAdding ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        },
      );
      const data = await readApiResponse(response);
      setItem({ ...emptyItem, ...data.item, active: Boolean(data.item.active) });
      setMode("view");
      await findItems(search);
      setNotice(isAdding ? "Item added." : "Item updated.");
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async () => {
    if (!item.code) return;
    if (!window.confirm(`Remove ${item.name || item.code}?`)) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(item.code)}`,
        { method: "DELETE" },
      );
      await readApiResponse(response);
      setItem(emptyItem);
      setMode("view");
      await findItems(search);
      setNotice("Item removed.");
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const isReadOnly = mode === "view";

  return (
    <section className="item-screen" aria-labelledby="items-title">
      <div className="item-heading">
        <div>
          <p className="eyebrow">MASTERS</p>
          <h1 id="items-title">Items</h1>
          <p className="item-description">Manage item details and product codes.</p>
        </div>
      </div>

      <div className="item-card">
        <form
          className="item-search"
          onSubmit={(event) => {
            event.preventDefault();
            findItems(search);
          }}
        >
          <label htmlFor="item-search">Find by code or name</label>
          <input
            id="item-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Enter code or name"
          />
          <button className="item-button item-button-primary" type="submit" disabled={loading}>
            Find
          </button>
        </form>

        <form className="item-form" onSubmit={saveItem}>
          <div className="item-fields">
            {fields.map((field) => (
              <label className="item-field" key={field.name}>
                <span>{field.label}{field.required && <span className="item-required"> *</span>}</span>
                <input
                  type="text"
                  name={field.name}
                  value={item[field.name] ?? ""}
                  required={field.required}
                  maxLength={field.maxLength}
                  readOnly={isReadOnly || field.name === "code"}
                  onChange={(event) =>
                    setItem((current) => ({ ...current, [field.name]: event.target.value }))
                  }
                />
              </label>
            ))}
            <label className="item-active">
              <input
                type="checkbox"
                checked={Boolean(item.active)}
                disabled={isReadOnly}
                onChange={(event) =>
                  setItem((current) => ({ ...current, active: event.target.checked }))
                }
              />
              <span>Active</span>
            </label>
          </div>

          <div className="item-actions" aria-label="Item actions">
            <button className="item-button" type="button" onClick={cancel} disabled={loading}>Cancel</button>
            <button className="item-button" type="button" onClick={startAdd} disabled={loading}>Add</button>
            <button
              className="item-button"
              type="button"
              onClick={() => {
                setMode("edit");
                setError("");
                setNotice("");
              }}
              disabled={!item.code || mode !== "view" || loading}
            >
              Edit
            </button>
            <button
              className="item-button item-button-primary"
              type="submit"
              disabled={mode === "view" || loading}
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              className="item-button item-button-danger"
              type="button"
              onClick={removeItem}
              disabled={!item.code || mode !== "view" || loading}
            >
              Remove
            </button>
          </div>
        </form>

        {error && <p className="item-message item-error" role="alert">{error}</p>}
        {notice && <p className="item-message" role="status">{notice}</p>}

        <div className="item-results">
          <div className="item-results-heading">
            <h2>Item list</h2>
            <span>{loading ? "Loading..." : `${items.length} shown`}</span>
          </div>
          <div className="item-table-wrap">
            <table className="item-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Packing</th>
                  <th scope="col">Units</th>
                  <th scope="col">Company</th>
                  <th scope="col">HSN Code</th>
                  <th scope="col">Drug Form</th>
                  <th scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.code}
                    className={item.code === row.code ? "item-row-selected" : ""}
                    onClick={() => {
                      setItem({ ...emptyItem, ...row, active: Boolean(row.active) });
                      setMode("view");
                      setError("");
                      setNotice("");
                    }}
                  >
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.packing}</td>
                    <td>{row.units}</td>
                    <td>{row.company}</td>
                    <td>{row.hsnCode}</td>
                    <td>{row.drugForm}</td>
                    <td>{row.active ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td className="item-empty" colSpan="8">No items to display.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
