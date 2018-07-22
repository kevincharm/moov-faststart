[![Build Status](https://travis-ci.org/kevincharm/moov-faststart.svg?branch=master)](https://travis-ci.org/kevincharm/moov-faststart)

# moov-faststart

Re-orders moov atoms in mp4 containers to enable streaming. Based on [qt-faststart](https://github.com/FFmpeg/FFmpeg/blob/master/tools/qt-faststart.c), but works with a `Buffer` interface.

⚠️ Requires Node >10.4 (V8 6.7) for `BigInt` support!

## Installation

Get it via npm:
```sh
npm install --save moov-faststart
```
or yarn:
```sh
yarn add moov-faststart
```

## Usage

```js
import { faststart } from 'moov-faststart'
import * as fs from 'fs'

// Get a Buffer containing unstreamable MP4...
const mp4File = fs.readFileSync('./unstreamable.mp4')

// Faststart it!
const faststartedMp4 = faststart(mp4File)

// Write out the Buffer containing the faststarted MP4. Done!
fs.writeFileSync('./streamable.mp4', faststartedMp4)
```
