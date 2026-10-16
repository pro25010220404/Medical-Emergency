;(function () {
  function tick() {
    document.getElementById('hx-netmap')?.remove()
    document.querySelector('.dashboard-center .main-map')?.classList.remove('hx-net-well')
  }
  window.addEventListener('hashchange', () => setTimeout(tick, 60))
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick)
  else tick()
})()
