type Props = { variant: "delivery" | "leads" | "horecah" };

export function SystemVisual({ variant }: Props) {
  if (variant === "delivery") {
    return (
      <div className="system-visual delivery-visual" aria-label="Simplified delivery intelligence system diagram">
        <div className="node node-main">Delivery Engine</div>
        <div className="node node-a">Inventory</div>
        <div className="node node-b">Courier</div>
        <div className="node node-c">Location</div>
        <div className="node node-d">Rules</div>
        <span className="pulse pulse-1" />
        <span className="pulse pulse-2" />
      </div>
    );
  }

  if (variant === "leads") {
    return (
      <div className="system-visual leads-visual" aria-label="Simplified lead routing system diagram">
        <div className="flow-source">Touchpoints</div>
        <div className="flow-line" />
        <div className="flow-core">Lead Service</div>
        <div className="flow-branches">
          <span>Sales</span><span>CRM</span><span>Messaging</span>
        </div>
      </div>
    );
  }

  return (
    <div className="system-visual device-visual" aria-label="Shared application across web, Android, and iOS">
      <div className="device desktop"><span>Web</span></div>
      <div className="device phone"><span>Android</span></div>
      <div className="device phone phone-small"><span>iOS</span></div>
      <div className="shared-core">Shared core</div>
    </div>
  );
}
