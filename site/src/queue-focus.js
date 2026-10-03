// SPDX-License-Identifier: MIT
// Preserve only the queue action removed by this synchronous render. Never
// schedule a later focus change that could override the user's next action.
export function preserveQueueFocus(list){
 const document=list.ownerDocument,active=document.activeElement;
 if(!list.contains(active))return()=>{};
 const action=['.preview-button','a.download','.remove'].find(selector=>active.matches(selector));
 const fileId=active.closest('.file-row')?.dataset.id;
 if(!action||!fileId)return()=>{};
 return()=>{
  if(active.isConnected||(document.activeElement!==document.body&&document.activeElement!==active))return;
  const row=Array.from(list.querySelectorAll('.file-row')).find(row=>row.dataset.id===fileId);
  const control=row?.querySelector(action);
  if(!control||control.disabled||control.closest('[hidden],[inert]')||!control.getClientRects().length)return;
  control.focus({preventScroll:true});
 };
}
