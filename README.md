# Strylez Virtual Try-On — Shopify App

Give shoppers a **real-time virtual try-on experience** powered by their webcam,
right on your Shopify product pages — no app install required for customers.

---

## How It Works

| Step | What happens |
|------|-------------|
| 1 | A **"Try It On"** button appears on the product page (added via the Theme App Extension). |
| 2 | Customer clicks the button. A modal opens with the product's featured image pre-loaded as the cloth overlay. |
| 3 | The customer optionally crops the image, removes the background using the interactive contour selector, and fine-tunes with the eraser tool. |
| 4 | Customer turns on their webcam. The garment is overlaid on their body in real-time using **pose-detection** (ml5.js PoseNet). |
| 5 | Customer can capture a photo and save it to their device. |

---

## Tech Stack

| Library | Role |
|---------|------|
| [p5.js 1.4](https://p5js.org/) | Canvas rendering & webcam capture |
| [ml5.js 0.12 (PoseNet)](https://ml5js.org/) | Real-time body pose detection |
| [Shopify Theme App Extension](https://shopify.dev/docs/apps/online-store/theme-app-extensions) | Embeds the widget into merchant themes without code changes |

---

## Repository Structure

```
strylez/
├── index.html                          # Standalone demo (open in browser)
├── virtualTryOn.js                     # Standalone demo JS
├── shopify.app.toml                    # Shopify app configuration
├── package.json
└── extensions/
    └── try-on-widget/                  # Theme App Extension
        ├── extension.toml
        ├── assets/
        │   └── virtual-try-on.js       # Shopify-adapted try-on logic
        ├── blocks/
        │   └── try_on_button.liquid    # App block for product pages
        └── locales/
            ├── en.default.json
            └── en.default.schema.json
```

---

## Standalone Demo

Open `index.html` in a browser to use the try-on experience without Shopify:

```bash
# Using any local HTTP server (HTTPS required for webcam access)
npx serve .
# then open https://localhost:3000
```

> **Note:** Browsers require HTTPS (or `localhost`) to access the webcam.

---

## Shopify App Setup

### Prerequisites

- A [Shopify Partner account](https://partners.shopify.com/)
- [Shopify CLI v3](https://shopify.dev/docs/api/shopify-cli) installed
- Node.js ≥ 18

### 1 — Install dependencies

```bash
npm install
```

### 2 — Create the app in your Partner Dashboard

1. Log in to [partners.shopify.com](https://partners.shopify.com/).
2. Click **Apps → Create app → Create app manually**.
3. Copy the **Client ID** and paste it into `shopify.app.toml`:

```toml
client_id = "YOUR_SHOPIFY_CLIENT_ID"
```

### 3 — Deploy the extension

```bash
npx shopify app deploy
```

### 4 — Add the block to your theme

1. In your Shopify Admin go to **Online Store → Themes → Customize**.
2. Navigate to a **Product page** template.
3. In the left sidebar click **Add block** and choose **Virtual Try-On** (under *Apps*).
4. Position the block below the Add-to-Cart button.
5. Customise the button text and colours in the right-hand settings panel.
6. Click **Save**.

---

## Merchant Customisation (Theme Editor)

| Setting | Description | Default |
|---------|-------------|---------|
| Button Text | Label shown on the trigger button | `Try It On` |
| Button Background Color | Hex colour for the button | `#667eea` |
| Button Text Color | Hex colour for the button label | `#ffffff` |

---

## Customer-Facing Flow

```
Product Page
    └─▶ [Try It On] button
            └─▶ Modal opens
                    ├─▶ "Use Product Image" (auto-loaded from the product)
                    ├─▶ Upload your own image
                    └─▶ Paste an image URL
                            └─▶ Crop (optional)
                                    └─▶ Select cloth region (contour selector)
                                            └─▶ Erase residuals (optional)
                                                    └─▶ [Turn on Webcam]
                                                            └─▶ Live overlay 🎉
                                                                    └─▶ [Capture Photo]
```

---

## Privacy & Permissions

- **No backend or server required.** All processing happens entirely in the customer's browser.
- **No images are uploaded.** The webcam feed and clothing image never leave the customer's device.
- **No Shopify API scopes required.** The extension reads product data via Liquid templates at render time.

---

## Browser Support

| Browser | Supported |
|---------|-----------|
| Chrome 90+ | ✅ |
| Firefox 90+ | ✅ |
| Edge 90+ | ✅ |
| Safari 14+ | ✅ |
| Mobile Chrome (Android) | ✅ |
| Mobile Safari (iOS 15+) | ✅ |

> Webcam access requires **HTTPS**. Shopify storefronts are served over HTTPS by default.

---

## Development

Run the extension locally against a development store:

```bash
npx shopify app dev
```

This starts a tunnel and lets you preview the block in the theme editor on a real
development store before deploying.

---

## License

MIT © Strylez
