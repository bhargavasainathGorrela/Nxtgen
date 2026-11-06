import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:5000/api/transactions";
const TRANSACTION_TYPES = {
  sale: { title: "Sale", accountType: "customer", hasImport: false },
  purchase: { title: "Purchase", accountType: "supplier", hasImport: true },
  saleReturn: { title: "Sale Return", accountType: "customer", hasImport: false },
  purchaseReturn: { title: "Purchase Return", accountType: "supplier", hasImport: false },
};
const screen = "mx-auto w-[94%] max-w-[1320px] py-8 pb-12 max-[520px]:pt-6";
const card = "rounded-[11px] border border-[#e9efec] bg-white p-5 shadow-[0_2px_6px_rgba(27,49,39,0.03)] dark:border-[#2a3931] dark:bg-[#1a241f] max-[520px]:p-[13px]";
const button = "min-h-9 rounded-md border border-[#dfe7e2] bg-white px-[14px] text-xs font-semibold text-[#435149] hover:border-[#a9cdb9] hover:bg-[#f3f8f5] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7] dark:hover:bg-[#26372e]";
const primaryButton = "border-[#23815c] bg-[#23815c] text-white hover:border-[#1d704f] hover:bg-[#1d704f] dark:border-[#23815c] dark:bg-[#23815c] dark:text-white";
const input = "h-9 w-full min-w-0 rounded-md border border-[#dfe7e2] bg-white px-[9px] text-xs text-[#27372f] outline-none focus:border-[#3a9a70] focus:ring-[3px] focus:ring-[#3a9a70]/[0.12] read-only:bg-[#f7f9f8] read-only:text-[#69766f] disabled:bg-[#f7f9f8] dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7] dark:read-only:bg-[#222f28] dark:disabled:bg-[#222f28] print:border-0 print:bg-transparent print:text-black";
const fieldLabel = "text-xs font-semibold text-[#536159] dark:text-[#b2c0b7]";
const tableHeader = "border-b border-[#edf1ef] bg-[#f7f9f8] px-[7px] py-[7px] text-left text-[10px] font-semibold uppercase tracking-[0.35px] text-[#728078] dark:border-[#2a3931] dark:bg-[#222f28] dark:text-[#9eada4]";
const tableCell = "min-w-[78px] whitespace-nowrap border-b border-[#edf1ef] p-[7px] dark:border-[#2a3931]";

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

  const removeLine = (index) => {
    setTransaction((current) => {
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
    });
  };

  const addLine = () => {
    setTransaction((current) => ({ ...current, lines: [...current.lines, emptyLine()] }));
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
      <section className="mx-auto my-4 flex w-[94%] max-w-[1320px] items-center justify-end gap-2 rounded-lg border border-[#e9efec] bg-white p-3 text-[#536159] dark:border-[#2a3931] dark:bg-[#1a241f] dark:text-[#d3ded7]" aria-label={`${config.title} minimized`}>
        <span className="mr-auto text-[13px] font-semibold">{config.title} is minimized</span>
        <button type="button" className={button} onClick={() => setMinimized(false)}>Restore</button>
        <button type="button" className={`${button} text-[#a8403a]`} onClick={onClose}>Close</button>
      </section>
    );
  }

  const isReadOnly = mode === "view";

  return (
    <section className={screen} aria-labelledby="transaction-title">
      <div className="mb-[18px] flex items-start justify-between">
        <div>
          <p className="eyebrow">TRANSACTIONS</p>
          <h1 id="transaction-title" className="m-0 text-[clamp(24px,3vw,30px)] font-bold tracking-[-1px] text-[#1c2b24] dark:text-[#e3ebe6]">{config.title}</h1>
          <p className="mt-2 text-sm text-[#78857f] dark:text-[#b2c0b7]">Enter and manage {config.title.toLowerCase()} invoices.</p>
        </div>
        <div className="flex gap-[7px] print:hidden">
          <button type="button" className="grid h-[34px] w-[34px] place-items-center rounded-md border border-[#dfe7e2] bg-white text-[21px] text-[#536159] hover:bg-[#f3f8f5] dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7]" aria-label="Minimize screen" title="Minimize" onClick={() => setMinimized(true)}>−</button>
          <button type="button" className="grid h-[34px] w-[34px] place-items-center rounded-md border border-[#dfe7e2] bg-white text-[21px] text-[#a8403a] hover:bg-[#f3f8f5] dark:border-[#38483f] dark:bg-[#1a241f]" aria-label="Close screen" title="Close" onClick={onClose}>×</button>
        </div>
      </div>

      <div className={card}>
        <form
          className="grid grid-cols-[auto_minmax(180px,1fr)_auto] items-center gap-3 border-b border-[#edf1ef] pb-[17px] dark:border-[#2a3931] print:hidden max-[700px]:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            findTransactions(search);
          }}
        >
          <label className={`${fieldLabel} max-[700px]:col-span-2`} htmlFor={`transaction-search-${type}`}>Find by invoice, feed no. or account</label>
          <input
            className={input}
            id={`transaction-search-${type}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Enter invoice, feed number or account"
          />
          <button className={`${button} ${primaryButton}`} type="submit" disabled={loading}>Find</button>
        </form>

        <form onSubmit={saveTransaction}>
          <div className="grid grid-cols-4 gap-3 py-[17px] pb-5 max-[800px]:grid-cols-2 max-[520px]:grid-cols-1">
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Code <b className="text-[#ba4b41]">*</b></span>
              <input
                className={input}
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
            <label className="grid min-w-0 gap-1.5 max-[800px]:col-span-2 max-[520px]:col-span-1">
              <span className={fieldLabel}>Name</span>
              <input className={input} value={transaction.name} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Door No</span>
              <input className={input} value={transaction.doorNo} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Street</span>
              <input className={input} value={transaction.street} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Area</span>
              <input className={input} value={transaction.area} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>City</span>
              <input className={input} value={transaction.city} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Phone</span>
              <input className={input} value={transaction.phone} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Cell</span>
              <input className={input} value={transaction.cell} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Mail ID</span>
              <input className={input} value={transaction.mailId} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Bill Type</span>
              <select
                className={input}
                value={transaction.billType}
                disabled={isReadOnly}
                onChange={(event) => setTransaction((current) => ({ ...current, billType: event.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="upi">UPI</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Invoice Number</span>
              <input className={input} value={transaction.invoiceNo} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Feed No</span>
              <input className={input} value={transaction.feedNo} readOnly />
            </label>
          </div>

          <div className="my-2 flex items-center justify-between">
            <h2 className="m-0 text-sm font-semibold text-[#293a31] dark:text-[#e3ebe6]">Items</h2>
            <span className="text-xs text-[#85918b]">{transaction.lines.filter((line) => line.itemCode || line.itemName).length} rows</span>
          </div>
          <div className="hidden overflow-auto min-[1024px]:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th className={`${tableHeader} min-w-[115px]`}>Item Code</th>
                  <th className={`${tableHeader} min-w-[150px]`}>Item Name</th>
                  <th className={tableHeader}>Price</th>
                  <th className={tableHeader}>Qty</th>
                  <th className={tableHeader}>Free</th>
                  <th className={tableHeader}>Exp Yr</th>
                  <th className={tableHeader}>Exp Month</th>
                  <th className={tableHeader}>Amount</th>
                  {!isReadOnly && <th className={`${tableHeader} print:hidden`}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {transaction.lines.map((line, index) => (
                  <tr className="text-[#46564e] hover:bg-[#f0f7f3] dark:text-[#b2c0b7] dark:hover:bg-[#26372e]" key={`${line.id || "new"}-${index}`}>
                    <td className={`${tableCell} min-w-[115px]`}>
                      <input
                        className={input}
                        list={`transaction-items-${type}`}
                        value={line.itemCode}
                        readOnly={isReadOnly}
                        maxLength={50}
                        onChange={(event) => updateLine(index, "itemCode", event.target.value)}
                        onBlur={(event) => resolveItemCode(index, event.target.value.trim())}
                        aria-label={`Item code row ${index + 1}`}
                      />
                    </td>
                    <td className={`${tableCell} min-w-[150px]`}>
                      <input
                        className={input}
                        value={line.itemName}
                        readOnly={isReadOnly || Boolean(line.itemCode)}
                        maxLength={200}
                        onChange={(event) => updateLine(index, "itemName", event.target.value)}
                        aria-label={`Item name row ${index + 1}`}
                      />
                    </td>
                    {["price", "qty", "free", "expYear", "expMonth"].map((field) => (
                      <td className={tableCell} key={field}>
                        <input
                          className={input}
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
                    <td className={`${tableCell} text-right tabular-nums`}>{lineAmount(line).toFixed(2)}</td>
                    {!isReadOnly && (
                      <td className={`${tableCell} print:hidden`}>
                        <button
                          type="button"
                          className="h-7 w-7 rounded border border-[#f0d7d4] bg-white text-[17px] text-[#a8403a]"
                          aria-label={`Remove item row ${index + 1}`}
                          onClick={() => removeLine(index)}
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!isReadOnly && (
                  <tr className="print:hidden">
                    <td className={tableCell} colSpan="9">
                      <button
                        type="button"
                        className="py-1 text-xs font-semibold text-[#23734f]"
                        onClick={addLine}
                      >
                        + Add item row
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 min-[1024px]:hidden">
            {transaction.lines.map((line, index) => (
              <div className="grid min-w-0 gap-3 rounded-lg border border-[#e9efec] bg-[#fbfcfb] p-3 dark:border-[#2a3931] dark:bg-[#1a241f]" key={`${line.id || "mobile"}-${index}`}>
                <div className="grid min-w-0 grid-cols-2 gap-3">
                  <label className="grid min-w-0 gap-1.5">
                    <span className={fieldLabel}>Item Code</span>
                    <input
                      className={input}
                      list={`transaction-items-${type}`}
                      value={line.itemCode}
                      readOnly={isReadOnly}
                      maxLength={50}
                      onChange={(event) => updateLine(index, "itemCode", event.target.value)}
                      onBlur={(event) => resolveItemCode(index, event.target.value.trim())}
                      aria-label={`Item code row ${index + 1}`}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1.5">
                    <span className={fieldLabel}>Item Name</span>
                    <input
                      className={input}
                      value={line.itemName}
                      readOnly={isReadOnly || Boolean(line.itemCode)}
                      maxLength={200}
                      onChange={(event) => updateLine(index, "itemName", event.target.value)}
                      aria-label={`Item name row ${index + 1}`}
                    />
                  </label>
                  {[
                    ["price", "Price"],
                    ["qty", "Qty"],
                    ["free", "Free"],
                    ["expYear", "Exp Yr"],
                    ["expMonth", "Exp Month"],
                  ].map(([field, label]) => (
                    <label className="grid min-w-0 gap-1.5" key={field}>
                      <span className={fieldLabel}>{label}</span>
                      <input
                        className={input}
                        type="number"
                        min="0"
                        step={field === "expYear" || field === "expMonth" ? "1" : "0.01"}
                        value={line[field]}
                        readOnly={isReadOnly}
                        onChange={(event) => updateLine(index, field, event.target.value)}
                        aria-label={`${field} row ${index + 1}`}
                      />
                    </label>
                  ))}
                  <div className="grid min-w-0 gap-1.5">
                    <span className={fieldLabel}>Amount</span>
                    <span className="flex h-9 items-center rounded-md bg-[#f0f7f3] px-2 text-sm font-semibold tabular-nums text-[#1d704f] dark:bg-[#26372e] dark:text-[#8bd1ac]">
                      {lineAmount(line).toFixed(2)}
                    </span>
                  </div>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    className="min-h-9 rounded-md border border-[#f0d7d4] px-3 text-xs font-semibold text-[#a8403a]"
                    onClick={() => removeLine(index)}
                  >
                    Remove item row
                  </button>
                )}
              </div>
            ))}
            {!isReadOnly && (
              <button
                type="button"
                className="min-h-9 rounded-md border border-dashed border-[#a9cdb9] text-xs font-semibold text-[#23734f]"
                onClick={addLine}
              >
                + Add item row
              </button>
            )}
          </div>
          <datalist id={`transaction-items-${type}`}>
            {items.map((item) => (
              <option key={item.code} value={item.code}>{item.name}</option>
            ))}
          </datalist>

          <div className="ml-auto my-[17px] mb-5 grid grid-cols-4 gap-3 max-[800px]:grid-cols-2 max-[520px]:grid-cols-1">
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Dis%</span>
              <input className={input} type="number" min="0" step="0.01" value={transaction.discountPercent} readOnly={isReadOnly} onChange={(event) => updateTotals("discountPercent", event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Dis Amt</span>
              <input className={input} type="number" min="0" step="0.01" value={transaction.discountAmount} readOnly={isReadOnly} onChange={(event) => updateTotals("discountAmount", event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Schamt</span>
              <input className={input} type="number" min="0" step="0.01" value={transaction.schemeAmount} readOnly={isReadOnly} onChange={(event) => updateTotals("schemeAmount", event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>CGST</span>
              <input className={input} type="number" min="0" step="0.01" value={transaction.cgst} readOnly={isReadOnly} onChange={(event) => updateTotals("cgst", event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>SGST</span>
              <input className={input} type="number" min="0" step="0.01" value={transaction.sgst} readOnly={isReadOnly} onChange={(event) => updateTotals("sgst", event.target.value)} />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Total GST</span>
              <input className={input} value={gstTotal.toFixed(2)} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Net Amt</span>
              <input className={`${input} font-bold text-[#1d704f]`} value={netAmount.toFixed(2)} readOnly />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabel}>Gross</span>
              <input className={input} value={lineTotal.toFixed(2)} readOnly />
            </label>
          </div>

          <div className="flex flex-wrap gap-[9px] border-b border-[#edf1ef] pb-[18px] dark:border-[#2a3931] print:hidden" aria-label={`${config.title} actions`}>
            <button type="button" className={button} onClick={() => startNew()} disabled={loading}>Cancel</button>
            {config.hasImport && (
              <>
                <input ref={fileInputRef} className="hidden" type="file" accept=".csv,text/csv" onChange={importCsv} />
                <button type="button" className={button} onClick={() => fileInputRef.current?.click()} disabled={loading}>Import</button>
                <span className="self-center text-[11px] text-[#78857f] dark:text-[#b2c0b7]">CSV columns: itemCode, itemName, price, qty, free, expYear, expMonth, amount</span>
              </>
            )}
            <button type="button" className={button} onClick={() => setMode("edit")} disabled={!transaction.id || mode !== "view" || loading}>Edit</button>
            <button type="button" className={button} onClick={() => window.print()} disabled={loading}>Print</button>
            <button type="submit" className={`${button} ${primaryButton}`} disabled={mode === "view" || loading}>{loading ? "Saving..." : "Save"}</button>
            <button type="button" className={`${button} ml-auto text-[#a8403a] max-[520px]:ml-0`} onClick={removeTransaction} disabled={!transaction.id || mode !== "view" || loading}>Remove</button>
          </div>
        </form>

        {error && <p className="mt-[14px] text-[13px] text-[#b13d36] print:hidden" role="alert">{error}</p>}
        {notice && <p className="mt-[14px] text-[13px] text-[#23734f] print:hidden" role="status">{notice}</p>}

        <div className="pt-[18px] print:hidden">
          <div className="my-2 flex items-center justify-between">
            <h2 className="m-0 text-sm font-semibold text-[#293a31] dark:text-[#e3ebe6]">{config.title} records</h2>
            <span className="text-xs text-[#85918b]">{loading ? "Loading..." : `${transactions.length} shown`}</span>
          </div>
          <div className="hidden overflow-auto min-[900px]:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th className={tableHeader}>Invoice No.</th>
                  <th className={tableHeader}>Feed No.</th>
                  <th className={tableHeader}>Account</th>
                  <th className={tableHeader}>Bill Type</th>
                  <th className={tableHeader}>Net Amt</th>
                  <th className={tableHeader}>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((row) => (
                  <tr key={row.id} className={`cursor-pointer text-[#46564e] hover:bg-[#f0f7f3] dark:text-[#b2c0b7] dark:hover:bg-[#26372e] ${transaction.id === row.id ? "bg-[#f0f7f3] font-semibold text-[#1d704f] dark:bg-[#26372e]" : ""}`} onClick={() => selectTransaction(row.id)}>
                    <td className={tableCell}>{row.invoiceNo}</td>
                    <td className={tableCell}>{row.feedNo}</td>
                    <td className={tableCell}>{row.name}</td>
                    <td className={tableCell}>{row.billType}</td>
                    <td className={tableCell}>{numericValue(row.netAmount).toFixed(2)}</td>
                    <td className={tableCell}>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ""}</td>
                  </tr>
                ))}
                {!loading && transactions.length === 0 && (
                  <tr><td className="border-b border-[#edf1ef] p-6 text-center text-[#87928c] dark:border-[#2a3931]" colSpan="6">No transactions to display.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 min-[900px]:hidden">
            {transactions.map((row) => (
              <button
                type="button"
                key={row.id}
                className={`grid min-w-0 gap-2 rounded-lg border p-3 text-left ${
                  transaction.id === row.id
                    ? "border-[#23815c] bg-[#f0f7f3] dark:bg-[#26372e]"
                    : "border-[#e9efec] bg-white hover:bg-[#f7f9f8] dark:border-[#2a3931] dark:bg-[#1a241f] dark:hover:bg-[#26372e]"
                }`}
                onClick={() => selectTransaction(row.id)}
              >
                <span className="break-words font-semibold text-[#1d704f] dark:text-[#8bd1ac]">{row.invoiceNo} · {row.name}</span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 break-words text-xs text-[#536159] dark:text-[#b2c0b7]">
                  <span>Feed: {row.feedNo}</span>
                  <span>{row.billType}</span>
                  <span>Net: {numericValue(row.netAmount).toFixed(2)}</span>
                  <span>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ""}</span>
                </span>
              </button>
            ))}
            {!loading && transactions.length === 0 && (
              <p className="m-0 p-6 text-center text-sm text-[#87928c]">No transactions to display.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
