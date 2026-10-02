import test from 'node:test';import assert from 'node:assert/strict';import {engineOrder} from '../backend/engine-order.mjs';
test('fallbacks use only declared engines, preserve stable priority and bound attempts',()=>{
 assert.deepEqual(engineOrder(['calibre','libreoffice','pandoc']),['libreoffice','pandoc','calibre']);
 assert.deepEqual(engineOrder(['imagemagick','graphicsmagick']),['imagemagick','graphicsmagick']);
 assert.deepEqual(engineOrder(['ffmpeg','vips','resvg','imaginary']),['resvg','vips','ffmpeg']);
 assert.deepEqual(engineOrder([]),[]);
});
