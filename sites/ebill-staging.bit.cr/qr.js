// Structure follows Project Nayuki's reference implementation (MIT).
(() => {
  "use strict";

  // Indexed by version; -1 pads version 0.
  const ECC_CODEWORDS_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  };
  const NUM_ERROR_CORRECTION_BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  };
  const FORMAT_BITS = { L: 1, M: 0 };
  const PENALTY_N1 = 3;
  const PENALTY_N2 = 3;
  const PENALTY_N3 = 40;
  const PENALTY_N4 = 10;

  const getBit = (value, index) => ((value >>> index) & 1) !== 0;

  function numRawDataModules(version) {
    let result = (16 * version + 128) * version + 64;
    if (version >= 2) {
      const numAlign = Math.floor(version / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (version >= 7) result -= 36;
    }
    return result;
  }

  function numDataCodewords(version, ecl) {
    return Math.floor(numRawDataModules(version) / 8) -
      ECC_CODEWORDS_PER_BLOCK[ecl][version] * NUM_ERROR_CORRECTION_BLOCKS[ecl][version];
  }

  function reedSolomonMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function reedSolomonComputeDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = reedSolomonMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = reedSolomonMultiply(root, 0x02);
    }
    return result;
  }

  function reedSolomonComputeRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const byte of data) {
      const factor = byte ^ result.shift();
      result.push(0);
      divisor.forEach((coefficient, i) => {
        result[i] ^= reedSolomonMultiply(coefficient, factor);
      });
    }
    return result;
  }

  function encodeData(bytes, version, ecl) {
    const bits = [];
    const append = (value, length) => {
      for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    };
    append(0x4, 4);
    append(bytes.length, version <= 9 ? 8 : 16);
    for (const byte of bytes) append(byte, 8);

    const capacityBits = numDataCodewords(version, ecl) * 8;
    append(0, Math.min(4, capacityBits - bits.length));
    append(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) append(pad, 8);

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      codewords.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
    }
    return codewords;
  }

  function addEccAndInterleave(data, version, ecl) {
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][version];
    const blockEccLength = ECC_CODEWORDS_PER_BLOCK[ecl][version];
    const rawCodewords = Math.floor(numRawDataModules(version) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLength = Math.floor(rawCodewords / numBlocks);
    const divisor = reedSolomonComputeDivisor(blockEccLength);

    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const block = data.slice(k, k + shortBlockLength - blockEccLength + (i < numShortBlocks ? 0 : 1));
      k += block.length;
      const ecc = reedSolomonComputeRemainder(block, divisor);
      if (i < numShortBlocks) block.push(0);
      blocks.push(block.concat(ecc));
    }

    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLength - blockEccLength || j >= numShortBlocks) result.push(block[i]);
      });
    }
    return result;
  }

  function alignmentPatternPositions(version, size) {
    if (version === 1) return [];
    const numAlign = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let position = size - 7; result.length < numAlign; position -= step) {
      result.splice(1, 0, position);
    }
    return result;
  }

  function buildMatrix(codewords, version, ecl) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFunction = (x, y, dark) => {
      modules[y][x] = dark;
      isFunction[y][x] = true;
    };

    function drawFormatBits(mask) {
      const data = (FORMAT_BITS[ecl] << 3) | mask;
      let remainder = data;
      for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
      const bits = ((data << 10) | remainder) ^ 0x5412;

      for (let i = 0; i <= 5; i++) setFunction(8, i, getBit(bits, i));
      setFunction(8, 7, getBit(bits, 6));
      setFunction(8, 8, getBit(bits, 7));
      setFunction(7, 8, getBit(bits, 8));
      for (let i = 9; i < 15; i++) setFunction(14 - i, 8, getBit(bits, i));

      for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, getBit(bits, i));
      for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, getBit(bits, i));
      setFunction(8, size - 8, true);
    }

    for (let i = 0; i < size; i++) {
      setFunction(6, i, i % 2 === 0);
      setFunction(i, 6, i % 2 === 0);
    }

    for (const [centerX, centerY] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          const x = centerX + dx;
          const y = centerY + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            setFunction(x, y, distance !== 2 && distance !== 4);
          }
        }
      }
    }

    const alignment = alignmentPatternPositions(version, size);
    const last = alignment.length - 1;
    alignment.forEach((centerX, i) => {
      alignment.forEach((centerY, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            setFunction(centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      });
    });

    drawFormatBits(0);

    if (version >= 7) {
      let remainder = version;
      for (let i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
      const bits = (version << 12) | remainder;
      for (let i = 0; i < 18; i++) {
        const dark = getBit(bits, i);
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunction(a, b, dark);
        setFunction(b, a, dark);
      }
    }

    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vertical : vertical;
          if (!isFunction[y][x] && bitIndex < codewords.length * 8) {
            modules[y][x] = getBit(codewords[bitIndex >>> 3], 7 - (bitIndex & 7));
            bitIndex++;
          }
        }
      }
    }

    const maskConditions = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    function applyMask(mask) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (!isFunction[y][x] && maskConditions[mask](x, y)) modules[y][x] = !modules[y][x];
        }
      }
    }

    function finderPenaltyCountPatterns(history) {
      const n = history[1];
      const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
      return (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) +
        (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0);
    }
    function finderPenaltyAddHistory(runLength, history) {
      history.pop();
      history.unshift(history[0] === 0 ? runLength + size : runLength);
    }
    function finderPenaltyTerminateAndCount(runColor, runLength, history) {
      if (runColor) {
        finderPenaltyAddHistory(runLength, history);
        runLength = 0;
      }
      finderPenaltyAddHistory(runLength + size, history);
      return finderPenaltyCountPatterns(history);
    }
    function linePenalty(get) {
      let result = 0;
      for (let a = 0; a < size; a++) {
        let runColor = false;
        let runLength = 0;
        const history = [0, 0, 0, 0, 0, 0, 0];
        for (let b = 0; b < size; b++) {
          if (get(a, b) === runColor) {
            runLength++;
            if (runLength === 5) result += PENALTY_N1;
            else if (runLength > 5) result++;
          } else {
            finderPenaltyAddHistory(runLength, history);
            if (!runColor) result += finderPenaltyCountPatterns(history) * PENALTY_N3;
            runColor = get(a, b);
            runLength = 1;
          }
        }
        result += finderPenaltyTerminateAndCount(runColor, runLength, history) * PENALTY_N3;
      }
      return result;
    }
    function penaltyScore() {
      let result = linePenalty((y, x) => modules[y][x]) + linePenalty((x, y) => modules[y][x]);
      let dark = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (modules[y][x]) dark++;
          if (y < size - 1 && x < size - 1) {
            const color = modules[y][x];
            if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) {
              result += PENALTY_N2;
            }
          }
        }
      }
      const total = size * size;
      result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * PENALTY_N4;
      return result;
    }

    let bestMask = 0;
    let minPenalty = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      applyMask(mask);
      drawFormatBits(mask);
      const penalty = penaltyScore();
      if (penalty < minPenalty) {
        bestMask = mask;
        minPenalty = penalty;
      }
      applyMask(mask);
    }
    applyMask(bestMask);
    drawFormatBits(bestMask);

    return modules;
  }

  function encodeText(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    for (let version = 1; version <= 40; version++) {
      const usedBits = 4 + (version <= 9 ? 8 : 16) + bytes.length * 8;
      if (usedBits > numDataCodewords(version, "L") * 8) continue;
      // Prefer the stronger level when it fits the same symbol size.
      const ecl = usedBits <= numDataCodewords(version, "M") * 8 ? "M" : "L";
      const codewords = addEccAndInterleave(encodeData(bytes, version, ecl), version, ecl);
      return buildMatrix(codewords, version, ecl);
    }
    return null;
  }

  globalThis.bitcreditQr = Object.freeze({ encodeText });
})();
