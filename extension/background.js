chrome.action.onClicked.addListener(tab => {
  if(!tab.id)return;
  chrome.tabs.create({url:chrome.runtime.getURL(`collector.html?tab=${tab.id}`)}).catch(console.error);
});
