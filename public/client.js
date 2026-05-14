(function () {
  if (typeof EventSource !== 'undefined') {
    let es;
    function connect() {
      es = new EventSource('/events');
      es.addEventListener('reload', () => window.location.reload());
      es.onerror = () => {
        es.close();
        setTimeout(connect, 1500);
      };
    }
    connect();
  }

  function persistFolderState() {
    const tree = document.querySelector('.tree');
    if (!tree) return;
    const KEY = 'markserv-diff:folders-open';
    let openSet;
    try {
      openSet = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
    } catch {
      openSet = new Set();
    }

    tree.querySelectorAll('details.folder').forEach((d) => {
      const p = d.dataset.path;
      if (!p) return;
      if (openSet.has(p) && !d.open) d.open = true;
    });

    tree.querySelectorAll('details.folder').forEach((d) => {
      d.addEventListener('toggle', () => {
        const p = d.dataset.path;
        if (!p) return;
        if (d.open) openSet.add(p);
        else openSet.delete(p);
        try {
          localStorage.setItem(KEY, JSON.stringify([...openSet]));
        } catch {
          /* ignore quota errors */
        }
      });
    });
  }

  function buildMinimap() {
    const minimap = document.getElementById('minimap');
    if (!minimap) return;

    const selectors = [
      { sel: '.block-added', cls: 'mark-add', label: 'Added block' },
      { sel: '.block-removed', cls: 'mark-del', label: 'Removed block' },
      { sel: '.block-modified', cls: 'mark-mod', label: 'Modified block' },
      { sel: 'tr.row-added', cls: 'mark-add', label: 'Added row' },
      { sel: 'tr.row-removed', cls: 'mark-del', label: 'Removed row' },
    ];

    function place() {
      minimap.innerHTML = '';
      const docHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;

      for (const { sel, cls, label } of selectors) {
        document.querySelectorAll(sel).forEach((el) => {
          if (cls === 'mark-mod' && (el.classList.contains('block-table-modified') || el.closest('.block-table-modified'))) return;
          const rect = el.getBoundingClientRect();
          const top = rect.top + window.scrollY;
          const height = Math.max(rect.height, 3);
          const mark = document.createElement('div');
          mark.className = 'minimap-mark ' + cls;
          mark.style.top = (top / docHeight) * 100 + '%';
          mark.style.height = Math.max((height / docHeight) * 100, 0.3) + '%';
          mark.title = label + ': ' + (el.textContent || '').trim().slice(0, 60);
          mark.addEventListener('click', (e) => {
            e.stopPropagation();
            window.scrollTo({ top: top - 80, behavior: 'smooth' });
          });
          minimap.appendChild(mark);
        });
      }

      const viewport = document.createElement('div');
      viewport.id = 'minimap-viewport';
      minimap.appendChild(viewport);

      function updateViewport() {
        const h = document.documentElement.scrollHeight;
        viewport.style.top = (window.scrollY / h) * 100 + '%';
        viewport.style.height = (window.innerHeight / h) * 100 + '%';
      }
      window.addEventListener('scroll', updateViewport, { passive: true });
      window.addEventListener('resize', updateViewport);
      updateViewport();

      minimap.addEventListener('click', (e) => {
        if (e.target !== minimap) return;
        const rect = minimap.getBoundingClientRect();
        const pct = (e.clientY - rect.top) / rect.height;
        const targetTop = pct * document.documentElement.scrollHeight - window.innerHeight / 2;
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      });
    }

    if (document.readyState === 'complete') {
      place();
    } else {
      window.addEventListener('load', place);
    }
  }

  persistFolderState();
  buildMinimap();
})();
