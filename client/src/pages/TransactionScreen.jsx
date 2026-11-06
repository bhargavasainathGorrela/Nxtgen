import { useCallback, useEffect, useRef, useState } from "react";
import "./TransactionScreen.css";

const API_URL = "http://localhost:5000/api/transactions";
const TRANSACTION_TYPES = {
  sale: { title: "Sale", accountType: "customer", hasImport: false },
  purchase: { title: "Purchase", accountType: "supplier", hasImport: true },
  saleReturn: { title: "Sale Return", accountType: "customer", hasImport: false },
  purchaseReturn: { title: "Purchase Return", accountType: "supplier", hasImport: false },
};

function emptyLine() {
  return {
    itemCode: "",
    itemName: "",
    price: 0,
    qty: 0,
    free: 0,
    expYear: "",
    expMonth: "",
    amount: 0,
  };
}

function emptyTransaction(numbers = {}) {
  return {
    id: null,
    accountCode: "",
    name: "",
    doorNo: "",
    street: "",
    area: "",
    city: "",
    phone: "",
    cell: "",
    mailId: "",
    billType: "cash",
    invoiceNo: numbers.invoiceNo || "",
    feedNo: numbers.feedNo || "",
    discountPercent: 0,
    discountAmount: 0,
    schemeAmount: 0,
    cgst: 0,
    sgst: 0,
    lines: [emptyLine()],
  };
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      `Transactions API returned a non-JSON response (HTTP ${response.status}). Check that the backend is running on port 5000.`,
    );
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
  }
  return data;
}

function numericValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineAmount(line) {
  return Number((numericValue(line.price) * numericValue(line.qty)).toFixed(2));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new Error("The CSV file has an unclosed quoted field.");
  if (rows.length < 2) throw new Error("The CSV file must contain a header and at least one item row.");

  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const column = (...names) => headers.findIndex((header) => names.includes(header));
  const columns = {
    itemCode: column("itemcode", "code", "productcode"),
    itemName: column("itemname", "name", "productname"),
    price: column("price", "rate"),
    qty: column("qty", "quantity"),
    free: column("free", "freeqty"),
    expYear: column("expyear", "expiryyear", "year"),
    expMonth: column("expmonth", "expirymonth", "month"),
    amount: column("amount", "lineamount"),
  };
  if (columns.itemCode < 0 && columns.itemName < 0) {
    throw new Error("The CSV needs an itemCode or itemName column.");
  }

  return rows.slice(1).map((cells) => {
    const value = (key) => columns[key] < 0 ? "" : cells[columns[key]] || "";
    const line = {
      ...emptyLine(),
      itemCode: value("itemCode"),
      itemName: value("itemName"),
      price: numericValue(value("price")),
      qty: numericValue(value("qty")),
      free: numericValue(value("free")),
      expYear: value("expYear"),
      expMonth: value("expMonth"),
    };
    line.amount = columns.amount < 0 ? lineAmount(line) : numericValue(value("amount"));
    return line;
  }).filter((line) => line.itemCode || line.itemName);
}

export default function TransactionScreen({ type, onClose }) {
  const config = TRANSACTION_TYPES[type];
  const [accounts, setAccounts] = useState([]);
  const [items, setItems] = useState([]);
  const [transaction, setTransaction] = useState(() => emptyTransaction());
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("add");
  const [minimized, setMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef(null);
  const lineTotal = transaction.lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const gstTotal = numericValue(transaction.cgst) + numericValue(transaction.sgst);
  const netAmount =
    lineTotal -
    numericValue(transaction.discountAmount) -
    numericValue(transaction.schemeAmount) +
    gstTotal;

  const findTransactions = useCallback(async (query = "") => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API_URL}?type=${type}&search=${encodeURIComponent(query)}`,
      );
      const data = await readApiResponse(response);
      setTransactions(data.transactions);
      if (data.transactions.length === 0) setNotice(`No matching ${config.title.toLowerCase()} records.`);
    } catch (requestError) {
      setError(requestError.message || "Unable to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [type, config.title]);

  const startNew = useCallback(async (lines) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/next-numbers?type=${type}`);
      const data = await readApiResponse(response);
      setTransaction({ ...emptyTransaction(data), ...(lines ? { lines } : {}) });
      setMode("add");
      return true;
    } catch (requestError) {
      setError(requestError.message || "Unable to generate transaction numbers.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    let active = true;
    const loadScreen = async () => {
      setLoading(true);
      setError("");
      try {
        const [accountsResponse, itemsResponse, nextResponse] = await Promise.all([
          fetch(`${API_URL}/accounts?type=${type}`),
          fetch("http://localhost:5000/api/items?search="),
          fetch(`${API_URL}/next-numbers?type=${type}`),
        ]);
        const [accountData, itemData, numberData] = await Promise.all([
          readApiResponse(accountsResponse),
          readApiResponse(itemsResponse),
          readApiResponse(nextResponse),
        ]);
        if (!active) return;
        setAccounts(accountData.accounts);
        setItems(itemData.items);
        setTransaction(emptyTransaction(numberData));
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load transaction details.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadScreen();
    findTransactions();
    return () => {
      active = false;
    };
  }, [type, findTransactions]);

  const selectAccount = (accountCode, selectedAccount) => {
    const selected = selectedAccount || accounts.find((account) => account.code === accountCode);
    setTransaction((current) => ({
      ...current,
      accountCode,
      name: selected?.name || "",
      doorNo: selected?.doorno || "",
      street: selected?.street || "",
      area: selected?.area || "",
      city: selected?.city || "",
      phone: selected?.phone || "",
      cell: selected?.cell || "",
      mailId: selected?.mailid || "",
    }));
  };

  const resolveAccount = async () => {
    const accountCode = transaction.accountCode.trim();
    if (!accountCode || accounts.some((account) => account.code === accountCode)) return;
    try {
      const response = await fetch(
        `${API_URL}/accounts?type=${type}&search=${encodeURIComponent(accountCode)}`,
      );
      const data = await readApiResponse(response);
      const selected = data.accounts.find((account) => account.code === accountCode);
      if (!selected) {
        setError(`No eligible account found with code ${accountCode}.`);
        return;
      }
      setAccounts((current) => [
        ...current.filter((account) => account.code !== selected.code),
        selected,
      ]);
      selectAccount(selected.code, selected);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Unable to find the account.");
    }
  };

  const resolveItemCode = async (index, itemCode) => {
    if (!itemCode || items.some((item) => item.code === itemCode)) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/items?search=${encodeURIComponent(itemCode)}`,
      );
      const data = await readApiResponse(response);
      const selected = data.items.find((item) => item.code === itemCode);
      if (!selected) {
        setError(`No item found with code ${itemCode}.`);
        return;
      }
      setItems((current) => [
        ...current.filter((item) => item.code !== selected.code),
        selected,
      ]);
      setTransaction((current) => ({
        ...current,
        lines: current.lines.map((line, lineIndex) => (
          lineIndex === index && line.itemCode === itemCode
            ? {
              ...line,
              itemName: selected.name,
              price: selected.price === undefined ? line.price : numericValue(selected.price),
            }
            : line
        )),
      }));
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Unable to find the item.");
    }
  };

  const updateLine = (index, field, value) => {
    setTransaction((current) => {
      const lines = current.lines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const nextLine = { ...line, [field]: value };
        if (field === "itemCode") {
          const selected = items.find((item) => item.code === value);
          nextLine.itemName = selected?.name || "";
          if (selected) {
            nextLine.price = numericValue(selected.price);
          }
        }
        nextLine.amount = lineAmount(nextLine);
        return nextLine;
      });
      const gross = lines.reduce((sum, line) => sum + lineAmount(line), 0);
      const discountAmount = numericValue(current.discountPercent) > 0
        ? gross * numericValue(current.discountPercent) / 100
        : current.discountAmount;
      return { ...current, lines, discountAmount };
    });
  };

  const updateTotals = (field, value) => {
    setTransaction((current) => {
      if (field === "discountPercent") {
        const gross = current.lines.reduce((sum, line) => sum + lineAmount(line), 0);
        return {
          ...current,
          discountPercent: value,
          discountAmount: gross * numericValue(value) / 100,
        };
      }
      if (field === "discountAmount") {
        return { ...current, discountPercent: 0, discountAmount: value };
      }
      return { ...current, [field]: value };
    });
  };

  const selectTransaction = async (id) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/${type}/${id}`);
      const data = await readApiResponse(response);
      setTransaction(data.transaction);
      setMode("view");
    } catch (requestError) {
      setError(requestError.message || "Unable to load the transaction.");
    } finally {
      setLoading(false);
    }
  };

  const saveTransaction = async (event) => {
    event.preventDefault();
    const lines = transaction.lines.filter((line) => line.itemCode || line.itemName);
    if (!transaction.accountCode) {
      setError("Select an account before saving.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one item before saving.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    const isAdding = mode === "add";
    try {
      const response = await fetch(
        isAdding
          ? `${API_URL}/${type}`
          : `${API_URL}/${type}/${transaction.id}`,
        {
          method: isAdding ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...transaction, lines }),
        },
      );
      const data = await readApiResponse(response);
      setTransaction(data.transaction);
      setMode("view");
      await findTransactions(search);
      setNotice(isAdding ? `${config.title} saved.` : `${config.title} updated.`);
    } catch (requestError) {
      setError(requestError.message || "Unable to save the transaction.");
    } finally {
      setLoading(false);
    }
  };

  const removeTransaction = async () => {
    if (!transaction.id) return;
    if (!window.confirm(`Remove ${config.title} ${transaction.invoiceNo}?`)) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/${type}/${transaction.id}`, {
        method: "DELETE",
      });
      await readApiResponse(response);
      await findTransactions(search);
      await startNew();
      setNotice(`${config.title} removed.`);
    } catch (requestError) {
      setError(requestError.message || "Unable to remove the transaction.");
    } finally {
      setLoading(false);
    }
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const lines = parseCsv(await file.text());
      if (mode === "add") {
        setTransaction((current) => {
          const gross = lines.reduce((sum, line) => sum + lineAmount(line), 0);
          return {
            ...current,
            lines,
            discountAmount: numericValue(current.discountPercent) > 0
              ? gross * numericValue(current.discountPercent) / 100
              : current.discountAmount,
          };
        });
        setNotice(`${lines.length} item rows imported.`);
      } else {
        if (await startNew(lines)) setNotice(`${lines.length} item rows imported.`);
      }
      setError("");
    } catch (importError) {
      setError(importError.message || "Unable to import the CSV file.");
    }
  };

  if (minimized) {
    return (
      <section className="transaction-minimized" aria-label={`${config.title} minimized`}>
        <span>{config.title} is minimized</span>
        <button type="button" className="transaction-button" onClick={() => setMinimized(false)}>Restore</button>
        <button type="button" className="transaction-button transaction-close-button" onClick={onClose}>Close</button>
      </section>
    );
  }

  const isReadOnly = mode === "view";

  return (
    <section className="transaction-screen" aria-labelledby="transaction-title">
      <div className="transaction-heading">
        <div>
          <p className="eyebrow">TRANSACTIONS</p>
          <h1 id="transaction-title">{config.title}</h1>
          <p className="transaction-description">Enter and manage {config.title.toLowerCase()} invoices.</p>
        </div>
        <div className="transaction-window-controls">
          <button type="button" className="transaction-window-button" aria-label="Minimize screen" title="Minimize" onClick={() => setMinimized(true)}>−</button>
          <button type="button" className="transaction-window-button transaction-window-close" aria-label="Close screen" title="Close" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="transaction-card">
        <form
          className="transaction-search"
          onSubmit={(event) => {
            event.preventDefault();
            findTransactions(search);
          }}
        >
          <label htmlFor={`transaction-search-${type}`}>Find by invoice, feed no. or account</label>
          <input
            id={`transaction-search-${type}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Enter invoice, feed number or account"
          />
          <button className="transaction-button transaction-button-primary" type="submit" disabled={loading}>Find</button>
        </form>

        <form className="transaction-form" onSubmit={saveTransaction}>
          <div className="transaction-header-fields">
            <label className="transaction-field">
              <span>Code <b>*</b></span>
              <input
                list={`transaction-accounts-${type}`}
                value={transaction.accountCode}
                required
                readOnly={isReadOnly}
                maxLength={50}
                onChange={(event) => selectAccount(event.target.value)}
                onBlur={resolveAccount}
                placeholder="Select account code"
              />
              <datalist id={`transaction-accounts-${type}`}>
                {accounts.map((account) => (
                  <option key={account.code} value={account.code}>{account.name}</option>
                ))}
              </datalist>
            </label>
            <label className="transaction-field transaction-field-wide">
              <span>Name</span>
              <input value={transaction.name} readOnly />
            </label>
            <label className="transaction-field">
              <span>Door No</span>
              <input value={transaction.doorNo} readOnly />
            </label>
            <label className="transaction-field">
              <span>Street</span>
              <input value={transaction.street} readOnly />
            </label>
            <label className="transaction-field">
              <span>Area</span>
              <input value={transaction.area} readOnly />
            </label>
            <label className="transaction-field">
              <span>City</span>
              <input value={transaction.city} readOnly />
            </label>
            <label className="transaction-field">
              <span>Phone</span>
              <input value={transaction.phone} readOnly />
            </label>
            <label className="transaction-field">
              <span>Cell</span>
              <input value={transaction.cell} readOnly />
            </label>
            <label className="transaction-field">
              <span>Mail ID</span>
              <input value={transaction.mailId} readOnly />
            </label>
            <label className="transaction-field">
              <span>Bill Type</span>
              <select
                value={transaction.billType}
                disabled={isReadOnly}
                onChange={(event) => setTransaction((current) => ({ ...current, billType: event.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="upi">UPI</option>
              </select>
            </label>
            <label className="transaction-field">
              <span>Invoice Number</span>
              <input value={transaction.invoiceNo} readOnly />
            </label>
            <label className="transaction-field">
              <span>Feed No</span>
              <input value={transaction.feedNo} readOnly />
            </label>
          </div>

          <div className="transaction-items-heading">
            <h2>Items</h2>
            <span>{transaction.lines.filter((line) => line.itemCode || line.itemName).length} rows</span>
          </div>
          <div className="transaction-table-wrap">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Free</th>
                  <th>Exp Yr</th>
                  <th>Exp Month</th>
                  <th>Amount</th>
                  {!isReadOnly && <th className="transaction-action-column">Action</th>}
                </tr>
              </thead>
              <tbody>
                {transaction.lines.map((line, index) => (
                  <tr key={`${line.id || "new"}-${index}`}>
                    <td>
                      <input
                        list={`transaction-items-${type}`}
                        value={line.itemCode}
                        readOnly={isReadOnly}
                        maxLength={50}
                        onChange={(event) => updateLine(index, "itemCode", event.target.value)}
                        onBlur={(event) => resolveItemCode(index, event.target.value.trim())}
                        aria-label={`Item code row ${index + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        value={line.itemName}
                        readOnly={isReadOnly || Boolean(line.itemCode)}
                        maxLength={200}
                        onChange={(event) => updateLine(index, "itemName", event.target.value)}
                        aria-label={`Item name row ${index + 1}`}
                      />
                    </td>
                    {["price", "qty", "free", "expYear", "expMonth"].map((field) => (
                      <td key={field}>
                        <input
                          type="number"
                          min="0"
                          step={field === "expYear" || field === "expMonth" ? "1" : "0.01"}
                          value={line[field]}
                          readOnly={isReadOnly}
                          onChange={(event) => updateLine(index, field, event.target.value)}
                          aria-label={`${field} row ${index + 1}`}
                        />
                      </td>
                    ))}
                    <td className="transaction-amount-cell">{lineAmount(line).toFixed(2)}</td>
                    {!isReadOnly && (
                      <td className="transaction-action-column">
                        <button
                          type="button"
                          className="transaction-remove-line"
                          aria-label={`Remove item row ${index + 1}`}
                          onClick={() => setTransaction((current) => {
                            const lines = current.lines.length === 1
                              ? [emptyLine()]
                              : current.lines.filter((_, lineIndex) => lineIndex !== index);
                            const gross = lines.reduce((sum, line) => sum + lineAmount(line), 0);
                            return {
                              ...current,
                              lines,
                              discountAmount: numericValue(current.discountPercent) > 0
                                ? gross * numericValue(current.discountPercent) / 100
                                : current.discountAmount,
                            };
                          })}
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!isReadOnly && (
                  <tr className="transaction-add-row">
                    <td colSpan="9">
                      <button
                        type="button"
                        className="transaction-add-line"
                        onClick={() => setTransaction((current) => ({ ...current, lines: [...current.lines, emptyLine()] }))}
                      >
                        + Add item row
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <datalist id={`transaction-items-${type}`}>
            {items.map((item) => (
              <option key={item.code} value={item.code}>{item.name}</option>
            ))}
          </datalist>

          <div className="transaction-footer">
            <label className="transaction-field">
              <span>Dis%</span>
              <input type="number" min="0" step="0.01" value={transaction.discountPercent} readOnly={isReadOnly} onChange={(event) => updateTotals("discountPercent", event.target.value)} />
            </label>
            <label className="transaction-field">
              <span>Dis Amt</span>
              <input type="number" min="0" step="0.01" value={transaction.discountAmount} readOnly={isReadOnly} onChange={(event) => updateTotals("discountAmount", event.target.value)} />
            </label>
            <label className="transaction-field">
              <span>Schamt</span>
              <input type="number" min="0" step="0.01" value={transaction.schemeAmount} readOnly={isReadOnly} onChange={(event) => updateTotals("schemeAmount", event.target.value)} />
            </label>
            <label className="transaction-field">
              <span>CGST</span>
              <input type="number" min="0" step="0.01" value={transaction.cgst} readOnly={isReadOnly} onChange={(event) => updateTotals("cgst", event.target.value)} />
            </label>
            <label className="transaction-field">
              <span>SGST</span>
              <input type="number" min="0" step="0.01" value={transaction.sgst} readOnly={isReadOnly} onChange={(event) => updateTotals("sgst", event.target.value)} />
            </label>
            <label className="transaction-field">
              <span>Total GST</span>
              <input value={gstTotal.toFixed(2)} readOnly />
            </label>
            <label className="transaction-field transaction-net-field">
              <span>Net Amt</span>
              <input value={netAmount.toFixed(2)} readOnly />
            </label>
            <label className="transaction-field">
              <span>Gross</span>
              <input value={lineTotal.toFixed(2)} readOnly />
            </label>
          </div>

          <div className="transaction-actions" aria-label={`${config.title} actions`}>
            <button type="button" className="transaction-button" onClick={() => startNew()} disabled={loading}>Cancel</button>
            {config.hasImport && (
              <>
                <input ref={fileInputRef} className="transaction-file-input" type="file" accept=".csv,text/csv" onChange={importCsv} />
                <button type="button" className="transaction-button" onClick={() => fileInputRef.current?.click()} disabled={loading}>Import</button>
                <span className="transaction-import-hint">CSV columns: itemCode, itemName, price, qty, free, expYear, expMonth, amount</span>
              </>
            )}
            <button type="button" className="transaction-button" onClick={() => setMode("edit")} disabled={!transaction.id || mode !== "view" || loading}>Edit</button>
            <button type="button" className="transaction-button" onClick={() => window.print()} disabled={loading}>Print</button>
            <button type="submit" className="transaction-button transaction-button-primary" disabled={mode === "view" || loading}>{loading ? "Saving..." : "Save"}</button>
            <button type="button" className="transaction-button transaction-button-danger" onClick={removeTransaction} disabled={!transaction.id || mode !== "view" || loading}>Remove</button>
          </div>
        </form>

        {error && <p className="transaction-message transaction-error" role="alert">{error}</p>}
        {notice && <p className="transaction-message" role="status">{notice}</p>}

        <div className="transaction-results">
          <div className="transaction-items-heading">
            <h2>{config.title} records</h2>
            <span>{loading ? "Loading..." : `${transactions.length} shown`}</span>
          </div>
          <div className="transaction-table-wrap">
            <table className="transaction-table transaction-records-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Feed No.</th>
                  <th>Account</th>
                  <th>Bill Type</th>
                  <th>Net Amt</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((row) => (
                  <tr key={row.id} className={transaction.id === row.id ? "transaction-row-selected" : ""} onClick={() => selectTransaction(row.id)}>
                    <td>{row.invoiceNo}</td>
                    <td>{row.feedNo}</td>
                    <td>{row.name}</td>
                    <td>{row.billType}</td>
                    <td>{numericValue(row.netAmount).toFixed(2)}</td>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ""}</td>
                  </tr>
                ))}
                {!loading && transactions.length === 0 && (
                  <tr><td className="transaction-empty" colSpan="6">No transactions to display.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
