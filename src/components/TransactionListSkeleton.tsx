import React from "react";
import { Skeleton } from "@mui/material";

export default function TransactionListSkeleton({
  rows = 5,
}: {
  rows?: number;
}) {
  return (
    <div className="card-accent" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Value</th>
            <th>Type</th>
            <th>Category</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <tr key={i}>
              <td>
                <Skeleton width="80%" />
              </td>
              <td>
                <Skeleton width="60%" />
              </td>
              <td>
                <Skeleton width="50%" />
              </td>
              <td>
                <Skeleton width="70%" />
              </td>
              <td>
                <Skeleton width="60%" />
              </td>
              <td style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "flex",
                    gap: 6,
                    justifyContent: "flex-end",
                  }}
                >
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="circular" width={32} height={32} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
