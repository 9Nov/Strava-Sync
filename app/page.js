"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  // Check for URL params for success/error messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      setStatus({ type: 'success', message: `User "${params.get('name')}" added successfully!` });
      window.history.replaceState({}, '', '/'); // Clean URL
    }
    if (params.get('error')) {
      setStatus({ type: 'error', message: 'Authentication failed. Please try again.' });
      window.history.replaceState({}, '', '/');
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/sheets/users');
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (e) {
      console.error("Failed to fetch users");
    }
  };

  const handleAddUser = () => {
    if (!newUserName.trim()) return;
    // Redirect to Strava Auth with state = display name
    const authUrl = `/api/auth/oauth-redirect?state=${encodeURIComponent(newUserName)}`;
    // We actually need to build the URL on the server or simply redirect.
    // However, our API route api/auth/strava is the CALLBACK.
    // We need a way to start the flow.
    // Let's create a helper function or just construct the URL here if we had the client ID.
    // Better: Creating a route `api/auth/login` that redirects might be cleaner, 
    // OR just use the helper in `lib/strava` exposed via an API.
    // Let's assume we create a simple GET route or just do it here if we expose the Client ID.
    // Exposing Client ID is fine (public). 
    // But we need the URL construction logic.
    // Let's make a quick API route for getting the login URL to keep env vars secure if we want, or just expose NEXT_PUBLIC_STRAVA_CLIENT_ID.

    // For now, let's call an API endpoint that redirects us.
    window.location.href = `/api/auth/login?name=${encodeURIComponent(newUserName)}`;
  };

  const handleSync = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setStatus({ type: 'info', message: 'Syncing data...' });
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: selectedUser,
          startDate: startDate,
          endDate: endDate
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: data.message });
      } else {
        setStatus({ type: 'error', message: data.error || 'Sync failed.' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: 'Network error.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/30 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-orange-500/30 rounded-full blur-[100px]" />

      <div className="z-10 w-full max-w-md glass rounded-2xl p-6 sm:p-8 space-y-8 animate-fade-in-up">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-600">
            Strava Sync
          </h1>
          <p className="text-gray-300">Connect and sync your activities to Google Sheets.</p>
        </div>

        {status && (
          <div className={`p-4 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-500/20 text-green-200 border border-green-500/30' :
            status.type === 'error' ? 'bg-red-500/20 text-red-200 border border-red-500/30' :
              'bg-blue-500/20 text-blue-200 border border-blue-500/30'
            } transition-all duration-300`}>
            {status.message}
          </div>
        )}

        <div className="space-y-6">
          {/* Action 1: Add User */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2">1. Add User</h2>
            {!showAddUser ? (
              <button
                onClick={() => setShowAddUser(true)}
                className="w-full btn-secondary flex items-center justify-center gap-2 group"
              >
                <span>+ Add New User</span>
              </button>
            ) : (
              <div className="space-y-3 animate-fade-in">
                <input
                  type="text"
                  placeholder="Enter Display Name"
                  className="w-full input-field"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddUser}
                    className="flex-1 btn-primary text-sm"
                  >
                    Connect with Strava
                  </button>
                  <button
                    onClick={() => setShowAddUser(false)}
                    className="px-4 py-2 hover:text-white text-gray-400 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action 2: Sync Data */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2">2. Fetch Data</h2>
            <div className="space-y-3">
              <select
                className="w-full input-field appearance-none cursor-pointer"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="" className="text-gray-800">Select User</option>
                {users.map(u => (
                  <option key={u.stravaId} value={u.displayName} className="text-gray-800">
                    {u.displayName}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 mb-1">Start Date (Optional)</label>
                  <input
                    type="date"
                    className="input-field w-full text-sm text-gray-800"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    className="input-field w-full text-sm text-gray-800"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <button
                onClick={handleSync}
                disabled={loading || !selectedUser}
                className={`w-full btn-primary flex items-center justify-center gap-2 ${loading || !selectedUser ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Syncing...</span>
                  </>
                ) : (
                  "Fetch Data"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
