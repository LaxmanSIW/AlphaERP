import { Routes, Route } from "react-router";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Buyers from "@/pages/Buyers";
import Reports from "@/pages/Reports";
import BulkUpload from "@/pages/BulkUpload";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Layout>
            <Dashboard />
          </Layout>
        }
      />
      <Route
        path="/transactions"
        element={
          <Layout>
            <Transactions />
          </Layout>
        }
      />
      <Route
        path="/buyers"
        element={
          <Layout>
            <Buyers />
          </Layout>
        }
      />
      <Route
        path="/reports"
        element={
          <Layout>
            <Reports />
          </Layout>
        }
      />
      <Route
        path="/bulk-upload"
        element={
          <Layout>
            <BulkUpload />
          </Layout>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
