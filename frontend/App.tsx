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
import ExamRecords from './pages/ExamRecords';
import Admin from './pages/Admin';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';

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
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="question/:id" element={<QuestionDetail />} />
          <Route path="lists" element={<ProblemLists />} />
          <Route path="lists/:id" element={<ProblemListDetail />} />
          <Route path="contests" element={<Contests />} />
          <Route path="contests/:id" element={<ContestDetail />} />
          <Route path="groups" element={<Groups />} />
          <Route path="groups/:id" element={<GroupDetail />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="exams" element={<Exams />} />
          <Route path="exams/records" element={<PrivateRoute><ExamRecords /></PrivateRoute>} />
          <Route path="exams/:id" element={<PrivateRoute><ExamDetail /></PrivateRoute>} />
          <Route path="profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
