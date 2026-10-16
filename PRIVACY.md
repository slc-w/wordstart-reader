# Privacy

WordStart Reader processes text inside the current browser page. The extension does not send page text, browsing history, or preferences to a server.

- No analytics, advertising, tracking, or account system.
- No external API calls or remote code.
- Reading settings and the selected theme are stored with `chrome.storage.local` on the device.
- Formatting state is held in the page and normally resets on reload or navigation.
- The extension does not maintain a browsing-history database.

The extension uses `activeTab`, `scripting`, and `storage` permissions. Its background worker changes the toolbar icon and resets that icon when a tab loads a new page.

This describes the extension itself. Websites, the browser, and GitHub have their own data handling practices.
