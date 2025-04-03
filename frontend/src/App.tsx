import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Web3ReactProvider } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Payments from './pages/Payments';
import ProjectDetail from './pages/ProjectDetail';

const queryClient = new QueryClient();

function getLibrary(provider: any) {
  return new Web3Provider(provider);
}

function App() {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="min-h-screen bg-gray-100">
            <Navbar />
            <main className="py-10">
              <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:id" element={<ProjectDetail />} />
                  <Route path="/payments" element={<Payments />} />
                </Routes>
              </div>
            </main>
          </div>
        </Router>
      </QueryClientProvider>
    </Web3ReactProvider>
  );
}

export default App;
