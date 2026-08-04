import React from "react";
import MainDashboard from "./components/MainDashboard";

interface DashboardScreenProps {
  onLogout: () => void;
  [key: string]: unknown;
}

const DashboardScreen = ({ onLogout }: DashboardScreenProps) => {
  return <MainDashboard onLogout={onLogout} />;
};

export default DashboardScreen;
