type Props = { variant: "delivery" | "leads" | "horecah" };

export function SystemVisual({ variant }: Props) {
  if (variant === "delivery") {
    return (
      <div className="system-visual vertical-diagram delivery-visual" aria-label="Delivery intelligence system diagram">
        <div className="diagram-row diagram-sources">
          <span>Inventory</span>
          <span>Warehouse</span>
          <span>Courier</span>
          <span>Location</span>
          <span>Rules</span>
        </div>
        <div className="diagram-arrow-down" />
        <div className="diagram-core">
          <strong>EDD Engine</strong>
          <span>Delivery promise logic</span>
        </div>
        <div className="diagram-arrow-down" />
        <div className="diagram-row diagram-outputs">
          <span>Product pages</span>
          <span>Checkout</span>
          <span>Support</span>
          <span>Alerts</span>
        </div>
      </div>
    );
  }

  if (variant === "leads") {
    return (
      <div className="system-visual vertical-diagram leads-visual" aria-label="Lead capture, routing, and reporting system diagram">
        <div className="diagram-row lead-touchpoints">
          <span>Website</span>
          <span>Campaigns</span>
          <span>Store</span>
          <span>Forms</span>
        </div>
        <div className="diagram-arrow-down" />
        <div className="diagram-core lead-core">
          <strong>Lead Service</strong>
          <span>Enrich, route, sync</span>
        </div>
        <div className="diagram-arrow-down" />
        <div className="diagram-row diagram-targets">
          <span>Sales</span>
          <span>CRM</span>
          <span>Messaging</span>
          <span>Database</span>
          <span>Analytics</span>
        </div>
      </div>
    );
  }

  return (
    <div className="system-visual device-visual" aria-label="Shared application across web, Android, and iOS">
      <div className="shared-core-frame">
        <span className="shared-core-label">Shared core</span>
        <div className="platform-device">
          <svg className="platform-icon pc-icon" viewBox="0 0 48 48" aria-hidden="true">
            <rect x="7" y="8" width="34" height="22" rx="3" />
            <path d="M18 39h12M24 30v9" />
            <path d="M12 14h24" />
          </svg>
          <strong>Web</strong>
        </div>
        <div className="platform-device">
          <svg className="platform-icon android-icon" viewBox="0 0 48 48" aria-hidden="true">
            <rect x="14" y="10" width="20" height="30" rx="4" />
            <path d="M19 18h10v12a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V18Z" />
            <path d="M21 18l-2-4M27 18l2-4" />
            <path d="M17 22v6M31 22v6M21 32v4M27 32v4" />
            <circle cx="22" cy="23" r="1" />
            <circle cx="26" cy="23" r="1" />
          </svg>
          <strong>Android</strong>
        </div>
        <div className="platform-device">
          <svg className="platform-icon ios-icon" viewBox="0 0 48 48" aria-hidden="true">
            <rect x="15" y="6" width="18" height="36" rx="5" />
            <path d="M21 10h6" />
            <path d="M21 35h6" />
            <rect x="19" y="16" width="4" height="4" rx="1" />
            <rect x="25" y="16" width="4" height="4" rx="1" />
            <rect x="19" y="23" width="4" height="4" rx="1" />
            <rect x="25" y="23" width="4" height="4" rx="1" />
          </svg>
          <strong>iOS</strong>
        </div>
      </div>
    </div>
  );
}
