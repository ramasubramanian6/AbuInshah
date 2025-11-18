import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Type Definitions
type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  photoUrl?: string;
};

type DashboardStats = {
  totalUsers: number;
  healthAdvisors: number;
  wealthManagers: number;
  designatedUsers: number;
};

// Mobile-optimized Dashboard Card Component
const MobileDashboardCard = ({ title, value, icon }) => (
  <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
    <div className="flex items-center gap-2">
      <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
        <span className="text-lg">{icon}</span>
      </div>
      <div>
        <h3 className="font-semibold text-gray-600 text-xs mb-0.5">{title}</h3>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

// Desktop-optimized Dashboard Card Component
const DesktopDashboardCard = ({ title, value, description, icon }) => (
  <div className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-all duration-300">
    <div className="flex items-start gap-3">
      <div className="bg-blue-50 p-3 rounded-lg flex-shrink-0">
        <span className="text-2xl">{icon}</span>
      </div>
      <div>
        <h3 className="font-semibold text-gray-600 text-sm mb-1">{title}</h3>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  </div>
);


// Main AdminPanel Component
const AdminPanel = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalUsers: 0,
    healthAdvisors: 0,
    wealthManagers: 0,
    designatedUsers: 0,
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'list' | 'edit'>('dashboard');

  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_URL;

  const userListRef = useRef<HTMLDivElement>(null);
  const [userListMaxHeight, setUserListMaxHeight] = useState('300px');

  // Callback to calculate dashboard statistics from user data
  const calculateDashboardStats = useCallback((usersList: User[]) => {
    const stats = usersList.reduce((acc, user) => {
      const designations = user.designation?.split(',').map(d => d.trim()) ?? [];
      const isHa = designations.includes('Health insurance advisor');
      const isWm = designations.includes('Wealth Manager');
      if (isHa) acc.healthAdvisors++;
      if (isWm) acc.wealthManagers++;
      if (isHa || isWm) acc.designatedUsers++;
      return acc;
    }, { healthAdvisors: 0, wealthManagers: 0, designatedUsers: 0 });
    setDashboardStats({ ...stats, totalUsers: usersList.length });
  }, []);

  // Fetch users from the API
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}api/users`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(response.status === 401 ? 'Please login again' : 'Failed to connect to server');
      }
      const data = await response.json();
      setUsers(data);
      calculateDashboardStats(data);
      setError(null);
    } catch (err) {
      setUsers([]);
      setDashboardStats({ totalUsers: 0, healthAdvisors: 0, wealthManagers: 0, designatedUsers: 0 });
      setError(err instanceof Error ? err.message : 'Failed to fetch users. Please try again later.');
      if (err instanceof Error && err.message === 'Please login again') {
        navigate('/admin-login');
      }
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, calculateDashboardStats, navigate]);

  // Initial fetch on component mount
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);


  // Effect to calculate max-height for user list dynamic scrolling
  useEffect(() => {
    const calculateHeight = () => {
      if (userListRef.current) {
        const headerElement = document.querySelector('header');
        const headerHeight = headerElement ? headerElement.offsetHeight : 0;
        const bottomPadding = 20; // Corresponds to pb-20 in main
        const userListTop = userListRef.current.getBoundingClientRect().top;
        const viewportHeight = window.innerHeight;
        const dynamicHeight = viewportHeight - userListTop - bottomPadding;
        setUserListMaxHeight(`${Math.max(250, dynamicHeight)}px`);
      }
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, [error, editingUser, activeTab, users]);

  // Handle user logout
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}api/admin/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      navigate('/admin-login');
    }
  };

  // Handle user deletion with confirmation
  const handleDelete = (id: string) => {
    setConfirmMessage('Are you sure you want to delete this user? This cannot be undone.');
    setConfirmAction(() => async () => {
      try {
        const response = await fetch(`${API_BASE_URL}api/users/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          throw new Error('Failed to delete user.');
        }
        const updatedUsers = users.filter(u => u.id !== id);
        setUsers(updatedUsers);
        calculateDashboardStats(updatedUsers);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete user.');
      } finally {
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  // Handle user editing
  const handleEdit = (user: User) => {
    setEditingUser({ ...user });
    if (window.innerWidth < 640) { // For mobile screens
      setActiveTab('edit');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle user update submission
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const response = await fetch(`${API_BASE_URL}api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update failed');
      const updatedUsers = users.map(u => u.id === editingUser.id ? data.user : u);
      setUsers(updatedUsers);
      calculateDashboardStats(updatedUsers);
      setEditingUser(null);
      if (window.innerWidth < 640) {
        setActiveTab('list');
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingUser(null);
    if (window.innerWidth < 640) {
      setActiveTab('list');
    }
  };

  // Handle user search by email
  const handleSearch = () => {
    const foundUser = users.find(u => u.email.toLowerCase() === searchEmail.trim().toLowerCase());
    if (foundUser) {
      handleEdit(foundUser);
      setError(null);
    } else {
      setError('User not found with this email.');
    }
  };

  // --- Render Functions for Content Sections ---

  const renderDashboardCards = (isMobileView: boolean) => (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-6">
      {isMobileView ? (
        <>
          <MobileDashboardCard title="Total Users" value={loading ? '-' : dashboardStats.totalUsers.toString()} icon="👥" />
          <MobileDashboardCard title="Health Advisors" value={loading ? '-' : dashboardStats.healthAdvisors.toString()} icon="⚕️" />
          <MobileDashboardCard title="Wealth Managers" value={loading ? '-' : dashboardStats.wealthManagers.toString()} icon="📈" />
          <MobileDashboardCard title="Designated" value={loading ? '-' : dashboardStats.designatedUsers.toString()} icon="🤝" />
        </>
      ) : (
        <>
          <DesktopDashboardCard title="Total Users" value={loading ? '-' : dashboardStats.totalUsers.toString()} description="All registered members" icon="👥" />
          <DesktopDashboardCard title="Health Advisors" value={loading ? '-' : dashboardStats.healthAdvisors.toString()} description="Health Insurance Advisors" icon="⚕️" />
          <DesktopDashboardCard title="Wealth Managers" value={loading ? '-' : dashboardStats.wealthManagers.toString()} description="Wealth Management Team" icon="📈" />
          <DesktopDashboardCard title="Designated Users" value={loading ? '-' : dashboardStats.designatedUsers.toString()} description="Users with specific roles" icon="🤝" />
        </>
      )}
    </div>
  );

  const renderSearchSectionContent = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="email"
            placeholder="Enter member's email..."
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
          />
        </div>
        <button
          onClick={handleSearch}
          className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
          aria-label="Search user by email"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Search Member</span>
        </button>
      </div>
    </div>
  );

  const renderUserListContent = () => (
    <div className="space-y-3">
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading members...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No members found</p>
        </div>
      ) : (
        <div
          ref={userListRef}
          className="space-y-3 overflow-y-auto pr-2 custom-scrollbar"
          style={{ maxHeight: userListMaxHeight }}
        >
          {users.map(user => (
            <div key={user.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-full sm:w-auto flex items-center gap-3 flex-shrink-0">
                <img
                  src={user.photoUrl ? `${API_BASE_URL}/${user.photoUrl}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff`}
                  alt={user.name}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-blue-200 flex-shrink-0"
                  onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=dc2626&color=fff`; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base sm:text-lg text-gray-800 truncate">{user.name}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">{user.email}</p>
                  <p className="text-xs sm:text-sm text-gray-500">{user.phone}</p>
                </div>
              </div>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 flex-wrap mt-2 sm:mt-0 ml-auto">
                <div className="flex flex-wrap gap-1 justify-start sm:justify-end">
                  {(user.designation || '').split(',').map((d, i) => d.trim() && (
                    <span key={i} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">{d.trim()}</span>
                  ))}
                </div>
                <div className="flex flex-row gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                  <button
                    onClick={() => handleEdit(user)}
                    className="flex-1 sm:flex-initial bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600 transition-colors flex items-center justify-center gap-1 text-xs sm:text-sm"
                    aria-label={`Edit ${user.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="flex-1 sm:flex-initial bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-1 text-xs sm:text-sm"
                    aria-label={`Delete ${user.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderEditFormContent = () => (
    <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md border">
      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Edit Member</h2>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close edit form"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-medium text-gray-700">Full Name</label>
            <input
              id="fullName"
              type="text"
              value={editingUser?.name || ''}
              onChange={(e) => setEditingUser({ ...editingUser!, name: e.target.value })}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              required
              placeholder="Enter full name"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              value={editingUser?.email || ''}
              className="w-full p-3 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm sm:text-base"
              disabled
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number</label>
            <input
              id="phone"
              type="tel"
              value={editingUser?.phone || ''}
              onChange={(e) => setEditingUser({ ...editingUser!, phone: e.target.value })}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              required
              placeholder="Enter phone number"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="designation" className="text-sm font-medium text-gray-700">Designation</label>
            <select
              id="designation"
              value={editingUser?.designation || ''}
              onChange={(e) => setEditingUser({ ...editingUser!, designation: e.target.value })}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              required
            >
              <option value="">Select Designation</option>
              <option value="Health insurance advisor">Health Insurance Advisor</option>
              <option value="Wealth Manager">Wealth Manager</option>
              <option value="Health insurance advisor,Wealth Manager">Both Roles</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            type="submit"
            className="w-full sm:w-auto bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Save Changes</span>
          </button>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="w-full sm:w-auto bg-gray-500 text-white px-8 py-3 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Cancel</span>
          </button>
        </div>
      </form>
    </section>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Fixed Top Header/Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Marketing Poster</h1>
          </div>
          {/* Desktop Navigation (hidden on mobile) */}
          <nav className="hidden sm:flex items-center gap-4">
            <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors text-sm sm:text-base">Home</a>
            <a href="/register" className="text-gray-600 hover:text-gray-900 transition-colors text-sm sm:text-base">Register</a>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base"
              aria-label="Logout"
            >
              Logout
            </button>
          </nav>
        </div>
        {/* Mobile Navigation Tabs (hidden on desktop) */}
        <div className="flex border-t sm:hidden">
          <button
            onClick={() => { setActiveTab('dashboard'); setEditingUser(null); }}
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'dashboard' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => { setActiveTab('search'); setEditingUser(null); }}
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'search' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            Search
          </button>
          <button
            onClick={() => { setActiveTab('list'); setEditingUser(null); }}
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            Members ({users.length})
          </button>
          {editingUser && (
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex-1 py-2 text-sm font-medium ${activeTab === 'edit' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            >
              Edit
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 pt-[100px] pb-20 sm:pt-[120px] sm:pb-8 overflow-y-auto">
        <div className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex justify-between items-center animate-fade-in text-sm sm:text-base">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700 transition-colors"
                aria-label="Dismiss alert"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Mobile Content Display - based on activeTab (visible only on small screens) */}
          <div className="sm:hidden">
            {activeTab === 'dashboard' && (
              <section className="mt-4">
                {renderDashboardCards(true)}
              </section>
            )}
            {activeTab === 'search' && (
              <section className="bg-white p-4 rounded-xl shadow-md border mt-4">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Search Member</h2>
                {renderSearchSectionContent()}
              </section>
            )}
            {activeTab === 'list' && (
              <section className="bg-white p-4 rounded-xl shadow-md border mt-4">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Registered Members</h2>
                {renderUserListContent()}
              </section>
            )}
            {activeTab === 'edit' && editingUser && (
              <section className="mt-4">
                {renderEditFormContent()}
              </section>
            )}
          </div>

          {/* Desktop Content Display - always visible (visible only on large screens) */}
          <div className="hidden sm:block">
            <section className="mt-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Dashboard Overview</h2>
                {renderDashboardCards(false)}
            </section>

            <section className="bg-white p-4 sm:p-6 rounded-xl shadow-md border relative mt-6">
                <div className="mb-6 sticky top-0 bg-white z-20 pb-4 border-b">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Search Member</h2>
                    {renderSearchSectionContent()}
                </div>

                {editingUser && (
                    <div className="mb-6">
                        {renderEditFormContent()}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 sticky top-[calc(120px + (var(--edit-form-height,0)))] bg-white py-2 z-10 border-b">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Registered Members</h2>
                        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                            {users.length} total
                        </span>
                    </div>
                    {users.length > 0 && (
                        <div className="text-sm text-gray-500">
                            Scroll to see more members
                        </div>
                    )}
                </div>

                {renderUserListContent()}
            </section>
          </div>
        </div>
      </main>

      {/* Floating Logout Button for Mobile */}
      <button
        onClick={handleLogout}
        className="fixed bottom-4 right-4 bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg z-40 sm:hidden flex items-center justify-center"
        aria-label="Logout"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl max-w-sm w-full text-center">
            <p className="text-lg sm:text-xl font-semibold text-gray-800 mb-6">{confirmMessage}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400 text-sm sm:text-base"
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => { confirmAction?.(); setShowConfirmModal(false); }}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 text-sm sm:text-base"
                aria-label="Confirm action"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { AdminPanel };
