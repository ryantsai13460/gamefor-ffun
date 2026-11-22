const repository = 'https://github.com/ryantsai13460/gamefor-ffun';
const discordStorageKey = 'ffun-community-discord-v1';
const discordAPI = 'https://discord.com/api';
const discordReport = 'https://support.discord.com/hc/en-us/articles/22582288274071-Reporting-Abusive-Behavior-to-Discord';
const discordServerHelp = 'https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID';

const topics = [
  {
    title: 'Build a better streak',
    prompt: 'Which timing cue helps you keep a streak in Lantern Shift?',
    game: 'Lantern Shift', id: 'lantern-shift', reason: 'A quick rhythm challenge with keyboard and touch controls.'
  },
  {
    title: 'Compare puzzle routes',
    prompt: 'Can you collect every clover in the first Clover Roll board with fewer stops?',
    game: 'Clover Roll', id: 'clover-roll', reason: 'A tilt puzzle with undo, so you can try a different route.'
  },
  {
    title: 'Talk about game design',
    prompt: 'How would you teach the first Clock Courier clue without using a written instruction?',
    game: 'Clock Courier', id: 'clock-courier', reason: 'A clock puzzle that gives immediate feedback on your choices.'
  }
];

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

function action(label, handler, className = 'button') {
  const item = element('button', className, label);
  item.type = 'button';
  item.addEventListener('click', handler);
  return item;
}

function link(label, href, className = 'text-action') {
  const item = element('a', className, label);
  item.href = href;
  if (href.startsWith('https://')) {
    item.target = '_blank';
    item.rel = 'noopener noreferrer';
  }
  return item;
}

function panel(title, className = '') {
  const item = element('section', `community-panel ${className}`.trim());
  item.append(element('h2', '', title));
  return item;
}

export function discordServerId(value) {
  if (typeof value !== 'string') return '';
  const id = value.trim();
  return /^[1-9]\d{16,19}$/.test(id) && BigInt(id) <= 18446744073709551615n ? id : '';
}

export function discordInviteCode(value) {
  if (typeof value !== 'string' || value.length > 160) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return '';
    if (url.hostname === 'discord.gg') return /^\/([A-Za-z0-9_-]{2,64})\/?$/.exec(url.pathname)?.[1] || '';
    if (url.hostname === 'discord.com') return /^\/invite\/([A-Za-z0-9_-]{2,64})\/?$/.exec(url.pathname)?.[1] || '';
  } catch {}
  return '';
}

function readDiscordSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(discordStorageKey));
    const id = discordServerId(saved?.id);
    if (id) return { id, code: typeof saved.code === 'string' && /^[A-Za-z0-9_-]{2,64}$/.test(saved.code) ? saved.code : '' };
  } catch {}
  return null;
}

function inviteUrl(code) {
  return `https://discord.com/invite/${code}`;
}

function updateCard(title, description, url) {
  const row = element('article', 'community-update');
  row.append(element('h3', '', title), element('p', '', description), link('Read update on GitHub', url));
  return row;
}

function projectUpdates() {
  const section = panel('Project updates');
  section.append(
    updateCard('Gamffun 5.0', 'This release expanded the game, film and music libraries and improved Blip and Proxy Gemini.', `${repository}/pull/12`),
    updateCard('Arcade discovery and watch queue', 'This release added quick play, YouTube queue controls and more ways to discover library titles.', `${repository}/pull/11`)
  );
  const links = element('div', 'community-actions');
  links.append(link('Browse source', repository, 'button'), link('Development history', `${repository}/commits/main/`, 'button'));
  section.append(links);
  return section;
}

function gamesAndDiscussions() {
  const section = panel('Gaming discussions');
  section.append(element('p', 'community-muted', 'Try a game and take a prompt to a conversation you already use.'));
  const list = element('div', 'community-topics');
  for (const { title, prompt, game, id, reason } of topics) {
    const item = element('article', 'community-topic');
    const recommendation = element('p', 'community-recommendation', reason);
    const copyStatus = element('p', 'community-status');
    copyStatus.setAttribute('role', 'status');
    const controls = element('div', 'community-actions');
    const copy = action('Copy prompt', async () => {
      try {
        await navigator.clipboard.writeText(prompt);
        copyStatus.textContent = 'Prompt copied.';
      } catch {
        copyStatus.textContent = 'Clipboard access is unavailable. You can select and copy the question above.';
      }
    });
    copy.setAttribute('aria-label', `Copy prompt for ${game}`);
    controls.append(link(`Play ${game}`, `#play/${id}?start=1`, 'button'), copy);
    item.append(element('h3', '', title), element('p', 'community-prompt', prompt), recommendation, controls, copyStatus);
    list.append(item);
  }
  section.append(list, link('View all games', '#games', 'text-action'));
  return section;
}

function guidelines() {
  const section = panel('Guidelines and reporting');
  const list = element('ul', 'community-rules');
  for (const guideline of [
    'Keep discussion welcoming. Critique ideas and gameplay without attacking people.',
    'Share age-appropriate content and use sources you have permission to share.',
    'Keep personal details and private messages out of public posts.'
  ]) list.append(element('li', '', guideline));
  const reports = element('div', 'community-reports');
  const site = element('article', 'community-report');
  site.append(element('h3', '', 'Report a site issue'),
    element('p', '', 'Use GitHub Issues for a broken link, player problem or correction to the catalog. Issues are public. Include the page and steps without personal details.'),
    link('Open Gamefor Ffun Issues', `${repository}/issues`));
  const discord = element('article', 'community-report');
  discord.append(element('h3', '', 'Report Discord behavior'),
    element('p', '', 'Use Discord’s reporting controls for a message or profile. Contact that server’s moderators for its own rules.'),
    link('Discord reporting guide', discordReport));
  reports.append(site, discord);
  section.append(list, reports);
  return section;
}

function discordPanel() {
  const section = panel('Discord', 'community-discord');
  const summary = element('p', 'community-muted');
  const preview = element('div', 'community-discord-preview');
  const inviteResult = element('div', 'community-discord-invite');
  const settings = element('details', 'community-discord-settings');
  settings.append(element('summary', '', 'Configure a Discord server'));
  const form = element('form', 'community-discord-form');
  form.noValidate = true;
  const serverId = element('input', 'field');
  serverId.type = 'text';
  serverId.inputMode = 'numeric';
  serverId.autocomplete = 'off';
  serverId.maxLength = 20;
  serverId.required = true;
  serverId.setAttribute('aria-describedby', 'community-discord-fields');
  const invite = element('input', 'field');
  invite.type = 'url';
  invite.autocomplete = 'off';
  invite.maxLength = 160;
  invite.placeholder = 'https://discord.gg/…';
  invite.setAttribute('aria-describedby', 'community-discord-fields');
  const idLabel = element('label', 'community-field', 'Server ID');
  const inviteLabel = element('label', 'community-field', 'Public invite URL (optional)');
  idLabel.append(serverId);
  inviteLabel.append(invite);
  const fieldHelp = element('p', 'community-muted', 'Use a server and public invite that its administrator has authorized. These settings are saved in this browser.');
  fieldHelp.id = 'community-discord-fields';
  const fieldActions = element('div', 'community-actions');
  const save = element('button', 'button primary', 'Save on this device');
  save.type = 'submit';
  const clear = action('Clear settings', clearSettings);
  fieldActions.append(save, clear);
  const editStatus = element('p', 'community-status');
  editStatus.setAttribute('role', 'status');
  form.append(idLabel, inviteLabel, fieldHelp, fieldActions, editStatus, link('Find a Discord server ID', discordServerHelp));
  settings.append(form);

  const connected = element('div', 'community-discord-connected');
  const connectionHelp = element('p', 'community-muted',
    'Discord receives a request when you load its public status widget or check an invite. This page shows no member profiles or messages.');
  const load = action('Load server widget', loadWidget, 'button primary');
  const verify = action('Check public invite', verifyInvite);
  const controls = element('div', 'community-actions');
  const widgetStatus = element('p', 'community-status');
  const inviteStatus = element('p', 'community-status');
  const serverLink = link('Open server in Discord', 'https://discord.com/');
  widgetStatus.setAttribute('role', 'status');
  inviteStatus.setAttribute('role', 'status');
  controls.append(load, verify);
  connected.append(connectionHelp, controls, preview, widgetStatus, inviteResult, inviteStatus, serverLink);
  section.append(summary, settings, connected);

  let saved = readDiscordSettings();
  let releaseWidget;
  let inviteRequest;
  displaySettings();

  function displaySettings() {
    serverId.value = saved?.id || '';
    invite.value = saved?.code ? inviteUrl(saved.code) : '';
    serverId.removeAttribute('aria-invalid');
    invite.removeAttribute('aria-invalid');
    summary.textContent = saved ? 'A Discord server is configured on this device.' : 'Connect a Discord server when an administrator provides its public details.';
    connected.hidden = !saved;
    verify.hidden = !saved?.code;
    clear.hidden = !saved;
    if (saved) serverLink.href = `https://discord.com/channels/${saved.id}`;
    else serverLink.removeAttribute('href');
  }

  function stopRequests() {
    releaseWidget?.();
    releaseWidget = undefined;
    inviteRequest?.abort();
    inviteRequest = undefined;
    preview.replaceChildren();
    inviteResult.replaceChildren();
    widgetStatus.textContent = '';
    inviteStatus.textContent = '';
    load.disabled = false;
    verify.disabled = false;
    load.textContent = 'Load server widget';
  }

  function clearSettings() {
    try { localStorage.removeItem(discordStorageKey); }
    catch {
      editStatus.textContent = 'Settings could not be removed from browser storage.';
      return;
    }
    stopRequests();
    saved = null;
    displaySettings();
    editStatus.textContent = 'Discord settings cleared.';
    serverId.focus();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    serverId.removeAttribute('aria-invalid');
    invite.removeAttribute('aria-invalid');
    const id = discordServerId(serverId.value);
    const code = discordInviteCode(invite.value);
    if (!id || (invite.value.trim() && !code)) {
      const input = id ? invite : serverId;
      input.setAttribute('aria-invalid', 'true');
      editStatus.textContent = id
        ? 'Enter a public invite from discord.gg or discord.com/invite.'
        : 'Enter a valid Discord server ID.';
      input.focus();
      return;
    }
    const next = { id, code };
    try { localStorage.setItem(discordStorageKey, JSON.stringify(next)); }
    catch {
      editStatus.textContent = 'Settings could not be saved in this browser.';
      return;
    }
    stopRequests();
    saved = next;
    displaySettings();
    editStatus.textContent = 'Discord settings saved on this device.';
  });

  function loadWidget() {
    if (!saved || load.disabled) return;
    releaseWidget?.();
    load.disabled = true;
    widgetStatus.textContent = 'Loading the Discord widget…';
    const image = element('img', 'community-discord-image');
    image.alt = 'Discord server status and number of people online';
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.hidden = true;
    const timer = setTimeout(fail, 10000);
    function dispose() {
      clearTimeout(timer);
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', fail);
    }
    function loaded() {
      dispose();
      image.hidden = false;
      widgetStatus.textContent = 'Discord’s public widget is loaded.';
      load.textContent = 'Reload server widget';
      load.disabled = false;
    }
    function fail() {
      dispose();
      image.remove();
      load.disabled = false;
      widgetStatus.textContent = 'The widget is unavailable. Ask the server administrator to enable it, or check the invite to open Discord.';
    }
    releaseWidget = () => {
      dispose();
      image.remove();
    };
    image.addEventListener('load', loaded);
    image.addEventListener('error', fail);
    preview.replaceChildren(image);
    image.src = `${discordAPI}/guilds/${saved.id}/widget.png?style=banner2`;
  }

  async function verifyInvite() {
    if (!saved?.code || verify.disabled) return;
    const { id, code } = saved;
    const controller = new AbortController();
    inviteRequest = controller;
    verify.disabled = true;
    inviteResult.replaceChildren();
    inviteStatus.textContent = 'Checking the public invite with Discord…';
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${discordAPI}/v10/invites/${code}`, {
        signal: controller.signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store'
      });
      if (inviteRequest !== controller) return;
      if (!response.ok) {
        inviteStatus.textContent = response.status === 404
          ? 'This invite has expired or Discord could not find it. Ask an administrator for a new link.'
          : 'Discord could not check this invite. Try again later.';
        return;
      }
      const result = await response.json();
      if (inviteRequest !== controller) return;
      if (result.type !== 0 || result.guild?.id !== id || result.code !== code) {
        inviteStatus.textContent = 'This invite does not match the configured Discord server.';
        return;
      }
      if (result.guild.nsfw || [1, 3].includes(result.guild.nsfw_level) || result.channel?.nsfw === true) {
        inviteStatus.textContent = 'Discord marks this server or invite channel as age-restricted.';
        return;
      }
      if (result.expires_at && Date.parse(result.expires_at) <= Date.now()) {
        inviteStatus.textContent = 'This invite has expired. Ask an administrator for a new link.';
        return;
      }
      const name = typeof result.guild.name === 'string' && result.guild.name.trim() ? result.guild.name.trim().slice(0, 100) : 'the configured server';
      inviteResult.append(link('Open Discord invite', inviteUrl(code), 'button primary'));
      inviteStatus.textContent = `Discord verified the invite for ${name}. Review the invitation in Discord before joining.`;
    } catch {
      if (inviteRequest === controller) inviteStatus.textContent = 'Discord could not check this invite. Try again later.';
    } finally {
      clearTimeout(timer);
      if (inviteRequest === controller) {
        inviteRequest = undefined;
        verify.disabled = false;
      }
    }
  }

  return { section, dispose: stopRequests, configure() {
    settings.open = true;
    serverId.focus();
  } };
}

export function renderCommunity(target) {
  const root = element('div', 'community-page');
  const header = element('header', 'community-header');
  const discord = discordPanel();
  const actions = element('div', 'community-actions');
  actions.append(action('Discord settings', discord.configure));
  header.append(element('h1', '', 'Community'),
    element('p', '', 'Find games to try, follow project updates, and connect through an authorized Discord server.'), actions);
  const content = element('div', 'community-main');
  content.append(gamesAndDiscussions(), projectUpdates());
  const aside = element('div', 'community-side');
  aside.append(discord.section, guidelines());
  const layout = element('div', 'community-layout');
  layout.append(content, aside);
  root.append(header, layout);
  target.replaceChildren(root);
  return discord.dispose;
}
