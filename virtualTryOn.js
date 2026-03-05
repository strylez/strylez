// ============================================
// Global Variables
// ============================================
let video;
let poseNet;
let canvas;
let img;
let started = false;

// Pose tracking variables
let noseX = 0, noseY = 0;
let eyelX = 0, eyelY = 0;
let lerpLeftShoulderX = 0, lerpLeftShoulderY = 0;
let lerpRightShoulderX = 0, lerpRightShoulderY = 0;
let lerpRightHipX = 0, lerpRightHipY = 0;
let lerpLeftHipX = 0, lerpLeftHipY = 0;

// Cloth configuration
const upperBodyKeywords = ["top", "shirt", "blouse", "dress"];
const lowerBodyKeywords = ["skirt", "pants", "shorts"];
let dressType = "tops";
let hasColar = false;
let try_on_flag = 1;

// Cached resized overlay image to avoid resizing every frame
let cachedResizedImg = null;
let lastImgRef = null;
let lastImgHeight = -1;

// Sample image URL (replace with your own)
const SAMPLE_IMAGE_URL = 'https://via.placeholder.com/300x400/667eea/ffffff?text=Sample+Cloth';

// ============================================
// Contour selector state
// ============================================
let _contourInputImg = null;
let _contourData = null;
let _contourSelectedSet = new Set();
let _contourCallback = null;
let _contourScale = 1;
let _contourSensitivity = 40;

// ============================================
// Crop selector state
// ============================================
let _cropInputImg = null;
let _cropCallback = null;
let _cropScale = 1;
let _cropRawPixels = null;
let _cropImgW = 0;
let _cropImgH = 0;
let _cropRect = null;   // {x1, y1, x2, y2} in source image coordinates
let _cropDragging = false;
let _cropDragStartX = 0;
let _cropDragStartY = 0;

// ============================================
// Eraser state
// ============================================
let _eraseInputImg = null;
let _eraseCallback = null;
let _eraseScale = 1;
let _erasePixels = null;
let _eraseOriginalPixels = null;
let _eraseImgW = 0;
let _eraseImgH = 0;
let _eraseIsDrawing = false;
let _eraseBrushSize = 20;
let _eraseCursorX = -1;
let _eraseCursorY = -1;

// ============================================
// DOM Elements
// ============================================
const modal = document.getElementById("myModal");
const btn = document.getElementById("myBtn");
const closeBtn = document.getElementsByClassName("close")[0];
const imageUpload = document.getElementById("imageUpload");
const useSampleImageBtn = document.getElementById("useSampleImage");
const imageUrlInput = document.getElementById("imageUrlInput");
const loadImageUrlBtn = document.getElementById("loadImageUrl");
const startBtn = document.getElementById("selectedDress");
const loadVideoBtn = document.getElementById("loadVideoBtn");
const videoFileInput = document.getElementById("videoFileInput");
const screenshotBtn = document.getElementById("takeScreenshot");
const stopBtn = document.getElementById("stopBtn");
const countdownEl = document.getElementById("countdown");

// ============================================
// Modal Control
// ============================================
btn.onclick = () => {
    modal.style.display = "block";
};

closeBtn.onclick = () => {
    modal.style.display = "none";
    cleanup();
};

window.onclick = (event) => {
    if (event.target === modal) {
        modal.style.display = "none";
        cleanup();
    }
};

// ============================================
// Image Upload Handling
// ============================================
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            loadImage(event.target.result, (loadedImage) => {
                showCropSelector(loadedImage, (croppedImage) => {
                    showContourSelector(croppedImage, (contourResult) => {
                        showEraseSelector(contourResult, (finalResult) => {
                            img = finalResult;
                            enableControls();
                        });
                    });
                });
            });
        };
        reader.readAsDataURL(file);
    }
});

useSampleImageBtn.onclick = () => {
    loadImage(SAMPLE_IMAGE_URL, (loadedImage) => {
        showCropSelector(loadedImage, (croppedImage) => {
            showContourSelector(croppedImage, (contourResult) => {
                showEraseSelector(contourResult, (finalResult) => {
                    img = finalResult;
                    enableControls();
                });
            });
        });
    });
};

loadImageUrlBtn.onclick = () => {
    const url = imageUrlInput.value.trim();
    if (!url) {
        alert("Please enter an image URL.");
        return;
    }
    loadImage(url, (loadedImage) => {
        showCropSelector(loadedImage, (croppedImage) => {
            showContourSelector(croppedImage, (contourResult) => {
                showEraseSelector(contourResult, (finalResult) => {
                    img = finalResult;
                    enableControls();
                });
            });
        });
    }, () => {
        alert("Failed to load image from the provided URL. Ensure the URL is correct and the server allows cross-origin requests (CORS).");
    });
};

// ============================================
// Pose Detection
// ============================================
function gotPoses(poses) {
    if (poses.length > 0) {
        const pose = poses[0].pose;

        let nX = pose.keypoints[0].position.x;
        let nY = pose.keypoints[0].position.y;
        let eX = pose.keypoints[1].position.x;
        let eY = pose.keypoints[1].position.y;

        let leftShoulderX = pose.keypoints[6].position.x;
        let leftShoulderY = pose.keypoints[6].position.y;
        let rightShoulderX = pose.keypoints[5].position.x;
        let rightShoulderY = pose.keypoints[5].position.y;

        let rightHipX = pose.keypoints[11].position.x;
        let rightHipY = pose.keypoints[11].position.y;
        let leftHipX = pose.keypoints[12].position.x;
        let leftHipY = pose.keypoints[12].position.y;

        // Smooth interpolation
        noseX = lerp(noseX, nX, 0.5);
        noseY = lerp(noseY, nY, 0.5);
        eyelX = lerp(eyelX, eX, 0.5);
        eyelY = lerp(eyelY, eY, 0.5);

        lerpLeftShoulderX = lerp(lerpLeftShoulderX, leftShoulderX, 0.1);
        lerpLeftShoulderY = lerp(lerpLeftShoulderY, leftShoulderY, 0.1);
        lerpRightShoulderX = lerp(lerpRightShoulderX, rightShoulderX, 0.1);
        lerpRightShoulderY = lerp(lerpRightShoulderY, rightShoulderY, 0.1);

        lerpLeftHipX = lerp(lerpLeftHipX, leftHipX, 0.1);
        lerpLeftHipY = lerp(lerpLeftHipY, leftHipY, 0.1);
        lerpRightHipX = lerp(lerpRightHipX, rightHipX, 0.1);
        lerpRightHipY = lerp(lerpRightHipY, rightHipY, 0.1);
    }
}

function modelReady() {
    console.log("PoseNet model ready");
}

// ============================================
// Interactive Contour Selection
// ============================================

// Performs BFS background flood-fill and labels all connected foreground
// components. Returns the raw data needed for interactive selection and
// for the final apply step — without modifying inputImg.
function _computeContourData(inputImg, tolerance) {
    const w = inputImg.width;
    const h = inputImg.height;

    const tempCanvas = createGraphics(w, h);
    tempCanvas.pixelDensity(1);
    tempCanvas.image(inputImg, 0, 0);
    tempCanvas.loadPixels();
    const pixels = tempCanvas.pixels;

    function pixelAt(px, py) {
        const i = (py * w + px) * 4;
        return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    }

    const corners = [pixelAt(0, 0), pixelAt(w - 1, 0), pixelAt(0, h - 1), pixelAt(w - 1, h - 1)];
    let bgR = 0, bgG = 0, bgB = 0;
    corners.forEach(c => { bgR += c[0]; bgG += c[1]; bgB += c[2]; });
    bgR = Math.round(bgR / 4); bgG = Math.round(bgG / 4); bgB = Math.round(bgB / 4);

    function isBackgroundColor(r, g, b) {
        return Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2) < tolerance;
    }

    const bgMask = new Uint8Array(w * h);
    const queue = [];

    function tryEnqueue(x, y) {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const idx = y * w + x;
        if (bgMask[idx]) return;
        const pi = idx * 4;
        if (pixels[pi + 3] < 10 || isBackgroundColor(pixels[pi], pixels[pi + 1], pixels[pi + 2])) {
            bgMask[idx] = 1;
            queue.push(x, y);
        }
    }

    for (let x = 0; x < w; x++) { tryEnqueue(x, 0); tryEnqueue(x, h - 1); }
    for (let y = 1; y < h - 1; y++) { tryEnqueue(0, y); tryEnqueue(w - 1, y); }

    let qi = 0;
    while (qi < queue.length) {
        const cx = queue[qi++], cy = queue[qi++];
        tryEnqueue(cx + 1, cy); tryEnqueue(cx - 1, cy);
        tryEnqueue(cx, cy + 1); tryEnqueue(cx, cy - 1);
    }

    // Label every foreground pixel with its component index
    const componentMap = new Int32Array(w * h).fill(-1);
    const components = [];
    const nbrDx = [-1, 1, 0, 0], nbrDy = [0, 0, -1, 1];

    for (let sy = 0; sy < h; sy++) {
        for (let sx = 0; sx < w; sx++) {
            const sidx = sy * w + sx;
            if (!bgMask[sidx] && componentMap[sidx] === -1) {
                const ci = components.length;
                const comp = [sidx];
                const cq = [sx, sy];
                componentMap[sidx] = ci;
                let queueIdx = 0;
                while (queueIdx < cq.length) {
                    const cx2 = cq[queueIdx++], cy2 = cq[queueIdx++];
                    for (let ni = 0; ni < 4; ni++) {
                        const nx = cx2 + nbrDx[ni], ny = cy2 + nbrDy[ni];
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                        const nidx = ny * w + nx;
                        if (!bgMask[nidx] && componentMap[nidx] === -1) {
                            componentMap[nidx] = ci;
                            comp.push(nidx);
                            cq.push(nx, ny);
                        }
                    }
                }
                components.push(comp);
            }
        }
    }

    const rawPixels = pixels.slice();
    tempCanvas.remove();
    return { bgMask, componentMap, components, rawPixels, w, h };
}

// Renders the image onto #contourCanvas with green/red tint overlays
// for selected/unselected foreground regions.
function _renderContourCanvas() {
    const { componentMap, rawPixels, w, h } = _contourData;
    const htmlCanvas = document.getElementById('contourCanvas');
    const maxW = Math.min(560, Math.floor(window.innerWidth * 0.78));
    _contourScale = Math.min(1, maxW / w);
    const dw = Math.round(w * _contourScale);
    const dh = Math.round(h * _contourScale);
    htmlCanvas.width = dw;
    htmlCanvas.height = dh;

    const ctx = htmlCanvas.getContext('2d');

    // Draw original image at display size via a temporary HTML canvas
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = w; tmpCanvas.height = h;
    const tmpCtx = tmpCanvas.getContext('2d');
    const imgData = tmpCtx.createImageData(w, h);
    imgData.data.set(rawPixels);
    tmpCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(tmpCanvas, 0, 0, dw, dh);

    // Apply tint overlays per pixel based on component membership
    const overlayData = ctx.getImageData(0, 0, dw, dh);
    const od = overlayData.data;
    for (let dy = 0; dy < dh; dy++) {
        for (let dx = 0; dx < dw; dx++) {
            const srcX = Math.min(w - 1, Math.round(dx / _contourScale));
            const srcY = Math.min(h - 1, Math.round(dy / _contourScale));
            const ci = componentMap[srcY * w + srcX];
            if (ci !== -1) {
                const pi = (dy * dw + dx) * 4;
                if (_contourSelectedSet.has(ci)) {
                    // Green tint for selected regions
                    od[pi]     = Math.round(od[pi] * 0.4);
                    od[pi + 1] = Math.min(255, Math.round(od[pi + 1] * 0.4 + 180));
                    od[pi + 2] = Math.round(od[pi + 2] * 0.4);
                } else {
                    // Red tint for unselected regions
                    od[pi]     = Math.min(255, Math.round(od[pi] * 0.4 + 180));
                    od[pi + 1] = Math.round(od[pi + 1] * 0.4);
                    od[pi + 2] = Math.round(od[pi + 2] * 0.4);
                }
            }
        }
    }
    ctx.putImageData(overlayData, 0, 0);
}

// Pre-selects the best garment component: prefers the component that
// contains the image centre pixel, falling back to the largest one.
function _preselectBestComponent(components, bgMask, w, h) {
    _contourSelectedSet.clear();
    if (components.length > 0) {
        let bestIdx = 0;
        for (let ci = 1; ci < components.length; ci++) {
            if (components[ci].length > components[bestIdx].length) bestIdx = ci;
        }
        const centerPx = Math.floor(h / 2) * w + Math.floor(w / 2);
        if (!bgMask[centerPx]) {
            for (let ci = 0; ci < components.length; ci++) {
                if (components[ci].includes(centerPx)) { bestIdx = ci; break; }
            }
        }
        _contourSelectedSet.add(bestIdx);
    }
}

// Opens the contour selector modal. After the user confirms their
// selection, callback is invoked with the resulting p5.Image.
function showContourSelector(inputImg, callback) {
    _contourInputImg = inputImg;
    _contourCallback = callback;
    _contourSensitivity = 40;
    const slider = document.getElementById('contourSensitivity');
    slider.value = _contourSensitivity;
    document.getElementById('contourSensitivityValue').textContent = _contourSensitivity;
    _contourData = _computeContourData(inputImg, _contourSensitivity);
    const { components, bgMask, w, h } = _contourData;

    _preselectBestComponent(components, bgMask, w, h);

    _renderContourCanvas();
    document.getElementById('contourModal').style.display = 'block';
}

// ============================================
// Crop Selector
// ============================================

// Opens the crop selector modal. callback(croppedImg) is called after
// the user applies a crop or skips; nothing is called on cancel.
function showCropSelector(inputImg, callback) {
    _cropInputImg = inputImg;
    _cropCallback = callback;
    _cropRect = null;
    _cropDragging = false;
    _cropImgW = inputImg.width;
    _cropImgH = inputImg.height;

    // Cache raw pixels for fast, repeated rendering
    const tmpGfx = createGraphics(_cropImgW, _cropImgH);
    tmpGfx.pixelDensity(1);
    tmpGfx.image(inputImg, 0, 0);
    tmpGfx.loadPixels();
    _cropRawPixels = tmpGfx.pixels.slice();
    tmpGfx.remove();

    const htmlCanvas = document.getElementById('cropCanvas');
    const maxW = Math.min(560, Math.floor(window.innerWidth * 0.78));
    _cropScale = Math.min(1, maxW / _cropImgW);
    htmlCanvas.width = Math.round(_cropImgW * _cropScale);
    htmlCanvas.height = Math.round(_cropImgH * _cropScale);

    document.getElementById('cropApply').disabled = true;
    _renderCropCanvas();
    document.getElementById('cropModal').style.display = 'block';
}

// Draws the cached image plus a dimmed overlay and selection rectangle
// onto #cropCanvas.
function _renderCropCanvas() {
    const htmlCanvas = document.getElementById('cropCanvas');
    const ctx = htmlCanvas.getContext('2d');
    const dw = htmlCanvas.width;
    const dh = htmlCanvas.height;

    // Draw image from cached raw pixels
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = _cropImgW;
    tmpCanvas.height = _cropImgH;
    const tmpCtx = tmpCanvas.getContext('2d');
    const imgData = tmpCtx.createImageData(_cropImgW, _cropImgH);
    imgData.data.set(_cropRawPixels);
    tmpCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(tmpCanvas, 0, 0, dw, dh);

    if (_cropRect) {
        const rx = Math.min(_cropRect.x1, _cropRect.x2) * _cropScale;
        const ry = Math.min(_cropRect.y1, _cropRect.y2) * _cropScale;
        const rw = Math.abs(_cropRect.x2 - _cropRect.x1) * _cropScale;
        const rh = Math.abs(_cropRect.y2 - _cropRect.y1) * _cropScale;

        // Dim the area outside the selection
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, dw, ry);
        ctx.fillRect(0, ry, rx, rh);
        ctx.fillRect(rx + rw, ry, dw - rx - rw, rh);
        ctx.fillRect(0, ry + rh, dw, dh - ry - rh);

        // Draw selection border
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
    }
}

// Returns a new p5.Image cropped to the current _cropRect,
// or the original image if no valid selection exists.
function _applyCrop() {
    if (!_cropRect || !_cropInputImg) return _cropInputImg;
    const x1 = Math.round(Math.min(_cropRect.x1, _cropRect.x2));
    const y1 = Math.round(Math.min(_cropRect.y1, _cropRect.y2));
    const x2 = Math.round(Math.max(_cropRect.x1, _cropRect.x2));
    const y2 = Math.round(Math.max(_cropRect.y1, _cropRect.y2));
    const cw = x2 - x1;
    const ch = y2 - y1;
    if (cw < 1 || ch < 1) return _cropInputImg;

    const srcGfx = createGraphics(_cropImgW, _cropImgH);
    srcGfx.pixelDensity(1);
    srcGfx.image(_cropInputImg, 0, 0);
    const result = createGraphics(cw, ch);
    result.pixelDensity(1);
    result.copy(srcGfx, x1, y1, cw, ch, 0, 0, cw, ch);
    srcGfx.remove();
    return result.get();
}

// Builds and returns the final p5.Image from the user's selection,
// making unselected and background pixels fully transparent, then
// cropping to the tight bounding box of the selected pixels.
function _applyContourSelection() {
    const { bgMask, componentMap, w, h } = _contourData;
    const inputImg = _contourInputImg;

    if (_contourSelectedSet.size === 0) {
        alert("Please select at least one region to keep.");
        return null;
    }

    const tempCanvas = createGraphics(w, h);
    tempCanvas.pixelDensity(1);
    tempCanvas.image(inputImg, 0, 0);
    tempCanvas.loadPixels();
    const pixels = tempCanvas.pixels;

    for (let i = 0; i < w * h; i++) {
        if (bgMask[i] || !_contourSelectedSet.has(componentMap[i])) {
            pixels[i * 4 + 3] = 0;
        }
    }
    tempCanvas.updatePixels();

    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (_contourSelectedSet.has(componentMap[i])) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < minX || maxY < minY) {
        tempCanvas.remove();
        return inputImg;
    }

    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const result = createGraphics(cw, ch);
    result.copy(tempCanvas, minX, minY, cw, ch, 0, 0, cw, ch);
    tempCanvas.remove();
    return result.get();
}

// ============================================
// Interactive Eraser
// ============================================

// Opens the eraser modal. After the user confirms, callback is invoked
// with the resulting p5.Image (pixels erased by the user are transparent).
function showEraseSelector(inputImg, callback) {
    _eraseInputImg = inputImg;
    _eraseCallback = callback;
    _eraseImgW = inputImg.width;
    _eraseImgH = inputImg.height;
    _eraseIsDrawing = false;
    _eraseCursorX = -1;
    _eraseCursorY = -1;

    // Cache raw pixels for interactive erasing
    const tmpGfx = createGraphics(_eraseImgW, _eraseImgH);
    tmpGfx.pixelDensity(1);
    tmpGfx.image(inputImg, 0, 0);
    tmpGfx.loadPixels();
    _erasePixels = tmpGfx.pixels.slice();
    _eraseOriginalPixels = tmpGfx.pixels.slice();
    tmpGfx.remove();

    const htmlCanvas = document.getElementById('eraseCanvas');
    const maxW = Math.min(560, Math.floor(window.innerWidth * 0.78));
    _eraseScale = Math.min(1, maxW / _eraseImgW);
    htmlCanvas.width = Math.round(_eraseImgW * _eraseScale);
    htmlCanvas.height = Math.round(_eraseImgH * _eraseScale);

    _eraseBrushSize = parseInt(document.getElementById('eraseBrushSize').value, 10);
    document.getElementById('eraseBrushSizeValue').textContent = _eraseBrushSize;

    _renderEraseCanvas();
    document.getElementById('eraseModal').style.display = 'block';
}

// Renders the current erased image onto #eraseCanvas, with a checkered
// background to show transparent areas and a brush cursor preview.
function _renderEraseCanvas() {
    const htmlCanvas = document.getElementById('eraseCanvas');
    const ctx = htmlCanvas.getContext('2d');
    const dw = htmlCanvas.width;
    const dh = htmlCanvas.height;

    // Draw checkerboard background to indicate transparency
    const tileSize = 10;
    for (let ty = 0; ty < dh; ty += tileSize) {
        for (let tx = 0; tx < dw; tx += tileSize) {
            const isLight = ((Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2 === 0);
            ctx.fillStyle = isLight ? '#d0d0d0' : '#ffffff';
            ctx.fillRect(tx, ty, Math.min(tileSize, dw - tx), Math.min(tileSize, dh - ty));
        }
    }

    // Draw current (possibly erased) image pixels on top
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = _eraseImgW;
    tmpCanvas.height = _eraseImgH;
    const tmpCtx = tmpCanvas.getContext('2d');
    const imgData = tmpCtx.createImageData(_eraseImgW, _eraseImgH);
    imgData.data.set(_erasePixels);
    tmpCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(tmpCanvas, 0, 0, dw, dh);

    // Draw brush cursor preview circle
    if (_eraseCursorX >= 0 && _eraseCursorY >= 0) {
        ctx.beginPath();
        ctx.arc(
            _eraseCursorX * _eraseScale,
            _eraseCursorY * _eraseScale,
            _eraseBrushSize * _eraseScale,
            0, Math.PI * 2
        );
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

// Erases pixels within a circular brush area centred at (srcX, srcY).
function _eraseAt(srcX, srcY) {
    const r = _eraseBrushSize;
    const x0 = Math.max(0, srcX - r);
    const y0 = Math.max(0, srcY - r);
    const x1 = Math.min(_eraseImgW - 1, srcX + r);
    const y1 = Math.min(_eraseImgH - 1, srcY + r);
    const r2 = r * r;

    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            if ((x - srcX) * (x - srcX) + (y - srcY) * (y - srcY) <= r2) {
                _erasePixels[(y * _eraseImgW + x) * 4 + 3] = 0;
            }
        }
    }
}

// Builds a p5.Image from the current (erased) pixel state, tightly
// cropped to the bounding box of remaining opaque pixels.
function _applyErase() {
    let minX = _eraseImgW, minY = _eraseImgH, maxX = -1, maxY = -1;
    for (let y = 0; y < _eraseImgH; y++) {
        for (let x = 0; x < _eraseImgW; x++) {
            if (_erasePixels[(y * _eraseImgW + x) * 4 + 3] > 0) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < minX || maxY < minY) return _eraseInputImg;

    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;

    const tempGfx = createGraphics(_eraseImgW, _eraseImgH);
    tempGfx.pixelDensity(1);
    tempGfx.loadPixels();
    for (let i = 0; i < _erasePixels.length; i++) {
        tempGfx.pixels[i] = _erasePixels[i];
    }
    tempGfx.updatePixels();

    const result = createGraphics(cw, ch);
    result.pixelDensity(1);
    result.copy(tempGfx, minX, minY, cw, ch, 0, 0, cw, ch);
    tempGfx.remove();
    return result.get();
}

// ============================================
// Contour-Based Cloth Extraction
// ============================================

// Extracts the cloth from inputImg by:
// 1. Sampling the background color from the four corners of the image.
// 2. Running a BFS flood-fill from every border pixel to label all
//    connected background regions (contour-based masking).
// 3. Setting labelled pixels to fully transparent so only the cloth remains.
// 4. Returning a tightly cropped copy of the extracted cloth.
function extractClothWithContour(inputImg) {
    const w = inputImg.width;
    const h = inputImg.height;

    const tempCanvas = createGraphics(w, h);
    tempCanvas.pixelDensity(1);
    tempCanvas.image(inputImg, 0, 0);
    tempCanvas.loadPixels();

    const pixels = tempCanvas.pixels;

    // Helper: read RGBA at (px, py)
    function pixelAt(px, py) {
        const i = (py * w + px) * 4;
        return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    }

    // Estimate background color by averaging the four corner samples
    const corners = [
        pixelAt(0, 0),
        pixelAt(w - 1, 0),
        pixelAt(0, h - 1),
        pixelAt(w - 1, h - 1)
    ];
    let bgR = 0, bgG = 0, bgB = 0;
    corners.forEach(c => { bgR += c[0]; bgG += c[1]; bgB += c[2]; });
    bgR = Math.round(bgR / 4);
    bgG = Math.round(bgG / 4);
    bgB = Math.round(bgB / 4);

    // Euclidean color distance from the estimated background
    const tolerance = 40;
    function isBackgroundColor(r, g, b) {
        return Math.sqrt(
            (r - bgR) * (r - bgR) +
            (g - bgG) * (g - bgG) +
            (b - bgB) * (b - bgB)
        ) < tolerance;
    }

    // BFS flood-fill from all border pixels to detect the background contour
    const bgMask = new Uint8Array(w * h); // 1 = background
    const queue = [];

    function tryEnqueue(x, y) {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const idx = y * w + x;
        if (bgMask[idx]) return;
        const pi = idx * 4;
        const a = pixels[pi + 3];
        const r = pixels[pi], g = pixels[pi + 1], b = pixels[pi + 2];
        if (a < 10 || isBackgroundColor(r, g, b)) {
            bgMask[idx] = 1;
            queue.push(x, y);
        }
    }

    // Seed the flood-fill from all four edges
    for (let x = 0; x < w; x++) {
        tryEnqueue(x, 0);
        tryEnqueue(x, h - 1);
    }
    for (let y = 1; y < h - 1; y++) {
        tryEnqueue(0, y);
        tryEnqueue(w - 1, y);
    }

    // Process BFS queue
    let qi = 0;
    while (qi < queue.length) {
        const cx = queue[qi++];
        const cy = queue[qi++];
        tryEnqueue(cx + 1, cy);
        tryEnqueue(cx - 1, cy);
        tryEnqueue(cx, cy + 1);
        tryEnqueue(cx, cy - 1);
    }

    // Find all connected foreground components and keep only the largest
    // (removes stray body parts like neck/hands without using skin-color detection)
    const visited = new Uint8Array(w * h);
    const components = [];
    const nbrDx = [-1, 1, 0, 0];
    const nbrDy = [0, 0, -1, 1];

    for (let sy = 0; sy < h; sy++) {
        for (let sx = 0; sx < w; sx++) {
            const sidx = sy * w + sx;
            if (!bgMask[sidx] && !visited[sidx]) {
                const component = [];
                const cq = [sx, sy];
                let cqi2 = 0;
                visited[sidx] = 1;
                component.push(sidx);
                while (cqi2 < cq.length) {
                    const cx2 = cq[cqi2++];
                    const cy2 = cq[cqi2++];
                    for (let ni = 0; ni < 4; ni++) {
                        const nx = cx2 + nbrDx[ni];
                        const ny = cy2 + nbrDy[ni];
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                        const nidx = ny * w + nx;
                        if (!bgMask[nidx] && !visited[nidx]) {
                            visited[nidx] = 1;
                            component.push(nidx);
                            cq.push(nx, ny);
                        }
                    }
                }
                components.push(component);
            }
        }
    }

    // Mark all components except the garment component as background.
    // The garment is identified as the component containing the image centre
    // pixel (garment images are always centred); if that pixel is background,
    // fall back to the largest component.  This is more reliable than always
    // keeping the largest, which would incorrectly retain a large body-part
    // mass (e.g. mannequin torso) over a smaller centred garment.
    if (components.length > 1) {
        let garmentIdx = 0;
        for (let ci = 1; ci < components.length; ci++) {
            if (components[ci].length > components[garmentIdx].length) garmentIdx = ci;
        }
        const centerPx = Math.floor(h / 2) * w + Math.floor(w / 2);
        if (!bgMask[centerPx]) { // centre pixel is foreground — find its component
            for (let ci = 0; ci < components.length; ci++) {
                if (components[ci].includes(centerPx)) { garmentIdx = ci; break; }
            }
        }
        for (let ci = 0; ci < components.length; ci++) {
            if (ci !== garmentIdx) {
                for (let pi = 0; pi < components[ci].length; pi++) {
                    bgMask[components[ci][pi]] = 1;
                }
            }
        }
    }

    // Make background pixels fully transparent
    for (let i = 0; i < w * h; i++) {
        if (bgMask[i]) {
            pixels[i * 4 + 3] = 0;
        }
    }
    tempCanvas.updatePixels();

    // Determine tight bounding box of the remaining cloth pixels
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!bgMask[y * w + x]) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    // Fallback: return original if nothing was found
    if (maxX < minX || maxY < minY) return inputImg;

    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const result = createGraphics(cw, ch);
    result.copy(tempCanvas, minX, minY, cw, ch, 0, 0, cw, ch);

    return result.get();
}

// ============================================
// Position and Size Calculations
// ============================================
function getImgHeight(dressType) {
    if (dressType === "skirts" || dressType === "pants") {
        return 100;
    } else if (dressType === "dresses") {
        return 250;
    }
    return 300; // default for tops
}

function getYPosition(dressType) {
    if (upperBodyKeywords.some(k => dressType.toLowerCase().includes(k))) {
        const y_shift = (lerpLeftShoulderY - noseY) / (hasColar ? 1.5 : 3);
        return lerpLeftShoulderY - y_shift;
    } else if (lowerBodyKeywords.some(k => dressType.toLowerCase().includes(k))) {
        const y_shift = (lerpLeftHipY - lerpLeftShoulderY) / 2;
        return lerpLeftHipY - y_shift;
    }
    return 0;
}

// ============================================
// p5.js Draw Function
// ============================================
function draw() {
    if (!started || !img || !video) return;

    background(255);

    // Mirror the video and fit to canvas dimensions
    translate(width, 0);
    scale(-1, 1);
    image(video, 0, 0, width, height);

    // Calculate body positioning
    const body_neck_mid_position_x = (((lerpRightShoulderX - lerpLeftShoulderX) - 1) / 2) + lerpLeftShoulderX;
    const y_position = getYPosition(dressType);
    const img_height = getImgHeight(dressType);
    const cloth_dist_to_mid_from_left_edge_x = (img_height - 1) / 2;
    const overlay_left_edge_x = body_neck_mid_position_x - cloth_dist_to_mid_from_left_edge_x;

    // Cache resized image to avoid resizing every frame
    if (img !== lastImgRef || img_height !== lastImgHeight) {
        if (cachedResizedImg) cachedResizedImg.remove();
        cachedResizedImg = img.get();
        cachedResizedImg.resize(img_height, 0);
        lastImgRef = img;
        lastImgHeight = img_height;
    }

    if (try_on_flag === 1) {
        // Wave animation settings
        const waveAmplitude = 15;
        const waveFrequency = 0.05;
        const waveSpeed = 0.1;
        const edgePercent = 0.2;

        const t = frameCount * waveSpeed;
        const leftEdgeLimit = cachedResizedImg.width * edgePercent;
        const rightEdgeLimit = cachedResizedImg.width * (1 - edgePercent);

        // Draw with edge-based waving using 4px-wide strips to reduce draw calls
        const stripWidth = 4;
        for (let x = 0; x < cachedResizedImg.width; x += stripWidth) {
            const sw = min(stripWidth, cachedResizedImg.width - x);
            let offset = 0;

            if (x < leftEdgeLimit) {
                const strength = 1 - (x / leftEdgeLimit);
                offset = sin((x * waveFrequency) + t) * waveAmplitude * strength;
            } else if (x > rightEdgeLimit) {
                const distFromRight = cachedResizedImg.width - x;
                const strength = 1 - (distFromRight / leftEdgeLimit);
                offset = sin((x * waveFrequency) + t) * waveAmplitude * strength;
            }

            copy(
                cachedResizedImg,
                x, 0, sw, cachedResizedImg.height,
                overlay_left_edge_x + x, y_position + offset, sw, cachedResizedImg.height
            );
        }
    }
}

// ============================================
// Webcam Control
// ============================================
function startWebcam() {
    canvas = createCanvas(Math.min(window.innerWidth * 0.9, 600), 600);
    canvas.parent('videoFrame');
    canvas.style.display = "block";
    pixelDensity(1);
    frameRate(24);

    video = createCapture(VIDEO);
    video.style.display = "block";
    video.style.margin = "auto";
    video.size(width, height);

    poseNet = ml5.poseNet(video, modelReady);
    poseNet.on('pose', gotPoses);

    started = true;
    loop();

    // Update button visibility
    startBtn.classList.add('hidden');
    loadVideoBtn.classList.add('hidden');
    screenshotBtn.classList.remove('hidden');
    stopBtn.classList.remove('hidden');
}

function startVideoFile(url) {
    canvas = createCanvas(Math.min(window.innerWidth * 0.9, 600), 600);
    canvas.parent('videoFrame');
    canvas.style.display = "block";
    pixelDensity(1);
    frameRate(24);

    video = createVideo([url]);
    video.hide();
    video.size(width, height);
    video.loop();
    video.volume(0);

    poseNet = ml5.poseNet(video, modelReady);
    poseNet.on('pose', gotPoses);

    started = true;
    loop();

    // Update button visibility
    startBtn.classList.add('hidden');
    loadVideoBtn.classList.add('hidden');
    screenshotBtn.classList.remove('hidden');
    stopBtn.classList.remove('hidden');
}

function stopWebcam() {
    if (video) {
        video.remove();
    }
    if (poseNet) {
        poseNet.remove();
    }
    if (cachedResizedImg) {
        cachedResizedImg.remove();
        cachedResizedImg = null;
        lastImgRef = null;
        lastImgHeight = -1;
    }
    noLoop();
    started = false;

    // Update button visibility
    startBtn.classList.remove('hidden');
    loadVideoBtn.classList.remove('hidden');
    screenshotBtn.classList.add('hidden');
    stopBtn.classList.add('hidden');

    // Clear video frame
    const videoFrame = document.getElementById('videoFrame');
    videoFrame.innerHTML = '';
}

function cleanup() {
    if (started) {
        stopWebcam();
    }
    countdownEl.textContent = '';

    // Reset loaded cloth image
    img = null;

    // Reset file and URL input fields
    imageUpload.value = '';
    imageUrlInput.value = '';

    // Disable webcam/video controls until a new image is loaded
    startBtn.disabled = true;
    loadVideoBtn.disabled = true;

    // Clear the video frame display area
    const videoFrame = document.getElementById('videoFrame');
    if (videoFrame) {
        videoFrame.innerHTML = '';
    }
}

// ============================================
// Screenshot Capture
// ============================================
function takeScreenshot() {
    let counter = 3;
    countdownEl.textContent = counter;

    const timer = setInterval(() => {
        counter--;
        countdownEl.textContent = counter > 0 ? counter : "";

        if (counter <= 0) {
            clearInterval(timer);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `virtual-tryon_${timestamp}`;
            saveCanvas(canvas, filename, 'png');

            alert("✅ Your photo has been saved to your device!");
            countdownEl.textContent = '';
        }
    }, 1000);
}

function enableControls() {
    startBtn.disabled = false;
    startBtn.addEventListener('click', startWebcam, { once: true });
    loadVideoBtn.disabled = false;
}

// ============================================
// Contour Selector Event Listeners
// ============================================
document.getElementById('contourCanvas').addEventListener('click', (e) => {
    if (!_contourData) return;
    const rect = e.target.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const srcX = Math.min(_contourData.w - 1, Math.round(dx / _contourScale));
    const srcY = Math.min(_contourData.h - 1, Math.round(dy / _contourScale));
    const ci = _contourData.componentMap[srcY * _contourData.w + srcX];
    if (ci !== -1) {
        if (_contourSelectedSet.has(ci)) {
            _contourSelectedSet.delete(ci);
        } else {
            _contourSelectedSet.add(ci);
        }
        _renderContourCanvas();
    }
});

document.getElementById('contourSelectAll').addEventListener('click', () => {
    if (!_contourData) return;
    _contourData.components.forEach((_, ci) => _contourSelectedSet.add(ci));
    _renderContourCanvas();
});

document.getElementById('contourClearAll').addEventListener('click', () => {
    _contourSelectedSet.clear();
    _renderContourCanvas();
});

document.getElementById('contourSensitivity').addEventListener('input', (e) => {
    if (!_contourInputImg) return;
    _contourSensitivity = parseInt(e.target.value, 10);
    document.getElementById('contourSensitivityValue').textContent = _contourSensitivity;
    _contourData = _computeContourData(_contourInputImg, _contourSensitivity);
    const { components, bgMask, w, h } = _contourData;
    _preselectBestComponent(components, bgMask, w, h);
    _renderContourCanvas();
});

document.getElementById('contourConfirm').addEventListener('click', () => {
    const result = _applyContourSelection();
    if (result) {
        document.getElementById('contourModal').style.display = 'none';
        if (_contourCallback) {
            _contourCallback(result);
            _contourCallback = null;
        }
    }
});

document.getElementById('contourCancel').addEventListener('click', () => {
    document.getElementById('contourModal').style.display = 'none';
    _contourCallback = null;
});

document.getElementById('contourClose').addEventListener('click', () => {
    document.getElementById('contourModal').style.display = 'none';
    _contourCallback = null;
});

// ============================================
// Crop Selector Event Listeners
// ============================================
(function () {
    const cropCanvas = document.getElementById('cropCanvas');
    const MIN_CROP_SIZE = 2; // minimum drag size in source pixels to enable Apply Crop

    function getCropSrcCoords(clientX, clientY) {
        const rect = cropCanvas.getBoundingClientRect();
        return {
            srcX: Math.max(0, Math.min(_cropImgW - 1, Math.round((clientX - rect.left) / _cropScale))),
            srcY: Math.max(0, Math.min(_cropImgH - 1, Math.round((clientY - rect.top) / _cropScale)))
        };
    }

    function onCropPointerDown(clientX, clientY) {
        if (!_cropRawPixels) return;
        const { srcX, srcY } = getCropSrcCoords(clientX, clientY);
        _cropDragging = true;
        _cropDragStartX = srcX;
        _cropDragStartY = srcY;
        _cropRect = { x1: srcX, y1: srcY, x2: srcX, y2: srcY };
        document.getElementById('cropApply').disabled = true;
    }

    function onCropPointerMove(clientX, clientY) {
        if (!_cropDragging || !_cropRawPixels) return;
        const { srcX, srcY } = getCropSrcCoords(clientX, clientY);
        _cropRect.x2 = srcX;
        _cropRect.y2 = srcY;
        _renderCropCanvas();
    }

    function onCropPointerUp(clientX, clientY) {
        if (!_cropDragging) return;
        _cropDragging = false;
        const { srcX, srcY } = getCropSrcCoords(clientX, clientY);
        _cropRect.x2 = srcX;
        _cropRect.y2 = srcY;
        const w = Math.abs(_cropRect.x2 - _cropRect.x1);
        const h = Math.abs(_cropRect.y2 - _cropRect.y1);
        document.getElementById('cropApply').disabled = (w < MIN_CROP_SIZE || h < MIN_CROP_SIZE);
        _renderCropCanvas();
    }

    cropCanvas.addEventListener('mousedown', (e) => onCropPointerDown(e.clientX, e.clientY));
    cropCanvas.addEventListener('mousemove', (e) => onCropPointerMove(e.clientX, e.clientY));
    cropCanvas.addEventListener('mouseup',   (e) => onCropPointerUp(e.clientX, e.clientY));
    cropCanvas.addEventListener('mouseleave', () => {
        if (_cropDragging) {
            _cropDragging = false;
            const w = _cropRect ? Math.abs(_cropRect.x2 - _cropRect.x1) : 0;
            const h = _cropRect ? Math.abs(_cropRect.y2 - _cropRect.y1) : 0;
            document.getElementById('cropApply').disabled = (w < MIN_CROP_SIZE || h < MIN_CROP_SIZE);
            _renderCropCanvas();
        }
    });

    cropCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        onCropPointerDown(t.clientX, t.clientY);
    }, { passive: false });

    cropCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        onCropPointerMove(t.clientX, t.clientY);
    }, { passive: false });

    cropCanvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        onCropPointerUp(t.clientX, t.clientY);
    }, { passive: false });
})();

document.getElementById('cropApply').addEventListener('click', () => {
    const result = _applyCrop();
    document.getElementById('cropModal').style.display = 'none';
    if (_cropCallback) {
        _cropCallback(result);
        _cropCallback = null;
    }
});

document.getElementById('cropSkip').addEventListener('click', () => {
    document.getElementById('cropModal').style.display = 'none';
    if (_cropCallback && _cropInputImg) {
        _cropCallback(_cropInputImg);
        _cropCallback = null;
    }
});

document.getElementById('cropCancel').addEventListener('click', () => {
    document.getElementById('cropModal').style.display = 'none';
    _cropCallback = null;
});

document.getElementById('cropClose').addEventListener('click', () => {
    document.getElementById('cropModal').style.display = 'none';
    _cropCallback = null;
});

// ============================================
// Eraser Event Listeners
// ============================================
(function () {
    const eraseCanvas = document.getElementById('eraseCanvas');

    function getEraseSrcCoords(clientX, clientY) {
        const rect = eraseCanvas.getBoundingClientRect();
        return {
            srcX: Math.max(0, Math.min(_eraseImgW - 1, Math.round((clientX - rect.left) / _eraseScale))),
            srcY: Math.max(0, Math.min(_eraseImgH - 1, Math.round((clientY - rect.top) / _eraseScale)))
        };
    }

    function onErasePointerDown(clientX, clientY) {
        if (!_erasePixels) return;
        _eraseIsDrawing = true;
        const { srcX, srcY } = getEraseSrcCoords(clientX, clientY);
        _eraseCursorX = srcX;
        _eraseCursorY = srcY;
        _eraseAt(srcX, srcY);
        _renderEraseCanvas();
    }

    function onErasePointerMove(clientX, clientY) {
        if (!_erasePixels) return;
        const { srcX, srcY } = getEraseSrcCoords(clientX, clientY);
        _eraseCursorX = srcX;
        _eraseCursorY = srcY;
        if (_eraseIsDrawing) {
            _eraseAt(srcX, srcY);
        }
        _renderEraseCanvas();
    }

    function onErasePointerUp() {
        _eraseIsDrawing = false;
    }

    eraseCanvas.addEventListener('mousedown', (e) => onErasePointerDown(e.clientX, e.clientY));
    eraseCanvas.addEventListener('mousemove', (e) => onErasePointerMove(e.clientX, e.clientY));
    eraseCanvas.addEventListener('mouseup', onErasePointerUp);
    eraseCanvas.addEventListener('mouseleave', () => {
        _eraseIsDrawing = false;
        _eraseCursorX = -1;
        _eraseCursorY = -1;
        _renderEraseCanvas();
    });

    eraseCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        onErasePointerDown(t.clientX, t.clientY);
    }, { passive: false });

    eraseCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        onErasePointerMove(t.clientX, t.clientY);
    }, { passive: false });

    eraseCanvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        onErasePointerUp();
    }, { passive: false });
})();

document.getElementById('eraseBrushSize').addEventListener('input', (e) => {
    _eraseBrushSize = parseInt(e.target.value, 10);
    document.getElementById('eraseBrushSizeValue').textContent = _eraseBrushSize;
    _renderEraseCanvas();
});

document.getElementById('eraseConfirm').addEventListener('click', () => {
    const result = _applyErase();
    document.getElementById('eraseModal').style.display = 'none';
    if (_eraseCallback) {
        _eraseCallback(result);
        _eraseCallback = null;
    }
});

document.getElementById('eraseReset').addEventListener('click', () => {
    if (!_eraseOriginalPixels) return;
    _erasePixels = _eraseOriginalPixels.slice();
    _renderEraseCanvas();
});

function _dismissEraseModal() {
    document.getElementById('eraseModal').style.display = 'none';
    if (_eraseCallback) {
        _eraseCallback(_eraseInputImg);
        _eraseCallback = null;
    }
}

document.getElementById('eraseCancel').addEventListener('click', _dismissEraseModal);
document.getElementById('eraseClose').addEventListener('click', _dismissEraseModal);

// ============================================
// Event Listeners
// ============================================
loadVideoBtn.addEventListener('click', () => videoFileInput.click());

videoFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const objectURL = URL.createObjectURL(file);
        startVideoFile(objectURL);
        // Reset input so the same file can be re-selected later
        videoFileInput.value = '';
    }
});
screenshotBtn.addEventListener('click', takeScreenshot);
stopBtn.addEventListener('click', stopWebcam);

// Initialize p5.js (required for p5 functions to work outside setup/draw)
console.log("Virtual Try-On initialized and ready!");
