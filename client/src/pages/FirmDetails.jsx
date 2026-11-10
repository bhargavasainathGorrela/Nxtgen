import { useState } from "react";

const STORAGE_KEY = "stockwise-firm-details";
const fields = [
  { name: "business", label: "Business" },
  { name: "firmname", label: "Firm Name", required: true },
  { name: "doorno", label: "Door No." },
  { name: "street", label: "Street" },
  { name: "area", label: "Area" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "cell", label: "Cell", type: "tel" },
  { name: "mailid", label: "Mail ID", type: "email" },
];
const emptyDetails = Object.fromEntries(fields.map(({ name }) => [name, ""]));
const fieldClass = "grid min-w-0 gap-1.5 text-xs font-semibold text-[#536159] dark:text-[#b2c0b7]";
const inputClass = "h-10 w-full min-w-0 rounded-md border border-[#dfe7e2] bg-white px-3 text-[13px] font-normal text-[#27372f] outline-none focus:border-[#3a9a70] focus:ring-[3px] focus:ring-[#3a9a70]/[0.12] dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7]";
const buttonClass = "min-h-9 rounded-md border border-[#dfe7e2] bg-white px-[14px] text-xs font-semibold text-[#435149] hover:border-[#a9cdb9] hover:bg-[#f3f8f5] dark:border-[#38483f] dark:bg-[#1a241f] dark:text-[#d3ded7] dark:hover:bg-[#26372e]";

function readFirmDetails() {
  const savedDetails = localStorage.getItem(STORAGE_KEY);
  return savedDetails
    ? { ...emptyDetails, ...JSON.parse(savedDetails) }
    : emptyDetails;
}

export default function FirmDetails({
  minimized,
  maximized,
  zIndex,
  onMinimize,
  onMaximize,
  onClose,
  onFocus,
}) {
  const [savedDetails, setSavedDetails] = useState(readFirmDetails);
  const [details, setDetails] = useState(savedDetails);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (minimized) return null;

  const updateField = (name, value) => {
    setDetails((current) => ({ ...current, [name]: value }));
    setNotice("");
    setError("");
  };

  const saveDetails = (event) => {
    event.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
      setSavedDetails(details);
      setNotice("Firm details saved.");
      setError("");
    } catch (saveError) {
      setError(saveError.message || "Unable to save firm details.");
    }
  };

  const cancelChanges = () => {
    setDetails(savedDetails);
    setNotice("");
    setError("");
  };

  return (
    <section
      className={`firm-details-window${maximized ? " is-maximized" : ""}`}
      style={{ zIndex }}
      aria-labelledby="firm-details-title"
      onPointerDown={onFocus}
    >
      <header className="firm-details-header" data-window-drag-handle>
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h1 id="firm-details-title">Firm Details</h1>
        </div>
        <div className="firm-details-window-actions print:hidden">
          <button type="button" className={buttonClass} onClick={onMinimize} aria-label="Minimize firm details">−</button>
          <button
            type="button"
            className={buttonClass}
            onClick={onMaximize}
            aria-label={maximized ? "Restore firm details" : "Maximize firm details"}
          >
            {maximized ? "❐" : "□"}
          </button>
          <button type="button" className={`${buttonClass} firm-details-close`} onClick={onClose} aria-label="Close firm details">×</button>
        </div>
      </header>

      <form className="firm-details-form" onSubmit={saveDetails}>
        <div className="firm-details-fields">
          {fields.map(({ name, label, type = "text", required }) => (
            <label className={fieldClass} htmlFor={`firm-${name}`} key={name}>
              {label}
              <input
                className={inputClass}
                id={`firm-${name}`}
                name={name}
                type={type}
                value={details[name]}
                required={required}
                onChange={(event) => updateField(name, event.target.value)}
              />
            </label>
          ))}
        </div>
        {(error || notice) && (
          <p className={error ? "firm-details-error" : "firm-details-notice"} role={error ? "alert" : "status"}>
            {error || notice}
          </p>
        )}
        <div className="firm-details-form-actions print:hidden">
          <button type="button" className={buttonClass} onClick={cancelChanges}>Cancel</button>
          <button type="submit" className={`${buttonClass} firm-details-save`}>Save</button>
        </div>
      </form>
    </section>
  );
}
