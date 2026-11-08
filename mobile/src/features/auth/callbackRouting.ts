export function redirectAuthCallback(path:string,initial:boolean){
  try{const url=new URL(path);if(url.protocol==='visual-travel-guide:'&&url.host==='auth'&&url.pathname==='/callback')return initial?'/auth/callback':null;}catch{/* Ordinary relative app paths retain Router handling. */}
  return path;
}
