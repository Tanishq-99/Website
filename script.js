// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js';

let currentPdf = null;
let originalPdfBytes = null;
let textBoxes = [];
let canvasInfo = [];
let selectedColor = '#fff700'; // default yellow
const colorPicker = document.getElementById('colorPicker');
if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
        selectedColor = e.target.value;
        updateSwatchSelection(selectedColor);
    });
}

// Color swatch row functionality
const colorSwatchRow = document.getElementById('colorSwatchRow');
if (colorSwatchRow) {
    colorSwatchRow.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            selectedColor = swatch.dataset.color;
            colorPicker.value = selectedColor;
            updateSwatchSelection(selectedColor);
        });
    });
}
function updateSwatchSelection(color) {
    if (!colorSwatchRow) return;
    colorSwatchRow.querySelectorAll('.color-swatch').forEach(swatch => {
        if (swatch.dataset.color.toLowerCase() === color.toLowerCase()) {
            swatch.classList.add('selected');
        } else {
            swatch.classList.remove('selected');
        }
    });
}
updateSwatchSelection(selectedColor);

// PDF loading and rendering
document.getElementById('pdfInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    originalPdfBytes = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: originalPdfBytes });
    
    try {
        currentPdf = await loadingTask.promise;
        await renderPDF(currentPdf);
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF. Please try again.');
    }
});

async function renderPDF(pdf) {
    const viewer = document.getElementById('pdfViewer');
    viewer.innerHTML = '';
    textBoxes = [];
    canvasInfo = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.display = 'block';
        canvas.style.position = 'relative';
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        // Wrap canvas in a relative div for absolute annotation placement
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = canvas.width + 'px';
        wrapper.style.height = canvas.height + 'px';
        wrapper.appendChild(canvas);
        document.getElementById('pdfViewer').appendChild(wrapper);
        canvasInfo.push({
            pageNumber: i,
            width: canvas.width,
            height: canvas.height,
            pdfWidth: page.view[2],
            pdfHeight: page.view[3]
        });
        // Add event listeners for text boxes
        canvas.addEventListener('contextmenu', (e) => handleRightClick(e, i, canvas, wrapper));
    }
}

// Helper: measure text size using Canvas API
function measureText(text, font = '12pt Arial') {
    const measureCanvas = document.createElement('canvas');
    const ctx = measureCanvas.getContext('2d');
    ctx.font = font;
    const metrics = ctx.measureText(text);
    // Height approximation: https://stackoverflow.com/a/13318387
    const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || 16;
    return { width: metrics.width, height };
}

let selectedBox = null;
let mode = 'chord'; // 'chord' or 'keychange'

const keyChangeBtn = document.getElementById('keyChangeBtn');
const chordInputBtn = document.getElementById('chordInputBtn');
if (keyChangeBtn && chordInputBtn) {
    keyChangeBtn.addEventListener('click', () => {
        mode = 'keychange';
        keyChangeBtn.classList.add('active');
        chordInputBtn.classList.remove('active');
    });
    chordInputBtn.addEventListener('click', () => {
        mode = 'chord';
        chordInputBtn.classList.add('active');
        keyChangeBtn.classList.remove('active');
    });
    // Default to chord mode
    chordInputBtn.classList.add('active');
}

// Override PDF area right-click to handle both modes
function handleRightClick(e, pageNumber, canvas, wrapper) {
    e.preventDefault();
    // Coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === 'keychange') {
        createKeyChangeLabel(x, y, pageNumber, canvas, wrapper);
    } else {
        createChordBox(x, y, pageNumber, canvas, wrapper);
    }
}

function createKeyChangeLabel(x, y, pageNumber, canvas, wrapper) {
    const label = document.createElement('div');
    label.className = 'keychange-label';
    label.contentEditable = true;
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.dataset.page = pageNumber;
    label.dataset.x = x;
    label.dataset.y = y;
    label.dataset.canvasWidth = canvas.width;
    label.dataset.canvasHeight = canvas.height;
    label.style.minWidth = '0px';
    label.style.minHeight = '0px';
    label.style.width = 'fit-content';
    label.style.height = 'fit-content';
    label.style.cursor = 'grab';
    label.style.borderColor = selectedColor;
    label.dataset.boxColor = selectedColor;

    // Only allow editing on double-click after initial entry
    let firstEdit = true;
    label.addEventListener('dblclick', () => {
        label.contentEditable = true;
        label.focus();
    });
    label.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            label.blur();
        }
    });
    label.addEventListener('blur', () => {
        // Always end with colon
        let txt = label.innerText.trim();
        if (txt && !txt.endsWith(':')) txt += ':';
        label.innerText = txt;
        if (label.innerText.trim() === '') {
            if (label.parentElement) label.parentElement.removeChild(label);
            const idx = textBoxes.findIndex(tb => tb.dom === label);
            if (idx !== -1) textBoxes.splice(idx, 1);
            if (selectedBox === label) selectedBox = null;
        } else {
            updateKeyChangeData();
        }
        label.contentEditable = false;
        label.classList.remove('selected-annotation');
    });
    label.addEventListener('input', () => {
        updateKeyChangeData();
        // Update border color if color changes
        label.style.borderColor = label.dataset.boxColor || selectedColor;
    });
    label.addEventListener('mouseup', updateKeyChangeData);
    label.addEventListener('mousemove', updateKeyChangeData);
    label.addEventListener('mouseenter', () => { label.style.cursor = 'grab'; });
    label.addEventListener('mouseleave', () => { label.style.cursor = 'grab'; });
    label.addEventListener('click', () => {
        if (selectedBox && selectedBox !== label) {
            selectedBox.classList.remove('selected-annotation');
        }
        selectedBox = label;
        label.classList.add('selected-annotation');
    });
    // Drag functionality
    let isDragging = false;
    let offsetX, offsetY;
    label.addEventListener('mousedown', (e) => {
        if (e.button === 0 && !label.isContentEditable) {
            isDragging = true;
            offsetX = e.clientX - label.getBoundingClientRect().left;
            offsetY = e.clientY - label.getBoundingClientRect().top;
            label.style.cursor = 'grabbing';
        }
    });
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onStopDrag);
    function onDrag(e2) {
        if (isDragging) {
            const parentRect = wrapper.getBoundingClientRect();
            let newX = e2.clientX - parentRect.left - offsetX;
            let newY = e2.clientY - parentRect.top - offsetY;
            newX = Math.max(0, Math.min(newX, canvas.width - label.offsetWidth));
            newY = Math.max(0, Math.min(newY, canvas.height - label.offsetHeight));
            label.style.left = `${newX}px`;
            label.style.top = `${newY}px`;
            label.dataset.x = newX;
            label.dataset.y = newY;
            updateKeyChangeData();
        }
    }
    function onStopDrag() {
        if (isDragging) {
            isDragging = false;
            label.style.cursor = 'grab';
        }
    }
    function updateKeyChangeData() {
        const idx = textBoxes.findIndex(tb => tb.dom === label);
        const boxRect = label.getBoundingClientRect();
        const width = boxRect.width;
        const height = boxRect.height;
        const data = {
            text: label.innerText,
            x: parseFloat(label.style.left),
            y: parseFloat(label.style.top),
            width,
            height,
            page: parseInt(label.dataset.page),
            canvasWidth: parseFloat(label.dataset.canvasWidth),
            canvasHeight: parseFloat(label.dataset.canvasHeight),
            dom: label,
            color: label.dataset.boxColor || selectedColor,
            type: 'keychange'
        };
        if (idx === -1) textBoxes.push(data);
        else textBoxes[idx] = data;
    }
    wrapper.appendChild(label);
    label.focus();
    updateKeyChangeData();
}

function createChordBox(x, y, pageNumber, canvas, wrapper) {
    const textBox = document.createElement('div');
    textBox.className = 'text-box';
    textBox.contentEditable = false; // Not editable by default
    textBox.style.position = 'absolute';
    textBox.style.left = `${x}px`;
    textBox.style.top = `${y}px`;
    textBox.dataset.page = pageNumber;
    textBox.dataset.x = x;
    textBox.dataset.y = y;
    textBox.dataset.canvasWidth = canvas.width;
    textBox.dataset.canvasHeight = canvas.height;
    textBox.style.minWidth = '0px';
    textBox.style.minHeight = '0px';
    textBox.style.width = 'fit-content';
    textBox.style.height = 'fit-content';
    textBox.style.backgroundColor = hexToRgba(selectedColor, 0.9);
    textBox.style.border = '1.5px solid #f1c40f';
    textBox.style.padding = '2px 4px';
    textBox.style.whiteSpace = 'pre-wrap';
    textBox.style.font = '12pt Arial';
    textBox.style.fontFamily = 'Arial, Helvetica, sans-serif';
    textBox.style.fontSize = '12pt';
    textBox.style.lineHeight = '1.2';
    textBox.style.boxSizing = 'border-box';
    textBox.style.overflow = 'hidden';
    textBox.style.borderRadius = '8px';
    textBox.style.display = 'inline-block';
    textBox.style.textAlign = 'left';
    textBox.dataset.boxColor = selectedColor;
    textBox.style.cursor = 'grab';

    // Only allow editing on double-click
    textBox.addEventListener('dblclick', (e) => {
        textBox.contentEditable = true;
        textBox.focus();
    });

    // Pressing Enter releases editing
    textBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            textBox.blur();
        }
    });

    // Show move cursor on hover
    textBox.addEventListener('mouseenter', () => {
        textBox.style.cursor = 'grab';
    });
    textBox.addEventListener('mouseleave', () => {
        textBox.style.cursor = 'grab';
    });

    // Select box on click (not double-click)
    textBox.addEventListener('click', (e) => {
        if (selectedBox && selectedBox !== textBox) {
            selectedBox.classList.remove('selected-annotation');
        }
        selectedBox = textBox;
        textBox.classList.add('selected-annotation');
    });

    // Add drag functionality
    let isDragging = false;
    let offsetX, offsetY;
    textBox.addEventListener('mousedown', (e) => {
        if (e.button === 0 && !textBox.isContentEditable) {
            isDragging = true;
            offsetX = e.clientX - textBox.getBoundingClientRect().left;
            offsetY = e.clientY - textBox.getBoundingClientRect().top;
            textBox.style.cursor = 'grabbing';
        }
    });
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onStopDrag);
    function onDrag(e2) {
        if (isDragging) {
            const parentRect = wrapper.getBoundingClientRect();
            let newX = e2.clientX - parentRect.left - offsetX;
            let newY = e2.clientY - parentRect.top - offsetY;
            // Clamp to canvas
            newX = Math.max(0, Math.min(newX, canvas.width - textBox.offsetWidth));
            newY = Math.max(0, Math.min(newY, canvas.height - textBox.offsetHeight));
            textBox.style.left = `${newX}px`;
            textBox.style.top = `${newY}px`;
            textBox.dataset.x = newX;
            textBox.dataset.y = newY;
            updateTextBoxData();
        }
    }
    function onStopDrag() {
        if (isDragging) {
            isDragging = false;
            textBox.style.cursor = 'grab';
        }
    }

    function updateTextBoxData() {
        const idx = textBoxes.findIndex(tb => tb.dom === textBox);
        // Use DOM to get actual size
        const boxRect = textBox.getBoundingClientRect();
        const parentRect = wrapper.getBoundingClientRect();
        const width = boxRect.width;
        const height = boxRect.height;
        const data = {
            text: textBox.innerText,
            x: parseFloat(textBox.style.left),
            y: parseFloat(textBox.style.top),
            width,
            height,
            page: parseInt(textBox.dataset.page),
            canvasWidth: parseFloat(textBox.dataset.canvasWidth),
            canvasHeight: parseFloat(textBox.dataset.canvasHeight),
            dom: textBox,
            color: textBox.dataset.boxColor || '#fff700',
            type: 'chord'
        };
        if (idx === -1) textBoxes.push(data);
        else textBoxes[idx] = data;
    }
    textBox.addEventListener('blur', () => {
        if (textBox.innerText.trim() === '') {
            // Remove from DOM
            if (textBox.parentElement) textBox.parentElement.removeChild(textBox);
            // Remove from textBoxes array
            const idx = textBoxes.findIndex(tb => tb.dom === textBox);
            if (idx !== -1) textBoxes.splice(idx, 1);
            // Deselect if this was selected
            if (selectedBox === textBox) selectedBox = null;
        } else {
            updateTextBoxData();
        }
        textBox.contentEditable = false;
        textBox.classList.remove('selected-annotation');
    });
    textBox.addEventListener('input', updateTextBoxData);
    textBox.addEventListener('mouseup', updateTextBoxData);
    textBox.addEventListener('mousemove', updateTextBoxData);

    wrapper.appendChild(textBox);
    // Start in edit mode for new box
    textBox.contentEditable = true;
    textBox.focus();
    updateTextBoxData();
}

// Listen for Delete key to remove selected box
window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBox && !selectedBox.isContentEditable) {
        if (selectedBox.parentElement) selectedBox.parentElement.removeChild(selectedBox);
        const idx = textBoxes.findIndex(tb => tb.dom === selectedBox);
        if (idx !== -1) textBoxes.splice(idx, 1);
        selectedBox = null;
    }
});

// Download functionality
document.getElementById('downloadBtn').addEventListener('click', async () => {
    if (!currentPdf || !originalPdfBytes) {
        alert('Please upload a PDF first');
        return;
    }
    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.load(originalPdfBytes);
        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helveticaBoldObliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique || StandardFonts.HelveticaOblique);
        const pages = pdfDoc.getPages();
        textBoxes.forEach((tb) => {
            const pageIdx = tb.page - 1;
            const page = pages[pageIdx];
            const pdfWidth = page.getWidth();
            const pdfHeight = page.getHeight();
            const scaleX = pdfWidth / tb.canvasWidth;
            const scaleY = pdfHeight / tb.canvasHeight;
            const pdfX = tb.x * scaleX;
            const pdfY = pdfHeight - (tb.y * scaleY) - (tb.height * scaleY);
            const pdfBoxWidth = tb.width * scaleX;
            const pdfBoxHeight = tb.height * scaleY;
            const borderRadius = 8 * scaleX;
            if (tb.type === 'keychange') {
                // Draw white rounded rectangle with colored border
                const boxColor = tb.color || '#fff700';
                const { r, g, b } = hexToRgb01(boxColor);
                page.drawRectangle({
                    x: pdfX,
                    y: pdfY,
                    width: pdfBoxWidth,
                    height: pdfBoxHeight,
                    color: rgb(1, 1, 1),
                    opacity: 1,
                    borderColor: rgb(r, g, b),
                    borderWidth: 2,
                    borderRadius: borderRadius
                });
                // Draw italic bold text, centered
                const textWidth = helveticaBoldObliqueFont.widthOfTextAtSize(tb.text, 12 * scaleY);
                let textX = pdfX + (pdfBoxWidth - textWidth) / 2;
                if (textX < pdfX + 4 * scaleX) textX = pdfX + 4 * scaleX;
                page.drawText(tb.text, {
                    x: textX,
                    y: pdfY + (pdfBoxHeight - 12 * scaleY) / 2,
                    size: 12 * scaleY,
                    font: helveticaBoldObliqueFont,
                    color: rgb(0.1, 0.1, 0.1),
                    maxWidth: pdfBoxWidth - 8 * scaleX,
                    lineHeight: 12 * scaleY * 1.2,
                });
            } else {
                // Chord box as rounded rectangle with border
                const boxColor = tb.color || '#fff700';
                const { r, g, b } = hexToRgb01(boxColor);
                page.drawRectangle({
                    x: pdfX,
                    y: pdfY,
                    width: pdfBoxWidth,
                    height: pdfBoxHeight,
                    color: rgb(r, g, b),
                    opacity: 0.9,
                    borderColor: rgb(0.95, 0.77, 0.06),
                    borderWidth: 1,
                    borderRadius: borderRadius
                });
                const textPaddingX = 4 * scaleX;
                const textPaddingY = 2 * scaleY;
                const textWidth = helveticaBoldFont.widthOfTextAtSize(tb.text, 12 * scaleY);
                let textX = pdfX + (pdfBoxWidth - textWidth) / 2;
                if (textX < pdfX + textPaddingX) textX = pdfX + textPaddingX;
                page.drawText(tb.text, {
                    x: textX,
                    y: pdfY + (pdfBoxHeight - 12 * scaleY) / 2,
                    size: 12 * scaleY,
                    font: helveticaBoldFont,
                    color: rgb(0, 0, 0),
                    maxWidth: pdfBoxWidth - 2 * textPaddingX,
                    lineHeight: 12 * scaleY * 1.2,
                });
            }
        });
        const modifiedPdfBytes = await pdfDoc.save();
        const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'annotated-pdf.pdf';
        link.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error saving PDF:', error);
        alert('Error saving PDF. Please try again.');
    }
});

// Helper: wrap text for PDF
function wrapText(text, font, fontSize, maxWidth) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    for (let i = 0; i < words.length; i++) {
        let testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
        let width = font.widthOfTextAtSize(testLine, fontSize);
        if (width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);
    // Ellipsis if too many lines
    const maxLines = 3;
    if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = lines[maxLines - 1].replace(/(.{3})$/, '...');
    }
    return lines;
}

// Helper: convert hex to rgba string
function hexToRgba(hex, alpha = 1) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

// Helper: convert hex to {r,g,b} in 0-1 range
function hexToRgb01(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const num = parseInt(c, 16);
    return {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255
    };
}
