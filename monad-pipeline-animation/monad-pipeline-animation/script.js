(() => {
  const svg = document.getElementById('pipeline');
  const layer = document.getElementById('packet-layer');
  const toggle = document.getElementById('motion-toggle');
  const card = document.querySelector('.pipeline-card');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let paused = false;
  let pauseStartedAt = 0;
  let totalPausedTime = 0;

  const packetSpecs = [
    { path: 'input-path-0', type: 'alert', label: 'ALERTS', delay: 0.0, duration: 5.4, width: 66 },
    { path: 'input-path-1', type: 'event', label: 'EVENT', delay: 1.4, duration: 5.0, width: 64 },
    { path: 'input-path-2', type: 'alert', label: '', delay: 2.4, duration: 5.8, width: 30 },
    { path: 'input-path-3', type: 'event', label: 'EVENTS', delay: 0.7, duration: 4.7, width: 68 },
    { path: 'input-path-4', type: 'event', label: 'EVENT', delay: 2.8, duration: 5.1, width: 64 },
    { path: 'input-path-5', type: 'event', label: 'EVENT', delay: 1.8, duration: 5.7, width: 64 },
    { path: 'input-path-6', type: 'event', label: '', delay: 3.5, duration: 5.3, width: 30 },
    { path: 'output-path-0', type: 'safe', label: '', delay: 1.2, duration: 5.6, width: 30 },
    { path: 'output-path-1', type: 'safe', label: 'EVENT', delay: 0.2, duration: 5.4, width: 68 },
    { path: 'output-path-2', type: 'safe', label: '', delay: 2.0, duration: 4.8, width: 30 },
    { path: 'output-path-3', type: 'safe', label: '', delay: 3.2, duration: 5.2, width: 30 },
    { path: 'output-path-4', type: 'safe', label: 'ALERT', delay: 0.9, duration: 5.9, width: 68 },
  ];

  function el(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) {
      node.setAttribute(key, String(value));
    }
    return node;
  }

  function buildPacket(spec) {
    const group = el('g', { class: `packet packet--${spec.type}` });
    const bodyHeight = 26;
    const body = el('rect', {
      class: 'packet__body',
      x: -spec.width / 2,
      y: -bodyHeight / 2,
      width: spec.width,
      height: bodyHeight,
      rx: 13,
    });

    const iconX = spec.label ? -spec.width / 2 + 14 : 0;
    const iconShell = el('circle', {
      class: 'packet__icon-shell',
      cx: iconX,
      cy: 0,
      r: 8.5,
    });

    const use = el('use', {
      class: 'packet__icon',
      href: spec.type === 'alert' ? '#icon-alert' : spec.type === 'safe' ? '#icon-check' : '#icon-diamond',
      x: iconX - 5.2,
      y: -5.2,
      width: 10.4,
      height: 10.4,
    });

    group.append(body, iconShell, use);

    if (spec.label) {
      const text = el('text', {
        class: 'packet__label',
        x: iconX + 13,
        y: 3,
      });
      text.textContent = spec.label;
      group.append(text);
    }

    layer.append(group);
    return {
      ...spec,
      node: group,
      pathNode: document.getElementById(spec.path),
      length: document.getElementById(spec.path).getTotalLength(),
    };
  }

  const packets = packetSpecs.map(buildPacket);

  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function updatePackets(timestamp) {
    const effectiveTime = timestamp - totalPausedTime;

    if (!paused && !reducedMotion.matches) {
      for (const packet of packets) {
        const cycle = packet.duration * 1000;
        const delay = packet.delay * 1000;
        let local = (effectiveTime - delay) % cycle;
        if (local < 0) local += cycle;

        const rawProgress = local / cycle;
        const progress = easeInOutSine(rawProgress);
        const point = packet.pathNode.getPointAtLength(progress * packet.length);

        const fadeIn = Math.min(rawProgress / 0.1, 1);
        const fadeOut = Math.min((1 - rawProgress) / 0.12, 1);
        const opacity = Math.max(0, Math.min(fadeIn, fadeOut));

        packet.node.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
        packet.node.style.opacity = opacity.toFixed(3);
      }
    }

    requestAnimationFrame(updatePackets);
  }

  function setPaused(nextPaused) {
    if (nextPaused === paused) return;
    paused = nextPaused;

    if (paused) {
      pauseStartedAt = performance.now();
      card.classList.add('is-paused');
      toggle.textContent = 'Resume animation';
      toggle.setAttribute('aria-pressed', 'true');
    } else {
      totalPausedTime += performance.now() - pauseStartedAt;
      card.classList.remove('is-paused');
      toggle.textContent = 'Pause animation';
      toggle.setAttribute('aria-pressed', 'false');
    }
  }

  toggle.addEventListener('click', () => setPaused(!paused));

  reducedMotion.addEventListener?.('change', (event) => {
    if (event.matches) {
      packets.forEach((packet, index) => {
        const progress = (index + 1) / (packets.length + 1);
        const point = packet.pathNode.getPointAtLength(progress * packet.length);
        packet.node.setAttribute('transform', `translate(${point.x} ${point.y})`);
        packet.node.style.opacity = '0.92';
      });
      toggle.hidden = true;
    } else {
      toggle.hidden = false;
    }
  });

  if (reducedMotion.matches) {
    packets.forEach((packet, index) => {
      const progress = (index + 1) / (packets.length + 1);
      const point = packet.pathNode.getPointAtLength(progress * packet.length);
      packet.node.setAttribute('transform', `translate(${point.x} ${point.y})`);
      packet.node.style.opacity = '0.92';
    });
    toggle.hidden = true;
  }

  requestAnimationFrame(updatePackets);
})();
