# Market listing

The DeepSeek Harness plugin market reads the curated
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) registry: one entry in
that repository's list is enough for the site and the in-app market to pick the plugin up (usually
within a day).

This is the entry shape this plugin expects (same fields the registry publishes):

```json
{
  "name": "dsh-cutout-pet",
  "url": "https://github.com/AlannerFranklin/dsh-cutout-pet",
  "category": "ui",
  "description": {
    "en": "Turn any picture into a floating desk pet: background removed locally in the page, sticker outline, idle animation, and a live DeepSeek account-balance bubble. Position follows the window.",
    "zh": "把任意图片变成浮在 Harness 上的桌宠：页面内本地抠图、白描边、呼吸/摇摆动画，头顶气泡显示 DeepSeek 账户余额；位置随窗口缩放跟随。"
  },
  "npm": "dsh-cutout-pet",
  "install": "dsh plugin --profile <profile> add dsh-cutout-pet"
}
```

Until the npm package is published, the registry entry can carry the git install instead:

```json
{
  "name": "dsh-cutout-pet",
  "url": "https://github.com/AlannerFranklin/dsh-cutout-pet",
  "category": "ui",
  "description": {
    "en": "Turn any picture into a floating desk pet: local cutout, sticker outline, idle animation, account-balance bubble, window-aware position.",
    "zh": "把任意图片变成 Harness 桌宠：本地抠图、白描边、动画与余额气泡，位置随窗口缩放。"
  },
  "install": "dsh plugin --profile <profile> add github:AlannerFranklin/dsh-cutout-pet"
}
```

## Checklist before submitting

- [ ] `npm pack --dry-run` lists exactly `index.js`, `client.js`, `cordis.patch.yml`, `locale/*.json`,
      `icon.svg`, `assets/default.png`, `README.md`, `LICENSE`.
- [ ] `package.json` `name`, `version`, `description`, `license`, `repository`, `homepage` are final.
- [ ] A tagged release (`v1.0.0`) exists, or the npm package of the same version is published.
- [ ] The README states what leaves the machine (nothing: cutout is local, balance is read by the Host).
- [ ] No third-party artwork is bundled; the default mascot is original.
