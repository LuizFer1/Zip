import React from "react";
import { Topbar } from "./topbar.jsx";
import { LeftSidebar } from "./left-sidebar.jsx";
import { LeftMainbar } from "./left-mainbar.jsx";
import { MainPanel } from "./main-panel.jsx";
import { RightSidebar } from "./right-sidebar.jsx";

export function Layout() {
  return (
  <>
    <Topbar />
    <div className="workspace">
      <LeftSidebar />
      <section className="main-layout">
        <LeftMainbar />
        <MainPanel />
      </section>
      <RightSidebar />
    </div>
  </>
  );
}
