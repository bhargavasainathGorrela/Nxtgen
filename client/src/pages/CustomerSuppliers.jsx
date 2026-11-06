import { useCallback, useEffect, useState } from "react";
import "./CustomerSuppliers.css";

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
    <section className="account-screen" aria-labelledby="accounts-title">
      <div className="account-heading">
        <div>
          <p className="eyebrow">MASTERS</p>
          <h1 id="accounts-title">Customers / Suppliers</h1>
          <p className="account-description">Manage customer and supplier account details.</p>
        </div>
      </div>

      <div className="account-card">
        <form
          className="account-search"
          onSubmit={(event) => {
            event.preventDefault();
            findAccounts(search);
          }}
        >
          <label htmlFor="account-search">Find by code or name</label>
          <input
            id="account-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Enter code or name"
          />
          <button className="account-button account-button-primary" type="submit" disabled={loading}>
            Find
          </button>
        </form>

        <form className="account-form" onSubmit={saveAccount}>
          <div className="account-fields">
            {fields.map((field) => (
              <label className="account-field" key={field.name}>
                <span>{field.label}{field.required && <span className="required-mark"> *</span>}</span>
                <input
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
            <label className="account-field">
              <span>Show in</span>
              <select
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
            <label className="account-active">
              <input
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

          <div className="account-actions" aria-label="Customer and supplier actions">
            <button className="account-button" type="button" onClick={cancel} disabled={loading}>Cancel</button>
            <button className="account-button" type="button" onClick={startAdd} disabled={loading}>Add</button>
            <button
              className="account-button"
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
              className="account-button account-button-primary"
              type="submit"
              disabled={mode === "view" || loading}
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              className="account-button account-button-danger"
              type="button"
              onClick={removeAccount}
              disabled={!account.code || mode !== "view" || loading}
            >
              Remove
            </button>
          </div>
        </form>

        {error && <p className="account-message account-error" role="alert">{error}</p>}
        {notice && <p className="account-message" role="status">{notice}</p>}

        <div className="account-results">
          <div className="account-results-heading">
            <h2>Customer / Supplier list</h2>
            <span>{loading ? "Loading..." : `${accounts.length} shown`}</span>
          </div>
          <div className="account-table-wrap">
            <table className="account-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">City</th>
                  <th scope="col">Cell</th>
                  <th scope="col">Show in</th>
                  <th scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((row) => (
                  <tr
                    key={row.code}
                    className={account.code === row.code ? "account-row-selected" : ""}
                    onClick={() => selectAccount(row)}
                  >
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.city}</td>
                    <td>{row.cell}</td>
                    <td>{String(row.showin || "").toLowerCase() === "suplier" ? "Supplier" : row.showin}</td>
                    <td>{row.active ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {!loading && accounts.length === 0 && (
                  <tr>
                    <td className="account-empty" colSpan="6">No accounts to display.</td>
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
