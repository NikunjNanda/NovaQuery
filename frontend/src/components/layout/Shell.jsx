import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

/**
 * Global application layout shell.
 * 
 * @param {Object} props
 * @param {'workspace' | 'schema' | 'practice'} props.activeTab - Currently active tab
 * @param {Function} props.onSelectTab - Tab switch callback
 * @param {Object} props.datasetInfo - Dataset summary { name, rows, cols }
 * @param {Object} props.profile - Dataset profile { table_name, total_rows, columns }
 * @param {Array} props.history - Query history items
 * @param {string|null} props.activeHistoryId - Selected history id
 * @param {Function} props.onSelectHistory - History select callback
 * @param {Function} props.onRefreshSchema - Re-fetch profile callback
 * @param {Function} props.onOpenUpload - Open upload modal callback
 * @param {Function} props.onOpenHelp - Open help modal callback
 * @param {React.ReactNode} props.children - Main body content
 */
export default function Shell({
  activeTab,
  onSelectTab,
  datasetInfo,
  profile,
  history,
  activeHistoryId,
  onSelectHistory,
  onRefreshSchema,
  onOpenUpload,
  onOpenHelp,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        datasetInfo={datasetInfo}
        onOpenUpload={onOpenUpload}
        onOpenHelp={onOpenHelp}
      />

      {/* Main App Container with Sidebar & Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          profile={profile}
          history={history}
          activeHistoryId={activeHistoryId}
          onSelectHistory={onSelectHistory}
          onRefreshSchema={onRefreshSchema}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Mobile Sidebar Toggle Bar */}
          <div className="lg:hidden flex items-center justify-between px-4 py-2 border-b border-[#1a243a] bg-[#0a0e1a]">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-2 text-xs font-mono text-slate-300 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800"
            >
              <Menu className="w-3.5 h-3.5 text-violet-400" />
              <span>Schema & History</span>
            </button>
            {datasetInfo && (
              <span className="text-xs font-mono text-slate-400 truncate max-w-[200px]">
                {datasetInfo.name}
              </span>
            )}
          </div>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex flex-col gap-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
