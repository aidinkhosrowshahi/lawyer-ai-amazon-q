# How to Check Job Status

The job status can be checked in the following ways:

1. After submitting a job, the status will be automatically displayed in the UI using a status indicator that shows:
   - Success (green) when the job is completed successfully
   - Error (red) when the job has failed
   - In Progress (blue) while the job is still running

2. The status automatically updates every 5 seconds until the job completes.

3. The status indicator will show one of these states:
   - SUCCEEDED
   - FAILED
   - IN_PROGRESS

4. If you don't see the status, make sure:
   - You have submitted a job (you should have a case ID)
   - You are logged into the application
   - You are looking at the page where you submitted the job

Note: The job status is fetched from the API endpoint: `https://g9wfjzx5c8.execute-api.us-east-1.amazonaws.com/dev/cases/{caseId}`
where `{caseId}` is the ID of your submitted job.