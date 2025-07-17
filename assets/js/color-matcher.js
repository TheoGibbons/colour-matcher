// Global variables
let imageCanvas = document.getElementById('imageCanvas');
let drawingCanvas = document.getElementById('drawingCanvas');
let imageCtx = imageCanvas.getContext('2d');
let drawingCtx = drawingCanvas.getContext('2d');
let image = new Image();
let squares = [];
let isDrawing = false;
let startX, startY;
let analyzedColors = [];
let averageColorSpan = document.getElementById('average-color');

// Load default image when page loads
window.addEventListener('DOMContentLoaded', loadDefaultImage);

// Event listeners
document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
document.getElementById('drawingCanvas').addEventListener('mousedown', startDrawingSquare);
document.getElementById('drawingCanvas').addEventListener('mousemove', drawSquare);
document.getElementById('drawingCanvas').addEventListener('mouseup', endDrawingSquare);
document.getElementById('undoButton').addEventListener('click', undoLastSquare);
document.getElementById('clearButton').addEventListener('click', clearAllSquares);
document.getElementById('addColorButton').addEventListener('click', addColorPicker);

// Event delegation for dynamic elements
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('remove-color')) {
    e.target.closest('.color-item').remove();
  }
});

// Color input change handlers
document.addEventListener('input', function (e) {
  if (e.target.classList.contains('color-picker')) {
    const colorItem = e.target.closest('.color-item');
    const preview = colorItem.querySelector('.color-preview');
    const hexSpan = colorItem.querySelector('.color-hex');

    preview.style.backgroundColor = e.target.value;
    hexSpan.textContent = e.target.value;

    // Automatically find matches when a color is changed
    if (analyzedColors.length > 0) {
      findColorMatches();
    }
  }
});

// Handle image upload
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    image.onload = function () {
      // Set canvas dimensions to match the image
      const maxWidth = window.innerWidth - 40;
      const maxHeight = Math.max(window.innerHeight, 2000);

      // Calculate scaling to fit within max dimensions while preserving aspect ratio
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);

      const canvasWidth = image.width * scale;
      const canvasHeight = image.height * scale;

      // Set both canvases to the same size
      imageCanvas.width = canvasWidth;
      imageCanvas.height = canvasHeight;
      drawingCanvas.width = canvasWidth;
      drawingCanvas.height = canvasHeight;

      // Draw the image on the image canvas
      imageCtx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

      // Show the canvas container and colors section
      document.getElementById('canvasContainer').style.display = 'block';
      document.getElementById('colorsSection').style.display = 'block';

      // Clear any previous squares and analyzed colors
      squares = [];
      analyzedColors = [];
      redrawSquares();

      // Clear the results section
      const squaresList = document.getElementById('squaresList');
      if (squaresList) {
        squaresList.innerHTML = '';
      }

      // Reset any matches in the color picker section
      document.querySelectorAll('.match-result').forEach(result => {
        result.style.display = 'none';
      });

      // Hide the results section until new squares are drawn
      document.getElementById('resultsSection').style.display = 'none';
    };
    image.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// Square drawing functions
function startDrawingSquare(e) {
  isDrawing = true;
  const rect = drawingCanvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
}

function drawSquare(e) {
  if (!isDrawing) return;

  const rect = drawingCanvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  // Clear the drawing canvas and redraw all squares
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

  // Draw all existing squares
  redrawSquares();

  // Draw the current square being created
  drawingCtx.strokeStyle = '#FF0000';
  drawingCtx.lineWidth = 2;
  const width = currentX - startX;
  const height = currentY - startY;
  drawingCtx.strokeRect(startX, startY, width, height);
}

function endDrawingSquare(e) {
  if (!isDrawing) return;
  isDrawing = false;

  const rect = drawingCanvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;

  // Create a new square object
  const newSquare = {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
    id: Date.now()
  };

  // Only add if the square has some reasonable size
  if (newSquare.width > 5 && newSquare.height > 5) {
    squares.push(newSquare);

    // Auto analyze this square immediately
    const imageData = imageCtx.getImageData(
      newSquare.x, newSquare.y, newSquare.width, newSquare.height
    );

    // Analyze the color
    const averageColor = analyzeColor(imageData);

    // Store the color
    newSquare.averageColor = averageColor;

    // Add to analyzed colors
    analyzedColors.push({
      id: newSquare.id,
      index: squares.length - 1,
      color: averageColor,
      square: newSquare
    });

    // Update display
    redrawSquares();
    displayResults();

    // Update the average color display
    updateAverageColor();

    // Show the results section if not already visible
    document.getElementById('resultsSection').style.display = 'block';

    // Auto find closest matches whenever a new square is added
    findColorMatches();
  }
}

function redrawSquares() {
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

  squares.forEach((square, index) => {
    drawingCtx.strokeStyle = '#FF0000';
    drawingCtx.lineWidth = 2;
    drawingCtx.strokeRect(square.x, square.y, square.width, square.height);

    // If the square has an analyzed color, display it with the number
    if (square.averageColor) {
      const hexText = `${index + 1}: ${square.averageColor}`;

      // Draw color value below the square
      drawingCtx.fillStyle = 'white';
      drawingCtx.fillRect(
        square.x,
        square.y + square.height + 2,
        hexText.length * 8,
        20
      );
      drawingCtx.fillStyle = 'black';
      drawingCtx.fillText(
        hexText,
        square.x + 2,
        square.y + square.height + 16
      );
    } else {
      // If square doesn't have a color yet (should rarely happen now with auto-analyze)
      // Add a small number label in the top-left corner
      drawingCtx.fillStyle = 'white';
      drawingCtx.fillRect(square.x, square.y, 20, 20);
      drawingCtx.fillStyle = 'black';
      drawingCtx.font = '12px Arial';
      drawingCtx.fillText((index + 1).toString(), square.x + 5, square.y + 14);
    }
  });
}

function undoLastSquare() {
  if (squares.length > 0) {
    const removedSquare = squares.pop();

    // Remove the corresponding color from analyzedColors
    analyzedColors = analyzedColors.filter(item => item.square.id !== removedSquare.id);

    redrawSquares();

    // Update the average color display
    updateAverageColor();
  }
}

function clearAllSquares() {
  squares = [];
  analyzedColors = [];
  redrawSquares();

  // Update the average color display
  updateAverageColor();

  // Also hide the results section
  document.getElementById('resultsSection').style.display = 'none';
}

function analyzeColor(imageData) {
  const pixels = imageData.data;

  // Collect all pixels
  let allPixels = [];
  for (let i = 0; i < pixels.length; i += 4) {
    // Skip fully transparent pixels
    if (pixels[i + 3] < 128) continue;

    allPixels.push({
      r: pixels[i],
      g: pixels[i + 1],
      b: pixels[i + 2],
      brightness: (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
    });
  }

  if (allPixels.length === 0) return '#FFFFFF';

  // Sort by brightness
  allPixels.sort((a, b) => a.brightness - b.brightness);

  // Remove the darkest and lightest 20%
  if (allPixels.length > 100) {
    const startIndex = Math.floor(allPixels.length * 0.2);
    const endIndex = Math.floor(allPixels.length * 0.8);
    allPixels = allPixels.slice(startIndex, endIndex);
  }

  if (allPixels.length === 0) return '#FFFFFF';

  // Calculate average of remaining pixels
  let r = 0, g = 0, b = 0;
  allPixels.forEach(pixel => {
    r += pixel.r;
    g += pixel.g;
    b += pixel.b;
  });

  r = Math.round(r / allPixels.length);
  g = Math.round(g / allPixels.length);
  b = Math.round(b / allPixels.length);

  // Convert to hex
  return rgbToHex(r, g, b);
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Display and match functions
function displayResults() {
  const squaresList = document.getElementById('squaresList');
  squaresList.innerHTML = '';

  analyzedColors.forEach(item => {
    const squareDiv = document.createElement('div');
    squareDiv.className = 'square-item';
    squareDiv.dataset.id = item.square.id;

    const colorDiv = document.createElement('div');
    colorDiv.className = 'square-color';
    colorDiv.style.backgroundColor = item.color;

    const labelDiv = document.createElement('div');
    labelDiv.textContent = `Square ${item.index + 1}`;

    const hexDiv = document.createElement('div');
    hexDiv.textContent = item.color;

    squareDiv.appendChild(colorDiv);
    squareDiv.appendChild(labelDiv);
    squareDiv.appendChild(hexDiv);

    squaresList.appendChild(squareDiv);
  });
}

function addColorPicker() {
  const colorTableBody = document.getElementById('colorTableBody');
  const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

  const newRow = document.createElement('tr');
  newRow.className = 'color-item';
  newRow.innerHTML = `
    <td><input type="color" class="color-picker" value="${randomColor}"></td>
    <td><div class="color-preview" style="background-color: ${randomColor};"></div></td>
    <td><span class="color-hex">${randomColor}</span></td>
    <td><button class="remove-color">Remove</button></td>
    <td>
      <div class="match-result" style="display: none;">
        <div class="match-preview" style="width: 30px; height: 30px; border: 1px solid #ccc; display: inline-block; margin: 0 5px;"></div>
        <span class="match-info"></span>
      </div>
    </td>
  `;

  // Add the new row to the table
  colorTableBody.appendChild(newRow);

  // Auto find closest matches after adding a new color
  if (analyzedColors.length > 0) {
    findColorMatches();
  }
}

function findColorMatches() {
  if (analyzedColors.length === 0) {
    alert('Please analyze the squares first.');
    return;
  }

  // Reset previous matches
  document.querySelectorAll('.square-item').forEach(item => {
    item.classList.remove('matched');
    const matchDiv = item.querySelector('.match-percentage');
    if (matchDiv) {
      matchDiv.style.display = 'none';
      matchDiv.textContent = 'Match: 0%';
    }
  });

  // Reset previous match results in the color picker section
  document.querySelectorAll('.match-result').forEach(result => {
    result.style.display = 'none';
  });

  // Get all color pickers
  const colorPickers = document.querySelectorAll('.color-picker');

  colorPickers.forEach(picker => {
    const targetColor = picker.value;
    const targetRgb = hexToRgb(targetColor);
    const colorItem = picker.closest('.color-item');
    const matchResult = colorItem.querySelector('.match-result');
    const matchPreview = matchResult.querySelector('.match-preview');
    const matchInfo = matchResult.querySelector('.match-info');

    if (!targetRgb) return;

    // Find the closest match
    let closestMatch = null;
    let closestDistance = Infinity;

    // Track all matches and their distances for percentage calculation
    const matches = [];

    // Maximum possible RGB distance is sqrt(255^2 + 255^2 + 255^2) = sqrt(195075) ≈ 441.67
    const MAX_DISTANCE = Math.sqrt(3 * Math.pow(255, 2));

    analyzedColors.forEach(colorItem => {
      const squareRgb = hexToRgb(colorItem.color);
      if (!squareRgb) return;

      // Calculate color distance (simple Euclidean distance in RGB space)
      const distance = Math.sqrt(
        Math.pow(targetRgb.r - squareRgb.r, 2) +
        Math.pow(targetRgb.g - squareRgb.g, 2) +
        Math.pow(targetRgb.b - squareRgb.b, 2)
      );

      // Calculate match percentage (0% = max distance, 100% = perfect match)
      const matchPercentage = Math.round((1 - (distance / MAX_DISTANCE)) * 100);

      // Store this match info
      matches.push({
        id: colorItem.square.id,
        distance: distance,
        percentage: matchPercentage,
        colorItem: colorItem
      });

      if (distance < closestDistance) {
        closestDistance = distance;
        closestMatch = colorItem;
      }
    });

    // Sort matches by distance (closest first)
    matches.sort((a, b) => a.distance - b.distance);

    // Show match percentages for all squares that have a reasonable match (above 70%)
    matches.forEach(match => {
      if (match.percentage >= 70) {
        const matchElement = document.querySelector(`.square-item[data-id="${match.id}"]`);
        if (matchElement) {
          const matchDiv = matchElement.querySelector('.match-percentage');
          if (matchDiv) {
            matchDiv.textContent = `Match: ${match.percentage}%`;
            matchDiv.style.display = 'block';
          }
        }
      }
    });

    // Highlight the closest match in results section
    if (closestMatch) {
      const matchedElement = document.querySelector(`.square-item[data-id="${closestMatch.square.id}"]`);
      if (matchedElement) {
        matchedElement.classList.add('matched');
        // Always show percentage for the best match
        const matchDiv = matchedElement.querySelector('.match-percentage');
        if (matchDiv) {
          const percentage = Math.round((1 - (closestDistance / MAX_DISTANCE)) * 100);
          matchDiv.textContent = `Match: ${percentage}%`;
          matchDiv.style.display = 'block';
          // Make the best match percentage bold
          matchDiv.style.fontWeight = 'bold';
        }
      }

      // // Also highlight in the canvas
      // drawingCtx.save();
      // drawingCtx.lineWidth = 4;
      // drawingCtx.strokeStyle = targetColor;
      // drawingCtx.strokeRect(
      //   closestMatch.square.x - 4,
      //   closestMatch.square.y - 4,
      //   closestMatch.square.width + 8,
      //   closestMatch.square.height + 8
      // );

      // Add percentage text near the highlighted square in the canvas
      const percentage = Math.round((1 - (closestDistance / MAX_DISTANCE)) * 100);
      // const text = `${percentage}%`;
      // drawingCtx.font = 'bold 14px Arial';
      // drawingCtx.fillStyle = 'white';
      // drawingCtx.fillRect(
      //   closestMatch.square.x + closestMatch.square.width + 5,
      //   closestMatch.square.y,
      //   text.length * 10,
      //   20
      // );
      // drawingCtx.fillStyle = 'black';
      // drawingCtx.fillText(
      //   text,
      //   closestMatch.square.x + closestMatch.square.width + 10,
      //   closestMatch.square.y + 15
      // );

      drawingCtx.restore();

      // Display match in the color picker section
      if (matchResult) {
        matchResult.style.display = 'flex';
        matchPreview.style.backgroundColor = closestMatch.color;
        matchInfo.textContent = `Square ${closestMatch.index + 1}: ${closestMatch.color} (${percentage}% match)`;
      }
    }
  });
}

// Function to load the default image
function loadDefaultImage() {
  const defaultImagePath = 'assets/images/yarns.png';

  // Set the image source
  image.onload = function() {
    // Set canvas dimensions to match the image
    const maxWidth = window.innerWidth - 40;
    const maxHeight = Math.max(window.innerHeight, 2000);

    // Calculate scaling to fit within max dimensions while preserving aspect ratio
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);

    const canvasWidth = image.width * scale;
    const canvasHeight = image.height * scale;

    // Set both canvases to the same size
    imageCanvas.width = canvasWidth;
    imageCanvas.height = canvasHeight;
    drawingCanvas.width = canvasWidth;
    drawingCanvas.height = canvasHeight;

    // Draw the image on the image canvas
    imageCtx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

    // Show the canvas container and colors section
    document.getElementById('canvasContainer').style.display = 'block';
    document.getElementById('colorsSection').style.display = 'block';

    // Clear any previous squares
    squares = [];
    redrawSquares();
  };

  // Handle any errors loading the image
  image.onerror = function() {
    console.error('Error loading default image');
  };

  image.src = defaultImagePath;
}

// Function to calculate and display the average color of all squares
function updateAverageColor() {
  // Check if we have any analyzed colors
  if (analyzedColors.length === 0) {
    // No colors to average, clear the display
    averageColorSpan.innerHTML = '';
    return;
  }

  // Convert all hex colors to RGB for averaging
  let totalR = 0, totalG = 0, totalB = 0;

  analyzedColors.forEach(item => {
    const rgb = hexToRgb(item.color);
    if (rgb) {
      totalR += rgb.r;
      totalG += rgb.g;
      totalB += rgb.b;
    }
  });

  // Calculate the average RGB values
  const avgR = Math.round(totalR / analyzedColors.length);
  const avgG = Math.round(totalG / analyzedColors.length);
  const avgB = Math.round(totalB / analyzedColors.length);

  // Convert back to hex
  const avgColorHex = rgbToHex(avgR, avgG, avgB);

  // Create a visual display with the color swatch and hex value
  averageColorSpan.innerHTML = `
    Average Colour Across All Squares:
    <span style="display: inline-block; vertical-align: middle; margin-left: 10px; background-color: ${avgColorHex}; width: 20px; height: 20px; border: 1px solid #ccc;"></span>
    <span style="margin-left: 5px; vertical-align: middle;">${avgColorHex}</span>
  `;
}
