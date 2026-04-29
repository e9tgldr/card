# AR Card Tracking — Design Spec

**Status:** Approved by user 2026-04-29
**Author:** brainstorming session

## Goal

Add a WebAR feature to the Altan Domog app: when a user taps an "AR" button on a figure page, their phone's camera opens, MindAR detects the physical playing card, and the admin-uploaded MP4 video for that figure plays as a flat video plane locked to the surface of the detected card — making the figure on the card "come alive."

The AR feature reuses the per-figure videos already uploaded for the Card3D video-back system (shipped 2026-04-28). The only new admin asset per figure is a compiled MindAR `.mind` target file.

## Non-goals

- 3D character models / animated avatars (cut from initial scope — flat video plane only)
- Inline Story / Quiz / Ask AI panels rendered on top of the AR scene (action buttons navigate to the existing `/story/:chapter`, `/figure/:figId`, `/c/:figId` routes instead)
- Anonymous AR access from `/c/:figId` scan flow (deferred — AR route is OtpGated, app-side entry only)
- Desktop AR via webcam (replaced by a QR-code fallback panel that points users at their phone)
- Multi-card / multi-target tracking in one scene (one card at a time)

## Architecture

### Route

`/ar/:figId` — new React Router route, OtpGated, lazy-loaded so the MindAR/A-Frame bundle (~250 KB) stays out of the main JS bundle.

### Data flow

```
/figure/:figId  --[<ARLaunchButton/>]-->  /ar/:figId
/collection     --[<ARLaunchButton/>]-->  /ar/:figId
                                            |
                                            +- desktop?  --> <DesktopFallback/>: QR code -> phone URL
                                            +- mobile?   --> <MindARScene>:
                                                              tracks .mind --> plays video on plane
                                                              top-bar:    Back, name, mute
                                                              bottom-bar: Story, Quiz, Ask AI
```

### Data model

Single column added to existing `figure_back_videos` table (the canonical per-figure card-back asset table from the 2026-04-28 video-back work):

```sql
alter table public.figure_back_videos
  add column ar_target_path text;
```

The video plane uses the existing `video_path` already in this table — no new video storage. The new `ar_target_path` points to the admin-uploaded `.mind` file. RLS unchanged: public read, admin write via `is_admin()`.

A figure is **AR-ready** iff both `video_path` and `ar_target_path` are non-null.

### Storage layout

Reuses the existing `figure-back-videos` bucket:

```
figure-back-videos/
  {fig_id}/
    video.mp4         (already exists from Card3D video back)
    captions.vtt      (already exists)
    target.mind       (new -- admin-uploaded MindAR target file)
```

### New files

- `src/pages/ARView.jsx` + `.test.jsx`
- `src/components/ARLaunchButton.jsx` + `.test.jsx`
- `src/components/ar/MindARScene.jsx`
- `src/components/ar/DesktopFallback.jsx` + `.test.jsx`
- `src/components/admin/ARTargetUploader.jsx` + `.test.jsx`
- `src/hooks/useFigureARTarget.js` + `.test.js`
- `supabase/migrations/2026XXXXXXXXXX_ar_target_column.sql`
- `supabase/functions/upload-figure-ar-target/index.ts` (mirrors existing `upload-figure-back-video`)

## Component design

### `<ARView>` (`src/pages/ARView.jsx`)

Thin page that:

1. Reads `figId` from URL params (`useParams`)
2. Detects mobile vs desktop via existing `useIsMobile()` hook (`src/hooks/use-mobile.jsx`)
3. Calls `useFigureARTarget(figId)` -> `{ videoUrl, targetUrl, ready, loading, error }`
4. Renders one of:
   - **Loading** — gold-ring + crimson-spinner pattern matching other pages
   - **Desktop** — `<DesktopFallback figId={figId} />`
   - **Mobile + ready** — `<MindARScene videoUrl targetUrl figId />`
   - **Mobile + assets missing** — full-page "AR-д бэлдэж байна" panel with Back button
5. Wraps in a fixed full-viewport container — no app chrome, AR needs the full screen

### `<MindARScene>` (`src/components/ar/MindARScene.jsx`)

The React/A-Frame bridge. Mounts A-Frame imperatively because A-Frame's HTML custom elements don't play well with React reconciliation. **Builds the scene with `document.createElement` + `setAttribute` (no string-built HTML) so untrusted-feeling URL interpolation is impossible**:

```jsx
useEffect(() => {
  let cancelled = false;
  Promise.all([
    import('aframe'),
    import('mind-ar/dist/mindar-image-aframe.prod.js'),
  ]).then(() => {
    if (cancelled) return;
    const scene = buildScene(targetUrl, videoUrl);
    containerRef.current.appendChild(scene);
    scene.addEventListener('arError', handleARError);
    scene.addEventListener('targetFound', () => {
      setTracking(true);
      scene.querySelector('#figVideo').play();
    });
    scene.addEventListener('targetLost', () => {
      setTracking(false);
      scene.querySelector('#figVideo').pause();
    });
  });
  return () => { cancelled = true; /* tear down scene, stop camera tracks */ };
}, [targetUrl, videoUrl]);
```

`buildScene(targetUrl, videoUrl)` constructs the scene tree via DOM APIs only:

```js
function buildScene(targetUrl, videoUrl) {
  const scene = document.createElement('a-scene');
  scene.setAttribute('mindar-image', `imageTargetSrc: ${targetUrl}; autoStart: true;`);
  scene.setAttribute('vr-mode-ui', 'enabled: false');
  scene.setAttribute('device-orientation-permission-ui', 'enabled: false');

  const assets = document.createElement('a-assets');
  const video = document.createElement('video');
  video.id = 'figVideo';
  video.src = videoUrl;
  video.preload = 'auto';
  video.playsInline = true;
  video.setAttribute('webkit-playsinline', '');
  video.crossOrigin = 'anonymous';
  assets.appendChild(video);
  scene.appendChild(assets);

  const camera = document.createElement('a-camera');
  camera.setAttribute('position', '0 0 0');
  camera.setAttribute('look-controls', 'enabled: false');
  scene.appendChild(camera);

  const target = document.createElement('a-entity');
  target.setAttribute('mindar-image-target', 'targetIndex: 0');
  const plane = document.createElement('a-video');
  plane.setAttribute('src', '#figVideo');
  plane.setAttribute('position', '0 0 0');
  plane.setAttribute('width', '1');
  plane.setAttribute('height', '0.552');
  plane.setAttribute('rotation', '0 0 0');
  target.appendChild(plane);
  scene.appendChild(target);

  return scene;
}
```

The plane size 1×0.552 reflects a 16:9 video on a card-aspect target; refine during real-phone testing. The `targetUrl` is still interpolated into the `mindar-image` attribute string — but that attribute is parsed by MindAR as a config string, not as HTML, and the URL comes from a Supabase signed/public URL we issued ourselves. If we want defense-in-depth here we URL-encode it before interpolation.

Video plays muted by default (mobile autoplay rules); the Mute/Unmute control in the top bar toggles audio. The user's tap on the AR launch button on the previous page counts as the user gesture that allows muted autoplay on iOS.

**Top-bar UI** (overlaid, fixed): Back (left, `navigate(-1)`), figure name + years (center), Mute/Unmute (right).

**Bottom-bar UI** (overlaid, fixed): Story / Quiz / Ask AI — each navigates to the existing route:
- Story -> `/story/:chapter` for the chapter mapped to this figure (button hidden if no chapter exists)
- Quiz -> `/figure/:figId#quiz`
- Ask AI -> `/c/:figId`

### `<ARLaunchButton>` (`src/components/ARLaunchButton.jsx`)

Shared button used in two surfaces. Props:

```
<ARLaunchButton figId={figId} variant="full" | "compact" />
```

`variant="full"` — used on `/figure/:figId` action row, alongside Story/Quiz.
`variant="compact"` — used on `Card3D` in `/collection`, small icon overlaid top-right of the 3D card.

State logic via `useFigureARTarget(figId)`:

| Condition | Render |
|---|---|
| Loading | skeleton/spinner in button slot |
| `ready === true` | active button -> on click `navigate('/ar/' + figId)` |
| `ready === false` | disabled button "AR — Тун удахгүй", tooltip "Энэ дүрд AR удахгүй нэмэгдэнэ" |

**"Unique" visual treatment** — must visually break from the rest of the action row:

- Color: gold gradient outline (`#d4af37 -> #b8860b`) on dark background (not the existing crimson/brass button styles)
- Icon: custom AR cube glyph (isometric cube + corner brackets, ~12-line SVG) — distinct from lucide-react icons used elsewhere
- Animation: idle pulse (gold ring expands and fades, 2.4 s loop) using existing `framer-motion`; hover/tap brighter gold flash + 1.05× scale; disabled state desaturates to muted bronze and stops the pulse
- `prefers-reduced-motion: reduce` skips the pulse (static gold instead)
- Label "AR харах" / "AR" via existing `useT` i18n
- Compact variant: 32×32 px gold-ringed circle, top-right anchored on `Card3D`, 44×44 hit area for accessibility

### `<DesktopFallback>` (`src/components/ar/DesktopFallback.jsx`)

Centered card with:
- Heading: figure name + "Утсаараа сканнердана уу"
- QR code (via existing `qrcode` package) encoding `https://{origin}/ar/{figId}`
- Subtext: "Or open this link on your phone:"
- Copyable URL with copy-to-clipboard button (use existing feedback toast on success)

### `<ARTargetUploader>` (`src/components/admin/ARTargetUploader.jsx`)

Slots into the existing admin area, alongside the back-video uploader.

Table of all figures:

| Figure | Video | AR Target | Action |
|---|---|---|---|
| Чингис Хаан | Y uploaded | Y uploaded | Replace target |
| Хубилай Хаан | Y uploaded | N missing | Upload `.mind` |
| Бат Хаан | N missing | N missing | (disabled — upload video first) |

Upload flow:
1. Admin clicks "Upload `.mind`" for a figure
2. File picker accepts `.mind` extension only
3. Inline help text:
   > "Энэ файлыг MindAR Target Compiler (https://hiukim.github.io/mind-ar-js-doc/tools/compile)-аар хөрвүүлж авна уу. Картын урд талын зургийг оруулж, `.mind` файл татаж авч энд хуулна уу."
4. Client POSTs to new edge function `upload-figure-ar-target`
5. Edge function: `is_admin()` check -> upload to `figure-back-videos/{fig_id}/target.mind` -> upsert `figure_back_videos.ar_target_path` -> return updated row
6. UI optimistically updates row, no toast on success (matches existing admin pattern)

Validation:
- Max 5 MB (typical `.mind` files are 100–500 KB)
- Extension whitelist + magic-bytes check (verify the header in dev with a real compiled file before locking down)
- Server-side: same size limit + content-type whitelist

Replace flow: clicking "Replace target" warns "Хуучин AR файл устах болно" before overwriting.

## Edge cases

1. **Camera permission denied** — `arError` event -> modal "Камер-р хандах эрх олгоно уу" with Try Again + browser-permission docs link + Back
2. **Camera unavailable / not present** — `getUserMedia` `NotFoundError` -> modal "Энэ төхөөрөмжид камер олдсонгүй" + use-different-device + Back
3. **Tracking never finds the card** (15 s without `targetFound`) -> hint banner "Картыг камерын дунд аваачиж, гэрэлтэй газар барина уу"; dismisses on first `targetFound`, no reappear that session
4. **Tracking lost mid-playback** — pause video on `targetLost`, resume on next `targetFound`; no UI noise
5. **Asset 404** (DB row exists but Storage returns 404) — caught at hook level, render the "AR coming soon" page; admin will see status mismatch in the upload panel
6. **iOS Safari quirks** — `playsinline` + `webkit-playsinline` already set on the video element; user-gesture-bound `play()` covered by the AR launch tap
7. **iOS in-app browsers** (Instagram, Facebook) often block camera — if `getUserMedia` is undefined, show "Аппын дотор камер ашиглах боломжгүй. Safari/Chrome-оор нээнэ үү" + copy-link button
8. **Slow network / large video** — `<video preload="auto">`; loading bar overlays camera while buffering; tracking starts without video; if video fails to start in 8 s, show "Slow connection" toast (existing feedback lib)

## Testing approach

### Vitest tests (run in CI)

5 new test files, ~25 new cases, bringing the suite from 223 -> ~248 tests:

1. **`useFigureARTarget.test.js`** — mocks Supabase client; asserts hook returns correct `{ ready, videoUrl, targetUrl }` for each combination of present/missing `video_path` and `ar_target_path`
2. **`ARLaunchButton.test.jsx`** — covers loading / ready / disabled / full vs compact; click navigates correctly when ready, no-op when disabled; uses `vi.mock` on `useFigureARTarget`
3. **`ARView.test.jsx`** — mocks `useIsMobile` and `useFigureARTarget`; asserts desktop -> DesktopFallback, mobile + ready -> MindAR container, mobile + missing -> "AR coming soon" state; **stubs the dynamic A-Frame import** so the test doesn't load A-Frame
4. **`DesktopFallback.test.jsx`** — QR encodes correct `/ar/:figId` URL; copyable link matches
5. **`ARTargetUploader.test.jsx`** — admin table renders correct status; upload calls edge function with correct `fig_id`; `.mind` extension validation rejects other file types client-side

### Not unit-tested

The actual MindAR scene mounting and tracking — A-Frame's custom elements and MindAR's WebGL pipeline can't run in jsdom. The bridge (event-listener setup, cleanup, state transitions) is verified by simulating `targetFound` / `targetLost` / `arError` events on a fake DOM element. Visual correctness of the AR scene is a manual-testing concern.

### Manual phone-testing checklist

The implementation plan must explicitly require this — feature is not complete until each is checked:

- [ ] iPhone (Safari) — camera opens, target detected, video plays, audio works after unmute, back nav works
- [ ] iPhone (Instagram in-app browser) — fallback message appears
- [ ] Android (Chrome) — same as iPhone Safari
- [ ] Desktop (Chrome) — `<DesktopFallback/>` shows; QR scans correctly with phone
- [ ] Real card under varying lighting (bright sun, dim indoor, screen reflection)
- [ ] Hold card at 15 cm, 30 cm, 60 cm distances — note which range works
- [ ] Lose tracking, recover tracking — video resumes correctly

## Dependencies

New npm packages:
- `aframe` (^1.5.0)
- `mind-ar` (^1.2.5)

Both are dynamic-imported only inside `<MindARScene>` so they're code-split out of the main bundle.

Existing packages reused:
- `qrcode` — already installed (used by other QR flows in repo)
- `framer-motion` — for the AR launch button pulse
- `react-router-dom` — `/ar/:figId` route
- existing `useT` i18n, `useIsMobile`, feedback toast, OtpGate, Supabase client

## Out of scope (explicit)

- Anonymous AR via `/c/:figId` — could be revisited later as a sub-project if user demand emerges
- 3D character models — could be revisited later; would require new `ar_model_path` column and `.glb` upload flow
- Multi-card scene tracking — out of scope for MVP

## Open questions resolved during brainstorming

| Question | Resolution |
|---|---|
| Static `/public/ar.html` or React route? | React route `/ar/:figId` |
| Single-figure MVP or all figures from day one? | All figures (data-driven, Supabase-backed) |
| Action buttons inline or navigate out? | Navigate to existing `/story/:chapter`, `/figure/:figId`, `/c/:figId` |
| Anonymous like `/c/:figId` or OtpGated? | OtpGated, app-side entry only |
| Behavior when AR assets missing? | Disabled "Coming Soon" button (visible, signals feature exists) |
| Where does the launch button live? | Both `/figure/:figId` and `Card3D` on `/collection` |
| What does "unique" mean for the button? | Distinctive visual style (gold pulse), one shared component, two variants |
| Desktop behavior? | QR-code fallback panel pointing users to their phone |
| What "video" plays in AR? | The existing admin-uploaded MP4 from `figure_back_videos.video_path` (no new video upload) |
| What does the admin upload? | One `.mind` target file per figure (compiled via MindAR target compiler) |
