import { useCallback, useEffect, useState } from "react";

const API_URL = "http://localhost:5000/api/accounts";
async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    if (response.status === 404) {
      throw new Error(
        "Accounts API route not found (HTTP 404). Restart the backend from the server folder with npm start.",
      );
    }
    throw new Error(
      `Accounts API returned a non-JSON response (HTTP ${response.status}). Check that the backend is running on port 5000.`,
    );
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
  }
  return data;
}

const emptyAccount = {
  code: "",
  name: "",
  doorno: "",
  street: "",
  area: "",
  city: "",
  phone: "",
  cell: "",
  mailid: "",
  active: true,
  showin: "customer",
};
const fields = [
  { name: "code", label: "Code", required: true },
  { name: "name", label: "Name", required: true },
  { name: "doorno", label: "Door no." },
  { name: "street", label: "Street" },
  { name: "area", label: "Area" },
  { name: "city", label: "City" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "cell", label: "Cell", type: "tel" },
  { name: "mailid", label: "Mail ID", type: "email" },
];
const screen = "mx-auto w-[89%] max-w-[1120px] py-10 pb-14 max-[520px]:pt-[30px]";
const card = "rounded-[11px] border border-[#e9efec] bg-white p-[22px] shadow-[0_2px_6px_rgba(27,49,39,0.03)] dark:border-[#2a3931] dark:bg-[#1a241f] max-[520px]:p-[15px]";
const input = "h-[38px] w-full min-w-0 rounded-md border border-[#dfe7e2] bg-white px-[10px] text-[13px] text-[#27372f] outline-none focus:border-[#3a9a70] focus:ring-[3px] focus:ring-[#3a9a70]/[0.12] read-only:bg-[#f7f9f8] read-only:text-[#69766f] dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7] dark:read-only:bg-[#222f28]";
const button = "min-h-9 rounded-md border border-[#dfe7e2] bg-white px-[14px] text-xs font-semibold text-[#435149] hover:border-[#a9cdb9] hover:bg-[#f3f8f5] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7] dark:hover:bg-[#26372e]";
const primaryButton = "border-[#23815c] bg-[#23815c] text-white hover:border-[#1d704f] hover:bg-[#1d704f] dark:border-[#23815c] dark:bg-[#23815c] dark:text-white";
const fieldLabel = "text-xs font-semibold text-[#536159] dark:text-[#b2c0b7]";
const tableHeader = "border-b border-[#edf1ef] bg-[#f7f9f8] px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[0.4px] text-[#728078] dark:border-[#2a3931] dark:bg-[#222f28] dark:text-[#9eada4]";
const tableCell = "whitespace-nowrap border-b border-[#edf1ef] px-3 py-[11px] text-left dark:border-[#2a3931]";

export default function CustomerSuppliers() {
  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState(emptyAccount);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("view");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const findAccounts = useCallback(async (query = "") => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API_URL}?search=${encodeURIComponent(query)}`,
      );
      const data = await readApiResponse(response);
      setAccounts(data.accounts);
      if (data.accounts.length === 0) setNotice("No matching customers or suppliers.");
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    findAccounts();
  }, [findAccounts]);

  const selectAccount = (selectedAccount) => {
    setAccount({ ...emptyAccount, ...selectedAccount, active: Boolean(selectedAccount.active) });
    setMode("view");
    setError("");
    setNotice("");
  };

  const startAdd = () => {
    setAccount(emptyAccount);
    setMode("add");
    setError("");
    setNotice("");
  };

  const cancel = () => {
    setAccount(emptyAccount);
    setMode("view");
    setError("");
    setNotice("");
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const isAdding = mode === "add";
    try {
      const response = await fetch(
        isAdding ? API_URL : `${API_URL}/${encodeURIComponent(account.code)}`,
        {
          method: isAdding ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(account),
        },
      );
      const data = await readApiResponse(response);
      setAccount({ ...emptyAccount, ...data.account, active: Boolean(data.account.active) });
      setMode("view");
      await findAccounts(search);
      setNotice(isAdding ? "Customer/supplier added." : "Customer/supplier updated.");
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const removeAccount = async () => {
    if (!account.code) return;
    if (!window.confirm(`Remove ${account.name || account.code}?`)) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(account.code)}`,
        { method: "DELETE" },
      );
      await readApiResponse(response);
      setAccount(emptyAccount);
      setMode("view");
      await findAccounts(search);
      setNotice("Customer/supplier removed.");
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const isEditing = mode === "edit";
  const isReadOnly = mode === "view";

  return (
    <section className={screen} aria-labelledby="accounts-title">
      <div className="mb-[22px]">
        <div>
          <p className="eyebrow">MASTERS</p>
          <h1 id="accounts-title" className="m-0 text-[clamp(24px,3vw,30px)] font-bold tracking-[-1px] text-[#1c2b24] dark:text-[#e3ebe6]">Customers / Suppliers</h1>
          <p className="mt-2 text-sm text-[#78857f] dark:text-[#b2c0b7]">Manage customer and supplier account details.</p>
        </div>
      </div>

      <div className={card}>
        <form
          className="grid grid-cols-[auto_minmax(180px,1fr)_auto] items-center gap-3 border-b border-[#edf1ef] pb-5 dark:border-[#2a3931] max-[520px]:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            findAccounts(search);
          }}
        >
          <label className={`${fieldLabel} max-[520px]:col-span-2`} htmlFor="account-search">Find by code or name</label>
          <input
            className={input}
            id="account-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Enter code or name"
          />
          <button className={`${button} ${primaryButton}`} type="submit" disabled={loading}>
            Find
          </button>
        </form>

        <form onSubmit={saveAccount}>
          <div className="grid grid-cols-4 gap-4 py-5 max-[760px]:grid-cols-2 max-[520px]:grid-cols-1">
            {fields.map((field) => (
              <label className="grid gap-[7px]" key={field.name}>
                <span className={fieldLabel}>{field.label}{field.required && <span className="text-[#ba4b41]"> *</span>}</span>
                <input
                  className={input}
                  type={field.type || "text"}
                  name={field.name}
                  value={account[field.name] ?? ""}
                  required={field.required}
                  readOnly={isReadOnly || (isEditing && field.name === "code")}
                  onChange={(event) =>
                    setAccount((current) => ({ ...current, [field.name]: event.target.value }))
                  }
                />
              </label>
            ))}
            <label className="grid gap-[7px]">
              <span className={fieldLabel}>Show in</span>
              <select
                className={input}
                name="showin"
                value={account.showin}
                disabled={isReadOnly}
                onChange={(event) =>
                  setAccount((current) => ({ ...current, showin: event.target.value }))
                }
              >
                <option value="customer">Customer</option>
                <option value="suplier">Supplier</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="flex min-h-[38px] items-center gap-2 self-end text-[13px] text-[#536159] dark:text-[#b2c0b7]">
              <input
                className="h-4 w-4 accent-[#23815c]"
                type="checkbox"
                checked={Boolean(account.active)}
                disabled={isReadOnly}
                onChange={(event) =>
                  setAccount((current) => ({ ...current, active: event.target.checked }))
                }
              />
              <span>Active</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-[9px] border-b border-[#edf1ef] pb-5 dark:border-[#2a3931]" aria-label="Customer and supplier actions">
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
              disabled={!account.code || mode !== "view" || loading}
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
              onClick={removeAccount}
              disabled={!account.code || mode !== "view" || loading}
            >
              Remove
            </button>
          </div>
        </form>

        {error && <p className="mt-[14px] text-[13px] text-[#b13d36]" role="alert">{error}</p>}
        {notice && <p className="mt-[14px] text-[13px] text-[#23734f]" role="status">{notice}</p>}

        <div className="pt-5">
          <div className="mb-[11px] flex items-center justify-between">
            <h2 className="m-0 text-sm font-semibold text-[#293a31] dark:text-[#e3ebe6]">Customer / Supplier list</h2>
            <span className="text-xs text-[#85918b]">{loading ? "Loading..." : `${accounts.length} shown`}</span>
          </div>
          <div className="hidden overflow-x-auto min-[1024px]:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th className={tableHeader} scope="col">Code</th>
                  <th className={tableHeader} scope="col">Name</th>
                  <th className={tableHeader} scope="col">City</th>
                  <th className={tableHeader} scope="col">Cell</th>
                  <th className={tableHeader} scope="col">Show in</th>
                  <th className={tableHeader} scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((row) => (
                  <tr
                    key={row.code}
                    className={`cursor-pointer text-[#46564e] hover:bg-[#f0f7f3] dark:text-[#b2c0b7] dark:hover:bg-[#26372e] ${account.code === row.code ? "bg-[#f0f7f3] font-semibold text-[#1d704f] dark:bg-[#26372e]" : ""}`}
                    onClick={() => selectAccount(row)}
                  >
                    <td className={tableCell}>{row.code}</td>
                    <td className={tableCell}>{row.name}</td>
                    <td className={tableCell}>{row.city}</td>
                    <td className={tableCell}>{row.cell}</td>
                    <td className={tableCell}>{String(row.showin || "").toLowerCase() === "suplier" ? "Supplier" : row.showin}</td>
                    <td className={tableCell}>{row.active ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {!loading && accounts.length === 0 && (
                  <tr>
                    <td className="border-b border-[#edf1ef] p-6 text-center text-[#87928c] dark:border-[#2a3931]" colSpan="6">No accounts to display.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 min-[1024px]:hidden">
            {accounts.map((row) => (
              <button
                type="button"
                key={row.code}
                className={`grid min-w-0 gap-2 rounded-lg border p-3 text-left ${
                  account.code === row.code
                    ? "border-[#23815c] bg-[#f0f7f3] dark:bg-[#26372e]"
                    : "border-[#e9efec] bg-white hover:bg-[#f7f9f8] dark:border-[#2a3931] dark:bg-[#1a241f] dark:hover:bg-[#26372e]"
                }`}
                onClick={() => selectAccount(row)}
              >
                <span className="break-words font-semibold text-[#1d704f] dark:text-[#8bd1ac]">{row.code} · {row.name}</span>
                <span className="break-words text-xs text-[#536159] dark:text-[#b2c0b7]">
                  {[row.city, row.cell, String(row.showin || "").toLowerCase() === "suplier" ? "Supplier" : row.showin, row.active ? "Active" : "Inactive"].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
            {!loading && accounts.length === 0 && (
              <p className="m-0 p-6 text-center text-sm text-[#87928c]">No accounts to display.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
