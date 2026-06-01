import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import QuestionDetail from './pages/QuestionDetail';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import ProblemLists from './pages/ProblemLists';
import ProblemListDetail from './pages/ProblemListDetail';
import Contests from './pages/Contests';
import ContestDetail from './pages/ContestDetail';
import Exams from './pages/Exams';
import ExamDetail from './pages/ExamDetail';
import Admin from './pages/Admin';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="question/:id" element={<QuestionDetail />} />
          <Route path="lists" element={<ProblemLists />} />
          <Route path="lists/:id" element={<ProblemListDetail />} />
          <Route path="contests" element={<Contests />} />
          <Route path="contests/:id" element={<ContestDetail />} />
          <Route path="exams" element={<Exams />} />
          <Route path="exams/:id" element={<ExamDetail />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;