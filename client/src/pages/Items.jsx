import { useCallback, useEffect, useState } from "react";

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
const screen = "mx-auto w-[89%] max-w-[1120px] py-10 pb-14 max-[520px]:pt-[30px]";
const card = "rounded-[11px] border border-[#e9efec] bg-white p-[22px] shadow-[0_2px_6px_rgba(27,49,39,0.03)] dark:border-[#2a3931] dark:bg-[#1a241f] max-[520px]:p-[15px]";
const input = "h-[38px] w-full min-w-0 rounded-md border border-[#dfe7e2] bg-white px-[10px] text-[13px] text-[#27372f] outline-none focus:border-[#3a9a70] focus:ring-[3px] focus:ring-[#3a9a70]/[0.12] read-only:bg-[#f7f9f8] read-only:text-[#69766f] dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7] dark:read-only:bg-[#222f28]";
const button = "min-h-9 rounded-md border border-[#dfe7e2] bg-white px-[14px] text-xs font-semibold text-[#435149] hover:border-[#a9cdb9] hover:bg-[#f3f8f5] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7] dark:hover:bg-[#26372e]";
const primaryButton = "border-[#23815c] bg-[#23815c] text-white hover:border-[#1d704f] hover:bg-[#1d704f] dark:border-[#23815c] dark:bg-[#23815c] dark:text-white";
const fieldLabel = "text-xs font-semibold text-[#536159] dark:text-[#b2c0b7]";
const tableHeader = "border-b border-[#edf1ef] bg-[#f7f9f8] px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[0.4px] text-[#728078] dark:border-[#2a3931] dark:bg-[#222f28] dark:text-[#9eada4]";
const tableCell = "whitespace-nowrap border-b border-[#edf1ef] px-3 py-[11px] text-left dark:border-[#2a3931]";

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
    <section className={screen} aria-labelledby="items-title">
      <div className="mb-[22px]">
        <div>
          <p className="eyebrow">MASTERS</p>
          <h1 id="items-title" className="m-0 text-[clamp(24px,3vw,30px)] font-bold tracking-[-1px] text-[#1c2b24] dark:text-[#e3ebe6]">Items</h1>
          <p className="mt-2 text-sm text-[#78857f] dark:text-[#b2c0b7]">Manage item details and product codes.</p>
        </div>
      </div>

      <div className={card}>
        <form
          className="grid grid-cols-[auto_minmax(180px,1fr)_auto] items-center gap-3 border-b border-[#edf1ef] pb-5 dark:border-[#2a3931] max-[520px]:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            findItems(search);
          }}
        >
          <label className={`${fieldLabel} max-[520px]:col-span-2`} htmlFor="item-search">Find by code or name</label>
          <input
            className={input}
            id="item-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Enter code or name"
          />
          <button className={`${button} ${primaryButton}`} type="submit" disabled={loading}>
            Find
          </button>
        </form>

        <form onSubmit={saveItem}>
          <div className="grid grid-cols-4 gap-4 py-5 max-[760px]:grid-cols-2 max-[520px]:grid-cols-1">
            {fields.map((field) => (
              <label className="grid gap-[7px]" key={field.name}>
                <span className={fieldLabel}>{field.label}{field.required && <span className="text-[#ba4b41]"> *</span>}</span>
                <input
                  className={input}
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
            <label className="flex min-h-[38px] items-center gap-2 self-end text-[13px] text-[#536159] dark:text-[#b2c0b7]">
              <input
                className="h-4 w-4 accent-[#23815c]"
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

          <div className="flex flex-wrap gap-[9px] border-b border-[#edf1ef] pb-5 dark:border-[#2a3931]" aria-label="Item actions">
            <button className={button} type="button" onClick={cancel} disabled={loading}>Cancel</button>
            <button className={button} type="button" onClick={startAdd} disabled={loading}>Add</button>
            <button
              className={button}
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
              className={`${button} ${primaryButton}`}
              type="submit"
              disabled={mode === "view" || loading}
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              className={`${button} ml-auto text-[#a8403a] max-[520px]:ml-0`}
              type="button"
              onClick={removeItem}
              disabled={!item.code || mode !== "view" || loading}
            >
              Remove
            </button>
          </div>
        </form>

        {error && <p className="mt-[14px] text-[13px] text-[#b13d36]" role="alert">{error}</p>}
        {notice && <p className="mt-[14px] text-[13px] text-[#23734f]" role="status">{notice}</p>}

        <div className="pt-5">
          <div className="mb-[11px] flex items-center justify-between">
            <h2 className="m-0 text-sm font-semibold text-[#293a31] dark:text-[#e3ebe6]">Item list</h2>
            <span className="text-xs text-[#85918b]">{loading ? "Loading..." : `${items.length} shown`}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th className={tableHeader} scope="col">Code</th>
                  <th className={tableHeader} scope="col">Name</th>
                  <th className={tableHeader} scope="col">Packing</th>
                  <th className={tableHeader} scope="col">Units</th>
                  <th className={tableHeader} scope="col">Company</th>
                  <th className={tableHeader} scope="col">HSN Code</th>
                  <th className={tableHeader} scope="col">Drug Form</th>
                  <th className={tableHeader} scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.code}
                    className={`cursor-pointer text-[#46564e] hover:bg-[#f0f7f3] dark:text-[#b2c0b7] dark:hover:bg-[#26372e] ${item.code === row.code ? "bg-[#f0f7f3] font-semibold text-[#1d704f] dark:bg-[#26372e]" : ""}`}
                    onClick={() => {
                      setItem({ ...emptyItem, ...row, active: Boolean(row.active) });
                      setMode("view");
                      setError("");
                      setNotice("");
                    }}
                  >
                    <td className={tableCell}>{row.code}</td>
                    <td className={tableCell}>{row.name}</td>
                    <td className={tableCell}>{row.packing}</td>
                    <td className={tableCell}>{row.units}</td>
                    <td className={tableCell}>{row.company}</td>
                    <td className={tableCell}>{row.hsnCode}</td>
                    <td className={tableCell}>{row.drugForm}</td>
                    <td className={tableCell}>{row.active ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td className="border-b border-[#edf1ef] p-6 text-center text-[#87928c] dark:border-[#2a3931]" colSpan="8">No items to display.</td>
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
