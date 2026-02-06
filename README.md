# Enterprise IT Asset & Procurement System

## 📌 Project Overview
A robust, **local-first ERP application** designed for University & Enterprise IT Departments to manage the complete lifecycle of IT assets. It streamlines **Procurement**, **Goods Receiving (GRN)**, **Inventory Management**, and **Maintenance Tracking** in a secure, offline-first environment.

### 🔐 1. Local-First Security

*   **Offline Ready:** Uses a local SQLite database (via Prisma) embedded within the application.
    
*   **Data Privacy:** Zero cloud dependency. Sensitive procurement data never leaves the local machine.
    
*   **Secure Storage:** Application data is sandboxed within the user's `AppData` directory.
    

### 📦 2. Intelligent Procurement

*   **Purchase Orders (PO):** Create, track, and manage complex purchase orders.
    
*   **Smart Parsing:** Upload PDF or Excel vendor quotes, and the system auto-extracts line items to populate the PO instantly.
    
*   **PDF Generation:** Generate professional, printable Purchase Order documents with one click.

### 🏭 3. Inventory & Goods Receipt (GRN)

*   **One-Click GRN:** Convert approved Purchase Orders directly into Inventory Assets without manual data entry.
    
*   **Dynamic Attributes:** Track specific hardware details (e.g., RAM, Storage, IP Address, MAC Address) using a flexible JSON-based schema.
    
*   **Asset Lifecycle:** Monitor asset status from "In Stock" to "Deployed," "Under Maintenance," and "Scrapped."
    

### 🔧 4. Maintenance & Support

*   **Service Logs:** Track repairs, maintenance schedules, and associated costs for every asset.
    
*   **Audit Trail:** Keep a historical record of every change made to an asset over time.

### 📊 5. Analytics & RBAC

*   **Dashboard:** Visual insights into Total Asset Value, Procurement Costs, and Category Distribution.
    
*   **Role-Based Access:** Granular permissions for **Admins** (Full Access) and **Viewers** (Read-Only), secured via password authentication.
* * *

## 🛠 Tech Stack

**Frontend:**

*   React 18 (Vite)
    
*   Tailwind CSS & Shadcn/UI (Styling)
    
*   Recharts (Analytics/Charts)
    
*   React Hook Form + Zod (Validation)
    

**Backend (Main Process):**

*   Electron.js (Desktop Environment)
    
*   Prisma ORM (Database Management)
    
*   SQLite (Embedded Database)
    
*   Node.js (Runtime)

* * *    
## 💻 Installation & Setup

### Prerequisites

*   **Node.js** (v18 or higher)
    
*   **Git**
    

### Development Setup

1.  **Clone the repository**
    
    Bash
    
        git clone https://github.com/ManikPandey/CTS_IT_AssistP1.git
        cd enterprise-it-asset-manager
    
2.  **Install Dependencies**
    
    Bash
    
        npm install
    
3.  **Initialize Database** This creates the local SQLite database and pushes the schema.
    
    Bash
    
        npx prisma generate
        npx prisma db push
4.  **Run Development Server** Starts both the React renderer and Electron main process concurrently.
    
    Bash
    
        npm run dev
* * *
## 🏗 Building for Production

To generate a standalone Windows installer (`.exe`):

1.  **Prepare the Database** Ensure your local schema is up to date.
    
    Bash
    
        npx prisma generate
    
2.  **Build the Installer** This command compiles the TypeScript, builds the React frontend, and packages everything into an NSIS installer.
    
    Bash
    
        npm run build
    
3.  **Locate Installer** The final `.exe` file will be located in the `release/` directory.
* * *
## 📂 Project Structure

Bash

    ├── electron/          # Main process (Backend logic)
    │   ├── main.ts        # Entry point
    │   ├── db.ts          # Database connection
    │   └── handlers/      # IPC Handlers (Auth, Assets, POs)
    ├── src/               # Renderer process (React Frontend)
    │   ├── components/    # Reusable UI components
    │   ├── pages/         # Application screens (Dashboard, Inventory)
    │   └── lib/           # Utilities (Excel/PDF parsers)
    ├── prisma/            # Database Config
    │   ├── schema.prisma  # Data models
    │   └── dev.db         # Local SQLite database
    └── package.json       # Dependencies & Scripts

* * *
**Developed by Manik Pandey** _VIT Bhopal University_


