import React, { useEffect, useState, useMemo } from 'react';
import { Search, Plus, FileSpreadsheet, Edit2, FolderPlus, Upload, ChevronRight, X, Save, Settings2, Trash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/context/UserContext';

// --- INTERNAL COMPONENT: INPUT MODAL ---
// A reusable modal for creating categories/sub-categories without using window.prompt()
function InputModal({ isOpen, onClose, title, placeholder, onSubmit }: any) {
  const [value, setValue] = useState('');
  
  // Reset value when opening
  useEffect(() => {
    if (isOpen) setValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        <input 
          autoFocus
          className="w-full p-2 border rounded-md mb-6 focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder={placeholder}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSubmit(value)}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
          <button 
            onClick={() => onSubmit(value)} 
            disabled={!value.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Inventory() {
  // --- STATE MANAGEMENT ---
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Asset Editing State
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  // New state for inline property addition in Edit Asset Modal
  const [isAddingProp, setIsAddingProp] = useState(false);
  const [newPropKey, setNewPropKey] = useState('');
  
  // Attribute Manager State
  const [manageSubCat, setManageSubCat] = useState<any | null>(null);
  const [subCatFields, setSubCatFields] = useState<any[]>([]);
  const [newAttrInput, setNewAttrInput] = useState('');

  // Creation Modal State (Replaces Prompts)
  const [createModal, setCreateModal] = useState<{ type: 'CAT' | 'SUB' | 'RENAME', data?: any } | null>(null);

  // Role Access
  const { isAdmin } = useUser();

  // --- DATA LOADING ---
  const loadCategories = async () => {
    const res = await window.api.getCategories();
    if (res.success) setCategories(res.data);
  };

  useEffect(() => { loadCategories(); }, []);

  const loadAssets = async () => {
    setLoading(true);
    // Fetch assets for the selected category (backend filters by Category ID)
    const res = await window.api.getAssets(selectedCatId || undefined);
    if (res.success) setAssets(res.data);
    setLoading(false);
  };

  // Reload assets when category changes
  useEffect(() => {
    loadAssets();
    setSearchQuery('');
    setSelectedSubCatId(null); // Reset sub-cat filter
  }, [selectedCatId]);


  // --- ACTIONS: CATEGORY & SUB-CATEGORY ---
  const handleModalSubmit = async (value: string) => {
    if (!value.trim()) return;

    let res;
    if (createModal?.type === 'CAT') {
        res = await window.api.createCategory({ name: value });
    } 
    else if (createModal?.type === 'SUB') {
        if (!selectedCatId) return;
        res = await window.api.createSubCategory({ categoryId: selectedCatId, name: value });
    }
    else if (createModal?.type === 'RENAME') {
        res = await window.api.updateCategory(createModal.data.id, { name: value });
    }

    if (res?.success) {
        loadCategories();
        setCreateModal(null);
    } else {
        alert("Error: " + res?.error);
    }
  };


  // --- ACTIONS: ATTRIBUTE MANAGER ---
  const openAttributeManager = (subCat: any) => {
    setManageSubCat(subCat);
    let fields = [];
    try { 
        fields = JSON.parse(subCat.fieldDefinitions || '[]'); 
    } catch(e) {}
    setSubCatFields(fields);
    setNewAttrInput('');
  };

  const saveAttributeDefinitions = async () => {
    if (!manageSubCat) return;
    const res = await window.api.updateSubCategory(manageSubCat.id, { fieldDefinitions: JSON.stringify(subCatFields) });
    if (res.success) {
      loadCategories(); // Reload to save new defs in state
      setManageSubCat(null);
    } else {
      alert("Error saving attributes: " + res.error);
    }
  };

  const addFieldDefinition = () => {
    if (!newAttrInput.trim()) return;
    const name = newAttrInput.trim();
    
    // Prevent duplicates
    if (subCatFields.some(f => f.key === name)) {
        alert("Field already exists!");
        return;
    }
    setSubCatFields([...subCatFields, { key: name, label: name, type: 'text' }]);
    setNewAttrInput('');
  };

  const removeFieldDefinition = (idx: number) => {
    const newFields = [...subCatFields];
    newFields.splice(idx, 1);
    setSubCatFields(newFields);
  };


  // --- ACTIONS: ASSET MANAGEMENT ---
  const handleCreateAsset = () => {
    if (!selectedSubCatId) {
      alert("Please select a specific Sub-Category (e.g., Laptops) from the tabs above before adding an asset.");
      return;
    }
    
    // 1. Find the sub-category object to get field definitions
    const currentCategory = categories.find(c => c.id === selectedCatId);
    const subCat = currentCategory?.subCategories.find((s: any) => s.id === selectedSubCatId);

    // 2. Initialize props with empty values for defined attributes
    let initialProps: any = {};
    if (subCat && subCat.fieldDefinitions) {
      try {
        const defs = JSON.parse(subCat.fieldDefinitions);
        defs.forEach((d: any) => initialProps[d.key] = "");
      } catch (e) {}
    }

    // 3. Ensure core fields always exist
    if (!initialProps['Name']) initialProps['Name'] = "";
    if (!initialProps['Serial No']) initialProps['Serial No'] = "";

    // 4. Open Modal in "Create Mode"
    setEditingAsset({ 
      isNew: true, 
      status: 'ACTIVE', 
      subCategoryId: selectedSubCatId, 
      subCategory: subCat, // Pass for modal rendering logic
      properties: JSON.stringify(initialProps) 
    });
    setEditForm({ 
      status: 'ACTIVE', 
      properties: initialProps 
    });
    setIsAddingProp(false);
  };

  const openEditModal = (asset: any) => {
    let props = {};
    try { props = JSON.parse(asset.properties); } catch(e) {}
    setEditingAsset(asset);
    setEditForm({ status: asset.status, properties: props });
    setIsAddingProp(false);
  };

  const saveAssetChanges = async () => {
    if (!editingAsset) return;
    
    let res;
    if (editingAsset.isNew) {
      res = await window.api.createAsset({
        subCategoryId: editingAsset.subCategoryId,
        status: editForm.status,
        properties: editForm.properties
      });
    } else {
      res = await window.api.updateAsset(editingAsset.id, { 
          status: editForm.status, 
          properties: editForm.properties 
      });
    }

    if (res.success) {
        setEditingAsset(null);
        loadAssets(); // Refresh Grid
    } else {
        alert("Operation Failed: " + res.error);
    }
  };

  const handlePropertyChange = (key: string, value: string) => {
    setEditForm((prev: any) => ({
      ...prev,
      properties: { ...prev.properties, [key]: value }
    }));
  };

  // Replaced prompt with inline state
  const confirmAddProperty = () => {
    if (newPropKey.trim()) {
        handlePropertyChange(newPropKey.trim(), "");
        setNewPropKey('');
        setIsAddingProp(false);
    }
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
      
      // Dynamic Checks (Search inside JSON properties)
      try {
        const props = JSON.parse(asset.properties);
        const values = Object.values(props).join(' ').toLowerCase();
        if (values.includes(query)) return true;
      } catch(e) {}

      return false;
    });
  }, [assets, searchQuery, statusFilter, selectedSubCatId]);

  // Derived Data
  const currentCategory = categories.find(c => c.id === selectedCatId);
  const subCategories = currentCategory?.subCategories || [];
  
  // Calculate Status Counts
  const statusCounts = useMemo(() => {
    const counts: any = { ALL: assets.length };
    assets.forEach(a => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [assets]);


  // --- RENDER ---
  return (
    <div className="flex h-[calc(100vh-4rem)] -m-8">
      
      {/* 1. SIDEBAR (Categories) */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Categories</h2>
            {isAdmin && (
              <button 
                onClick={() => setCreateModal({ type: 'CAT' })} 
                className="text-indigo-600 hover:bg-indigo-50 p-1 rounded transition-colors"
                title="Add Category"
              >
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
                      onClick={(e) => { e.stopPropagation(); setCreateModal({type: 'RENAME', data: cat}); }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600"
                  >
                      <Edit2 size={12} />
                  </button>
                )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        
        {/* TOP TOOLBAR */}
        <div className="p-4 border-b border-gray-200 space-y-4">
          <div className="flex items-center justify-between gap-4">
            {/* Search */}
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

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
                <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export
              </button>

              {isAdmin && (
                <>
                  <button onClick={handleImport} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
                    <Upload className="w-4 h-4 text-blue-600" /> Import
                  </button>
                  <button onClick={handleCreateAsset} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
                    <Plus className="w-4 h-4" /> Add Asset
                  </button>
                </>
              )}
            </div>
          </div>

          {/* SECONDARY TOOLBAR: SUB-CATS & FILTERS */}
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
                    <div key={sub.id} className="relative group">
                        <button 
                          onClick={() => setSelectedSubCatId(sub.id)} 
                          className={cn(
                            "px-3 py-1 text-xs font-medium rounded-full border whitespace-nowrap transition-colors pr-6", 
                            selectedSubCatId === sub.id ? "bg-indigo-100 text-indigo-800 border-indigo-200" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                          )}
                        >
                          {sub.name}
                        </button>
                        {isAdmin && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); openAttributeManager(sub); }} 
                                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 p-0.5 rounded-full" 
                                title="Manage Attributes"
                            >
                                <Settings2 size={10} />
                            </button>
                        )}
                    </div>
                  ))}
                  
                  {/* Create Sub-Category Button */}
                  {isAdmin && (
                    <button 
                      onClick={() => setCreateModal({ type: 'SUB' })} 
                      className="px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-full border border-dashed border-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} /> New Sub-Cat
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Status Filters */}
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
                  
                  // Extract core fields
                  const nameKey = Object.keys(props).find(k => k.toLowerCase().includes('name')) || 'Name';
                  const serialKey = Object.keys(props).find(k => k.toLowerCase().includes('serial')) || 'Serial No';
                  
                  const name = props[nameKey] || 'Unnamed Asset';
                  const serial = props[serialKey] || '-';
                  
                  // Filter specs (exclude redundant info)
                  const specString = Object.entries(props)
                    .filter(([key, val]) => {
                      const k = key.toLowerCase();
                      return !k.includes('name') && !k.includes('serial') && !k.includes('po_ref') && val !== '';
                    })
                    .slice(0, 4) 
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

      {/* --- MODAL 1: CREATE CATEGORY / SUB-CATEGORY --- */}
      <InputModal 
        isOpen={!!createModal}
        onClose={() => setCreateModal(null)}
        title={createModal?.type === 'CAT' ? "New Category" : createModal?.type === 'SUB' ? "New Sub-Category" : "Rename Category"}
        placeholder="Enter name..."
        onSubmit={handleModalSubmit}
      />

      {/* --- MODAL 2: ASSET EDITING (Dynamic) --- */}
      {editingAsset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingAsset.isNew ? 'Create New Asset' : 'Edit Asset'}</h3>
              <button onClick={() => setEditingAsset(null)} className="text-gray-500 hover:text-red-500">
                <X size={20} />
              </button>
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
                  {/* FIXED: No prompt(). Using inline input state instead. */}
                  {!isAddingProp && (
                      <button onClick={() => setIsAddingProp(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Plus size={12} /> Add Field
                      </button>
                  )}
                </div>

                {/* INLINE PROPERTY ADDER */}
                {isAddingProp && (
                    <div className="flex gap-2 mb-3 bg-blue-50 p-2 rounded">
                        <input 
                            autoFocus
                            className="flex-1 p-1 border rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" 
                            placeholder="Property Name (e.g. Color)" 
                            value={newPropKey} 
                            onChange={e => setNewPropKey(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && confirmAddProperty()}
                        />
                        <button onClick={confirmAddProperty} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Add</button>
                        <button onClick={() => setIsAddingProp(false)} className="text-xs text-gray-500 hover:text-gray-700"><X size={14}/></button>
                    </div>
                )}
                
                {/* 1. Defined Attributes */}
                {editingAsset.subCategory?.fieldDefinitions && JSON.parse(editingAsset.subCategory.fieldDefinitions).map((field: any) => (
                   <div key={field.key} className="mb-2">
                      <label className="block text-xs font-medium text-indigo-600 uppercase">{field.label} *</label>
                      <input 
                        className="w-full mt-1 p-2 border rounded text-sm bg-indigo-50"
                        value={editForm.properties[field.key] || ''}
                        onChange={(e) => handlePropertyChange(field.key, e.target.value)}
                        placeholder={`Enter ${field.label}...`}
                      />
                   </div>
                ))}

                {/* 2. Custom Properties */}
                {Object.entries(editForm.properties || {}).map(([key, val]: any) => {
                   const defs = editingAsset.subCategory?.fieldDefinitions ? JSON.parse(editingAsset.subCategory.fieldDefinitions) : [];
                   if (defs.find((d: any) => d.key === key)) return null;

                   return (
                    <div key={key} className="mb-2">
                        <label className="block text-xs font-medium text-gray-500 uppercase">{key}</label>
                        <input 
                          className="w-full mt-1 p-2 border rounded text-sm"
                          value={val}
                          onChange={(e) => handlePropertyChange(key, e.target.value)}
                        />
                    </div>
                   );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <button onClick={() => setEditingAsset(null)} className="px-4 py-2 border rounded text-gray-700">Cancel</button>
              <button onClick={saveAssetChanges} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2">
                <Save size={16} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: ATTRIBUTE MANAGER --- */}
      {manageSubCat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-1">Manage Attributes</h3>
            <p className="text-sm text-gray-500 mb-4">Define standard columns for <strong>{manageSubCat.name}</strong></p>
            
            <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto">
               {subCatFields.map((field: any, idx) => (
                 <div key={idx} className="flex gap-2 items-center">
                    <input className="flex-1 p-2 border rounded text-sm" value={field.label} readOnly />
                    <button onClick={() => removeFieldDefinition(idx)} className="text-red-500 hover:text-red-700 p-2">
                        <Trash size={16}/>
                    </button>
                 </div>
               ))}
               {subCatFields.length === 0 && <div className="text-center text-sm text-gray-400 italic py-4">No attributes defined.</div>}
            </div>

            <div className="flex gap-2 mb-4">
                <input 
                    className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="Enter field name (e.g. RAM)"
                    value={newAttrInput}
                    onChange={(e) => setNewAttrInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addFieldDefinition()}
                />
                <button 
                    onClick={addFieldDefinition} 
                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 flex items-center justify-center"
                    disabled={!newAttrInput.trim()}
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={() => setManageSubCat(null)} className="px-4 py-2 border rounded text-gray-700">Close</button>
              <button onClick={saveAttributeDefinitions} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                Save Definitions
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}