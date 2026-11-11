const banner=document.getElementById('game-announcement');
if(banner){
  const key='synergy.exe/announcement-dismissed';
  try{banner.hidden=sessionStorage.getItem(key)==='1';}catch{/* The close button still works without storage. */}
  banner.querySelector('button').addEventListener('click',()=>{
    banner.hidden=true;
    try{sessionStorage.setItem(key,'1');}catch{/* Private browsing may block storage. */}
  });
}
