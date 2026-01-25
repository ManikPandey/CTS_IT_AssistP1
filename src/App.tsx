import React from 'react';

function App() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100">
      <div className="text-center p-10 bg-white shadow-xl rounded-xl">
        <h1 className="text-4xl font-bold text-indigo-700 mb-4">IT Asset Manager V2</h1>
        <p className="text-gray-600 mb-6">Enterprise Edition - Phase 1 Complete</p>
        <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          System Status: Online
        </button>
      </div>
    </div>
  );
}

export default App;