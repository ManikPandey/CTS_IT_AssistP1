import React, { useEffect, useState, useMemo } from 'react';
import { Search, Plus, FileSpreadsheet, Edit2, FolderPlus, Upload, ChevronRight, X, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Inventory() {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Edit Modal State
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Role State (Placeholder for Phase 6 - RBAC)
  const [isAdmin, setIsAdmin] = useState(true); 

  // --- INITIAL LOAD ---
  const loadCategories = async () => {
    const res = await window.api.getCategories();
    if (res.success) setCategories(res.data);
  };

  useEffect(() => { loadCategories(); }, []);

  // --- ASSET FETCHING ---
  const loadAssets = async () => {
    setLoading(true);
    // Fetch assets for the selected category (backend filters by Category ID)
    const res = await window.api.getAssets(selectedCatId || undefined);
    if (res.success) setAssets(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadAssets();
    setSearchQuery('');
    setSelectedSubCatId(null); // Reset sub-cat filter when category changes
  }, [selectedCatId]);

  // --- ACTIONS: CATEGORY MANAGEMENT ---
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

  const handleAddSubCategory = async () => {
    if (!selectedCatId) return;
    const name = prompt("Enter new Sub-Category Name:");
    if (!name) return;
    
    // CONNECTED TO BACKEND
    const res = await window.api.createSubCategory({ categoryId: selectedCatId, name });
    if (res.success) {
        loadCategories(); // Refresh categories to show the new sub-category
        // Optionally select it or just show alert
    } else {
        alert(res.error);
    }
  };

  // --- ACTIONS: ASSET MANAGEMENT ---
  const openEditModal = (asset: any) => {
    let props = {};
    try { props = JSON.parse(asset.properties); } catch(e) {}
    
    setEditingAsset(asset);
    setEditForm({
      status: asset.status,
      properties: props // Store as object for easy editing
    });
  };

  const saveAssetChanges = async () => {
    if (!editingAsset) return;
    
    // CONNECTED TO BACKEND
    const res = await window.api.updateAsset(editingAsset.id, { 
        status: editForm.status, 
        properties: editForm.properties 
    });

    if (res.success) {
        setEditingAsset(null);
        loadAssets(); // Refresh grid to show changes
    } else {
        alert("Update Failed: " + res.error);
    }
  };

  const handlePropertyChange = (key: string, value: string) => {
    setEditForm((prev: any) => ({
      ...prev,
      properties: { ...prev.properties, [key]: value }
    }));
  };

  const handleAddProperty = () => {
    const key = prompt("Enter new Property Name (e.g., 'Color', 'Warranty Exp'):");
    if (!key) return;
    // Add new property with empty value to the edit form
    handlePropertyChange(key, "");
  };

  // --- IMPORT/EXPORT ---
  const handleImport = async () => {
    if(!confirm("Please ensure your Excel file has at least a 'Category' column.")) return;
    setLoading(true);
    const res = await window.api.importExcel();
    setLoading(false);
    if (res.success) {
      alert(`Import Complete!\nProcessed: ${res.report.total}\nSuccess: ${res.report.success}\nErrors: ${res.report.errors.length}`);
      loadCategories(); 
      loadAssets();     
    } else if (res.error !== "No file selected") {
      alert("Import Failed: " + res.error);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    const res = await window.api.exportExcel();
    setLoading(false);
    if (res.success) alert("Report saved to: " + res.filePath);
    else if (res.error !== "Export cancelled") alert("Export Failed: " + res.error);
  };

  // --- FILTERING LOGIC ---
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // 1. Sub-Category Filter
      if (selectedSubCatId && asset.subCategoryId !== selectedSubCatId) return false;

      // 2. Status Filter
      if (statusFilter && asset.status !== statusFilter) return false;

      // 3. Search Query
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      
      // Static Checks
      if (asset.status.toLowerCase().includes(query)) return true;
      if (asset.subCategory?.name.toLowerCase().includes(query)) return true;
      
      // Dynamic Checks
      try {
        const props = JSON.parse(asset.properties);
        const values = Object.values(props).join(' ').toLowerCase();
        if (values.includes(query)) return true;
      } catch(e) {}

      return false;
    });
  }, [assets, searchQuery, statusFilter, selectedSubCatId]);

  // Calculate Status Counts for Chips
  const statusCounts = useMemo(() => {
    const counts: any = { ALL: assets.length };
    assets.forEach(a => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [assets]);

  // Derived Data
  const currentCategory = categories.find(c => c.id === selectedCatId);
  const subCategories = currentCategory?.subCategories || [];

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-8">
      
      {/* 1. LEFT SIDEBAR: CATEGORIES */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Categories</h2>
            {isAdmin && (
              <button onClick={handleCreateCategory} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded" title="Add Category">
                  <FolderPlus size={16} />
              </button>
            )}
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
                    "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors pr-8 truncate",
                    selectedCatId === cat.id ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
                )}
                title={cat.name}
                >
                {cat.name}
                </button>
                {isAdmin && (
                  <button 
                      onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600"
                  >
                      <Edit2 size={12} />
                  </button>
                )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        
        {/* HEADER TOOLBAR */}
        <div className="p-4 border-b border-gray-200 space-y-4">
          <div className="flex items-center justify-between gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by Name, Serial, IP..." 
                className="w-full pl-10 pr-10 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Global Actions */}
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <button onClick={handleImport} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
                    <Upload className="w-4 h-4 text-blue-600" /> Import
                  </button>
                  <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
                    <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                    <Plus className="w-4 h-4" /> Add Asset
                  </button>
                </>
              )}
            </div>
          </div>

          {/* SECONDARY TOOLBAR: SUB-CATEGORIES & FILTERS */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            
            {/* Sub-Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
              {selectedCatId && (
                <>
                  <button 
                    onClick={() => setSelectedSubCatId(null)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-full border whitespace-nowrap transition-colors",
                      !selectedSubCatId ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    )}
                  >
                    All {currentCategory?.name}
                  </button>
                  {subCategories.map((sub: any) => (
                    <button 
                      key={sub.id}
                      onClick={() => setSelectedSubCatId(sub.id)}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-full border whitespace-nowrap transition-colors",
                        selectedSubCatId === sub.id ? "bg-indigo-100 text-indigo-800 border-indigo-200" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      )}
                    >
                      {sub.name}
                    </button>
                  ))}
                  {isAdmin && (
                    <button 
                      onClick={handleAddSubCategory}
                      className="px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-full border border-dashed border-indigo-300 flex items-center gap-1"
                    >
                      <Plus size={12} /> New Sub-Cat
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Status Filter Chips (Reverted from Dropdown) */}
            <div className="flex gap-2">
              <button 
                onClick={() => setStatusFilter(null)}
                className={cn("px-3 py-1 text-xs font-medium rounded-full border transition-colors", !statusFilter ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300")}
              >
                All ({statusCounts.ALL || 0})
              </button>
              {['ACTIVE', 'RETIRED', 'IN_STOCK', 'MAINTENANCE'].map(status => (
                <button 
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn("px-3 py-1 text-xs font-medium rounded-full border transition-colors", statusFilter === status ? "bg-indigo-100 text-indigo-800 border-indigo-200" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300")}
                >
                  {status} ({statusCounts[status] || 0})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-64">Asset Details</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-48">Category / Sub</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Properties</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-24">Status</th>
                {isAdmin && <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b text-right w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading assets...</td></tr>
              ) : filteredAssets.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-gray-500">
                    <p className="text-lg font-medium text-gray-900">No assets found</p>
                    <p className="text-sm">Try adjusting your filters or search.</p>
                </td></tr>
              ) : (
                filteredAssets.map((asset) => {
                  let props: any = {};
                  try { props = JSON.parse(asset.properties); } catch(e) {}
                  
                  // Heuristic to find Name/Serial for the main column
                  const nameKey = Object.keys(props).find(k => k.toLowerCase().includes('name')) || 'Name';
                  const serialKey = Object.keys(props).find(k => k.toLowerCase().includes('serial')) || 'Serial No';
                  
                  const name = props[nameKey] || 'Unnamed Asset';
                  const serial = props[serialKey] || '-';
                  
                  // Generate Spec String (excluding name/serial)
                  const specString = Object.entries(props)
                    .filter(([key, val]) => {
                      const k = key.toLowerCase();
                      return !k.includes('name') && !k.includes('serial') && !k.includes('po_ref') && val !== '';
                    })
                    .slice(0, 4) // Show max 4 specs
                    .map(([k, v]) => `<span class="font-semibold text-gray-600">${k}:</span> ${v}`)
                    .join(' • ');

                  return (
                    <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">{name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 font-mono">SN: {serial}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                         <div className="font-medium text-gray-700">{asset.subCategory?.category?.name || 'Unknown'}</div>
                         <div className="text-xs text-gray-400 flex items-center gap-1">
                           <ChevronRight size={10} />
                           {asset.subCategory?.name || 'General'}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        <div dangerouslySetInnerHTML={{ __html: specString || '<span class="italic text-gray-400">No extra properties</span>' }} />
                      </td>
                      <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 text-xs font-semibold rounded-full",
                            asset.status === 'ACTIVE' ? "bg-green-100 text-green-800" :
                            asset.status === 'RETIRED' ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                          )}>
                              {asset.status}
                          </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          <button onClick={() => openEditModal(asset)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded">
                            <Edit2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT ASSET MODAL */}
      {editingAsset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Edit Asset</h3>
              <button onClick={() => setEditingAsset(null)} className="text-gray-500 hover:text-red-500"><X size={20} /></button>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select 
                  className="w-full mt-1 p-2 border rounded"
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="IN_STOCK">IN_STOCK</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="RETIRED">RETIRED</option>
                </select>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold text-gray-900">Properties</h4>
                  <button onClick={handleAddProperty} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add Field
                  </button>
                </div>
                
                {Object.entries(editForm.properties || {}).map(([key, val]: any) => (
                  <div key={key} className="mb-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase">{key}</label>
                    <input 
                      className="w-full mt-1 p-2 border rounded text-sm"
                      value={val}
                      onChange={(e) => handlePropertyChange(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <button onClick={() => setEditingAsset(null)} className="px-4 py-2 border rounded text-gray-700">Cancel</button>
              <button onClick={saveAssetChanges} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2">
                <Save size={16} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}