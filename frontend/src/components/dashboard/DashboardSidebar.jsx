import { useNavigate } from "react-router-dom";

const menuItems = [
  {
    id: "overview",
    label: "Overview"
  },
  {
    id: "temporal",
    label: "Temporal Evolution"
  },
  {
    id: "hotspots",
    label: "Hotspots"
  },
  {
    id: "quality",
    label: "Quality & Structure"
  },
  {
    id: "files",
    label: "All File Metrics"
  }
];

function DashboardSidebar({
  activeSection,
  onSectionChange
}) {
  const navigate = useNavigate();

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-logo">
        <span>Health</span>
        <span>Dashboard</span>
      </div>

      <button
        type="button"
        className="dashboard-back-button"
        onClick={() => navigate("/")}
        aria-label="Back to home"
      >
        ←
      </button>

      <nav className="dashboard-navigation">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              activeSection === item.id
                ? "dashboard-nav-item active"
                : "dashboard-nav-item"
            }
            onClick={() =>
              onSectionChange(item.id)
            }
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default DashboardSidebar;