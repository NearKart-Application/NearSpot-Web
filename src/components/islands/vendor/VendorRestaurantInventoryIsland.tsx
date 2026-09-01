import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '../../../lib/api';
import VendorAuthGuard from '../../auth/VendorAuthGuard';

const qc = new QueryClient();

export default function VendorRestaurantInventoryIsland() {
  return (
    <QueryClientProvider client={qc}>
      <VendorAuthGuard>
        <RestaurantInventoryApp />
      </VendorAuthGuard>
    </QueryClientProvider>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ingredient {
  id: string; name: string; unit: string;
  current_stock: string; reorder_level: string; cost_per_unit: string;
  notes: string; is_low_stock: boolean; created_at: string;
}
interface RecipeIngredient {
  id: string; ingredient: string; ingredient_name: string;
  unit: string; quantity_per_serving: string;
}
interface Recipe {
  id: string; name: string; serves: number; notes: string;
  product?: string; product_name?: string;
  ingredients: RecipeIngredient[]; created_at: string;
}
interface Wastage {
  id: string; ingredient: string; ingredient_name: string;
  unit: string; quantity: string; reason: string; notes: string; date: string;
}
interface DailyStock {
  id: string; ingredient: string; ingredient_name: string; unit: string;
  date: string; opening_stock: string; closing_stock: string | null;
  received: string; consumed: string | null; notes: string;
}
interface ConsumptionSummary {
  date: string; total_consumption_cost: string;
  items: {ingredient:string;unit:string;opening_stock:string;received:string;closing_stock:string|null;consumed:string|null;cost_per_unit:string;total_cost:string}[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const UNIT_OPTS = ['piece','kg','g','l','ml','dozen'];
const WASTE_REASONS = ['spoiled','prep_waste','overproduced','spillage','other'];
const today = () => new Date().toISOString().slice(0,10);

function badge(text: string, bg: string, fg: string) {
  return <span style={{background:bg,color:fg,borderRadius:4,padding:'2px 8px',fontSize:12,fontWeight:600}}>{text}</span>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function RestaurantInventoryApp() {
  const [tab, setTab] = useState<'ingredients'|'recipes'|'wastage'|'daily'>('ingredients');

  const TABS = [
    {key:'ingredients',label:'Ingredients'},
    {key:'recipes',label:'Recipes / BOM'},
    {key:'wastage',label:'Wastage'},
    {key:'daily',label:'Daily Stock'},
  ] as const;

  return (
    <div style={{fontFamily:'sans-serif',maxWidth:1000,margin:'0 auto',padding:'0 16px 40px'}}>
      <h2 style={{fontSize:22,fontWeight:700,margin:'0 0 16px'}}>Restaurant Inventory</h2>

      <div style={{display:'flex',gap:8,borderBottom:'2px solid #e5e7eb',marginBottom:20}}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{padding:'8px 16px',border:'none',background:'none',cursor:'pointer',
              borderBottom:tab===t.key?'2px solid #0f172a':'2px solid transparent',
              fontWeight:tab===t.key?700:400,color:tab===t.key?'#0f172a':'#6b7280'}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ingredients' && <IngredientsTab />}
      {tab === 'recipes'     && <RecipesTab />}
      {tab === 'wastage'     && <WastageTab />}
      {tab === 'daily'       && <DailyStockTab />}
    </div>
  );
}

// ── Ingredients Tab ───────────────────────────────────────────────────────────

function IngredientsTab() {
  const queryClient = useQueryClient();
  const [showAdd,   setShowAdd]   = useState(false);
  const [editItem,  setEditItem]  = useState<Ingredient|null>(null);
  const [lowOnly,   setLowOnly]   = useState(false);

  const {data:ingredients=[],isLoading} = useQuery<Ingredient[]>({
    queryKey: ['rest-ingredients',lowOnly],
    queryFn: () => api.get('/restaurant/ingredients/',{params:lowOnly?{low_stock:'true'}:{}}).then(r=>r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id:string) => api.delete(`/restaurant/ingredients/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({queryKey:['rest-ingredients']}),
  });

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            <input type="checkbox" checked={lowOnly} onChange={e=>setLowOnly(e.target.checked)} />
            Low stock only
          </label>
        </div>
        <button onClick={() => setShowAdd(true)} style={btn('#0f172a','#fff')}>+ Add Ingredient</button>
      </div>

      {isLoading ? <p>Loading…</p> : (
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
          <thead><tr style={{background:'#f9fafb'}}>
            {['Name','Unit','Stock','Reorder','Cost/Unit','Status','Actions'].map(h=>(
              <th key={h} style={{padding:'8px 12px',textAlign:'left',borderBottom:'1px solid #e5e7eb',fontWeight:600}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {ingredients.map(i=>(
              <tr key={i.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                <td style={{padding:'8px 12px',fontWeight:500}}>{i.name}</td>
                <td style={{padding:'8px 12px',color:'#6b7280'}}>{i.unit}</td>
                <td style={{padding:'8px 12px'}}>{i.current_stock}</td>
                <td style={{padding:'8px 12px',color:'#6b7280'}}>{i.reorder_level}</td>
                <td style={{padding:'8px 12px'}}>₹{i.cost_per_unit}</td>
                <td style={{padding:'8px 12px'}}>{i.is_low_stock?badge('Low Stock','#FEE2E2','#DC2626'):badge('OK','#DCFCE7','#16A34A')}</td>
                <td style={{padding:'8px 12px',display:'flex',gap:6}}>
                  <button onClick={()=>setEditItem(i)} style={btn('#f3f4f6','#374151',12)}>Edit</button>
                  <button onClick={()=>{if(confirm('Delete?'))deleteMut.mutate(i.id)}} style={btn('#ef4444','#fff',12)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAdd  && <IngredientModal onClose={()=>setShowAdd(false)} />}
      {editItem && <IngredientModal ingredient={editItem} onClose={()=>setEditItem(null)} />}
    </div>
  );
}

function IngredientModal({ingredient, onClose}: {ingredient?: Ingredient; onClose:()=>void}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: ingredient?.name??'', unit: ingredient?.unit??'piece',
    current_stock: ingredient?.current_stock??'0',
    reorder_level: ingredient?.reorder_level??'0',
    cost_per_unit: ingredient?.cost_per_unit??'0', notes: ingredient?.notes??'',
  });
  const mut = useMutation({
    mutationFn: (d:typeof form) => ingredient
      ? api.patch(`/restaurant/ingredients/${ingredient.id}/`,d)
      : api.post('/restaurant/ingredients/',d),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['rest-ingredients']}); onClose(); },
  });
  const f = (k:keyof typeof form,v:string) => setForm(p=>({...p,[k]:v}));

  return (
    <div style={overlay}>
      <div style={modal(420)}>
        <h3 style={{margin:'0 0 14px'}}>{ingredient?'Edit':'Add'} Ingredient</h3>
        <label style={lbl}>Name *</label>
        <input style={inp} value={form.name} onChange={e=>f('name',e.target.value)} />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div>
            <label style={lbl}>Unit</label>
            <select style={inp} value={form.unit} onChange={e=>f('unit',e.target.value)}>
              {UNIT_OPTS.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Cost / Unit (₹)</label>
            <input style={inp} type="number" step="0.01" value={form.cost_per_unit} onChange={e=>f('cost_per_unit',e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Current Stock</label>
            <input style={inp} type="number" step="0.001" value={form.current_stock} onChange={e=>f('current_stock',e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Reorder Level</label>
            <input style={inp} type="number" step="0.001" value={form.reorder_level} onChange={e=>f('reorder_level',e.target.value)} />
          </div>
        </div>
        <label style={lbl}>Notes</label>
        <textarea style={{...inp,height:50}} value={form.notes} onChange={e=>f('notes',e.target.value)} />
        {mut.isError && <p style={{color:'#dc2626'}}>Failed to save.</p>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
          <button onClick={onClose} style={btn('#e5e7eb','#374151')}>Cancel</button>
          <button onClick={()=>mut.mutate(form)} disabled={mut.isPending} style={btn('#0f172a','#fff')}>{mut.isPending?'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Recipes Tab ───────────────────────────────────────────────────────────────

function RecipesTab() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Recipe|null>(null);

  const {data:recipes=[],isLoading} = useQuery<Recipe[]>({
    queryKey: ['rest-recipes'],
    queryFn: () => api.get('/restaurant/recipes/').then(r=>r.data),
  });

  const deductMut = useMutation({
    mutationFn: ({id,servings}:{id:string;servings:number}) =>
      api.post(`/restaurant/recipes/${id}/deduct/`,{servings}),
    onSuccess: () => queryClient.invalidateQueries({queryKey:['rest-ingredients']}),
  });

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
        <button onClick={()=>setShowAdd(true)} style={btn('#0f172a','#fff')}>+ Add Recipe</button>
      </div>
      {isLoading ? <p>Loading…</p> : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {recipes.map(r=>(
            <div key={r.id} style={{border:'1px solid #e5e7eb',borderRadius:8,padding:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <span style={{fontWeight:700,fontSize:15}}>{r.name}</span>
                  {r.product_name && <span style={{color:'#6b7280',marginLeft:8,fontSize:13}}>→ {r.product_name}</span>}
                  <span style={{color:'#6b7280',fontSize:12,marginLeft:8}}>Serves {r.serves}</span>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setSelected(r)} style={btn('#f3f4f6','#374151',12)}>Manage Ingredients</button>
                  <button onClick={()=>{const s=parseInt(prompt('Servings to deduct?','1')??'0');if(s>0)deductMut.mutate({id:r.id,servings:s})}} style={btn('#f59e0b','#fff',12)}>Deduct Stock</button>
                </div>
              </div>
              {r.ingredients.length>0 && (
                <div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:6}}>
                  {r.ingredients.map(ri=>(
                    <span key={ri.id} style={{background:'#f3f4f6',borderRadius:4,padding:'2px 10px',fontSize:12}}>
                      {ri.ingredient_name} × {ri.quantity_per_serving}{ri.unit}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {recipes.length===0 && <p style={{color:'#9ca3af'}}>No recipes yet.</p>}
        </div>
      )}

      {showAdd   && <RecipeModal onClose={()=>setShowAdd(false)} />}
      {selected  && <RecipeIngredientsModal recipe={selected} onClose={()=>setSelected(null)} />}
    </div>
  );
}

function RecipeModal({onClose}: {onClose:()=>void}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({name:'',serves:'1',notes:''});
  const mut = useMutation({
    mutationFn: (d:typeof form) => api.post('/restaurant/recipes/',d),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['rest-recipes']}); onClose(); },
  });
  return (
    <div style={overlay}>
      <div style={modal(380)}>
        <h3 style={{margin:'0 0 14px'}}>Add Recipe</h3>
        <label style={lbl}>Recipe Name *</label>
        <input style={inp} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} />
        <label style={lbl}>Serves</label>
        <input style={inp} type="number" min="1" value={form.serves} onChange={e=>setForm(p=>({...p,serves:e.target.value}))} />
        <label style={lbl}>Notes</label>
        <textarea style={{...inp,height:50}} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} />
        {mut.isError && <p style={{color:'#dc2626'}}>Failed to save.</p>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
          <button onClick={onClose} style={btn('#e5e7eb','#374151')}>Cancel</button>
          <button onClick={()=>mut.mutate(form)} disabled={mut.isPending} style={btn('#0f172a','#fff')}>{mut.isPending?'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function RecipeIngredientsModal({recipe, onClose}: {recipe:Recipe; onClose:()=>void}) {
  const queryClient = useQueryClient();
  const {data:ingredients=[]} = useQuery<Ingredient[]>({
    queryKey:['rest-ingredients'],
    queryFn:()=>api.get('/restaurant/ingredients/').then(r=>r.data),
  });
  const [selectedIng, setSelectedIng] = useState('');
  const [qty, setQty] = useState('');

  const addMut = useMutation({
    mutationFn: (d:{ingredient:string;quantity_per_serving:string}) =>
      api.post(`/restaurant/recipes/${recipe.id}/ingredients/`,d),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['rest-recipes']}); setSelectedIng(''); setQty(''); },
  });

  const removeMut = useMutation({
    mutationFn: (riId:string) =>
      api.delete(`/restaurant/recipes/${recipe.id}/ingredients/${riId}/`),
    onSuccess: () => queryClient.invalidateQueries({queryKey:['rest-recipes']}),
  });

  return (
    <div style={overlay}>
      <div style={modal(480)}>
        <h3 style={{margin:'0 0 4px'}}>{recipe.name}</h3>
        <p style={{color:'#6b7280',marginTop:0,marginBottom:14,fontSize:13}}>Manage ingredients (per serving)</p>

        <div style={{marginBottom:14}}>
          {recipe.ingredients.map(ri=>(
            <div key={ri.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #f3f4f6'}}>
              <span>{ri.ingredient_name}</span>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{color:'#6b7280',fontSize:13}}>{ri.quantity_per_serving} {ri.unit}</span>
                <button onClick={()=>removeMut.mutate(ri.id)} style={btn('#ef4444','#fff',11)}>Remove</button>
              </div>
            </div>
          ))}
          {recipe.ingredients.length===0 && <p style={{color:'#9ca3af',fontSize:13}}>No ingredients yet.</p>}
        </div>

        <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          <div style={{flex:2}}>
            <label style={lbl}>Ingredient</label>
            <select style={inp} value={selectedIng} onChange={e=>setSelectedIng(e.target.value)}>
              <option value="">— select —</option>
              {ingredients.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>Qty / Serving</label>
            <input style={inp} type="number" step="0.001" value={qty} onChange={e=>setQty(e.target.value)} />
          </div>
          <button onClick={()=>addMut.mutate({ingredient:selectedIng,quantity_per_serving:qty})} style={{...btn('#0f172a','#fff'),marginBottom:12}}>Add</button>
        </div>

        <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
          <button onClick={onClose} style={btn('#e5e7eb','#374151')}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Wastage Tab ───────────────────────────────────────────────────────────────

function WastageTab() {
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState(today());
  const [showAdd, setShowAdd] = useState(false);

  const {data:wastage=[],isLoading} = useQuery<Wastage[]>({
    queryKey:['rest-wastage',dateFilter],
    queryFn:()=>api.get('/restaurant/wastage/',{params:dateFilter?{date:dateFilter}:{}}).then(r=>r.data),
  });

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{fontSize:13}}>Date:</label>
          <input type="date" style={{...inp,marginBottom:0,width:'auto'}} value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
        </div>
        <button onClick={()=>setShowAdd(true)} style={btn('#0f172a','#fff')}>+ Record Wastage</button>
      </div>
      {isLoading ? <p>Loading…</p> : (
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
          <thead><tr style={{background:'#f9fafb'}}>
            {['Date','Ingredient','Qty','Reason','Notes'].map(h=>(
              <th key={h} style={{padding:'8px 12px',textAlign:'left',borderBottom:'1px solid #e5e7eb',fontWeight:600}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {wastage.map(w=>(
              <tr key={w.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                <td style={{padding:'8px 12px'}}>{w.date}</td>
                <td style={{padding:'8px 12px',fontWeight:500}}>{w.ingredient_name}</td>
                <td style={{padding:'8px 12px'}}>{w.quantity} {w.unit}</td>
                <td style={{padding:'8px 12px',color:'#d97706'}}>{w.reason.replace('_',' ')}</td>
                <td style={{padding:'8px 12px',color:'#6b7280'}}>{w.notes||'—'}</td>
              </tr>
            ))}
            {wastage.length===0 && <tr><td colSpan={5} style={{padding:'16px 12px',color:'#9ca3af',textAlign:'center'}}>No wastage records for this date.</td></tr>}
          </tbody>
        </table>
      )}
      {showAdd && <WastageModal onClose={()=>setShowAdd(false)} />}
    </div>
  );
}

function WastageModal({onClose}: {onClose:()=>void}) {
  const queryClient = useQueryClient();
  const {data:ingredients=[]} = useQuery<Ingredient[]>({queryKey:['rest-ingredients'],queryFn:()=>api.get('/restaurant/ingredients/').then(r=>r.data)});
  const [form, setForm] = useState({ingredient:'',quantity:'',reason:'other',notes:'',date:today()});
  const mut = useMutation({
    mutationFn: (d:typeof form) => api.post('/restaurant/wastage/',d),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['rest-wastage']}); queryClient.invalidateQueries({queryKey:['rest-ingredients']}); onClose(); },
  });
  const f = (k:keyof typeof form,v:string) => setForm(p=>({...p,[k]:v}));
  return (
    <div style={overlay}>
      <div style={modal(400)}>
        <h3 style={{margin:'0 0 14px'}}>Record Wastage</h3>
        <label style={lbl}>Ingredient *</label>
        <select style={inp} value={form.ingredient} onChange={e=>f('ingredient',e.target.value)}>
          <option value="">— select —</option>
          {ingredients.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
        </select>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div>
            <label style={lbl}>Quantity *</label>
            <input style={inp} type="number" step="0.001" value={form.quantity} onChange={e=>f('quantity',e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Date</label>
            <input style={inp} type="date" value={form.date} onChange={e=>f('date',e.target.value)} />
          </div>
        </div>
        <label style={lbl}>Reason</label>
        <select style={inp} value={form.reason} onChange={e=>f('reason',e.target.value)}>
          {WASTE_REASONS.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}
        </select>
        <label style={lbl}>Notes</label>
        <textarea style={{...inp,height:50}} value={form.notes} onChange={e=>f('notes',e.target.value)} />
        {mut.isError && <p style={{color:'#dc2626'}}>Failed to save.</p>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
          <button onClick={onClose} style={btn('#e5e7eb','#374151')}>Cancel</button>
          <button onClick={()=>mut.mutate(form)} disabled={mut.isPending} style={btn('#0f172a','#fff')}>{mut.isPending?'Saving…':'Record'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Daily Stock Tab ───────────────────────────────────────────────────────────

function DailyStockTab() {
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState(today());
  const [showOpeningModal, setShowOpeningModal] = useState(false);

  const {data:dailyStocks=[],isLoading} = useQuery<DailyStock[]>({
    queryKey:['rest-daily-stock',dateFilter],
    queryFn:()=>api.get('/restaurant/daily-stock/',{params:{date:dateFilter}}).then(r=>r.data),
  });

  const {data:summary} = useQuery<ConsumptionSummary>({
    queryKey:['rest-consumption',dateFilter],
    queryFn:()=>api.get('/restaurant/daily-consumption/',{params:{date:dateFilter}}).then(r=>r.data),
  });

  const closingMut = useMutation({
    mutationFn: ({id,closing_stock}:{id:string;closing_stock:string}) =>
      api.patch(`/restaurant/daily-stock/${id}/`,{closing_stock}),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['rest-daily-stock']}); queryClient.invalidateQueries({queryKey:['rest-consumption']}); },
  });

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{fontSize:13}}>Date:</label>
          <input type="date" style={{...inp,marginBottom:0,width:'auto'}} value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
        </div>
        <button onClick={()=>setShowOpeningModal(true)} style={btn('#0f172a','#fff')}>+ Set Opening Stock</button>
      </div>

      {summary && (
        <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16}}>
          <strong>Total Consumption Cost:</strong> ₹{summary.total_consumption_cost}
        </div>
      )}

      {isLoading ? <p>Loading…</p> : (
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
          <thead><tr style={{background:'#f9fafb'}}>
            {['Ingredient','Opening','Received','Closing','Consumed','Actions'].map(h=>(
              <th key={h} style={{padding:'8px 12px',textAlign:'left',borderBottom:'1px solid #e5e7eb',fontWeight:600}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {dailyStocks.map(ds=>(
              <tr key={ds.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                <td style={{padding:'8px 12px',fontWeight:500}}>{ds.ingredient_name} <span style={{color:'#9ca3af',fontSize:11}}>({ds.unit})</span></td>
                <td style={{padding:'8px 12px'}}>{ds.opening_stock}</td>
                <td style={{padding:'8px 12px'}}>{ds.received}</td>
                <td style={{padding:'8px 12px'}}>{ds.closing_stock??'—'}</td>
                <td style={{padding:'8px 12px',color:'#d97706'}}>{ds.consumed??'—'}</td>
                <td style={{padding:'8px 12px'}}>
                  {ds.closing_stock===null && (
                    <button onClick={()=>{const v=prompt('Enter closing stock:');if(v)closingMut.mutate({id:ds.id,closing_stock:v})}}
                      style={btn('#f59e0b','#fff',12)}>Set Closing</button>
                  )}
                </td>
              </tr>
            ))}
            {dailyStocks.length===0 && <tr><td colSpan={6} style={{padding:'16px 12px',color:'#9ca3af',textAlign:'center'}}>No entries for this date. Set opening stock to begin.</td></tr>}
          </tbody>
        </table>
      )}

      {showOpeningModal && <OpeningStockModal onClose={()=>setShowOpeningModal(false)} date={dateFilter} />}
    </div>
  );
}

function OpeningStockModal({onClose, date}: {onClose:()=>void; date:string}) {
  const queryClient = useQueryClient();
  const {data:ingredients=[]} = useQuery<Ingredient[]>({queryKey:['rest-ingredients'],queryFn:()=>api.get('/restaurant/ingredients/').then(r=>r.data)});
  const [form, setForm] = useState({ingredient:'',opening_stock:'',received:'0',notes:'',date});
  const mut = useMutation({
    mutationFn: (d:typeof form) => api.post('/restaurant/daily-stock/',d),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['rest-daily-stock']}); onClose(); },
  });
  const f = (k:keyof typeof form,v:string) => setForm(p=>({...p,[k]:v}));
  return (
    <div style={overlay}>
      <div style={modal(400)}>
        <h3 style={{margin:'0 0 14px'}}>Set Opening Stock</h3>
        <label style={lbl}>Ingredient *</label>
        <select style={inp} value={form.ingredient} onChange={e=>f('ingredient',e.target.value)}>
          <option value="">— select —</option>
          {ingredients.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
        </select>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div>
            <label style={lbl}>Opening Stock *</label>
            <input style={inp} type="number" step="0.001" value={form.opening_stock} onChange={e=>f('opening_stock',e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Received Today</label>
            <input style={inp} type="number" step="0.001" value={form.received} onChange={e=>f('received',e.target.value)} />
          </div>
        </div>
        <label style={lbl}>Notes</label>
        <textarea style={{...inp,height:50}} value={form.notes} onChange={e=>f('notes',e.target.value)} />
        {mut.isError && <p style={{color:'#dc2626'}}>Failed — entry may already exist for this date.</p>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
          <button onClick={onClose} style={btn('#e5e7eb','#374151')}>Cancel</button>
          <button onClick={()=>mut.mutate(form)} disabled={mut.isPending} style={btn('#0f172a','#fff')}>{mut.isPending?'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function btn(bg:string,color:string,fontSize=14): React.CSSProperties {
  return {background:bg,color,border:'none',borderRadius:6,padding:'6px 14px',cursor:'pointer',fontSize};
}
const overlay: React.CSSProperties = {position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50};
function modal(w:number): React.CSSProperties {
  return {background:'#fff',borderRadius:12,padding:24,width:'100%',maxWidth:w,maxHeight:'90vh',overflowY:'auto'};
}
const inp: React.CSSProperties = {display:'block',width:'100%',boxSizing:'border-box',border:'1px solid #d1d5db',borderRadius:6,padding:'7px 10px',marginBottom:12,fontSize:14};
const lbl: React.CSSProperties = {display:'block',fontWeight:600,fontSize:13,marginBottom:4,color:'#374151'};
