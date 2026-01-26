import React, { useEffect, useState } from 'react';
import { Search, Plus, FileSpreadsheet, Edit2, FolderPlus, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Inventory() {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load Categories
  const loadCategories = async () => {
    const res = await window.api.getCategories();
    if (res.success) setCategories(res.data);
  };

  useEffect(() => { loadCategories(); }, []);

  // Load Assets
  const loadAssets = async () => {
    setLoading(true);
    const res = await window.api.getAssets(selectedCatId || undefined);
    if (res.success) setAssets(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadAssets();
  }, [selectedCatId]);

  // Actions
  const handleCreateCategory = async () => {
    const name = prompt("Enter new Category Name:");
    if (!name) return;
    const res = await window.api.createCategory({ name });
    if (res.success) loadCategories();
    else alert(res.error);
  };

  const handleEditCategory = async (cat: any) => {
    const newName = prompt("Rename Category:", cat.name);
    if (!newName || newName === cat.name) return;
    const res = await window.api.updateCategory(cat.id, { name: newName });
    if (res.success) loadCategories();
    else alert(res.error);
  };

  const handleImport = async () => {
    if(!confirm("Please ensure your Excel file has at least a 'Category' column. Continue?")) return;
    
    setLoading(true);
    const res = await window.api.importExcel();
    setLoading(false);

    if (res.success) {
      alert(`Import Complete!\nProcessed: ${res.report.total}\nSuccess: ${res.report.success}\nErrors: ${res.report.errors.length}`);
      
      if (res.report.errors.length > 0) {
        console.error("Import Errors:", res.report.errors);
        alert("Some rows failed. Check console (Ctrl+Shift+I) for details.");
      }
      
      loadCategories(); 
      loadAssets();     
    } else if (res.error !== "No file selected") {
      alert("Import Failed: " + res.error);
    }
  };

  // NEW EXPORT FUNCTION
  const handleExport = async () => {
    setLoading(true);
    const res = await window.api.exportExcel();
    setLoading(false);

    if (res.success) {
      alert("Report generated successfully!\nLocation: " + res.filePath);
    } else if (res.error !== "Export cancelled") {
      alert("Export Failed: " + res.error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-8">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Categories</h2>
            <button onClick={handleCreateCategory} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded" title="Add Category">
                <FolderPlus size={16} />
            </button>
        </div>
        
        <div className="space-y-1 flex-1">
          <button
            onClick={() => setSelectedCatId(null)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors",
              selectedCatId === null ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
            )}
          >
            All Assets
          </button>
          {categories.map((cat) => (
            <div key={cat.id} className="group relative flex items-center">
                <button
                onClick={() => setSelectedCatId(cat.id)}
                className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors pr-8",
                    selectedCatId === cat.id ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
                )}
                >
                {cat.name}
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600"
                >
                    <Edit2 size={12} />
                </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search assets..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleImport} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors">
              <Upload className="w-4 h-4 text-blue-600" />
              Import Excel
            </button>
            {/* EXPORT BUTTON - Linked to handleExport */}
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors">
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              Export
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" />
              Add Asset
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-64">Asset Details</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-48">Category</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Specifications</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-24">Status</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading assets...</td></tr>
              ) : assets.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-gray-500">
                    <p className="text-lg font-medium text-gray-900">No assets found</p>
                    <p className="text-sm">Import an Excel file or add a new asset.</p>
                </td></tr>
              ) : (
                assets.map((asset) => {
                  let props: any = {};
                  try { props = JSON.parse(asset.properties); } catch(e) {}
                  
                  // Extract core fields (Name and Serial) to display prominently in the first column
                  const name = props['name'] || props['Name'] || 'Asset';
                  const serial = props['serial no'] || props['Serial No'] || props['Serial'] || '-';
                  
                  // Filter out Name and Serial from the "Specifications" list to avoid duplication
                  // Also filter out empty values to keep the UI clean
                  const specString = Object.entries(props)
                    .filter(([key, val]) => {
                      const k = key.toLowerCase();
                      return k !== 'name' && k !== 'serial no' && k !== 'serial' && val !== '';
                    })
                    .map(([k, v]) => `<span class="font-semibold text-gray-600">${k}:</span> ${v}`)
                    .join(' • ');

                  // Safe access for potentially deeply nested values
                  const categoryName = asset.subCategory?.category?.name || 'Unknown';
                  const subCategoryName = asset.subCategory?.name || 'General';

                  return (
                    <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">{name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">SN: {serial}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                         <div className="font-medium text-gray-700">{categoryName}</div>
                         <div className="text-xs text-gray-400">{subCategoryName}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        {/* Render the filtered specs. If none remain, show "No specs" */}
                        <div dangerouslySetInnerHTML={{ __html: specString || '<span class="italic text-gray-400">No specs</span>' }} />
                      </td>
                      <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              {asset.status}
                          </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900">Edit</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}