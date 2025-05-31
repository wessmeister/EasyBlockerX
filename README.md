# EasyBlockerX

A lightweight Chrome extension that adds one-click mute and block buttons directly to tweets on X (formerly Twitter).

## Features

- **One-Click Actions**: Mute or block users directly from their tweets
- **Auto-Action URLs**: Share links that automatically mute/block users (e.g., `x.com/username?mute=true`)
- **Customizable**: Toggle mute/block buttons, confirmations, and auto-actions
- **Lightweight**: Simple, fast, and efficient

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Open Chrome and navigate to `chrome://extensions`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `dist` folder

## Project Structure

```
EasyBlockerX/
├── src/
│   ├── content.ts      # Content script for injecting buttons
│   ├── background.ts   # Service worker for handling actions
│   ├── styles.css      # Button styles
│   └── types.ts        # TypeScript type definitions
├── public/
│   ├── manifest.json   # Extension manifest
│   ├── popup.html      # Extension popup
│   └── popup.js        # Popup functionality
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # NPM dependencies and scripts
```

## Development

- `npm run dev` - Start development with watch mode
- `npm run build` - Build for production
- `npm run preview` - Preview the built extension

## Usage

### Manual Actions

- Hover over any tweet to see the mute/block buttons
- Click to perform the action (with optional confirmation)

### Auto-Action URLs

Share links that automatically perform actions:

- Mute: `https://x.com/username?mute=true`
- Block: `https://x.com/username?block=true`

## Settings

Access settings through the extension popup:

- **Enable Mute Button**: Show/hide the mute button
- **Enable Block Button**: Show/hide the block button
- **Confirm Actions**: Ask for confirmation before muting/blocking
- **Enable Auto-Action**: Allow automatic actions from URL parameters

## Privacy

This extension:

- Only runs on x.com and twitter.com
- Doesn't collect or transmit any data
- All settings are stored locally

## License

MIT
