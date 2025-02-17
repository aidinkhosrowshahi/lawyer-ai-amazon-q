import React from 'react';
import { Table, StatusIndicator, Box } from "@cloudscape-design/components";

export const JobStatus = ({ caseId }) => {
  const [jobStatus, setJobStatus] = React.useState(null);
  const [error, setError] = React.useState(null);

  const checkJobStatus = React.useCallback(async (caseId) => {
    try {
      const response = await fetch(`https://g9wfjzx5c8.execute-api.us-east-1.amazonaws.com/dev/cases/${caseId}`);
      const data = await response.json();
      setJobStatus(data);
      
      // Continue polling if job is not complete
      if (data.status !== "SUCCEEDED" && data.status !== "FAILED") {
        setTimeout(() => checkJobStatus(caseId), 5000); // Poll every 5 seconds
      }
    } catch (error) {
      console.error("Error checking job status:", error);
      setError("Failed to fetch job status");
    }
  }, []);

  React.useEffect(() => {
    if (caseId) {
      checkJobStatus(caseId);
    }
  }, [caseId, checkJobStatus]);

  if (!jobStatus) return null;

  return (
    <Box margin={{ bottom: 'l' }}>
      <Table
        columnDefinitions={[
          {
            id: "status",
            header: "Job Status",
            cell: item => (
              <StatusIndicator type={
                item.status === "SUCCEEDED" ? "success" :
                item.status === "FAILED" ? "error" :
                "in-progress"
              }>
                {item.status}
              </StatusIndicator>
            )
          },
          {
            id: "caseId",
            header: "Case ID",
            cell: item => item.caseId
          },
          {
            id: "timestamp",
            header: "Last Updated",
            cell: item => new Date(parseInt(item.timestamp)).toLocaleString()
          }
        ]}
        items={[jobStatus]}
        loadingText="Loading job status..."
        empty={
          <Box textAlign="center" color="inherit">
            <b>No job status available</b>
          </Box>
        }
      />
      {error && (
        <Box color="error" padding={{ top: 's' }}>
          {error}
        </Box>
      )}
    </Box>
  );
};