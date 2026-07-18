(function () {
  var root = document.getElementById('nco-root');
  if (!root) return;
  var config = JSON.parse(root.dataset.nco);

  var loadingEl = document.getElementById('nco-loading');
  var cardEl = document.getElementById('nco-card');
  var fallbackEl = document.getElementById('nco-fallback');
  var dateHeader = document.getElementById('nco-date-header');
  var dateSublabel = document.getElementById('nco-date-sublabel');
  var dateEl = document.getElementById('nco-date-display');
  var gridEl = document.getElementById('nco-sessions-grid');
  var fallbackSublabel = document.getElementById('nco-fallback-sublabel');
  var fallbackMessage = document.getElementById('nco-fallback-message');

  var ncoMatcher = /new contributor orientation|\bnco\b/i;
  var JOIN_HOSTS = ['zoom.us', 'meet.google.com'];
  var CAL_HOSTS = ['google.com', 'calendar.google.com'];

  function show(target) {
    [loadingEl, cardEl, fallbackEl].forEach(function (e) {
      e.classList.add('d-none');
      e.classList.remove('d-flex');
    });
    target.classList.remove('d-none');
    if (target === loadingEl) target.classList.add('d-flex');
  }

  function createEl(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function icon(classes) {
    var i = createEl('i', classes);
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  function hostAllowed(hostname, allowed) {
    var host = hostname.toLowerCase();
    for (var i = 0; i < allowed.length; i++) {
      var base = allowed[i];
      if (host === base || host.endsWith('.' + base)) return true;
    }
    return false;
  }

  function safeHttpUrl(raw, allowedHosts) {
    if (!raw || typeof raw !== 'string') return '';
    try {
      var u = new URL(raw);
      if (u.protocol !== 'https:') return '';
      if (allowedHosts && !hostAllowed(u.hostname, allowedHosts)) return '';
      return u.href;
    } catch (e) {
      return '';
    }
  }

  function regionOf(ev) {
    var s = ev.summary || '';
    if (/EMEA|APAC/i.test(s)) return 'emea';
    if (/\bAMER\b/i.test(s)) return 'amer';
    return null;
  }

  function eventStart(ev) {
    return new Date(ev.start.dateTime || ev.start.date);
  }

  function eventEnd(ev) {
    if (ev.end && (ev.end.dateTime || ev.end.date)) {
      return new Date(ev.end.dateTime || ev.end.date);
    }
    return new Date(eventStart(ev).getTime() + 60 * 60 * 1000);
  }

  function utcDayKey(date) {
    return date.getUTCFullYear() + '-' + date.getUTCMonth() + '-' + date.getUTCDate();
  }

  function extractJoinLink(ev) {
    var candidates = [];
    if (ev.location) candidates.push(ev.location);
    if (ev.hangoutLink) candidates.push(ev.hangoutLink);
    if (ev.description) {
      var re = /https:\/\/[^\s"'<>]+/gi;
      var m;
      while ((m = re.exec(ev.description)) !== null) {
        candidates.push(m[0].replace(/[.,);]+$/, ''));
      }
    }
    for (var i = 0; i < candidates.length; i++) {
      var safe = safeHttpUrl(candidates[i], JOIN_HOSTS);
      if (safe) return safe;
    }
    return '';
  }

  function actionBtn(href, ariaLabel, iconClass) {
    var a = createEl('a', 'nco-action-btn');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', ariaLabel);
    a.title = ariaLabel;
    a.appendChild(icon(iconClass));
    return a;
  }

  function appendRow(parent, ev, region, now) {
    var meta = (config.regions && config.regions[region]) || {};
    var label = meta.label || region;
    var iconClass = meta.icon || 'fas fa-globe';
    var shortLabel = meta.short || region;
    var row = createEl('div', 'nco-session-row d-flex align-items-center justify-content-between gap-3');

    if (!ev) {
      row.className += ' nco-session-row--unconfirmed';
      var pending = createEl('div', 'd-flex align-items-center gap-3 flex-grow-1');
      var wrap = createEl('div', 'nco-globe-icon-wrapper');
      wrap.appendChild(icon('fas fa-info-circle'));
      pending.appendChild(wrap);
      var text = createEl('div');
      var line = createEl('div', 'small');
      line.textContent = shortLabel + ' \u2014 not scheduled yet';
      var hint = createEl('div', 'small nco-muted');
      hint.textContent = 'Watch the community calendar';
      text.appendChild(line);
      text.appendChild(hint);
      pending.appendChild(text);
      row.appendChild(pending);
      row.appendChild(actionBtn(config.calLink, 'Check calendar', 'far fa-calendar-alt'));
      parent.appendChild(row);
      return;
    }

    var start = eventStart(ev);
    var end = eventEnd(ev);
    var ended = end <= now;
    var joinLink = ended ? '' : extractJoinLink(ev);
    var calEvLink = safeHttpUrl(ev.htmlLink || '', CAL_HOSTS);

    var timeStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (ev.end) {
      timeStr += ' - ' + end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    } else {
      timeStr += ' ' + start.toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(' ').pop();
    }
    if (ended) {
      timeStr += ' (ended)';
      row.className += ' nco-session-row--unconfirmed';
    }

    var linkOrDiv = calEvLink
      ? createEl('a', 'nco-session-link d-flex align-items-center gap-3')
      : createEl('div', 'd-flex align-items-center gap-3 flex-grow-1');
    if (calEvLink) {
      linkOrDiv.href = calEvLink;
      linkOrDiv.target = '_blank';
      linkOrDiv.rel = 'noopener';
    }
    var globe = createEl('div', 'nco-globe-icon-wrapper');
    globe.appendChild(icon(iconClass));
    linkOrDiv.appendChild(globe);
    var details = createEl('div');
    var title = createEl('div', 'nco-session-title-text fw-bold');
    title.textContent = label;
    var time = createEl('div', 'nco-session-time-text small');
    time.textContent = timeStr;
    details.appendChild(title);
    details.appendChild(time);
    linkOrDiv.appendChild(details);
    row.appendChild(linkOrDiv);

    var actions = createEl('div', 'd-flex align-items-center gap-2');
    if (joinLink) {
      actions.appendChild(actionBtn(joinLink, 'Join Meeting', 'fas fa-video'));
    }
    if (calEvLink) {
      actions.appendChild(actionBtn(calEvLink, 'Add to Calendar', 'far fa-calendar-plus'));
    } else {
      actions.appendChild(actionBtn(config.calLink, 'Check calendar', 'far fa-calendar-alt'));
    }
    row.appendChild(actions);
    parent.appendChild(row);
  }

  function runFallback(reason) {
    if (reason === 'error') {
      if (fallbackSublabel) fallbackSublabel.textContent = 'Typical schedule (calendar unavailable)';
      if (fallbackMessage) {
        fallbackMessage.textContent = 'Live session data could not be loaded right now. Typical timing is shown below — check the community calendar and mailing list for confirmed sessions.';
      }
    } else {
      if (fallbackSublabel) fallbackSublabel.textContent = 'Typical schedule (unconfirmed)';
      if (fallbackMessage) {
        fallbackMessage.textContent = 'No upcoming sessions found on the community calendar yet. Exact timing depends on available leads — check the calendar and mailing list.';
      }
    }
    show(fallbackEl);
  }

  if (!config.apiKey) {
    runFallback('error');
    return;
  }

  show(loadingEl);

  var now = new Date();
  var timeMin = new Date(now.getTime() - 86400000).toISOString();
  var url = 'https://www.googleapis.com/calendar/v3/calendars/'
    + encodeURIComponent(config.calendarId)
    + '/events?key=' + encodeURIComponent(config.apiKey)
    + '&timeMin=' + encodeURIComponent(timeMin)
    + '&q=' + encodeURIComponent(config.searchQuery)
    + '&orderBy=startTime&singleEvents=true&maxResults=20';

  fetch(url)
    .then(function (r) {
      return r.json().then(function (data) {
        return { ok: r.ok, data: data };
      });
    })
    .then(function (res) {
      if (!res.ok || (res.data && res.data.error)) {
        runFallback('error');
        return;
      }

      var items = res.data.items;
      if (!items || !items.length) {
        runFallback('empty');
        return;
      }

      var events = items.filter(function (e) {
        return e.summary && ncoMatcher.test(e.summary);
      });

      if (!events.length) {
        runFallback('empty');
        return;
      }

      events.sort(function (a, b) {
        return eventStart(a) - eventStart(b);
      });

      var now = new Date();
      var anchor = null;
      for (var i = 0; i < events.length; i++) {
        if (eventEnd(events[i]) > now) {
          anchor = events[i];
          break;
        }
      }

      if (!anchor) {
        runFallback('empty');
        return;
      }

      var dayKey = utcDayKey(eventStart(anchor));
      var byRegion = { emea: null, amer: null };
      for (var j = 0; j < events.length; j++) {
        var ev = events[j];
        if (utcDayKey(eventStart(ev)) !== dayKey) continue;
        var region = regionOf(ev);
        if (region && !byRegion[region]) byRegion[region] = ev;
      }

      if (!byRegion.emea && !byRegion.amer) {
        runFallback('empty');
        return;
      }

      if (dateHeader) dateHeader.style.display = '';
      if (dateSublabel) dateSublabel.textContent = 'Next Session Date';
      dateEl.textContent = eventStart(anchor).toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      while (gridEl.firstChild) gridEl.removeChild(gridEl.firstChild);
      appendRow(gridEl, byRegion.emea, 'emea', now);
      appendRow(gridEl, byRegion.amer, 'amer', now);
      show(cardEl);
    })
    .catch(function () { runFallback('error'); });
})();
