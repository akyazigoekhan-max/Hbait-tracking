const content = document.getElementById('content');
const tabs = ['habits','calendar','stats','timer','routines'];

function showTab(tab) {
  tabs.forEach(t => document.getElementById('tab-'+t).classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');

  if (tab === 'habits') {
    content.innerHTML = '<h2>Habits</h2><p>Hier kannst du deine Gewohnheiten verwalten.</p>';
  } else if (tab === 'calendar') {
    content.innerHTML = '<h2>Kalender</h2><p>Monats- und Tagesübersicht deiner Habits.</p>';
  } else if (tab === 'stats') {
    content.innerHTML = '<h2>Statistik</h2><p>Deine Fortschritte in Diagrammen.</p>';
  } else if (tab === 'timer') {
    content.innerHTML = '<h2>Timer</h2><p>Fokus-Timer mit Pausenoption.</p>';
  } else if (tab === 'routines') {
    content.innerHTML = '<h2>Routinen</h2><p>Plane Routinen und füge sie in den Kalender ein.</p>';
  }
}
