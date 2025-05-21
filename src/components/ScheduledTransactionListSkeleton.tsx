import React from "react";
import { Skeleton } from "@mui/material";
import { useIsMobile } from "@/hooks/useIsMobile";

function getMobileSkeletonRow() {
  return (
    <tr>
      <td style={{ padding: "1.2rem 0.5rem", border: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "1.1em" }}>
              <Skeleton width="80%" sx={{ bgcolor: "var(--secondary)" }} />
            </div>
            <div style={{ fontSize: "0.97em", color: "#888" }}>
              <Skeleton width="60%" sx={{ bgcolor: "var(--secondary)" }} />
            </div>
            <div style={{ fontSize: "0.97em", color: "#888" }}>
              <Skeleton width="50%" sx={{ bgcolor: "var(--secondary)" }} />
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 110 }}>
            <div
              style={{
                color: "var(--accent-red)",
                fontWeight: 600,
                fontSize: "1.1em",
              }}
            >
              <Skeleton width="60%" sx={{ bgcolor: "var(--secondary)" }} />
            </div>
            <div style={{ fontSize: "0.97em", color: "#888" }}>
              <Skeleton width="50%" sx={{ bgcolor: "var(--secondary)" }} />
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function getDesktopSkeletonRow() {
  return (
    <tr>
      <td>
        <Skeleton width="80%" sx={{ bgcolor: "var(--secondary)" }} />
      </td>
      <td>
        <Skeleton width="60%" sx={{ bgcolor: "var(--secondary)" }} />
      </td>
      <td>
        <Skeleton width="50%" sx={{ bgcolor: "var(--secondary)" }} />
      </td>
      <td>
        <Skeleton width="60%" sx={{ bgcolor: "var(--secondary)" }} />
      </td>
      <td>
        <Skeleton width="70%" sx={{ bgcolor: "var(--secondary)" }} />
      </td>
      <td>
        <Skeleton width="60%" sx={{ bgcolor: "var(--secondary)" }} />
      </td>
    </tr>
  );
}

export default function ScheduledTransactionListSkeleton({
  rows = 5,
}: {
  rows?: number;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="card-accent" style={{ padding: 0 }}>
        <table
          className="table"
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            width: "100%",
          }}
        >
          <tbody>
            {[...Array(rows)].map((_, idx) =>
              React.cloneElement(getMobileSkeletonRow(), { key: idx })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="card-accent" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Value</th>
            <th>Type</th>
            <th>Category</th>
            <th>Schedule</th>
            <th>Next Run</th>
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, idx) =>
            React.cloneElement(getDesktopSkeletonRow(), { key: idx })
          )}
        </tbody>
      </table>
    </div>
  );
}
