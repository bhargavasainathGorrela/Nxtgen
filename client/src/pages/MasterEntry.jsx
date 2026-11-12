import { useState } from "react";

const field = (name, label, options = {}) => ({ name, label, ...options });

export const masterConfigs = {
  Doctors: {
    title: "Doctors",
    singularTitle: "Doctor",
    description: "Manage doctor details.",
    storageKey: "stockwise-doctors",
    fields: [
      field("code", "Code", { required: true }),
      field("name", "Doctor name", { required: true }),
      field("specialty", "Specialty"),
      field("phone", "Phone", { type: "tel" }),
      field("cell", "Cell", { type: "tel" }),
      field("address", "Address"),
    ],
    columns: ["code", "name", "specialty", "cell"],
  },
  "Sales Men": {
    title: "Sales Men",
    singularTitle: "Sales man",
    description: "Manage sales team details.",
    storageKey: "stockwise-sales-men",
    fields: [
      field("code", "Code", { required: true }),
      field("name", "Sales man name", { required: true }),
      field("phone", "Phone", { type: "tel" }),
      field("cell", "Cell", { type: "tel" }),
      field("area", "Area"),
    ],
    columns: ["code", "name", "cell", "area"],
  },
  Areas: {
    title: "Areas",
    singularTitle: "Area",
    description: "Manage delivery and sales areas.",
    storageKey: "stockwise-areas",
    fields: [
      field("code", "Code", { required: true }),
      field("name", "Area name", { required: true }),
      field("city", "City"),
      field("description", "Description"),
    ],
    columns: ["code", "name", "city", "description"],
  },
  Accounts: {
    title: "Accounts",
    singularTitle: "Account",
    description: "Manage account names and opening balances.",
    storageKey: "stockwise-master-accounts",
    fields: [
      field("code", "Code", { required: true }),
      field("name", "Account name", { required: true }),
      field("group", "Account group"),
      field("subGroup", "Account sub group"),
      field("openingBalance", "Opening balance", { type: "number", min: "0", step: "0.01" }),
      field("balanceType", "Balance type", {
        options: [
          { value: "debit", label: "Debit" },
          { value: "credit", label: "Credit" },
        ],
      }),
    ],
    columns: ["code", "name", "group", "openingBalance", "balanceType"],
  },
};

const card = "rounded-[11px] border border-[#e9efec] bg-white p-[22px] shadow-[0_2px_6px_rgba(27,49,39,0.03)] dark:border-[#2a3931] dark:bg-[#1a241f] max-[520px]:p-[15px]";
const input = "h-[38px] w-full min-w-0 rounded-md border border-[#dfe7e2] bg-white px-[10px] text-[13px] text-[#27372f] outline-none focus:border-[#3a9a70] focus:ring-[3px] focus:ring-[#3a9a70]/[0.12] read-only:bg-[#f7f9f8] read-only:text-[#69766f] dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7] dark:read-only:bg-[#222f28]";
const button = "min-h-9 rounded-md border border-[#dfe7e2] bg-white px-[14px] text-xs font-semibold text-[#435149] hover:border-[#a9cdb9] hover:bg-[#f3f8f5] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7] dark:hover:bg-[#26372e]";
const primaryButton = "border-[#23815c] bg-[#23815c] text-white hover:border-[#1d704f] hover:bg-[#1d704f] dark:border-[#23815c] dark:bg-[#23815c] dark:text-white";
const fieldLabel = "text-xs font-semibold text-[#536159] dark:text-[#b2c0b7]";
const tableHeader = "border-b border-[#edf1ef] bg-[#f7f9f8] px-3 py-[11px] text-left text-[11px] font-semibold uppercase tracking-[0.4px] text-[#728078] dark:border-[#2a3931] dark:bg-[#222f28] dark:text-[#9eada4]";
const tableCell = "whitespace-nowrap border-b border-[#edf1ef] px-3 py-[11px] text-left dark:border-[#2a3931]";

function readEntries(storageKey, title) {
  const savedEntries = localStorage.getItem(storageKey);
  if (!savedEntries) return { entries: [], error: "" };

  try {
    const entries = JSON.parse(savedEntries);
    if (!Array.isArray(entries)) throw new Error(`Saved ${title.toLowerCase()} data is invalid.`);
    return { entries, error: "" };
  } catch (error) {
    return {
      entries: [],
      error: error.message || `Unable to read saved ${title.toLowerCase()}.`,
    };
  }
}

function nextCode(entries) {
  const largestCode = entries.reduce((largest, entry) => {
    const code = Number(entry.code);
    return Number.isSafeInteger(code) && code > largest ? code : largest;
  }, 0);
  return String(largestCode + 1);
}

export default function MasterEntry({
  config,
  minimized,
  maximized,
  isWorkspaceActive,
  geometry,
  onMinimize,
  onMaximize,
  onClose,
  onFocus,
}) {
  const emptyEntry = Object.fromEntries([
    ...config.fields.map(({ name, defaultValue, options }) => [
      name,
      defaultValue ?? (options ? options[0].value : ""),
    ]),
    ["active", true],
  ]);
  const [initialData] = useState(() => readEntries(config.storageKey, config.title));
  const [entries, setEntries] = useState(initialData.entries);
  const [entry, setEntry] = useState(emptyEntry);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("view");
  const [isFindScreen, setIsFindScreen] = useState(false);
  const [error, setError] = useState(initialData.error);
  const [notice, setNotice] = useState("");

  const persistEntries = (updatedEntries) => {
    localStorage.setItem(config.storageKey, JSON.stringify(updatedEntries));
    setEntries(updatedEntries);
  };

  const startAdd = () => {
    setEntry({ ...emptyEntry, code: nextCode(entries) });
    setMode("add");
    setIsFindScreen(false);
    setError("");
    setNotice("");
  };

  const saveEntry = (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const normalizedEntry = {
      ...entry,
      code: String(entry.code || "").trim(),
      name: String(entry.name || "").trim(),
    };
    const isAdding = mode === "add";
    const updatedEntries = isAdding
      ? [...entries, normalizedEntry]
      : entries.map((currentEntry) => (
        currentEntry.code === normalizedEntry.code ? normalizedEntry : currentEntry
      ));

    if (isAdding && entries.some((currentEntry) => currentEntry.code === normalizedEntry.code)) {
      setError(`A ${config.singularTitle.toLowerCase()} with this code already exists.`);
      return;
    }

    try {
      persistEntries(updatedEntries);
      setEntry(normalizedEntry);
      setMode("view");
      setNotice(isAdding ? `${config.singularTitle} added.` : `${config.singularTitle} updated.`);
    } catch (saveError) {
      setError(saveError.message || `Unable to save ${config.title.toLowerCase()}.`);
    }
  };

  const removeEntry = () => {
    if (!entry.code || !window.confirm(`Remove ${entry.name || entry.code}?`)) return;
    const updatedEntries = entries.filter((currentEntry) => currentEntry.code !== entry.code);
    try {
      persistEntries(updatedEntries);
      setEntry(emptyEntry);
      setMode("view");
      setNotice(`${config.singularTitle} removed.`);
      setError("");
    } catch (removeError) {
      setError(removeError.message || `Unable to remove ${config.title.toLowerCase()}.`);
    }
  };

  const cancel = () => {
    setEntry(emptyEntry);
    setMode("view");
    setError("");
    setNotice("");
  };

  const selectEntry = (selectedEntry) => {
    setEntry({ ...emptyEntry, ...selectedEntry });
    setMode("view");
    setIsFindScreen(false);
    setError("");
    setNotice("");
  };

  const query = search.trim().toLowerCase();
  const matchingEntries = entries.filter((currentEntry) =>
    !query || [currentEntry.code, currentEntry.name].some((value) =>
      String(value || "").toLowerCase().includes(query),
    ),
  );
  const isReadOnly = mode === "view";
  return (
    <section
      className={`transaction-window master-window ${maximized ? "is-maximized" : ""} ${isWorkspaceActive ? "is-active" : "is-inactive"}`}
      style={{
        display: minimized || !isWorkspaceActive ? "none" : undefined,
        zIndex: geometry.zIndex,
        ...(maximized ? {} : {
          left: geometry.left,
          top: geometry.top,
          width: geometry.width,
          height: geometry.height,
        }),
      }}
      aria-labelledby="master-entry-title"
      onPointerDown={onFocus}
    >
      <div className="transaction-screen-header master-screen-header mb-[18px] flex items-start justify-between">
        <div>
          <p className="eyebrow">MASTERS</p>
          <h1 id="master-entry-title" className="m-0 text-[clamp(24px,3vw,30px)] font-bold tracking-[-1px] text-[#1c2b24] dark:text-[#e3ebe6]">
            {isFindScreen ? `Find ${config.title}` : config.title}
          </h1>
          <p className="mt-2 text-sm text-[#78857f] dark:text-[#b2c0b7]">
            {isFindScreen ? `Find an entry by code or name.` : config.description}
          </p>
        </div>
        <div className="flex gap-[7px] print:hidden">
          {isFindScreen && (
            <button className={button} type="button" onClick={() => setIsFindScreen(false)}>
              Back
            </button>
          )}
          <button type="button" className="grid h-[34px] w-[34px] place-items-center rounded-md border border-[#dfe7e2] bg-white text-[21px] text-[#536159] hover:bg-[#f3f8f5] dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7]" aria-label="Minimize screen" title="Minimize" onClick={onMinimize}>−</button>
          <button type="button" className="grid h-[34px] w-[34px] place-items-center rounded-md border border-[#dfe7e2] bg-white text-[15px] text-[#536159] hover:bg-[#f3f8f5] dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7]" aria-label={maximized ? "Restore screen size" : "Maximize screen"} title={maximized ? "Restore" : "Maximize"} onClick={onMaximize}>{maximized ? "❐" : "□"}</button>
          <button type="button" className="grid h-[34px] w-[34px] place-items-center rounded-md border border-[#dfe7e2] bg-white text-[21px] text-[#a8403a] hover:bg-[#f3f8f5] dark:border-[#38483f] dark:bg-[#1a241f]" aria-label="Close screen" title="Close" onClick={onClose}>×</button>
        </div>
      </div>

      <div className={`${card} transaction-card master-card`}>
        {isFindScreen && (
          <form
            className="grid grid-cols-[auto_minmax(180px,1fr)_auto] items-center gap-3 border-b border-[#edf1ef] pb-5 dark:border-[#2a3931] max-[520px]:grid-cols-[1fr_auto]"
            onSubmit={(event) => event.preventDefault()}
          >
            <label className={`${fieldLabel} max-[520px]:col-span-2`} htmlFor="master-entry-search">
              Find by code or name
            </label>
            <input
              className={input}
              id="master-entry-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Enter code or name"
            />
            <button className={`${button} ${primaryButton}`} type="submit">Find</button>
          </form>
        )}

        {!isFindScreen && (
          <form onSubmit={saveEntry}>
            <div className="grid grid-cols-3 gap-4 py-5 max-[760px]:grid-cols-2 max-[520px]:grid-cols-1">
              {config.fields.map((currentField) => (
                <label className="grid gap-[7px]" key={currentField.name}>
                  <span className={fieldLabel}>
                    {currentField.label}{currentField.required && <span className="text-[#ba4b41]"> *</span>}
                  </span>
                  {currentField.options ? (
                    <select
                      className={input}
                      name={currentField.name}
                      value={entry[currentField.name] ?? currentField.options[0].value}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        setEntry((current) => ({ ...current, [currentField.name]: event.target.value }))
                      }
                    >
                      {currentField.options.map((option) => (
                        <option value={option.value} key={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={input}
                      type={currentField.type || "text"}
                      name={currentField.name}
                      value={entry[currentField.name] ?? ""}
                      required={currentField.required}
                      min={currentField.min}
                      step={currentField.step}
                      readOnly={isReadOnly || (mode === "edit" && currentField.name === "code")}
                      onChange={(event) =>
                        setEntry((current) => ({ ...current, [currentField.name]: event.target.value }))
                      }
                    />
                  )}
                </label>
              ))}
              <label className="flex min-h-[38px] items-center gap-2 self-end text-[13px] text-[#536159] dark:text-[#b2c0b7]">
                <input
                  className="h-4 w-4 accent-[#23815c]"
                  type="checkbox"
                  checked={Boolean(entry.active)}
                  disabled={isReadOnly}
                  onChange={(event) =>
                    setEntry((current) => ({ ...current, active: event.target.checked }))
                  }
                />
                <span>Active</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-[9px] border-b border-[#edf1ef] pb-5 dark:border-[#2a3931]" aria-label={`${config.title} actions`}>
              <button className={button} type="button" onClick={cancel}>Cancel</button>
              <button className={button} type="button" onClick={startAdd}>New entry</button>
              <button
                className={button}
                type="button"
                onClick={() => {
                  setMode("edit");
                  setError("");
                  setNotice("");
                }}
                disabled={!entry.code || mode !== "view"}
              >
                Edit
              </button>
              <button className={`${button} ${primaryButton}`} type="submit" disabled={mode === "view"}>
                {mode === "add" ? "Save entry" : "Update entry"}
              </button>
              <button
                className={button}
                type="button"
                onClick={() => {
                  setIsFindScreen(true);
                  setSearch("");
                  setError("");
                  setNotice("");
                }}
              >
                Find
              </button>
              <button
                className="min-h-9 rounded-md border border-[#dfe7e2] bg-white px-[14px] text-xs font-semibold text-[#a8403a] hover:bg-[#f3f8f5] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#38483f] dark:bg-[#1a241f]"
                type="button"
                onClick={removeEntry}
                disabled={!entry.code || mode !== "view"}
              >
                Remove
              </button>
            </div>
          </form>
        )}

        {error && <p className="mt-[14px] text-[13px] text-[#b13d36]" role="alert">{error}</p>}
        {notice && <p className="mt-[14px] text-[13px] text-[#23734f]" role="status">{notice}</p>}

        {isFindScreen && (
          <div className="master-list pt-5">
            <div className="mb-[11px] flex items-center justify-between">
              <h2 className="m-0 text-sm font-semibold text-[#293a31] dark:text-[#e3ebe6]">{config.title} list</h2>
              <span className="text-xs text-[#85918b]">{matchingEntries.length} shown</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr>
                    {config.columns.map((columnName) => {
                      const column = config.fields.find(({ name }) => name === columnName);
                      return <th className={tableHeader} scope="col" key={columnName}>{column.label}</th>;
                    })}
                    <th className={tableHeader} scope="col">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {matchingEntries.map((row) => (
                    <tr
                      key={row.code}
                      className="cursor-pointer text-[#46564e] hover:bg-[#f0f7f3] dark:text-[#b2c0b7] dark:hover:bg-[#26372e]"
                      onClick={() => selectEntry(row)}
                    >
                      {config.columns.map((columnName) => (
                        <td className={tableCell} key={columnName}>{row[columnName]}</td>
                      ))}
                      <td className={tableCell}>{row.active ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {matchingEntries.length === 0 && (
                    <tr>
                      <td className="border-b border-[#edf1ef] p-6 text-center text-[#87928c] dark:border-[#2a3931]" colSpan={config.columns.length + 1}>
                        No {config.title.toLowerCase()} to display.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
