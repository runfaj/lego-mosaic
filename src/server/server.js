const path = require('path');
const Jimp = require('jimp');

const desiredResolution = {
  height: 32,
  width: 32,
  fillWith: [0,0,0,255],
  doCircles: true,
};
const inFileName = 'meh.jpg';
const outFileName = 'temp/test3.png';

const startTime = new Date();

Jimp.read(path.join(__dirname, inFileName), (err, image) => {
  if (err) throw err;

  // fine, but doesn't have threshold logic I want
  //image.resize(32, 32).write(path.join(__dirname, 'resized.png'));
  //return;

  const imgWidth = image.bitmap.width;
  const imgHeight = image.bitmap.height;

  if (imgWidth % desiredResolution.width !== 0) {
    // it will need to fill empty width pixels
  }
  if (imgHeight % desiredResolution.height !== 0) {
    // it will need to fill empty width pixels
  }

  const blockSizes = generateBlocks(imgWidth, imgHeight);
  fillAverages(blockSizes, image, imgWidth, imgHeight);
  let outputPixels;
  if (desiredResolution.doCircles) {
    outputPixels = createCircles(blockSizes);
  } else {
    outputPixels = createSquares(blockSizes);
  }
  compileImage(outputPixels, imgWidth, imgHeight);
});

function generateBlocks(imgWidth, imgHeight) {
  //// for now, assuming it matches up properly
  //// also assuming down scaling
  // get lower end of pixels for each section (e.g. 1 pixel in our desired result = N pixels in given image)
  let wPixels = Math.floor(imgWidth / desiredResolution.width); // 18
  let hPixels = Math.floor(imgHeight / desiredResolution.height);
  // get remainder so we can assign those to the blocks
  let widthRemainder = imgWidth % desiredResolution.width;
  let heightRemainder = imgHeight % desiredResolution.height;

  // 19 19 19 ... 19 19 18 18 ...
  
  // set up our blocks with initial sizes
  /*
    [
      [1,2,3,...],
      [1,2,3,...],
      ...
    ]
  */
  const blockSizes = new Array(desiredResolution.height);
  for(let row=0; row<blockSizes.length; row++) {
    blockSizes[row] = new Array(desiredResolution.width);
    for(let column=0; column<blockSizes[row].length; column++) {
      blockSizes[row][column] = { width: wPixels, height: hPixels, averages: { r: 0, g: 0, b: 0, idx: 0 } };
    }
  }

  // loop through all columns and add the extra width pixels until remainder is used up
  let colIdx = 0;
  while(widthRemainder > 0) {
    for(let row=0; row < desiredResolution.width; row++) {
      blockSizes[row][colIdx].width += 1;
    }
    widthRemainder -= 1;
    colIdx++;
  }
  // loop through all rows and add the extra height pixels until remainder is used up
  let rowIdx = 0;
  while(heightRemainder > 0) {
    for(let column=0; column < desiredResolution.height; column++) {
      blockSizes[rowIdx][column].height += 1;
    }
    heightRemainder -= 1;
    rowIdx++;
  }
  return blockSizes;
}

function fillAverages(blockSizes, image, imgWidth, imgHeight) {
  // start scanning image
  let row = 0, column = 0, currX = 0, currY = 0;
  image.scan(0, 0, imgWidth, imgHeight, function(x, y, bufferIdx) {
    const currentBlock = blockSizes[row][column];
    // x, y is the position of this pixel on the image
    // bufferIdx is the position start position of this rgba tuple in the bitmap Buffer
    // this is the image

    const color = getColor(this.bitmap.data, bufferIdx);
  
    
    // put unique colors in array above
    // then see if 3 or less colors. Determine if one is prominent over the others
    // if so, pick that one instead
    
    /*
      if (uniqueColors.r.indexOf(color.r) === -1) {
        uniqueColors.r.push(color.r);
      }
      if (uniqueColors.g.indexOf(color.g) === -1) {
        uniqueColors.g.push(color.g);
      }
      if (uniqueColors.b.indexOf(color.b) === -1) {
        uniqueColors.b.push(color.b);
      }
    */

    //console.log(row, column, x, y, color.r, color.g, color.b)
    
    currentBlock.averages.r += color.r;
    currentBlock.averages.g += color.g;
    currentBlock.averages.b += color.b;
    currentBlock.averages.idx += 1;

    if (x == currX + currentBlock.width) {
      currX += currentBlock.width;
      column += 1;
    }
    if (x == imgWidth - 1) {
      column = 0;
      currX = 0;
    }
    if (y == currY + currentBlock.height) {
      currY += currentBlock.height;
      row += 1;
    }
  });

  for(let row=0; row < blockSizes.length; row++) {
    for(let column=0; column < blockSizes[row].length; column++) {
      const currentBlock = blockSizes[row][column];
      const total = currentBlock.width * currentBlock.height;
      currentBlock.averages.r = Math.round(currentBlock.averages.r / total);
      currentBlock.averages.g = Math.round(currentBlock.averages.g / total);
      currentBlock.averages.b = Math.round(currentBlock.averages.b / total);
    }
  }
}

function compileImage(inputPixelArray, imgWidth, imgHeight) {
  // compile new image
  const buffer = Buffer.from(inputPixelArray);
  const newImage = new Jimp({
    data: buffer,
    width: imgWidth,//desiredResolution.width,
    height: imgHeight//desiredResolution.height
  }, (err, img) => {
    img.write(path.join(__dirname, outFileName));

    const endTime = new Date();
    console.log((endTime.valueOf() - startTime.valueOf()) / 1000);
  });
}

function createCircles(blocks) {
  const output = [];

  for(let row = 0; row < blocks.length; row++) {
    for(let col = 0; col < blocks[row].length; col++) {
      blocks[row][col].outputPixels = drawCircle(blocks[row][col]);
    }
  }
  for(let row = 0; row < blocks.length; row++) {
    const blockRows = blocks[row][0].height;
    for(let blockRow = 0; blockRow < blockRows; blockRow++) {
      for(let col = 0; col < blocks[row].length; col++) {
        output.push(blocks[row][col].outputPixels[blockRow]);
      }
    }
  }

  return flattenArray(output);
}

function createSquares(blocks) {
  const pixelArr = [];
  
  for(let row = 0; row < blocks.length; row++) {
    const blockRows = blocks[row][0].height;
    
    for(let blockRow = 0; blockRow < blockRows; blockRow++) {
      for(let col = 0; col < blocks[row].length; col++) {
        const block = blocks[row][col];
        for(let blockCell = 0; blockCell < block.width; blockCell++) {
          pixelArr.push(
            block.averages.r,
            block.averages.g,
            block.averages.b,
            255
          );
        }
      }
    }
  }
  return pixelArr;
}

function getColor(data, bufferIdx) {
  let color = {
    r: data[bufferIdx + 0],
    g: data[bufferIdx + 1],
    b: data[bufferIdx + 2],
    a: data[bufferIdx + 3] / 255,
  };
  return rgba2rgb({
    r: desiredResolution.fillWith[0],
    g: desiredResolution.fillWith[1],
    b: desiredResolution.fillWith[2],
  }, color);
}

function flattenArray(arr) {
  return [].concat.apply([], arr);
}

function rgba2rgb(RGB_background, RGBA_color) {
  const alpha = RGBA_color.a;

  return {
    r: (1 - alpha) * RGB_background.r + alpha * RGBA_color.r,
    g: (1 - alpha) * RGB_background.g + alpha * RGBA_color.g,
    b: (1 - alpha) * RGB_background.b + alpha * RGBA_color.b
  };
}

function getBlock(x, y, blocks) {
  let pixelX = 0;
  let pixelY = 0;
  for(let row=0; row < blocks.length; row++) {
    const blockRow = blocks[row];
    const startY = pixelY;
    for(let column=0; column < blockRow.length; column++) {
      const block = blockRow[column];
      const startX = pixelX;
      const endX = pixelX + block.width;
      const endY = pixelY + block.height;

      if (x >= startX && x < endX
        && y >= startY && y < endY
      ) {
        return block;
      }
      
      pixelX += block.width;
    }
    pixelY += blockRow[0].height;
  }
}

function drawCircle(block) {
  const color = [block.averages.r, block.averages.g, block.averages.b, 255];
  const radius = Math.floor((block.width + block.height) / 2 / 2);
  const centerX = Math.floor(block.width / 2);
  const centerY = Math.floor(block.height / 2);
  const isInCircle = (x, y) => ((x - centerX)**2 + (y - centerY)**2) < (radius**2);
  const output = [];
  
  // populate colors
  for(let row = 0; row < block.height; row++) {
    const rowOutput = [];
    for(let col = 0; col < block.width; col++) {
      rowOutput.push(isInCircle(col, row)
        ? color.slice()
        : desiredResolution.fillWith.slice()
      );
    }
    output.push(flattenArray(rowOutput))
  }
  return output;
}