(function () {
  if (typeof EventSource === 'undefined') return;

  function connect() {
    const es = new EventSource('/events');
    es.addEventListener('reload', () => {
      window.location.reload();
    });
    es.onerror = () => {
      es.close();
      setTimeout(connect, 1500);
    };
  }

  connect();
})();
