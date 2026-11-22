# Gamefor Ffun Cloud Browser

Cloud Browser opens a fresh Chromium session on a separate Linux backend and streams its display to Gamefor Ffun. Open it from Proxy Gemini or go directly to `#cloud-browser`. The in-page viewer at `#browse` continues to serve built-in games, approved embeds, and its existing search and media tools.

GitHub Pages serves the arcade’s static HTML, CSS, and JavaScript. The browser backend needs a running Linux process that can launch Chromium, keep a WebSocket open, and send frames while a session is active. Run it separately on a machine you administer or an approved VM. [GitHub Pages hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## Run locally

Start the arcade from the repository root.

```sh
npm run dev
```

In a second terminal, install the backend dependencies and run the service. Use Node.js 22 or later, a patched Chromium, and a Linux account with Chromium sandbox support. The system dependency installer may require administrative access. If the host already has a compatible Chromium, set `CLOUD_CHROMIUM_PATH` to its executable and skip the browser install command. [Playwright browser installation](https://playwright.dev/docs/browsers)

```sh
cd cloud-browser
npm ci
npm exec -- playwright install --with-deps chromium
export CLOUD_CLIENT_ORIGINS=http://127.0.0.1:3000
export CLOUD_ALLOWED_ORIGINS=https://example.com
export CLOUD_ACCESS_CODE="$(openssl rand -hex 32)"
printf '%s\n' "$CLOUD_ACCESS_CODE"
npm start
```

In the local arcade, enter `ws://127.0.0.1:4892/v1/session` as the **Session endpoint**, copy the **Access code** from your private terminal, and choose **Start session**. Navigate to `https://example.com` and try the tab controls, fullscreen, and **End session**. Use `curl --fail http://127.0.0.1:4892/healthz` to check the HTTP listener. [Local Cloud Browser](http://127.0.0.1:3000/#cloud-browser)

| Setting | Purpose |
| --- | --- |
| `CLOUD_CLIENT_ORIGINS` | Comma-separated exact origins that can establish a session. Use `https://ryantsai13460.github.io` for the live arcade. An origin contains the scheme and host with any nondefault port. All projects served from that hostname share its origin. |
| `CLOUD_ALLOWED_ORIGINS` | Comma-separated approved HTTPS origins on port 443. Hostnames must resolve to public IPv4 addresses. Include individual asset or redirect origins only after reviewing them. Sites that depend on other origins may render partially. |
| `CLOUD_ACCESS_CODE` | Required shared code from 16 to 256 bytes for invited users. Generate a random secret and store it in your host’s secret store or service configuration. |
| `CLOUD_SEARCH_URL` | Optional approved HTTPS search endpoint. The server supplies the submitted terms as its `q` query parameter. |
| `CLOUD_PORT` | Loopback listen port. Defaults to `4892`. |
| `CLOUD_CHROMIUM_PATH` | Optional executable path on the backend host. |

## Verify the backend and viewer

From the repository root, install both packages and run the loopback suites. The browser tests start real Chromium processes and use controlled HTTPS fixtures. If you use a system Chromium, set `ARCADE_CHROMIUM` to its executable for both the viewer and remote browser in the tests. Otherwise, install the Playwright browser as shown above.

```sh
npm ci
npm --prefix cloud-browser ci
npm --prefix cloud-browser test
npx playwright test --config cloud-browser/playwright.config.mjs
```

The fixture tests exercise the application flow and browser controls with the Chromium sandbox disabled for the controlled local processes. The service started by `npm start` requires the sandbox. Validate Chromium’s sandbox and network isolation on the intended host with the production configuration before serving other users.

## Prepare a private deployment

Start with a trusted group and a short list of authorized sites. Apply your organization’s browsing policy to the allowlist and to access to the service itself. The shared code suits a small pilot. For wider access, use a gateway with individual identity, revocable access, and connection and authentication-attempt limits.

1. Use a dedicated Linux VM or a correctly sandboxed, unprivileged container. Keep the Chromium sandbox enabled and browser dependencies patched. Apply CPU, memory, process, and temporary storage limits at the OS level. Enforce a network policy outside Chromium that confines the browser to its filtered egress proxy and prevents direct DNS, UDP, and network connections. Limit the egress proxy to a trusted DNS resolver and approved public HTTPS. Block private, link-local, local management, and cloud metadata networks. Confirm these boundaries with the actual hosting configuration before sharing the endpoint. [Playwright sandbox guidance](https://playwright.dev/docs/docker)
2. Expose `/v1/session` over `wss://` through an HTTPS reverse proxy that supports WebSocket upgrades. Keep the Node service and its outbound proxy on private listeners. Configure the exact Pages origin, require the access code, give it only to invited users, and keep it out of URLs, shell history, logs, and the repository.
3. On the deployed site, connect to the new endpoint and verify that an approved destination loads, a destination outside the allowlist is denied, and ending a session closes its browser. Verify that an unapproved frontend origin cannot open a session. Watch CPU, memory, open connections, and outbound transfer while testing concurrency before inviting more users.

For a host with Caddy and a domain you control, this forwards the WebSocket path to the default loopback port. Replace `browser.example.org` with that domain, point DNS at the host, and configure your access and connection limits at the gateway. The endpoint for this example is `wss://browser.example.org/v1/session`. [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) · [Caddy certificate requirements](https://caddyserver.com/docs/automatic-https)

```caddyfile
browser.example.org {
    handle /v1/session {
        reverse_proxy 127.0.0.1:4892
    }
    respond 404
}
```

## Sessions and streaming

- The service starts an isolated Chromium process and a fresh profile per session. Defaults allow two sessions and five tabs per session. A session ends after five idle minutes, twenty total minutes, or disconnect. File transfers are disabled.
- The display sends Chromium screencast JPEG frames over the WebSocket at up to 1280 × 800. Auto quality adapts to the connection’s send queue. The player preserves its aspect ratio in fullscreen and maps pointer, touch, scrolling, and keyboard input to the remote page. Audio and smooth high-motion video would require a separate media pipeline. Use the arcade’s official media players when you need video with sound.
- Browser storage and navigation history are scoped to the active browser and discarded at session end. Explicit bookmarks can persist in the visitor’s browser. The backend handles page contents and input, and the selected destination receives ordinary browser requests and can retain data submitted to it. Use an endpoint you administer or trust. Configure infrastructure logs to omit access codes and browsing activity.

## Hosting and transfer costs

Local testing on an existing compatible machine needs no hosting subscription. On November 22, 2026, DigitalOcean listed Basic Linux VMs with two shared vCPUs at $18/month for 2 GiB of memory or $24/month for 4 GiB. These are budget examples. Test the actual pages and concurrent session count to size a host. Domain registration, backups, and additional transfer can cost extra. Check current regional pricing and any trial expiration before provisioning. [DigitalOcean VM pricing and transfer allowances](https://www.digitalocean.com/pricing/droplets)

For a planning estimate, ten 75 kB JPEG frames per second use about 2.7 GB of outbound traffic per session-hour before protocol overhead. Actual traffic depends on the page, activity, quality setting, and connection. Measure egress during the pilot. GitHub Pages can keep serving the arcade while the browser backend is offline.
