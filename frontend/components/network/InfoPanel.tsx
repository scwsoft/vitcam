export const InfoPanel = () => {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
      <div className="text-blue-700 dark:text-blue-200">
        <strong className="text-blue-900 dark:text-blue-100">Network Monitoring:</strong> This
        application utilizes the Network Information API and performs real-time bandwidth
        measurements. Results may vary based on server location, network congestion, and browser
        capabilities. All test data is securely stored and linked to your authenticated session.
      </div>
    </div>
  );
};