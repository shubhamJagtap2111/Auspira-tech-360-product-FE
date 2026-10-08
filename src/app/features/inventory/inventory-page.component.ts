import { AcKpiCardComponent } from '../../shared/ui/kpi-card/kpi-card.component';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { BranchContextService } from '../../core/context/branch-context.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import { AcAdminDrawerComponent } from '../../shared/ui/admin-drawer/admin-drawer.component';
import { InventoryService, emptyWorkspace, StoreItem, Vendor, Asset, PurchaseOrder } from './inventory.service';

type Tab = 'overview'|'items'|'orders'|'assets'|'vendors'|'ledger';
type Editor = 'item'|'vendor'|'asset'|'order'|'receive'|'movement'|null;
@Component({
  standalone:true, imports:[AcKpiCardComponent,CommonModule,FormsModule,RouterLink,AcAdminDrawerComponent],
  templateUrl:'./inventory-page.component.html', styleUrl:'./inventory-page.component.css', changeDetection:ChangeDetectionStrategy.OnPush
})
export class InventoryPageComponent implements OnInit {
  private readonly api=inject(InventoryService);
  private readonly auth=inject(AuthStore);
  readonly branch=inject(BranchContextService);
  private readonly toast=inject(ToastService);
  private readonly dialog=inject(DialogService);
  readonly data=signal(emptyWorkspace()); readonly loading=signal(false); readonly busy=signal(false); readonly error=signal('');
  readonly tab=signal<Tab>('overview'); readonly editor=signal<Editor>(null); readonly search=signal(''); readonly state=signal('');
  readonly tabs:{key:Tab;name:string;icon:string}[]=[{key:'overview',name:'Overview',icon:'space_dashboard'},{key:'items',name:'Items & stock',icon:'inventory_2'},{key:'orders',name:'Purchase orders',icon:'shopping_cart'},{key:'assets',name:'Equipment & assets',icon:'medical_services'},{key:'vendors',name:'Vendors',icon:'local_shipping'},{key:'ledger',name:'Stock ledger',icon:'history'}];
  readonly canWrite=computed(()=>!!this.branch.selectedBranchCode() && !['ALL','NONE'].includes(this.branch.selectedBranchCode()!));
  can(action:'Create'|'Edit') { return this.auth.hasPermission(`Inventory.${action}`); }
  canView(module:'Pharmacy'|'Reports') { return this.auth.hasPermission(`${module}.View`); }
  readonly lowStock=computed(()=>this.data().items.filter(i=>i.active && i.onHand<=i.reorderLevel));
  readonly stockValue=computed(()=>this.data().items.reduce((n,i)=>n+i.onHand*i.unitCost,0));
  readonly openOrders=computed(()=>this.data().orders.filter(o=>['DRAFT','ORDERED','PARTIALLY_RECEIVED'].includes(o.status)));
  readonly maintenance=computed(()=>this.data().assets.filter(a=>a.status==='MAINTENANCE'||(a.status!=='RETIRED'&&!!a.maintenanceDue&&a.maintenanceDue<=this.today)));
  readonly items=computed(()=>this.data().items.filter(i=>this.matches(i.name,i.category,i.branch)&&(!this.state()||(this.state()==='LOW'?i.active&&i.onHand<=i.reorderLevel:this.state()==='ACTIVE'?i.active:!i.active))));
  readonly orders=computed(()=>this.data().orders.filter(o=>this.matches(o.number,o.vendor,o.branch)&&(!this.state()||o.status===this.state())));
  readonly assets=computed(()=>this.data().assets.filter(a=>this.matches(a.name,a.number,a.location,a.branch)&&(!this.state()||a.status===this.state())));
  readonly vendors=computed(()=>this.data().vendors.filter(v=>this.matches(v.name,v.phone,v.gstin,v.branch)&&(!this.state()||(this.state()==='ACTIVE'?v.active:!v.active))));
  readonly movements=computed(()=>this.data().movements.filter(m=>this.matches(m.item,m.reference,m.department??'',m.patientMrn??'',m.branch)&&(!this.state()||m.type===this.state())));
  readonly activeItems=computed(()=>this.data().items.filter(i=>i.active)); readonly activeVendors=computed(()=>this.data().vendors.filter(v=>v.active));
  readonly categories=[{value:'CONSUMABLE',label:'Clinical consumables'},{value:'EQUIPMENT',label:'Medical equipment'},{value:'LAB_SUPPLY',label:'Laboratory supplies'},{value:'GENERAL',label:'General supplies'}];
  readonly assetStatuses=['IN_SERVICE','MAINTENANCE','OUT_OF_SERVICE','RETIRED'];
  readonly today=new Date().toLocaleDateString('en-CA');
  editId:string|null=null; selectedOrder:PurchaseOrder|null=null; formError='';
  item={name:'',category:'CONSUMABLE',unit:'Each',reorderLevel:0,unitCost:0,active:true};
  vendor={name:'',phone:'',email:'',address:'',gstin:'',active:true};
  asset={number:'',name:'',category:'EQUIPMENT',status:'IN_SERVICE',location:'',serial:'',maintenanceDue:'',notes:''};
  order={vendorId:'',notes:'',lines:[{itemId:'',quantity:1,rate:0}]};
  receipt:{lineId:string;name:string;unit:string;outstanding:number;quantity:number}[]=[]; receiptNotes='';
  movement={itemId:'',type:'ISSUE',quantity:1,reference:'',adjustmentDirection:'DECREASE',departmentId:'',notes:''};
  requestId='';
  ngOnInit() { void this.load(); }
  async load() {
    if(this.loading())return; this.loading.set(true); this.error.set('');
    try {this.data.set(await this.api.workspace());} catch(e) {this.error.set(this.message(e));} finally {this.loading.set(false);}
  }
  private matches(...values:string[]) {const q=this.search().trim().toLowerCase();return !q||values.some(v=>v.toLowerCase().includes(q));}
  choose(t:Tab) {this.tab.set(t);this.search.set('');this.state.set('');}
  label(value:string) {return value.toLowerCase().replaceAll('_',' ').replace(/^\w/,c=>c.toUpperCase());}
  category(value:string) {return this.categories.find(c=>c.value===value)?.label??this.label(value);}
  open(kind:Editor, row?:StoreItem|Vendor|Asset|PurchaseOrder) {
    if(!this.canWrite()||this.busy())return;
    this.formError='';this.editId=row?.id??null;this.requestId=crypto.randomUUID();this.selectedOrder=null;
    if(kind==='item')this.item=row?{...row as StoreItem}:{name:'',category:'CONSUMABLE',unit:'Each',reorderLevel:0,unitCost:0,active:true};
    if(kind==='vendor')this.vendor=row?{...row as Vendor}:{name:'',phone:'',email:'',address:'',gstin:'',active:true};
    if(kind==='asset'){const a=row as Asset|undefined;this.asset=a?{...a,maintenanceDue:a.maintenanceDue??''}:{number:'',name:'',category:'EQUIPMENT',status:'IN_SERVICE',location:'',serial:'',maintenanceDue:'',notes:''};}
    if(kind==='order') {
      if(row && 'lines' in row)this.order={vendorId:row.vendorId,notes:row.notes,lines:row.lines.map(l=>({itemId:l.itemId,quantity:l.quantity,rate:l.rate}))};
      else {this.editId=null;this.order={vendorId:'',notes:'',lines:[{itemId:row?.id??'',quantity:1,rate:(row as StoreItem)?.unitCost??0}]};}
    }
    if(kind==='movement')this.movement={itemId:row?.id??'',type:'ISSUE',quantity:1,reference:'',adjustmentDirection:'DECREASE',departmentId:'',notes:''};
    if(kind==='receive'){this.selectedOrder=row as PurchaseOrder;this.receipt=this.selectedOrder.lines.filter(l=>l.received<l.quantity).map(l=>({lineId:l.id,name:l.name,unit:l.unit,outstanding:l.quantity-l.received,quantity:l.quantity-l.received}));this.receiptNotes='';}
    this.editor.set(kind);
  }
  close() {if(!this.busy())this.editor.set(null);}
  get editorTitle() {return ({item:this.editId?'Edit stock item':'New stock item',vendor:this.editId?'Edit vendor':'New vendor',asset:this.editId?'Edit equipment / asset':'Register equipment / asset',order:'New purchase order',receive:'Receive purchase order',movement:'Record stock movement'} as Record<string,string>)[this.editor()??'']??'';}
  get orderTotal() {return this.order.lines.reduce((n,l)=>n+Number(l.quantity)*Number(l.rate),0);}
  get selectedStock() {return this.data().items.find(i=>i.id===this.movement.itemId);}
  itemChanged(index:number) {this.order.lines[index].rate=this.data().items.find(i=>i.id===this.order.lines[index].itemId)?.unitCost??0;}
  addLine() {if(this.order.lines.length<100)this.order.lines.push({itemId:'',quantity:1,rate:0});}
  removeLine(index:number) {this.order.lines.splice(index,1);}
  async save() {
    if(this.busy()||!this.canWrite())return;this.formError='';this.busy.set(true);
    try {
      const kind=this.editor();
      if(kind==='item')await this.api.save('items',this.editId,this.item);
      if(kind==='vendor')await this.api.save('vendors',this.editId,this.vendor);
      if(kind==='asset')await this.api.save('assets',this.editId,this.asset);
      if(kind==='order')this.editId?await this.api.editOrder(this.editId,this.order):await this.api.command('purchase-orders',{...this.order,requestId:this.requestId});
      if(kind==='movement')await this.api.command('stock-movements',{...this.movement,requestId:this.requestId,departmentId:this.movement.departmentId||null});
      if(kind==='receive'){
        const lines=this.receipt.filter(l=>l.quantity>0).map(l=>({lineId:l.lineId,quantity:l.quantity}));
        if(!lines.length)throw {message:'Enter at least one received quantity.'};
        await this.api.command(`purchase-orders/${this.selectedOrder!.id}/receive`,{requestId:this.requestId,lines,notes:this.receiptNotes});
      }
      this.editor.set(null);this.toast.success(kind==='receive'?'Stock received':kind==='movement'?'Stock movement recorded':'Inventory record saved');await this.load();
    } catch(e) {this.formError=this.message(e);} finally {this.busy.set(false);}
  }
  async changeStatus(o:PurchaseOrder,status:'ORDERED'|'CANCELLED') {
    if(this.busy()||!this.canWrite())return;
    const answer=await this.dialog.confirm({title:status==='ORDERED'?'Approve purchase order?':'Cancel purchase order?',message:`${o.number} · ${o.vendor}. ${status==='ORDERED'?'Approved orders are ready for receiving.':'This order will be closed without receiving stock.'}`,confirmText:status==='ORDERED'?'Approve order':'Cancel order',cancelText:'Keep editing'});
    if(!answer)return;this.busy.set(true);
    try {await this.api.command(`purchase-orders/${o.id}/status`,{status});this.toast.success(status==='ORDERED'?'Purchase order approved':'Purchase order cancelled');await this.load();}catch(e){this.toast.error('Unable to update order',this.message(e));}finally{this.busy.set(false);}
  }
  private message(e:unknown):string {const r=e as {message?:string;error?:{message?:string;errors?:{message?:string}[]}};return r.error?.message??r.message??'Unable to load inventory. Please try again.';}
}
