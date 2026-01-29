import React, { useEffect, useState } from 'react';
import { Plus, Calendar, Trash2, X, Eye, Printer, PackageCheck, Upload, FileText, FileSpreadsheet, ListPlus, Check, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/context/UserContext';

// --- INTERNAL COMPONENT: INPUT MODAL (For Quick Sub-Cat Creation) ---
function InputModal({ isOpen, onClose, title, placeholder, onSubmit }: any) {
  const [value, setValue] = useState('');
  
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
          <button onClick={onClose} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSubmit(value)} disabled={!value.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">Create</button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrders() {
  // --- STATE ---
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewPo, setViewPo] = useState<any | null>(null);
  
  // Receiving State
  const [showReceive, setShowReceive] = useState(false);
  const [receiveData, setReceiveData] = useState<{
    lineItemId: string, quantity: number, serials: string[], categoryId: string, subCategoryId: string, productName: string, maxQty: number
  }[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Quick Sub-Cat Creation State
  const [quickSubCat, setQuickSubCat] = useState<{ categoryId: string } | null>(null);

  // RBAC
  const { isAdmin } = useUser();

  // Create Form State
  const [formData, setFormData] = useState({
    poNumber: '', date: new Date().toISOString().split('T')[0], vendorName: '', gstin: '',
    billingAddress: '', deliveryAddress: '',
    termsAndConditions: "Delivery: Immediate\nPayment Terms: Against certified original invoice\nFreight Charges: As per approved actuals",
    remarks: '', requestRef: '', deptName: '', approvedBy: '', 
    requestDate: '', actionDate: '', requestType: '', prfRef: ''
  });

  const [lineItems, setLineItems] = useState([{ srNo: 1, productName: '', quantity: 1, uom: 'Nos', unitPrice: 0, gst: 18, totalAmount: 0 }]);
  
  // Dynamic Custom Fields for PO (e.g. Project Code)
  const [customFields, setCustomFields] = useState<{key: string, value: string}[]>([]);

  // --- DATA LOADING ---
  const loadData = async () => {
    setLoading(true);
    const [poRes, catRes] = await Promise.all([
      window.api.getPurchaseOrders(),
      window.api.getCategories()
    ]);
    if (poRes.success) setPos(poRes.data);
    if (catRes.success) setCategories(catRes.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // --- HELPERS ---
  const calculateDelays = (po: any) => {
    if (!po.requestDate || !po.actionDate) return null;
    const req = new Date(po.requestDate);
    const act = new Date(po.actionDate);
    const processDelay = Math.floor((act.getTime() - req.getTime()) / (1000 * 3600 * 24));
    const deadline = new Date(act);
    deadline.setDate(deadline.getDate() + 30);
    const daysLeft = Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return { processDelay, daysLeft };
  };

  const calculateGrandTotal = () => lineItems.reduce((acc, item) => acc + item.totalAmount, 0).toFixed(2);

  // --- ACTIONS: IMPORT ---
  const handleImportPOs = async () => {
    if (!isAdmin) return;
    if(!confirm("Import POs from Excel?\n\nRequired: PO Number, Date, Vendor, Product, Qty, Price")) return;
    setLoading(true);
    const res = await window.api.importPurchaseOrders();
    setLoading(false);
    if (res.success) { 
      alert(`Success! Imported ${res.count} Purchase Orders.`);
      loadData();
    } else if (res.error !== "No file selected") {
      alert("Import Failed: " + res.error);
    }
  };

  const handleScanPDF = async () => {
    if (!isAdmin) return;
    setLoading(true);
    const res = await window.api.parsePurchaseOrderPDF();
    setLoading(false);

    if (res.success) {
        // Auto-fill standard fields
        setFormData(prev => ({
            ...prev,
            poNumber: res.data.poNumber || prev.poNumber,
            date: res.data.date || prev.date,
            vendorName: res.data.vendorName || prev.vendorName,
            gstin: res.data.gstin || prev.gstin,
        }));
        // Auto-fill line items
        if (res.data.lineItems?.length) setLineItems(res.data.lineItems);
        
        // Auto-fill dynamic fields found in PDF
        if (res.data.properties) {
            const extra = Object.entries(res.data.properties).map(([k,v]) => ({key: k, value: String(v)}));
            setCustomFields(extra);
        }

        setShowForm(true);
        alert("PDF Scanned! Please review the extracted details.");
    } else if (res.error !== "No file selected") {
        alert("Scan Failed: " + res.error);
    }
  };

  // --- ACTIONS: CREATE PO HANDLERS ---
  const handleLineItemChange = (i: number, f: string, v: any) => {
    const newItems = [...lineItems];
    newItems[i] = { ...newItems[i], [f]: v };
    
    // Recalculate row total
    const qty = parseFloat(newItems[i].quantity as any) || 0;
    const price = parseFloat(newItems[i].unitPrice as any) || 0;
    const gst = parseFloat(newItems[i].gst as any) || 0;
    const baseTotal = qty * price;
    const gstAmount = baseTotal * (gst / 100);
    newItems[i].totalAmount = baseTotal + gstAmount;

    setLineItems(newItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { srNo: lineItems.length + 1, productName: '', quantity: 1, uom: 'Nos', unitPrice: 0, gst: 18, totalAmount: 0 }]);
  };

  const removeLineItem = (i: number) => {
    if (lineItems.length > 1) {
      const filtered = lineItems.filter((_, idx) => idx !== i);
      // Re-index serial numbers
      setLineItems(filtered.map((item, idx) => ({ ...item, srNo: idx + 1 })));
    }
  };

  // Custom Field Handlers
  const addCustomField = () => setCustomFields([...customFields, { key: '', value: '' }]);
  const removeCustomField = (i: number) => setCustomFields(customFields.filter((_, idx) => idx !== i));
  const updateCustomField = (i: number, field: 'key'|'value', val: string) => { 
      const n = [...customFields]; n[i][field] = val; setCustomFields(n); 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.poNumber || !formData.vendorName) return alert("Please fill required fields (PO Number, Vendor)");
    
    // Pack custom fields into object
    const props: any = {};
    customFields.forEach(f => { if(f.key) props[f.key] = f.value; });

    const payload = {
      ...formData,
      totalAmount: parseFloat(calculateGrandTotal()),
      status: "ISSUED",
      lineItems,
      properties: props,
      requestDate: formData.requestDate ? new Date(formData.requestDate) : null,
      actionDate: formData.actionDate ? new Date(formData.actionDate) : null,
    };

    const res = await window.api.createPurchaseOrder(payload);
    if (res.success) {
      alert("Purchase Order Created Successfully!");
      setShowForm(false);
      // Reset State
      setFormData({
        poNumber: '', date: new Date().toISOString().split('T')[0], vendorName: '', gstin: '',
        billingAddress: '', deliveryAddress: '',
        termsAndConditions: "Delivery: Immediate\nPayment Terms: Against certified original invoice\nFreight Charges: As per approved actuals",
        remarks: '', requestRef: '', deptName: '', approvedBy: '', 
        requestDate: '', actionDate: '', requestType: '', prfRef: ''
      });
      setLineItems([{ srNo: 1, productName: '', quantity: 1, uom: 'Nos', unitPrice: 0, gst: 18, totalAmount: 0 }]);
      setCustomFields([]);
      loadData();
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleDeletePO = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Are you sure you want to delete this Purchase Order? This cannot be undone.")) return;
    const res = await window.api.deletePurchaseOrder(id);
    if (res.success) loadData(); else alert(res.error);
  };

  // --- ACTIONS: RECEIVE ITEMS ---
  const openReceiveModal = (po: any) => {
    if (!isAdmin) return;
    const pendingItems = po.lineItems.filter((i: any) => i.receivedQty < i.quantity);
    if (pendingItems.length === 0) {
      alert("All items in this PO have been received!");
      return;
    }
    
    // Find safe defaults
    const defCatId = categories.length > 0 ? categories[0].id : '';
    const defSubId = categories.length > 0 && categories[0].subCategories.length > 0 ? categories[0].subCategories[0].id : '';

    const initialData = pendingItems.map((item: any) => ({
      lineItemId: item.id,
      productName: item.productName,
      maxQty: item.quantity - item.receivedQty,
      quantity: item.quantity - item.receivedQty,
      serials: [], 
      categoryId: defCatId,
      subCategoryId: defSubId
    }));
    setReceiveData(initialData);
    setShowReceive(true);
  };

  const handleQuickSubCatSubmit = async (name: string) => {
    if (!name.trim() || !quickSubCat) return;
    
    const res = await window.api.createSubCategory({ categoryId: quickSubCat.categoryId, name });
    if (res.success) {
        // Refresh categories to fetch the new sub-cat
        const catRes = await window.api.getCategories();
        if (catRes.success) setCategories(catRes.data);
        setQuickSubCat(null); // Close modal
    } else {
        alert("Error creating sub-category: " + res.error);
    }
  };

  const handleReceiveSubmit = async () => {
    // 1. Client-Side Validation
    for (const item of receiveData) { 
        if (!item.categoryId || !item.subCategoryId) { 
            alert(`Error: Sub-Category missing for item "${item.productName}".\n\nPlease select one or create a new Sub-Category using the '+' button.`); 
            return; 
        } 
    }
    if (!confirm("Add to Inventory?")) return;

    const itemsToProcess = receiveData.map(item => ({
      lineItemId: item.lineItemId,
      quantity: item.quantity,
      categoryId: item.categoryId,
      subCategoryId: item.subCategoryId,
      serials: item.serials.length > 0 ? item.serials : Array(item.quantity).fill("").map((_, i) => `PO-AUTO-${Date.now()}-${i}`) 
    }));
    
    const res = await window.api.receiveItems({ poId: viewPo.id, items: itemsToProcess });
    if (res.success) {
      alert("Items Received Successfully!");
      setShowReceive(false);
      setViewPo(null);
      loadData();
    } else {
      alert("Error: " + res.error);
    }
  };

  // ==========================================
  // RENDER SECTIONS
  // ==========================================
  
  // 1. RECEIVE MODAL
  if (showReceive && viewPo) {
    const isFormValid = receiveData.every(item => item.categoryId && item.subCategoryId);

    return (
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Receive Items: {viewPo.poNumber}</h2>
          
          <div className="space-y-6">
            {receiveData.map((item: any, idx) => {
              const selectedCat = categories.find(c => c.id === item.categoryId);
              const availableSubCats = selectedCat?.subCategories || [];
              const isSubCatMissing = availableSubCats.length === 0 && item.categoryId;

              return (
                <div key={item.lineItemId} className={cn("border p-4 rounded-lg", !item.subCategoryId ? "bg-red-50 border-red-200" : "bg-gray-50")}>
                  <div className="flex justify-between font-semibold mb-2">
                    <span className="text-gray-800">{item.productName}</span>
                    <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded border">Qty: {item.quantity} / {item.maxQty}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Category</label>
                      <select className="w-full p-2 border rounded-md text-sm mt-1 bg-white" 
                        value={item.categoryId}
                        onChange={(e) => {
                          const catId = e.target.value;
                          const cat = categories.find(c => c.id === catId);
                          const newData = [...receiveData];
                          newData[idx].categoryId = catId;
                          newData[idx].subCategoryId = cat?.subCategories[0]?.id || '';
                          setReceiveData(newData);
                        }}
                      >
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Sub-Category</label>
                      <div className="flex gap-2">
                          <select className="w-full p-2 border rounded-md text-sm mt-1 bg-white"
                              value={item.subCategoryId}
                              onChange={(e) => {
                                const newData = [...receiveData];
                                newData[idx].subCategoryId = e.target.value;
                                setReceiveData(newData);
                              }}
                          >
                              <option value="">-- Select --</option>
                              {availableSubCats.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                          </select>
                          {/* FEATURE: Quick Add Sub-Cat */}
                          <button 
                              onClick={() => setQuickSubCat({ categoryId: item.categoryId })} 
                              className="mt-1 p-2 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200 border border-indigo-200 transition-colors"
                              title="Create new Sub-Category"
                              disabled={!item.categoryId}
                          >
                              <Plus size={18} />
                          </button>
                      </div>
                      
                      {/* ERROR FEEDBACK */}
                      {isSubCatMissing ? (
                        <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1">
                          <AlertTriangle size={12}/> No Sub-Categories! Create one.
                        </p>
                      ) : !item.subCategoryId && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle size={12}/> Required
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Serial Numbers</label>
                    <textarea className="w-full p-2 border rounded-md text-sm mt-1" rows={2}
                        placeholder={`Enter ${item.quantity} serial numbers separated by commas...`}
                        onChange={(e) => {
                          const serials = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                          const newData = [...receiveData];
                          newData[idx].serials = serials;
                          setReceiveData(newData);
                        }}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank to auto-generate system serials.</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 mt-6 border-t pt-4">
            <button onClick={() => setShowReceive(false)} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50">Cancel</button>
            <button 
                onClick={handleReceiveSubmit} 
                disabled={!isFormValid}
                className={cn(
                  "px-4 py-2 text-white rounded font-medium flex items-center gap-2 transition-colors", 
                  !isFormValid ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                )}
            >
                <Check size={16} /> Confirm Receiving
            </button>
          </div>
        </div>

        {/* NESTED MODAL FOR QUICK SUB-CAT */}
        <InputModal 
            isOpen={!!quickSubCat} 
            onClose={() => setQuickSubCat(null)} 
            title="Create Sub-Category" 
            placeholder="Name (e.g. Ethernet Cables)" 
            onSubmit={handleQuickSubCatSubmit} 
        />
      </div>
    );
  }

  // 2. VIEW PO MODAL (Document View)
  if (viewPo) {
    const stats = calculateDelays(viewPo);
    const isCompleted = viewPo.status === 'COMPLETED';
    let dynamicProps = {};
    try { dynamicProps = JSON.parse(viewPo.properties || '{}'); } catch(e) {}

    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 overflow-y-auto flex items-start justify-center pt-10 print:pt-0 print:bg-white print:static">
        <style>{`@media print { body * { visibility: hidden; } #printable-area, #printable-area * { visibility: visible; } #printable-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; } .no-print { display: none !important; } }`}</style>
        
        <div id="printable-area" className="bg-white w-[210mm] min-h-[297mm] p-12 shadow-2xl relative mb-10 mx-auto print:shadow-none print:m-0">
          <div className="absolute top-4 right-4 flex gap-2 no-print">
            {isAdmin && !isCompleted && (
                <button onClick={() => openReceiveModal(viewPo)} className="p-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2 font-medium text-sm">
                    <PackageCheck size={16} /> Receive Items
                </button>
            )}
            <button onClick={() => window.print()} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 font-medium text-sm">
                <Printer size={16} /> Print
            </button>
            <button onClick={() => setViewPo(null)} className="p-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                <X size={16} />
            </button>
          </div>

          {/* Analytics Badge (Admin Only View) */}
          {stats && isAdmin && (
            <div className="no-print mb-8 p-4 bg-orange-50 border border-orange-200 rounded-lg flex gap-8">
               <div><span className="block text-xs text-orange-600 uppercase font-bold">Process Delay</span><span className="text-xl font-bold text-gray-800">{stats.processDelay} days</span></div>
               <div><span className="block text-xs text-orange-600 uppercase font-bold">Days Left</span><span className="text-xl font-bold text-gray-800">{stats.daysLeft} days</span></div>
               <div className="flex-1 text-right text-xs text-orange-400 self-end">Calculated from Request & Action Dates</div>
            </div>
          )}

          {/* Document Header */}
          <div className="border-b-2 border-gray-800 pb-6 mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">PURCHASE ORDER</h1>
                <p className="text-sm text-gray-500 mt-1 uppercase tracking-wide font-semibold">Computer Generated Document</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-gray-800">VIT BHOPAL UNIVERSITY</h2>
                <p className="text-sm text-gray-600">Kothri Kalan, Sehore</p>
                <p className="text-sm text-gray-600">Madhya Pradesh - 466114</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-12 mb-8 text-sm">
            <div>
              <h3 className="font-bold text-gray-700 border-b-2 border-gray-100 mb-3 pb-1 uppercase tracking-wider">Order Details</h3>
              <div className="grid grid-cols-3 gap-y-2">
                <span className="text-gray-500 font-medium">PO Number:</span><span className="col-span-2 font-mono font-bold text-gray-800">{viewPo.poNumber}</span>
                <span className="text-gray-500 font-medium">Date:</span><span className="col-span-2">{new Date(viewPo.date).toLocaleDateString()}</span>
                <span className="text-gray-500 font-medium">Reference:</span><span className="col-span-2">{viewPo.requestRef || '-'}</span>
                <span className="text-gray-500 font-medium">Req Type:</span><span className="col-span-2">{viewPo.requestType || '-'}</span>
                <span className="text-gray-500 font-medium">PRF Ref:</span><span className="col-span-2">{viewPo.prfRef || '-'}</span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-gray-700 border-b-2 border-gray-100 mb-3 pb-1 uppercase tracking-wider">Vendor Details</h3>
              <div className="grid grid-cols-3 gap-y-2">
                <span className="text-gray-500 font-medium">Name:</span><span className="col-span-2 font-semibold text-gray-800">{viewPo.vendorNameSnap}</span>
                <span className="text-gray-500 font-medium">GSTIN:</span><span className="col-span-2">{viewPo.gstin || '-'}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Properties View */}
          {Object.keys(dynamicProps).length > 0 && (
             <div className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Additional Information</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                    {Object.entries(dynamicProps).map(([k, v]: any) => (
                        <div key={k}><span className="text-gray-500 mr-2 font-medium">{k}:</span><span className="font-semibold text-gray-800">{v}</span></div>
                    ))}
                </div>
             </div>
          )}

          <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h4 className="font-bold text-gray-700 mb-2 uppercase text-xs tracking-wide">Billing Address</h4>
                <p className="whitespace-pre-wrap text-gray-600 leading-relaxed">{viewPo.billingAddress || 'Same as Institute Address'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h4 className="font-bold text-gray-700 mb-2 uppercase text-xs tracking-wide">Delivery Address</h4>
                <p className="whitespace-pre-wrap text-gray-600 leading-relaxed">{viewPo.deliveryAddress || 'Same as Institute Address'}</p>
            </div>
          </div>

          <table className="w-full border-collapse border border-gray-300 text-sm mb-8">
            <thead className="bg-gray-100">
                <tr>
                    <th className="border border-gray-300 p-2 w-12 text-center">Sr.</th>
                    <th className="border border-gray-300 p-2 text-left">Description</th>
                    <th className="border border-gray-300 p-2 w-16 text-center">Qty</th>
                    <th className="border border-gray-300 p-2 w-16 text-center">UOM</th>
                    <th className="border border-gray-300 p-2 w-24 text-right">Unit Price</th>
                    <th className="border border-gray-300 p-2 w-24 text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                {viewPo.lineItems?.map((item: any) => (
                    <tr key={item.id}>
                        <td className="border border-gray-300 p-2 text-center">{item.srNo}</td>
                        <td className="border border-gray-300 p-2 font-medium">{item.productName}</td>
                        <td className="border border-gray-300 p-2 text-center">{item.quantity}</td>
                        <td className="border border-gray-300 p-2 text-center">{item.uom}</td>
                        <td className="border border-gray-300 p-2 text-right">{item.unitPrice.toLocaleString()}</td>
                        <td className="border border-gray-300 p-2 text-right font-bold">{item.totalAmount.toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
                <tr>
                    <td colSpan={5} className="border border-gray-300 p-2 text-right font-bold uppercase text-gray-600">Grand Total</td>
                    <td className="border border-gray-300 p-2 text-right font-bold bg-gray-50 text-base">₹ {viewPo.totalAmount.toLocaleString()}</td>
                </tr>
            </tfoot>
          </table>

          <div className="mt-auto pt-8 border-t-2 border-gray-200">
             <div className="grid grid-cols-2 gap-8">
                <div className="text-sm">
                   <h4 className="font-bold mb-2 text-gray-700 uppercase tracking-wide">Terms & Conditions</h4>
                   <div className="whitespace-pre-wrap text-gray-600 leading-relaxed border-l-2 border-gray-300 pl-3">{viewPo.termsAndConditions}</div>
                </div>
                <div className="text-right flex flex-col justify-end">
                   <div className="mb-10 font-bold text-lg">Authorized Signatory</div>
                   <div className="text-gray-500 border-t border-gray-400 pt-2 inline-block w-48 ml-auto">{viewPo.approvedBy || 'Start-Up Admin'}</div>
                </div>
             </div>
          </div>
          
          <div className="text-center text-[10px] text-gray-400 mt-12 pt-4 border-t print:block hidden">
             This is a computer generated document. No signature is required.
          </div>
        </div>
      </div>
    );
  }

  // 3. CREATE FORM
  if (showForm) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-2xl font-bold text-gray-800">New Purchase Order</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-red-500 p-1 rounded hover:bg-gray-100"><X size={24} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-1">
                 <label className="text-sm font-medium text-gray-700">PO Number <span className="text-red-500">*</span></label>
                 <input required type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" value={formData.poNumber} onChange={e => setFormData({...formData, poNumber: e.target.value})} placeholder="e.g. PO-2024-001" />
             </div>
             <div className="space-y-1">
                 <label className="text-sm font-medium text-gray-700">Date <span className="text-red-500">*</span></label>
                 <input required type="date" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
             </div>
             <div className="space-y-1">
                 <label className="text-sm font-medium text-gray-700">Vendor Name <span className="text-red-500">*</span></label>
                 <input required type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" value={formData.vendorName} onChange={e => setFormData({...formData, vendorName: e.target.value})} placeholder="Vendor Organization" />
             </div>
             
             {/* Analytics & Meta Fields */}
             <div className="space-y-1"><label className="text-sm font-medium text-gray-700">Request Date (PRF)</label><input type="datetime-local" className="w-full p-2 border rounded bg-orange-50 focus:ring-2 focus:ring-orange-500" value={formData.requestDate} onChange={e => setFormData({...formData, requestDate: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium text-gray-700">Action Date (Approval)</label><input type="datetime-local" className="w-full p-2 border rounded bg-orange-50 focus:ring-2 focus:ring-orange-500" value={formData.actionDate} onChange={e => setFormData({...formData, actionDate: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium text-gray-700">GSTIN</label><input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value})} /></div>
             
             <div className="space-y-1"><label className="text-sm font-medium text-gray-700">Department</label><input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" value={formData.deptName} onChange={e => setFormData({...formData, deptName: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium text-gray-700">Approved By</label><input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" value={formData.approvedBy} onChange={e => setFormData({...formData, approvedBy: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium text-gray-700">Reference No</label><input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" value={formData.requestRef} onChange={e => setFormData({...formData, requestRef: e.target.value})} /></div>
             
             <div className="space-y-1"><label className="text-sm font-medium text-gray-700">Request Type</label><input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" value={formData.requestType} onChange={e => setFormData({...formData, requestType: e.target.value})} placeholder="e.g. PRF" /></div>
             <div className="space-y-1"><label className="text-sm font-medium text-gray-700">PRF Ref</label><input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" value={formData.prfRef} onChange={e => setFormData({...formData, prfRef: e.target.value})} placeholder="e.g. 587" /></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-1"><label className="text-sm font-medium text-gray-700">Billing Address</label><textarea className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" rows={3} value={formData.billingAddress} onChange={e => setFormData({...formData, billingAddress: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium text-gray-700">Delivery Address</label><textarea className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500" rows={3} value={formData.deliveryAddress} onChange={e => setFormData({...formData, deliveryAddress: e.target.value})} /></div>
          </div>

          {/* DYNAMIC ATTRIBUTES SECTION */}
          <div className="bg-gray-50 border rounded-lg p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2 text-gray-700"><ListPlus size={18}/> Additional Attributes</h3>
              {customFields.map((field, idx) => (
                  <div key={idx} className="flex gap-3 mb-2">
                      <input className="w-1/3 p-2 border rounded text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Field Name (e.g. Project Code)" value={field.key} onChange={e => updateCustomField(idx, 'key', e.target.value)} />
                      <input className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Value" value={field.value} onChange={e => updateCustomField(idx, 'value', e.target.value)} />
                      <button type="button" onClick={() => removeCustomField(idx)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </div>
              ))}
              <button type="button" onClick={addCustomField} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mt-2 hover:bg-blue-50 p-1.5 rounded transition-colors">+ Add Custom Field</button>
          </div>

          {/* LINE ITEMS TABLE */}
          <div className="border rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 border-b">
                <tr><th className="p-3 w-12 text-center text-gray-600">Sr.</th><th className="p-3 text-gray-600">Product Description</th><th className="p-3 w-24 text-gray-600">Qty</th><th className="p-3 w-24 text-gray-600">UOM</th><th className="p-3 w-32 text-gray-600">Price</th><th className="p-3 w-20 text-gray-600">GST %</th><th className="p-3 w-32 text-right text-gray-600">Total</th><th className="p-3 w-12"></th></tr>
              </thead>
              <tbody className="divide-y">
                {lineItems.map((item, idx) => (
                  <tr key={idx} className="bg-white hover:bg-gray-50">
                    <td className="p-2 text-center text-gray-500">{item.srNo}</td>
                    <td className="p-2"><input type="text" className="w-full p-1.5 border rounded focus:ring-1 focus:ring-indigo-500" value={item.productName} onChange={e => handleLineItemChange(idx, 'productName', e.target.value)} /></td>
                    <td className="p-2"><input type="number" className="w-full p-1.5 border rounded text-center focus:ring-1 focus:ring-indigo-500" value={item.quantity} onChange={e => handleLineItemChange(idx, 'quantity', e.target.value)} /></td>
                    <td className="p-2"><input type="text" className="w-full p-1.5 border rounded text-center focus:ring-1 focus:ring-indigo-500" value={item.uom} onChange={e => handleLineItemChange(idx, 'uom', e.target.value)} /></td>
                    <td className="p-2"><input type="number" className="w-full p-1.5 border rounded text-right focus:ring-1 focus:ring-indigo-500" value={item.unitPrice} onChange={e => handleLineItemChange(idx, 'unitPrice', e.target.value)} /></td>
                    <td className="p-2"><input type="number" className="w-full p-1.5 border rounded text-center focus:ring-1 focus:ring-indigo-500" value={item.gst} onChange={e => handleLineItemChange(idx, 'gst', e.target.value)} /></td>
                    <td className="p-2 text-right font-medium text-gray-800">{item.totalAmount.toFixed(2)}</td>
                    <td className="p-2 text-center"><button type="button" onClick={() => removeLineItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 bg-gray-50 border-t flex justify-between items-center">
                <button type="button" onClick={addLineItem} className="text-indigo-600 text-sm font-bold hover:text-indigo-800 flex items-center gap-1 transition-colors"><Plus size={16} /> Add Line Item</button>
                <div className="text-xl font-bold text-gray-800">Grand Total: <span className="text-indigo-700">₹ {calculateGrandTotal()}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
             <label className="block text-sm font-medium text-gray-700">Terms & Conditions</label>
             <textarea className="w-full p-3 border rounded font-mono text-sm bg-gray-50 focus:bg-white transition-colors" rows={4} value={formData.termsAndConditions} onChange={e => setFormData({...formData, termsAndConditions: e.target.value})} />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
             <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">Cancel</button>
             <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700 transition-all flex items-center gap-2">
                <Check size={18} /> Save Order
             </button>
          </div>
        </form>
      </div>
    );
  }

  // 4. MAIN LIST (Default View)
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-gray-500 text-sm">Manage procurement, vendor orders, and receiving.</p>
        </div>
        <div className="flex gap-2">
            {/* ADMIN ONLY ACTIONS */}
            {isAdmin && (
                <>
                    <button onClick={handleScanPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm transition-all text-sm font-medium"><FileText className="w-4 h-4 text-orange-600" /> Scan PDF</button>
                    <button onClick={handleImportPOs} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm transition-all text-sm font-medium"><FileSpreadsheet className="w-4 h-4 text-green-600" /> Import Excel</button>
                    <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow transition-all text-sm font-bold"><Plus className="w-4 h-4" /> New PO</button>
                </>
            )}
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
               <tr>
                  <th className="p-4 text-sm font-semibold text-gray-500 uppercase tracking-wider">PO Number</th>
                  <th className="p-4 text-sm font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="p-4 text-sm font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="p-4 text-right text-sm font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="p-4 text-right text-sm font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="p-4"></th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {pos.length === 0 && !loading && (
                   <tr><td colSpan={6} className="p-12 text-center text-gray-400 italic">No Purchase Orders found. Create one to get started.</td></tr>
               )}
               {pos.map(po => (
                  <tr key={po.id} className="hover:bg-gray-50 transition-colors group">
                     <td className="p-4 font-bold text-gray-900">{po.poNumber}</td>
                     <td className="p-4 text-gray-500 text-sm">
                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />{new Date(po.date).toLocaleDateString()}</div>
                     </td>
                     <td className="p-4 text-gray-700 font-medium">{po.vendorNameSnap}</td>
                     <td className="p-4 text-right font-mono font-bold text-gray-900">₹ {po.totalAmount.toLocaleString()}</td>
                     <td className="p-4 text-right">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border", 
                            po.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        )}>
                           {po.status}
                        </span>
                     </td>
                     <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setViewPo(po)} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors" title="View"><Eye size={18}/></button>
                            {isAdmin && <button onClick={() => handleDeletePO(po.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors" title="Delete"><Trash2 size={18}/></button>}
                        </div>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
}