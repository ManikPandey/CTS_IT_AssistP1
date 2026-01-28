import React, { useEffect, useState } from 'react';
import { Plus, Calendar, Trash2, X, Eye, Printer, PackageCheck, Upload, FileText, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/context/UserContext';

// --- INTERNAL COMPONENT: INPUT MODAL ---
// Reused here to allow quick creation of sub-categories during receiving
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

export default function PurchaseOrders() {
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

  // Form State
  const [formData, setFormData] = useState({
    poNumber: '',
    date: new Date().toISOString().split('T')[0],
    vendorName: '',
    gstin: '',
    billingAddress: '',
    deliveryAddress: '',
    termsAndConditions: "Delivery: Immediate\nPayment Terms: Against certified original invoice\nFreight Charges: As per approved actuals",
    remarks: '',
    requestRef: '',
    deptName: '',
    approvedBy: '',
    requestDate: '',
    actionDate: '',
    requestType: '', 
    prfRef: ''       
  });

  const [lineItems, setLineItems] = useState([
    { srNo: 1, productName: '', quantity: 1, uom: 'Nos', unitPrice: 0, gst: 18, totalAmount: 0 }
  ]);

  // Load Data
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

  // Helpers
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

  // --- ACTIONS (Admin Only Checks) ---
  
  const handleImportPOs = async () => {
    if (!isAdmin) return;
    if(!confirm("Import POs from Excel?\n\nThe Excel file MUST have these columns:\n- PO Number\n- Date\n- Vendor\n- Product\n- Qty\n- Price")) return;
    
    setLoading(true);
    const res = await window.api.importPurchaseOrders();
    setLoading(false);
    
    if (res.success) {
      alert(`Success! Imported ${res.count} Purchase Orders.`);
      loadData();
    } else if (res.error !== "No file selected") {
      alert("Excel Import Failed: " + res.error);
    }
  };

  const handleScanPDF = async () => {
    if (!isAdmin) return;
    setLoading(true);
    const res = await window.api.parsePurchaseOrderPDF();
    setLoading(false);

    if (res.success) {
        setFormData(prev => ({
            ...prev,
            poNumber: res.data.poNumber || prev.poNumber,
            date: res.data.date || prev.date,
            vendorName: res.data.vendorName || prev.vendorName,
            gstin: res.data.gstin || prev.gstin,
        }));

        if (res.data.lineItems && res.data.lineItems.length > 0) {
            setLineItems(res.data.lineItems);
        }

        setShowForm(true);
        alert("PDF Scanned! Please review the details in the form.");
    } else if (res.error !== "No file selected") {
        alert("PDF Scan Failed: " + res.error);
    }
  };

  const handleDeletePO = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Delete this PO?")) return;
    const res = await window.api.deletePurchaseOrder(id);
    if (res.success) loadData();
    else alert(res.error);
  };

  // --- FORM HANDLERS ---
  const handleLineItemChange = (index: number, field: string, value: any) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], [field]: value };
    const qty = parseFloat(newItems[index].quantity as any) || 0;
    const price = parseFloat(newItems[index].unitPrice as any) || 0;
    const gst = parseFloat(newItems[index].gst as any) || 0;
    const baseTotal = qty * price;
    const gstAmount = baseTotal * (gst / 100);
    newItems[index].totalAmount = baseTotal + gstAmount;
    setLineItems(newItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { srNo: lineItems.length + 1, productName: '', quantity: 1, uom: 'Nos', unitPrice: 0, gst: 18, totalAmount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    const newItems = lineItems.filter((_, i) => i !== index);
    newItems.forEach((item, i) => item.srNo = i + 1);
    setLineItems(newItems);
  };

  const calculateGrandTotal = () => {
    return lineItems.reduce((acc, item) => acc + item.totalAmount, 0).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.poNumber || !formData.vendorName) return alert("Fill required fields");
    const payload = {
      ...formData,
      totalAmount: parseFloat(calculateGrandTotal()),
      status: "ISSUED",
      lineItems: lineItems,
      requestDate: formData.requestDate ? new Date(formData.requestDate) : null,
      actionDate: formData.actionDate ? new Date(formData.actionDate) : null,
    };
    const res = await window.api.createPurchaseOrder(payload);
    if (res.success) {
      alert("PO Created!");
      setShowForm(false);
      loadData();
    } else {
      alert("Error: " + res.error);
    }
  };

  // --- RECEIVING LOGIC (Admin Only) ---
  const openReceiveModal = (po: any) => {
    if (!isAdmin) return;

    const pendingItems = po.lineItems.filter((i: any) => i.receivedQty < i.quantity);
    if (pendingItems.length === 0) {
      alert("All items in this PO have been received!");
      return;
    }
    
    // Find default category safely
    const defaultCatId = categories.length > 0 ? categories[0].id : '';
    const defaultSubId = categories.length > 0 && categories[0].subCategories.length > 0 ? categories[0].subCategories[0].id : '';

    const initialData = pendingItems.map((item: any) => ({
      lineItemId: item.id,
      productName: item.productName,
      maxQty: item.quantity - item.receivedQty,
      quantity: item.quantity - item.receivedQty,
      serials: [], 
      categoryId: defaultCatId,
      subCategoryId: defaultSubId
    }));
    setReceiveData(initialData);
    setShowReceive(true);
  };

  // Handler for creating a sub-category directly from the Receive modal
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
    if (!confirm("This will add these items to your Inventory. Continue?")) return;
    
    // Validation check before sending
    for (const item of receiveData) {
        if (!item.subCategoryId) {
            alert(`Error: Sub-Category not selected for item "${item.productName}".\n\nPlease select one or create new using the '+' button.`);
            return;
        }
    }

    const itemsToProcess = receiveData.map(item => ({
      lineItemId: item.lineItemId,
      quantity: item.quantity,
      categoryId: item.categoryId,
      subCategoryId: item.subCategoryId,
      serials: item.serials.length > 0 ? item.serials : Array(item.quantity).fill("").map((_, i) => `PO-AUTO-${Date.now()}-${i}`) 
    }));
    
    const res = await window.api.receiveItems({ poId: viewPo.id, items: itemsToProcess });
    if (res.success) {
      alert("Received!");
      setShowReceive(false);
      setViewPo(null);
      loadData();
    } else alert(res.error);
  };

  // --- RENDER ---
  
  // 1. RECEIVE MODAL
  if (showReceive && viewPo) {
    return (
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Receive Items: {viewPo.poNumber}</h2>
          <div className="space-y-6">
            {receiveData.map((item: any, idx) => (
              <div key={item.lineItemId} className="border p-4 rounded bg-gray-50">
                <div className="flex justify-between font-semibold mb-2">
                  <span>{item.productName}</span>
                  <span className="text-sm text-gray-500">{item.quantity} / {item.maxQty}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Category</label>
                    <select className="w-full p-2 border rounded text-sm mt-1" 
                      value={item.categoryId}
                      onChange={(e) => {
                        const catId = e.target.value;
                        const cat = categories.find(c => c.id === catId);
                        const newData = [...receiveData];
                        newData[idx].categoryId = catId;
                        // Auto-select first sub-category of new category
                        newData[idx].subCategoryId = cat?.subCategories[0]?.id || '';
                        setReceiveData(newData);
                      }}
                    >
                      <option value="">Select Category...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-gray-700">Sub-Category</label>
                     <div className="flex gap-2">
                        <select className="w-full p-2 border rounded text-sm mt-1"
                            value={item.subCategoryId}
                            onChange={(e) => {
                              const newData = [...receiveData];
                              newData[idx].subCategoryId = e.target.value;
                              setReceiveData(newData);
                            }}
                        >
                            <option value="">Select Sub-Category...</option>
                            {categories.find(c => c.id === item.categoryId)?.subCategories.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        {/* FEATURE: Quick Add Button */}
                        <button 
                            onClick={() => setQuickSubCat({ categoryId: item.categoryId })} 
                            className="mt-1 p-2 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 border border-indigo-200 transition-colors"
                            title="Create new Sub-Category"
                        >
                            <Plus size={16} />
                        </button>
                     </div>
                     {!item.subCategoryId && <p className="text-xs text-red-500 mt-1">Required</p>}
                  </div>
                </div>
                <div className="mt-3">
                   <label className="block text-xs font-medium text-gray-700">Serials (Comma Separated)</label>
                   <textarea className="w-full p-2 border rounded text-sm mt-1" rows={2}
                      placeholder={`Enter ${item.quantity} serial numbers...`}
                      onChange={(e) => {
                        const serials = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                        const newData = [...receiveData];
                        newData[idx].serials = serials;
                        setReceiveData(newData);
                      }}
                   />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6 border-t pt-4">
            <button onClick={() => setShowReceive(false)} className="px-4 py-2 border rounded">Cancel</button>
            <button onClick={handleReceiveSubmit} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Confirm</button>
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

  // 2. VIEW PO MODAL
  if (viewPo) {
    const stats = calculateDelays(viewPo);
    const isCompleted = viewPo.status === 'COMPLETED';
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 overflow-y-auto flex items-start justify-center pt-10 print:pt-0 print:bg-white print:static">
        <style>{`@media print { body * { visibility: hidden; } #printable-area, #printable-area * { visibility: visible; } #printable-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; } .no-print { display: none !important; } }`}</style>
        <div id="printable-area" className="bg-white w-[210mm] min-h-[297mm] p-10 shadow-2xl relative mb-10 mx-auto print:shadow-none print:m-0">
          <div className="absolute top-4 right-4 flex gap-2 no-print">
            
            {/* ADMIN ACTIONS in View Modal */}
            {isAdmin && !isCompleted && (
                <button onClick={() => openReceiveModal(viewPo)} className="p-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2">
                    <PackageCheck size={16} /> Receive Items
                </button>
            )}
            
            <button onClick={() => window.print()} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"><Printer size={16} /> Print</button>
            <button onClick={() => setViewPo(null)} className="p-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"><X size={16} /> Close</button>
          </div>
          
          {stats && (
            <div className="no-print mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex gap-8">
               <div><span className="block text-xs text-orange-600 uppercase font-bold">Process Delay</span><span className="text-xl font-bold text-gray-800">{stats.processDelay} days</span></div>
               <div><span className="block text-xs text-orange-600 uppercase font-bold">Days Left</span><span className="text-xl font-bold text-gray-800">{stats.daysLeft} days</span></div>
            </div>
          )}

          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div><h1 className="text-3xl font-bold text-gray-900">PURCHASE ORDER</h1><p className="text-sm text-gray-500 mt-1">Computer Generated Document</p></div>
              <div className="text-right"><h2 className="text-xl font-bold text-gray-800">VIT BHOPAL</h2><p className="text-sm text-gray-600">Sehore, MP</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
            <div><h3 className="font-bold text-gray-700 border-b mb-2 pb-1">Order Details</h3>
              <div className="grid grid-cols-3 gap-y-1">
                <span className="text-gray-500">PO:</span><span className="col-span-2">{viewPo.poNumber}</span>
                <span className="text-gray-500">Date:</span><span className="col-span-2">{new Date(viewPo.date).toLocaleDateString()}</span>
                <span className="text-gray-500">Ref:</span><span className="col-span-2">{viewPo.requestRef || '-'}</span>
                <span className="text-gray-500">Type:</span><span className="col-span-2">{viewPo.requestType || '-'}</span>
                <span className="text-gray-500">PRF:</span><span className="col-span-2">{viewPo.prfRef || '-'}</span>
              </div>
            </div>
            <div><h3 className="font-bold text-gray-700 border-b mb-2 pb-1">Vendor</h3>
              <div className="grid grid-cols-3 gap-y-1">
                <span className="text-gray-500">Name:</span><span className="col-span-2">{viewPo.vendorNameSnap}</span>
                <span className="text-gray-500">GSTIN:</span><span className="col-span-2">{viewPo.gstin || '-'}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
            <div className="bg-gray-50 p-4 rounded border"><h4 className="font-bold text-gray-700 mb-2">Billing Address</h4><p className="whitespace-pre-wrap">{viewPo.billingAddress || 'Same as Institute Address'}</p></div>
            <div className="bg-gray-50 p-4 rounded border"><h4 className="font-bold text-gray-700 mb-2">Delivery Address</h4><p className="whitespace-pre-wrap">{viewPo.deliveryAddress || 'Same as Institute Address'}</p></div>
          </div>
          <table className="w-full border-collapse border border-gray-300 text-sm mb-8">
            <thead className="bg-gray-100"><tr><th className="border p-2">Sr.</th><th className="border p-2">Desc</th><th className="border p-2">Qty</th><th className="border p-2">Unit Price</th><th className="border p-2">Total</th></tr></thead>
            <tbody>{viewPo.lineItems?.map((item: any) => (<tr key={item.id}><td className="border p-2 text-center">{item.srNo}</td><td className="border p-2">{item.productName}</td><td className="border p-2 text-center">{item.quantity}</td><td className="border p-2 text-right">{item.unitPrice.toLocaleString()}</td><td className="border p-2 text-right">{item.totalAmount.toLocaleString()}</td></tr>))}</tbody>
            <tfoot><tr><td colSpan={4} className="border p-2 text-right font-bold">Grand Total</td><td className="border p-2 text-right font-bold bg-gray-50">₹ {viewPo.totalAmount.toLocaleString()}</td></tr></tfoot>
          </table>
          <div className="mt-auto pt-8 border-t">
             <div className="grid grid-cols-2">
                <div className="text-sm"><h4 className="font-bold mb-2">Terms & Conditions</h4><div className="whitespace-pre-wrap text-gray-600">{viewPo.termsAndConditions}</div></div>
                <div className="text-right"><div className="mb-8 font-bold">Authorized Signatory</div><div className="text-gray-500">{viewPo.approvedBy}</div></div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. CREATE FORM
  if (showForm) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6 border-b pb-4"><h2 className="text-2xl font-bold text-gray-800">New Purchase Order</h2><button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-red-500"><X size={24} /></button></div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-1"><label className="text-sm font-medium">PO Number</label><input required type="text" className="w-full p-2 border rounded" value={formData.poNumber} onChange={e => setFormData({...formData, poNumber: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium">Date</label><input required type="date" className="w-full p-2 border rounded" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium">Vendor</label><input required type="text" className="w-full p-2 border rounded" value={formData.vendorName} onChange={e => setFormData({...formData, vendorName: e.target.value})} /></div>
             
             {/* Analytics & Meta Fields */}
             <div className="space-y-1"><label className="text-sm font-medium">Request Date</label><input type="datetime-local" className="w-full p-2 border rounded bg-orange-50" value={formData.requestDate} onChange={e => setFormData({...formData, requestDate: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium">Action Date</label><input type="datetime-local" className="w-full p-2 border rounded bg-orange-50" value={formData.actionDate} onChange={e => setFormData({...formData, actionDate: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium">GSTIN</label><input type="text" className="w-full p-2 border rounded" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value})} /></div>
             
             <div className="space-y-1"><label className="text-sm font-medium">Department</label><input type="text" className="w-full p-2 border rounded" value={formData.deptName} onChange={e => setFormData({...formData, deptName: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium">Approved By</label><input type="text" className="w-full p-2 border rounded" value={formData.approvedBy} onChange={e => setFormData({...formData, approvedBy: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium">Ref No</label><input type="text" className="w-full p-2 border rounded" value={formData.requestRef} onChange={e => setFormData({...formData, requestRef: e.target.value})} /></div>
             
             <div className="space-y-1"><label className="text-sm font-medium">Request Type</label><input type="text" className="w-full p-2 border rounded" value={formData.requestType} onChange={e => setFormData({...formData, requestType: e.target.value})} placeholder="e.g. PRF" /></div>
             <div className="space-y-1"><label className="text-sm font-medium">PRF Ref</label><input type="text" className="w-full p-2 border rounded" value={formData.prfRef} onChange={e => setFormData({...formData, prfRef: e.target.value})} placeholder="e.g. 587" /></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-1"><label className="text-sm font-medium">Billing Address</label><textarea className="w-full p-2 border rounded" rows={3} value={formData.billingAddress} onChange={e => setFormData({...formData, billingAddress: e.target.value})} /></div>
             <div className="space-y-1"><label className="text-sm font-medium">Delivery Address</label><textarea className="w-full p-2 border rounded" rows={3} value={formData.deliveryAddress} onChange={e => setFormData({...formData, deliveryAddress: e.target.value})} /></div>
          </div>

          {/* Table Line Items UI */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 border-b">
                <tr><th className="p-2 w-12 text-center">Sr.</th><th className="p-2">Product Description</th><th className="p-2 w-24">Qty</th><th className="p-2 w-24">UOM</th><th className="p-2 w-32">Price</th><th className="p-2 w-20">GST %</th><th className="p-2 w-32 text-right">Total</th><th className="p-2 w-12"></th></tr>
              </thead>
              <tbody className="divide-y">
                {lineItems.map((item, idx) => (
                  <tr key={idx} className="bg-white">
                    <td className="p-2 text-center text-gray-500">{item.srNo}</td>
                    <td className="p-2"><input type="text" className="w-full p-1.5 border rounded" value={item.productName} onChange={e => handleLineItemChange(idx, 'productName', e.target.value)} /></td>
                    <td className="p-2"><input type="number" className="w-full p-1.5 border rounded text-center" value={item.quantity} onChange={e => handleLineItemChange(idx, 'quantity', e.target.value)} /></td>
                    <td className="p-2"><input type="text" className="w-full p-1.5 border rounded text-center" value={item.uom} onChange={e => handleLineItemChange(idx, 'uom', e.target.value)} /></td>
                    <td className="p-2"><input type="number" className="w-full p-1.5 border rounded text-right" value={item.unitPrice} onChange={e => handleLineItemChange(idx, 'unitPrice', e.target.value)} /></td>
                    <td className="p-2"><input type="number" className="w-full p-1.5 border rounded text-center" value={item.gst} onChange={e => handleLineItemChange(idx, 'gst', e.target.value)} /></td>
                    <td className="p-2 text-right font-medium">{item.totalAmount.toFixed(2)}</td>
                    <td className="p-2 text-center"><button type="button" onClick={() => removeLineItem(idx)} className="text-red-500"><Trash2 size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 bg-gray-50 border-t flex justify-between items-center">
              <button type="button" onClick={addLineItem} className="text-indigo-600 text-sm font-bold hover:underline flex items-center gap-1"><Plus size={16} /> Add Line Item</button>
              <div className="text-xl font-bold">Grand Total: <span className="text-indigo-700">₹ {calculateGrandTotal()}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
             <label className="block text-sm font-medium text-gray-700">Terms & Conditions</label>
             <textarea className="w-full p-2 border rounded font-mono text-sm bg-gray-50" rows={4} value={formData.termsAndConditions} onChange={e => setFormData({...formData, termsAndConditions: e.target.value})} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
             <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 border rounded">Cancel</button>
             <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded font-bold shadow">Save PO</button>
          </div>
        </form>
      </div>
    );
  }

  // 4. MAIN LIST
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        <div className="flex gap-2">
            {/* ADMIN ACTIONS */}
            {isAdmin && (
                <>
                    <button onClick={handleScanPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm transition-all"><FileText className="w-4 h-4 text-orange-600" /> Scan PDF</button>
                    <button onClick={handleImportPOs} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm transition-all"><FileSpreadsheet className="w-4 h-4 text-green-600" /> Import Excel</button>
                    <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow transition-all"><Plus className="w-4 h-4" /> New PO</button>
                </>
            )}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
               <tr>
                  <th className="p-4 text-sm font-semibold text-gray-500">PO Number</th>
                  <th className="p-4 text-sm font-semibold text-gray-500">Date</th>
                  <th className="p-4 text-sm font-semibold text-gray-500">Vendor</th>
                  <th className="p-4 text-right text-sm font-semibold text-gray-500">Amount</th>
                  <th className="p-4 text-right text-sm font-semibold text-gray-500">Status</th>
                  <th className="p-4"></th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {pos.map(po => (
                  <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                     <td className="p-4 font-medium text-gray-900">{po.poNumber}</td>
                     <td className="p-4 text-gray-500 text-sm"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />{new Date(po.date).toLocaleDateString()}</div></td>
                     <td className="p-4 text-gray-700">{po.vendorNameSnap}</td>
                     <td className="p-4 text-right font-bold text-gray-900">₹ {po.totalAmount.toLocaleString()}</td>
                     <td className="p-4 text-right"><span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", po.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800')}>{po.status}</span></td>
                     <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                            {/* EVERYONE can View/Print */}
                            <button onClick={() => setViewPo(po)} className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors"><Eye size={18}/></button>
                            
                            {/* ONLY ADMIN can Delete */}
                            {isAdmin && (
                                <button onClick={() => handleDeletePO(po.id)} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors">
                                    <Trash2 size={18}/>
                                </button>
                            )}
                        </div>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
         {pos.length === 0 && !loading && (
            <div className="p-12 text-center text-gray-500">No Purchase Orders found. Create one to get started.</div>
         )}
      </div>
    </div>
  );
}