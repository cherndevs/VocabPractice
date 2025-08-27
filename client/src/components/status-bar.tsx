export default function StatusBar() {
  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className="flex justify-between items-center px-4 py-2 text-sm font-medium text-foreground">
      <span data-testid="text-current-time">{getCurrentTime()}</span>
      <div className="flex items-center space-x-1">
        {/* Signal strength */}
        <div className="flex space-x-1">
          <div className="w-1 h-4 bg-foreground rounded-full"></div>
          <div className="w-1 h-4 bg-foreground rounded-full"></div>
          <div className="w-1 h-4 bg-foreground rounded-full"></div>
          <div className="w-1 h-4 bg-muted rounded-full"></div>
        </div>
        {/* WiFi icon */}
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.24 0 1 1 0 01-1.415-1.415 5 5 0 017.07 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 112 0 1 1 0 01-2 0z" clipRule="evenodd"></path>
        </svg>
        {/* Battery */}
        <div className="w-6 h-3 border border-foreground rounded-sm">
          <div className="w-5 h-2 bg-foreground rounded-sm m-0.5"></div>
        </div>
      </div>
    </div>
  );
}
