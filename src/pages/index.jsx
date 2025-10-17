import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Components from "./Components";

import Dinosaurs from "./Dinosaurs";

import Sales from "./Sales";

import Search from "./Search";

import BOMManagement from "./BOMManagement";

import Devices from "./Devices";

import DinosaurVersions from "./DinosaurVersions";

import QualityControl from "./QualityControl";

import InventoryManagement from "./InventoryManagement";

import OperatorManagement from "./OperatorManagement";

import OperatorLogin from "./OperatorLogin";

import Shipping from "./Shipping";

import CountdownToChristmas from "./CountdownToChristmas";

import QuickQC from "./QuickQC";

import SlackBotDiagnostics from "./SlackBotDiagnostics";

import WarehouseManagement from "./WarehouseManagement";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {

    Dashboard: Dashboard,

    Components: Components,

    Dinosaurs: Dinosaurs,

    Sales: Sales,

    Search: Search,

    BOMManagement: BOMManagement,

    Devices: Devices,

    DinosaurVersions: DinosaurVersions,

    QualityControl: QualityControl,

    InventoryManagement: InventoryManagement,

    OperatorManagement: OperatorManagement,

    OperatorLogin: OperatorLogin,

    Shipping: Shipping,

    CountdownToChristmas: CountdownToChristmas,

    QuickQC: QuickQC,

    WarehouseManagement: WarehouseManagement,

}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

export default function Pages() {
    return (
        <Routes>
            <Route path="/" element={<Layout currentPageName="Dashboard"><Dashboard /></Layout>} />
            <Route path="/Dashboard" element={<Layout currentPageName="Dashboard"><Dashboard /></Layout>} />
            <Route path="/Components" element={<Layout currentPageName="Components"><Components /></Layout>} />
            <Route path="/Dinosaurs" element={<Layout currentPageName="Dinosaurs"><Dinosaurs /></Layout>} />
            <Route path="/Sales" element={<Layout currentPageName="Sales"><Sales /></Layout>} />
            <Route path="/Search" element={<Layout currentPageName="Search"><Search /></Layout>} />
            <Route path="/BOMManagement" element={<Layout currentPageName="BOMManagement"><BOMManagement /></Layout>} />
            <Route path="/Devices" element={<Layout currentPageName="Devices"><Devices /></Layout>} />
            <Route path="/DinosaurVersions" element={<Layout currentPageName="DinosaurVersions"><DinosaurVersions /></Layout>} />
            <Route path="/QualityControl" element={<Layout currentPageName="QualityControl"><QualityControl /></Layout>} />
            <Route path="/InventoryManagement" element={<Layout currentPageName="InventoryManagement"><InventoryManagement /></Layout>} />
            <Route path="/OperatorManagement" element={<Layout currentPageName="OperatorManagement"><OperatorManagement /></Layout>} />
            <Route path="/OperatorLogin" element={<OperatorLogin />} />
            <Route path="/Shipping" element={<Layout currentPageName="Shipping"><Shipping /></Layout>} />
            <Route path="/CountdownToChristmas" element={<CountdownToChristmas />} />
            <Route path="/QuickQC" element={<Layout currentPageName="QuickQC"><QuickQC /></Layout>} />
            {/* SlackBotDiagnostics and FirebaseBackup removed as requested */}
            <Route path="/WarehouseManagement" element={<Layout currentPageName="WarehouseManagement"><WarehouseManagement /></Layout>} />
        </Routes>
    );
}
