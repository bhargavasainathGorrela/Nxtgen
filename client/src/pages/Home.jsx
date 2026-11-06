import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomerSuppliers from "./CustomerSuppliers";
import Items from "./Items";
import TransactionScreen from "./TransactionScreen";
import "./Home.css";

const USER_STORAGE_KEY = "stockwise-user";
const settingsItems = [
  "Security",
  "General",
  "Firm Details",
  "Updates",
  "Data Explorer",
  "Prints",
];

const navigation = [
  {
    label: "Inventory",
    items: [
      { label: "Sale" },
      { label: "Purchase" },
      { label: "Orders", items: ["To Supplier", "From Customer", "Order Import"] },
      { label: "GST Tools", items: ["Invoice / E-Way Bill", "GST Manager"] },
      {
        label: "Returns",
        items: ["Sale Return", "Purchase Return", "Stock Adjustment", "Replacement"],
      },
      {
        label: "Expiry / Damage",
        items: ["Expiry / Damages In", "Expiry / Damages Out", "ED Stock Adj", "ED Stock"],
      },
      { label: "Tracing", items: ["Location Stock Removal", "Claims", "Dispatch"] },
    ],
  },
  {
    label: "Accounts",
    items: [
      "Customers",
      "Suppliers",
      "Invoices",
      "Receipts",
      "Payments",
      "Vouchers",
      {
        label: "Banking",
        items: [
          "Cheque Print",
          "Bank Manager",
          "Cheque Return",
          "Bank Reconciliation",
          "Cheque Book",
          "Cheques Deposit Slip",
          "Denomination",
        ],
      },
      "Fast Receipts",
      "Daybook",
      "Tally Posting",
      "Payment Return",
      "Zooming",
    ],
  },
  {
    label: "Reports",
    items: ["Stock summary", "Sales report", "Purchase report", "Transactions"],
  },
  {
    label: "Masters",
    items: [
      "Stock",
      "Items",
      "Customers/Suppliers",
      "Doctors",
      "Sales Men",
      "Areas",
      "Accounts",
      "Account Sub Groups",
      "Account Groups",
      "Companies",
      "Company Groups",
      "Customer Banks",
      "Drug Formula",
      "Import Softwares",
      "Items Category",
      "Discount Ceiling",
      "Offers",
      "Transport",
    ],
  },
  {
    label: "Tools",
    items: [
      "Backup",
      "WhatsApp/Mail",
      "Shortage Book",
      "Contacts",
      {
        label: "Management",
        items: [
          "Letter Writing",
          "Attendance",
          "Diary",
          "Envelope Print",
          "Bulk Update",
          "GST Slabs Update",
        ],
      },
      {
        label: "Misc",
        items: ["Clear QIT", "Verify Files", "Local Settings", "Cloud Bill"],
      },
    ],
  },
  {
    label: "Automation",
    items: [
      "Invoice Export",
      "Profit Orders",
      "Reports/SMS/Mail/WhatsApp",
      "GST Number Verify",
      "Post Card",
      "Restart/Close Weblink",
      "Chrome Driver Download",
    ],
  },
];

export default function Home() {
  const [userName] = useState(
    () => localStorage.getItem(USER_STORAGE_KEY) || "Guest",
  );
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("stockwise-theme") === "dark",
  );
  const [openSection, setOpenSection] = useState(null);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [isMainNavOpen, setIsMainNavOpen] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [activeSetting, setActiveSetting] = useState("");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const navigate = useNavigate();

  const initials = userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
      if (!settingsMenuRef.current?.contains(event.target)) {
        setIsSettingsMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        setIsSettingsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleTheme = () => {
    const nextIsDarkMode = !isDarkMode;
    localStorage.setItem("stockwise-theme", nextIsDarkMode ? "dark" : "light");
    setIsDarkMode(nextIsDarkMode);
  };

  const toggleSection = (sectionLabel) => {
    setOpenSection((currentSection) =>
      currentSection === sectionLabel ? null : sectionLabel,
    );
    setOpenSubmenu(null);
  };

  const toggleSubmenu = (submenuId) => {
    setOpenSubmenu((currentSubmenu) =>
      currentSubmenu === submenuId ? null : submenuId,
    );
  };

  const closeMenus = () => {
    setOpenSection(null);
    setOpenSubmenu(null);
    setIsMainNavOpen(false);
  };

  const handleNavigationItem = (label) => {
    const transactionViews = {
      Sale: "sale",
      Purchase: "purchase",
      "Sale Return": "saleReturn",
      "Purchase Return": "purchaseReturn",
    };
    if (label === "Customers/Suppliers") {
      setActiveView("customer-suppliers");
    } else if (label === "Items") {
      setActiveView("items");
    } else if (transactionViews[label]) {
      setActiveView(transactionViews[label]);
    }
    closeMenus();
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    navigate("/");
  };

  return (
    <main className="home-page" data-theme={isDarkMode ? "dark" : "light"}>
      <header className="topbar print:hidden">
        <div className="settings-menu-container relative mr-4 flex shrink-0 items-center gap-3" ref={settingsMenuRef}>
          <button
            className="grid h-9 w-9 shrink-0 place-content-center gap-[5px] rounded-md border border-[#e5ece8] bg-white hover:bg-[#f1f7f4] dark:border-[#38483f] dark:bg-[#1a241f] dark:hover:bg-[#26372e]"
            type="button"
            aria-label="Toggle settings menu"
            aria-expanded={isSettingsMenuOpen}
            aria-controls="settings-menu"
            onClick={() => setIsSettingsMenuOpen((isOpen) => !isOpen)}
          >
            <span className="block h-[2px] w-[17px] rounded bg-[#485650] dark:bg-[#c1cec6]" />
            <span className="block h-[2px] w-[17px] rounded bg-[#485650] dark:bg-[#c1cec6]" />
            <span className="block h-[2px] w-[17px] rounded bg-[#485650] dark:bg-[#c1cec6]" />
          </button>
          {isSettingsMenuOpen && (
            <div
              className="absolute left-0 top-[calc(100%+18px)] z-20 w-[min(250px,calc(100vw-2rem))] rounded-xl border border-[#e7eeea] bg-white p-2 shadow-[0_12px_30px_rgba(25,49,39,0.12)] dark:border-[#2a3931] dark:bg-[#1a241f] dark:shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
              id="settings-menu"
              aria-label="Settings"
            >
              <h2 className="m-0 border-b border-[#edf1ef] px-3 py-2 text-[11px] font-bold uppercase tracking-[1.1px] text-[#78857f] dark:border-[#2a3931] dark:text-[#9eada4]">
                Settings
              </h2>
              <nav className="mt-1 grid gap-1" aria-label="Settings menu">
                {settingsItems.map((setting) => (
                  <button
                    className={`rounded-md px-3 py-[10px] text-left text-[13px] text-[#485650] hover:bg-[#f1f7f4] hover:text-[#1d7653] dark:text-[#c1cec6] dark:hover:bg-[#26372e] dark:hover:text-[#8bd1ac] ${
                      activeSetting === setting
                        ? "bg-[#f1f7f4] font-semibold text-[#1d7653] dark:bg-[#26372e] dark:text-[#8bd1ac]"
                        : ""
                    }`}
                    type="button"
                    key={setting}
                    onClick={() => setActiveSetting(setting)}
                  >
                    {setting}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>
        <a
          className="brand"
          href="/home"
          aria-label="Stockwise home"
          onClick={(event) => {
            event.preventDefault();
            setActiveView("dashboard");
          }}
        >
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>stockwise</span>
        </a>

        <button
          className="main-nav-toggle"
          type="button"
          aria-label={isMainNavOpen ? "Close main menu" : "Open main menu"}
          aria-expanded={isMainNavOpen}
          aria-controls="primary-navigation"
          onClick={() => setIsMainNavOpen((isOpen) => !isOpen)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="primary-navigation"
          className={`main-nav${isMainNavOpen ? " main-nav-open" : ""}`}
          aria-label="Main navigation"
        >
          {navigation.map((section) => (
            <details
              className="nav-dropdown"
              key={section.label}
              open={openSection === section.label}
            >
              <summary onClick={(event) => {
                event.preventDefault();
                toggleSection(section.label);
              }}>
                {section.label}
                <span className="nav-chevron" aria-hidden="true" />
              </summary>
              <div
                className={`dropdown-menu${section.label === "Masters" ? " dropdown-menu-scrollable" : ""}`}
              >
                {section.items.map((item) => {
                  if (typeof item === "string") {
                    return (
                      <a href="#" key={item} onClick={(event) => {
                        event.preventDefault();
                        handleNavigationItem(item);
                      }}>
                        {item}
                      </a>
                    );
                  }

                  if (!item.items) {
                    return (
                      <a href="#" key={item.label} onClick={(event) => {
                        event.preventDefault();
                        handleNavigationItem(item.label);
                      }}>
                        {item.label}
                      </a>
                    );
                  }

                  return (
                    <details
                      className="submenu-dropdown"
                      key={item.label}
                      open={openSubmenu === `${section.label}:${item.label}`}
                    >
                      <summary onClick={(event) => {
                        event.preventDefault();
                        toggleSubmenu(`${section.label}:${item.label}`);
                      }}>
                        {item.label}
                        <span className="submenu-chevron" aria-hidden="true" />
                      </summary>
                      <div className="submenu-menu">
                        {item.items.map((subitem) => (
                          <a
                            href="#"
                            key={subitem}
                            onClick={(event) => {
                              event.preventDefault();
                              handleNavigationItem(subitem);
                            }}
                          >
                            {subitem}
                          </a>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>
          ))}
        </nav>

        <div className="header-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
            title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
          >
            <span aria-hidden="true">{isDarkMode ? "☀" : "☾"}</span>
          </button>
          <div className="profile-menu-container" ref={profileMenuRef}>
            <button
              className="profile-button"
              type="button"
              aria-label="Account menu"
              aria-expanded={isProfileMenuOpen}
              onClick={() => setIsProfileMenuOpen((isOpen) => !isOpen)}
            >
              <span className="profile-avatar">{initials}</span>
              <span className="profile-name">{userName}</span>
              <span className="nav-chevron" aria-hidden="true" />
            </button>
            {isProfileMenuOpen && (
              <div className="profile-dropdown">
                <span className="profile-dropdown-name">{userName}</span>
                <button type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {activeView === "customer-suppliers" ? (
        <CustomerSuppliers />
      ) : activeView === "items" ? (
        <Items />
      ) : ["sale", "purchase", "saleReturn", "purchaseReturn"].includes(activeView) ? (
        <TransactionScreen
          key={activeView}
          type={activeView}
          onClose={() => setActiveView("dashboard")}
        />
      ) : (
      <>
      <section className="welcome-section">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Good morning, {userName}</h1>
          <p className="welcome-copy">Here&apos;s what&apos;s happening with your business today.</p>
        </div>
        <button className="primary-button" type="button">
          <span aria-hidden="true">+</span> Add new item
        </button>
      </section>

      <section className="dashboard-grid" aria-label="Business overview">
        <article className="overview-card">
          <p className="card-label">Total products</p>
          <p className="card-value">1,248</p>
          <p className="card-note"><span className="positive">↗ 12%</span> vs last month</p>
          <span className="card-icon inventory-icon" aria-hidden="true">▦</span>
        </article>
        <article className="overview-card">
          <p className="card-label">Stock value</p>
          <p className="card-value">$84,320</p>
          <p className="card-note"><span className="positive">↗ 8.2%</span> vs last month</p>
          <span className="card-icon value-icon" aria-hidden="true">$</span>
        </article>
        <article className="overview-card">
          <p className="card-label">Low stock items</p>
          <p className="card-value">18</p>
          <p className="card-note"><span className="attention">Needs attention</span></p>
          <span className="card-icon low-stock-icon" aria-hidden="true">!</span>
        </article>
        <article className="overview-card">
          <p className="card-label">Orders this month</p>
          <p className="card-value">356</p>
          <p className="card-note"><span className="positive">↗ 4.6%</span> vs last month</p>
          <span className="card-icon orders-icon" aria-hidden="true">⌁</span>
        </article>
      </section>

      <section className="activity-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent activity</h2>
            <p>Your latest inventory updates</p>
          </div>
          <button className="text-button" type="button">View all <span aria-hidden="true">→</span></button>
        </div>
        <div className="empty-activity">
          <span className="empty-icon" aria-hidden="true">⌁</span>
          <p>You&apos;re all caught up</p>
          <span>New activity will appear here.</span>
        </div>
      </section>
      </>
      )}
    </main>
  );
}
