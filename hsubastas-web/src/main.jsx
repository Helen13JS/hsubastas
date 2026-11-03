import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./modules/auth/auth.css";
import "./modules/auctions/marketplace.css";
import "./assets/portal.css";
createRoot(document.getElementById("root")).render(<AuthProvider><App /></AuthProvider>);
