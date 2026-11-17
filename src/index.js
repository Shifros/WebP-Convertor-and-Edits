import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { installAgentApi } from "./agent-api";

installAgentApi();
createRoot(document.getElementById("root")).render(<App />);
