import { Link, useLocation } from 'react-router-dom';

type NavigationProps = {
  connectionStatus: 'idle' | 'connected' | 'disconnected';
};

export function Navigation({ connectionStatus }: NavigationProps) {
  const location = useLocation();

  const navItems = [
    { path: '/personas', label: 'Personas', icon: '👤' },
    { path: '/workflows', label: 'Workflows', icon: '🔄' },
    { path: '/projects', label: 'Projects', icon: '📋' },
    { path: '/assistant', label: 'Assistant', icon: '🤖' },
    { path: '/mcp-test', label: 'MCP Test', icon: '🔧' }
  ];

  return (
    <nav className="flex items-center gap-6">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path || (item.path === '/personas' && location.pathname === '/');
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? 'bg-brand text-white'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
      {connectionStatus === 'connected' && (
        <span className="ml-auto flex items-center gap-1 rounded-full bg-green-900/30 px-2 py-1 text-xs text-green-400">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Connected
        </span>
      )}
      {connectionStatus === 'disconnected' && (
        <span className="ml-auto flex items-center gap-1 rounded-full bg-red-900/30 px-2 py-1 text-xs text-red-400">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          Disconnected
        </span>
      )}
    </nav>
  );
}

