import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import VeytrixEditor from "../editor screen";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VeytrixEditor />
  </StrictMode>,
);
