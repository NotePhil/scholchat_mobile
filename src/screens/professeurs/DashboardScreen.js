import React from "react";
import MainDashboard from "./components/MainDashboard";

const DashboardScreen = ({ navigation, onLogout }) => {
  return <MainDashboard navigation={navigation} onLogout={onLogout} />;
};

export default DashboardScreen;
